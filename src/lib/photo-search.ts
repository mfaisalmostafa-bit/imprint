/**
 * Confidence layer over Photo Search. Does not replace the matcher.
 * Refuses to rank a photo it cannot see. Never paints 40% as a lock.
 */

import type { PhotoBuf } from "./photo-check";
import { MOCKUPS } from "./mockups";

export type SearchHit = {
  sku: string;
  name: string;
  src: string;
  score: number;
};

export type SearchRefusal = {
  judged: false;
  code: "blur" | "dark" | "empty" | "far";
  why: string;
};

export type SearchAnswer =
  | {
      judged: true;
      kind: "winner" | "cluster" | "weak";
      hits: SearchHit[];
      note: string;
    }
  | SearchRefusal;

/** Honest bands. A 0.40 top hit is not a lock. Leaders within CLUSTER are inseparable. */
export const SEARCH_BANDS = {
  WIN: 0.82,
  WEAK: 0.55,
  CLUSTER: 0.06,
} as const;

function lumMean(buf: PhotoBuf) {
  let s = 0;
  const n = buf.w * buf.h;
  const step = Math.max(1, Math.floor(n / 3000));
  let c = 0;
  for (let i = 0; i < n; i += step) {
    const p = i * 4;
    s += 0.2126 * (buf.data[p] ?? 0) + 0.7152 * (buf.data[p + 1] ?? 0) + 0.0722 * (buf.data[p + 2] ?? 0);
    c++;
  }
  return c ? s / c : 0;
}

function laplace(buf: PhotoBuf) {
  const w = buf.w;
  const h = buf.h;
  let acc = 0;
  let n = 0;
  const step = Math.max(1, Math.round(Math.min(w, h) / 80));
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return 0.2126 * (buf.data[i] ?? 0) + 0.7152 * (buf.data[i + 1] ?? 0) + 0.0722 * (buf.data[i + 2] ?? 0);
  };
  for (let y = step; y < h - step; y += step) {
    for (let x = step; x < w - step; x += step) {
      const v = Math.abs(4 * at(x, y) - at(x - step, y) - at(x + step, y) - at(x, y - step) - at(x, y + step));
      acc += v;
      n++;
    }
  }
  return n ? acc / n : 0;
}

export function inspectQuery(buf: PhotoBuf | null): SearchRefusal | null {
  if (!buf || buf.w < 8 || buf.h < 8) {
    return { judged: false, code: "empty", why: "No usable photo. Point the camera at one product." };
  }
  const long = Math.max(buf.naturalW ?? buf.w, buf.naturalH ?? buf.h);
  if (long < 80) {
    return { judged: false, code: "far", why: "Too far or too small. Move in until the product fills the frame." };
  }
  const lum = lumMean(buf);
  if (lum < 22) {
    return { judged: false, code: "dark", why: "Too dark to match. Find a light before ranking." };
  }
  const sharp = laplace(buf);
  if (sharp < 6) {
    return { judged: false, code: "blur", why: "Too blurred to match. Hold still, then search." };
  }
  return null;
}

function hist(buf: PhotoBuf) {
  const bins = new Float32Array(24);
  const n = buf.w * buf.h;
  const step = Math.max(1, Math.floor(n / 2500));
  let c = 0;
  for (let i = 0; i < n; i += step) {
    const p = i * 4;
    const r = buf.data[p] ?? 0;
    const g = buf.data[p + 1] ?? 0;
    const b = buf.data[p + 2] ?? 0;
    bins[Math.min(7, (r / 32) | 0)] += 1;
    bins[8 + Math.min(7, (g / 32) | 0)] += 1;
    bins[16 + Math.min(7, (b / 32) | 0)] += 1;
    c++;
  }
  const inv = c ? 1 / c : 0;
  for (let i = 0; i < 24; i++) bins[i]! *= inv;
  return bins;
}

function cosine(a: Float32Array, b: Float32Array) {
  let d = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den ? d / den : 0;
}

export type CatalogVec = { sku: string; name: string; src: string; vec: Float32Array };

export function vectorize(buf: PhotoBuf): Float32Array {
  return hist(buf);
}

/** Rank catalog vectors. Plug DINOv2 / MobileNet here — this is the stand-in. */
export function rankHits(query: Float32Array, catalog: CatalogVec[]): SearchHit[] {
  return catalog
    .map((c) => ({
      sku: c.sku,
      name: c.name,
      src: c.src,
      score: cosine(query, c.vec),
    }))
    .sort((a, b) => b.score - a.score);
}

export function interpretHits(hits: SearchHit[]): SearchAnswer {
  if (!hits.length) {
    return { judged: false, code: "empty", why: "Catalogue has no photos to rank against." };
  }
  const top = hits[0]!;
  const second = hits[1];
  if (top.score < SEARCH_BANDS.WEAK) {
    return {
      judged: false,
      code: "far",
      why: `Nothing in the catalogue is close (top ${Math.round(top.score * 100)}%). This is not a match.`,
    };
  }
  if (second && top.score - second.score < SEARCH_BANDS.CLUSTER && second.score >= SEARCH_BANDS.WEAK) {
    return {
      judged: true,
      kind: "cluster",
      hits: hits.slice(0, 4),
      note: `Leaders are too close to separate (${Math.round(top.score * 100)}% vs ${Math.round(second.score * 100)}%). Pick by eye — do not treat this as a lock.`,
    };
  }
  if (top.score < SEARCH_BANDS.WIN) {
    return {
      judged: true,
      kind: "weak",
      hits: hits.slice(0, 4),
      note: `Best guess ${top.sku} at ${Math.round(top.score * 100)}%. That is not a confident lock.`,
    };
  }
  return {
    judged: true,
    kind: "winner",
    hits: hits.slice(0, 4),
    note: `${top.sku} at ${Math.round(top.score * 100)}%.`,
  };
}

/** Several photos of one item → one answer. */
export function mergeQueries(answers: SearchAnswer[]): SearchAnswer {
  if (!answers.length) {
    return { judged: false, code: "empty", why: "No photos in this query." };
  }
  const refusal = answers.find((a) => a.judged === false);
  if (refusal && answers.every((a) => a.judged === false)) return refusal;
  const ranked = answers.filter((a): a is Extract<SearchAnswer, { judged: true }> => a.judged);
  if (!ranked.length) return answers[0]!;
  const scores = new Map<string, { hit: SearchHit; n: number }>();
  for (const a of ranked) {
    for (const h of a.hits) {
      const prev = scores.get(h.sku);
      if (!prev) scores.set(h.sku, { hit: { ...h }, n: 1 });
      else {
        prev.hit.score += h.score;
        prev.n += 1;
      }
    }
  }
  const hits = [...scores.values()]
    .map((v) => ({ ...v.hit, score: v.hit.score / v.n }))
    .sort((a, b) => b.score - a.score);
  return interpretHits(hits);
}

export function catalogSkus() {
  return MOCKUPS.map((m) => ({ sku: m.sku, name: m.name, src: m.src }));
}

export function isLock(answer: SearchAnswer): boolean {
  return answer.judged === true && answer.kind === "winner";
}
