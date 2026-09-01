/**
 * Confidence + rerank over Photo Search. Does not replace the embedder.
 * Isolates the object, scores shape/colour/family, never SKU.
 * 56% is not a lock. "It fits" only on a winner.
 */

import type { PhotoBuf } from "./photo-check";
import { MOCKUPS } from "./mockups";

export type SearchHit = {
  sku: string;
  name: string;
  src: string;
  score: number;
  family?: string;
  familyAgree?: boolean;
  superAgree?: boolean;
  colorCap?: boolean;
  reasons?: string[];
};

export type SearchRefusal = {
  judged: false;
  code: "blur" | "dark" | "empty" | "far";
  why: string;
};

export type SearchAnswer =
  | {
      judged: true;
      kind: "winner" | "cluster" | "weak" | "colour-mismatch";
      hits: SearchHit[];
      note: string;
    }
  | SearchRefusal;

export const SEARCH_BANDS = {
  WIN: 0.82,
  WEAK: 0.62,
  CLUSTER: 0.06,
} as const;

export const COLOR_DL = 45;
export const COLOR_CAP = 0.5;
export const FAMILY_DROP = 0.42;
const SIL_BINS = 12;

const SUPERFAMILY: Record<string, string> = {
  tumbler: "drinkware",
  mug: "drinkware",
  cup: "drinkware",
  flask: "drinkware",
  bottle: "drinkware",
  powerbank: "tech",
  charger: "tech",
  usb: "tech",
  cable: "tech",
  notebook: "stationery",
  pen: "writing",
  apparel: "apparel",
  bag: "bag",
  award: "award",
  display: "display",
  tech: "tech",
  default: "default",
};

export type PhotoFeat = {
  isolated: boolean;
  aspect: number;
  L: number;
  mean: [number, number, number];
  sil: number[];
  screen: number;
  coverage: number;
  family?: string;
};

export type CatalogVec = {
  sku: string;
  name: string;
  src: string;
  category?: string;
  material?: string;
  family: string;
  feat: PhotoFeat;
  vec?: Float32Array;
};

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

export function familyOf(product: { category?: string; name?: string; material?: string; family?: string } | null): string {
  const blob = [product?.category, product?.name, product?.material, product?.family].filter(Boolean).join(" ").toLowerCase();
  if (/wireless|\bqi\b|charg(er|ing)|charging pad/.test(blob)) return "charger";
  if (/power\s*bank|powerbank/.test(blob)) return "powerbank";
  if (/\busb\b|flash drive/.test(blob)) return "usb";
  if (/cable|hub/.test(blob) && !/drink/.test(blob)) return "cable";
  if (/tumbler|\bbrew\b/.test(blob)) return "tumbler";
  if (/\bmug\b/.test(blob)) return "mug";
  if (/flask|thermos/.test(blob)) return "flask";
  if (/vacuum|\bbottle\b/.test(blob)) return "bottle";
  if (/\bcup\b/.test(blob)) return "cup";
  if (/notebook|journal|diary/.test(blob)) return "notebook";
  if (/\bpen\b|pencil/.test(blob)) return "pen";
  if (/polo|hoodie|tee|t-?shirt|cap|apparel/.test(blob)) return "apparel";
  if (/tote|backpack|\bbag\b/.test(blob)) return "bag";
  if (/award|crystal|plaque/.test(blob)) return "award";
  if (/totem|billboard|display/.test(blob)) return "display";
  const cat = (product?.category ?? "").toLowerCase();
  if (cat.includes("drink")) return "bottle";
  if (cat.includes("tech")) return "tech";
  if (cat.includes("station")) return "notebook";
  if (cat.includes("apparel")) return "apparel";
  if (cat.includes("award")) return "award";
  if (cat.includes("packag")) return "bag";
  return "default";
}

function lum(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function blobOf(mask: Uint8Array, w: number, h: number) {
  const seen = new Uint8Array(mask.length);
  let best: { n: number; minX: number; maxX: number; minY: number; maxY: number } | null = null;
  const qx = new Int32Array(mask.length);
  const qy = new Int32Array(mask.length);
  for (let y0 = 0; y0 < h; y0++) {
    for (let x0 = 0; x0 < w; x0++) {
      const s = y0 * w + x0;
      if (!mask[s] || seen[s]) continue;
      let n = 0,
        minX = x0,
        maxX = x0,
        minY = y0,
        maxY = y0,
        qs = 0,
        qe = 0;
      qx[qe] = x0;
      qy[qe] = y0;
      qe++;
      seen[s] = 1;
      while (qs < qe) {
        const x = qx[qs]!;
        const y = qy[qs]!;
        qs++;
        n++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = ny * w + nx;
          if (!mask[k] || seen[k]) continue;
          seen[k] = 1;
          qx[qe] = nx;
          qy[qe] = ny;
          qe++;
        }
      }
      if (!best || n > best.n) best = { n, minX, maxX, minY, maxY };
    }
  }
  return best;
}

function silOf(mask: Uint8Array, w: number, box: { minX: number; maxX: number; minY: number; maxY: number }) {
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const acc = new Array(SIL_BINS).fill(0);
  const cnt = new Array(SIL_BINS).fill(0);
  const maxR = Math.max(1, Math.hypot(box.maxX - box.minX, box.maxY - box.minY) / 2);
  for (let y = box.minY; y <= box.maxY; y++) {
    for (let x = box.minX; x <= box.maxX; x++) {
      if (!mask[y * w + x]) continue;
      const ang = (Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI);
      const b = Math.min(SIL_BINS - 1, (ang * SIL_BINS) | 0);
      acc[b] += Math.hypot(x - cx, y - cy) / maxR;
      cnt[b]++;
    }
  }
  return acc.map((v, i) => (cnt[i] ? v / cnt[i] : 0));
}

function cosine(a: number[], b: number[]) {
  let d = 0,
    na = 0,
    nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    d += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den ? d / den : 0;
}

function screenHint(buf: PhotoBuf, box: { minX: number; maxX: number; minY: number; maxY: number }) {
  const y1 = box.minY + Math.max(2, ((box.maxY - box.minY) * 0.22) | 0);
  let n = 0,
    bright = 0;
  for (let y = box.minY; y <= Math.min(box.maxY, y1); y++) {
    for (let x = box.minX; x <= box.maxX; x++) {
      const i = (y * buf.w + x) * 4;
      const r = buf.data[i] ?? 0,
        g = buf.data[i + 1] ?? 0,
        b = buf.data[i + 2] ?? 0;
      n++;
      if (lum(r, g, b) > 160 && Math.max(r, g, b) - Math.min(r, g, b) > 25) bright++;
    }
  }
  return n ? bright / n : 0;
}

export function describePhoto(buf: PhotoBuf): PhotoFeat {
  const w = buf.w;
  const h = buf.h;
  const m = Math.max(3, Math.round(Math.min(w, h) * 0.08));
  const boxes: [number, number][] = [
    [0, 0],
    [w - m, 0],
    [0, h - m],
    [w - m, h - m],
  ];
  let rs = 0,
    gs = 0,
    bs = 0,
    n = 0,
    lAcc = 0;
  const lums: number[] = [];
  for (const [sx, sy] of boxes) {
    for (let y = sy; y < sy + m; y++) {
      for (let x = sx; x < sx + m; x++) {
        const i = (y * w + x) * 4;
        const r = buf.data[i] ?? 0,
          g = buf.data[i + 1] ?? 0,
          b = buf.data[i + 2] ?? 0;
        rs += r;
        gs += g;
        bs += b;
        const L = lum(r, g, b);
        lums.push(L);
        lAcc += L;
        n++;
      }
    }
  }
  const bg: [number, number, number] = [rs / n, gs / n, bs / n];
  const bgL = lAcc / n;
  const std = Math.sqrt(lums.reduce((s, v) => s + (v - bgL) ** 2, 0) / n);
  const thresh = Math.max(10, 1.6 * std + 8);

  const build = (th: number) => {
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = buf.data[i] ?? 0,
          g = buf.data[i + 1] ?? 0,
          b = buf.data[i + 2] ?? 0;
        if (Math.hypot(r - bg[0], g - bg[1], b - bg[2]) >= th || Math.abs(lum(r, g, b) - bgL) >= th) {
          mask[y * w + x] = 1;
        }
      }
    }
    return mask;
  };

  let mask = build(thresh);
  let blob = blobOf(mask, w, h);
  if (!blob || blob.n < w * h * 0.04) {
    mask = build(Math.max(6, thresh * 0.5));
    blob = blobOf(mask, w, h);
  }
  let isolated = Boolean(blob && blob.n >= w * h * 0.03);
  const box = isolated && blob
    ? blob
    : {
        n: ((w * h) * 0.25) | 0,
        minX: (w * 0.25) | 0,
        maxX: ((w * 0.75) | 0) - 1,
        minY: (h * 0.25) | 0,
        maxY: ((h * 0.75) | 0) - 1,
      };
  if (!isolated) isolated = false;
  const bw = Math.max(1, box.maxX - box.minX + 1);
  const bh = Math.max(1, box.maxY - box.minY + 1);
  let pr = 0,
    pg = 0,
    pb = 0,
    pn = 0;
  for (let y = box.minY; y <= box.maxY; y++) {
    for (let x = box.minX; x <= box.maxX; x++) {
      if (isolated && !mask[y * w + x]) continue;
      const i = (y * w + x) * 4;
      pr += buf.data[i] ?? 0;
      pg += buf.data[i + 1] ?? 0;
      pb += buf.data[i + 2] ?? 0;
      pn++;
    }
  }
  const mean: [number, number, number] = pn ? [pr / pn, pg / pn, pb / pn] : [0, 0, 0];
  return {
    isolated,
    aspect: bw / bh,
    L: lum(mean[0], mean[1], mean[2]),
    mean,
    sil: silOf(isolated ? mask : new Uint8Array(w * h).fill(1), w, box),
    screen: screenHint(buf, box),
    coverage: box.n / (w * h),
  };
}

export function inferFamily(feat: PhotoFeat): string {
  if (!feat.isolated) return "default";
  if (feat.aspect < 0.28) return feat.screen > 0.08 ? "flask" : "bottle";
  if (feat.aspect < 0.55) return feat.screen > 0.08 ? "flask" : "tumbler";
  if (feat.aspect >= 0.85 && feat.aspect <= 1.25 && feat.coverage > 0.12) return "charger";
  if (feat.aspect >= 0.45 && feat.aspect <= 0.85) return "powerbank";
  return "default";
}

export function scorePair(
  query: PhotoFeat,
  catalog: PhotoFeat,
  catFamily?: string,
  embed?: number,
) {
  const qa = Math.max(1e-6, query.aspect);
  const ca = Math.max(1e-6, catalog.aspect);
  const shape = 1 - Math.min(1, Math.abs(Math.log(qa / ca)) / Math.log(2.4));
  const dL = Math.abs(query.L - catalog.L);
  const colour = 1 - Math.min(1, dL / 80);
  const sil = cosine(query.sil, catalog.sil);
  const qFam = query.family || inferFamily(query);
  const cFam = catFamily || catalog.family || inferFamily(catalog);
  const unknown = qFam === "default" || cFam === "default";
  const drinkware = SUPERFAMILY[qFam] === "drinkware" && SUPERFAMILY[cFam] === "drinkware";
  const fam = qFam === cFam || unknown ? 1 : drinkware ? 0.45 : 0;
  const screenPen = Math.abs(query.screen - catalog.screen) > 0.12 ? 0.12 : 0;
  let score = 0.36 * shape + 0.32 * colour + 0.18 * sil + 0.14 * fam - screenPen;
  if (embed != null) score = 0.55 * score + 0.45 * embed;
  const reasons: string[] = [];
  const colorCap = dL >= COLOR_DL;
  const familyDrop = !unknown && qFam !== cFam && !drinkware;
  if (familyDrop) {
    score *= FAMILY_DROP;
    reasons.push(`family ${qFam}≠${cFam}`);
  }
  if (colorCap) {
    score = Math.min(score, COLOR_CAP);
    reasons.push(`colour ΔL ${dL.toFixed(0)}`);
  }
  score = Math.max(0, Math.min(1, score));
  return {
    score,
    shape,
    colour,
    sil,
    family: cFam,
    queryFamily: qFam,
    familyAgree: qFam === cFam || unknown,
    superAgree: SUPERFAMILY[qFam] === SUPERFAMILY[cFam] || unknown,
    colorCap,
    familyDrop,
    dL,
    reasons,
  };
}

export function vectorize(buf: PhotoBuf): PhotoFeat {
  return describePhoto(buf);
}

export function rankHits(query: PhotoFeat, catalog: CatalogVec[], embedHits?: { sku: string; score: number }[]): SearchHit[] {
  const embedMap = new Map((embedHits ?? []).map((h) => [h.sku, h.score]));
  let pool = catalog;
  if (embedHits?.length) {
    const wanted = new Set(embedHits.map((h) => h.sku));
    const tagged = catalog.filter((c) => wanted.has(c.sku));
    if (tagged.length) pool = tagged;
  }
  const q = { ...query, family: query.family || inferFamily(query) };
  const out: SearchHit[] = [];
  for (const row of pool) {
    const scored = scorePair(q, row.feat, row.family, embedMap.get(row.sku));
    if (scored.familyDrop) continue;
    out.push({
      sku: row.sku,
      name: row.name,
      src: row.src,
      score: scored.score,
      family: scored.family,
      familyAgree: scored.familyAgree,
      superAgree: scored.superAgree,
      colorCap: scored.colorCap,
      reasons: scored.reasons,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function interpretHits(hits: SearchHit[]): SearchAnswer {
  if (!hits.length) {
    return { judged: false, code: "empty", why: "Catalogue has no photos to rank against." };
  }
  const live = hits.filter((h) => h.score >= SEARCH_BANDS.WEAK && !h.colorCap);
  const capped = hits.filter((h) => h.colorCap && h.superAgree !== false);
  if (!live.length) {
    if (capped.length) {
      return {
        judged: true,
        kind: "colour-mismatch",
        hits: capped.slice(0, 4),
        note: "Same shape family, different colour. Confirm by eye — not a lock.",
      };
    }
    const top = hits[0]!;
    return {
      judged: false,
      code: "far",
      why: `Nothing in the catalogue is close (top ${Math.round(top.score * 100)}%). This is not a match.`,
    };
  }
  const top = live[0]!;
  const second = live[1];
  if (second && top.score - second.score < SEARCH_BANDS.CLUSTER && second.score >= SEARCH_BANDS.WEAK) {
    return {
      judged: true,
      kind: "cluster",
      hits: live.slice(0, 4),
      note: `Leaders are too close to separate (${Math.round(top.score * 100)}% vs ${Math.round(second.score * 100)}%). Pick by eye — do not treat this as a lock.`,
    };
  }
  if (top.score < SEARCH_BANDS.WIN || top.colorCap) {
    return {
      judged: true,
      kind: "weak",
      hits: live.slice(0, 4),
      note: `Best guess ${top.sku} at ${Math.round(top.score * 100)}%. That is not a confident lock.`,
    };
  }
  if (top.familyAgree === false && top.superAgree === false) {
    return {
      judged: true,
      kind: "weak",
      hits: live.slice(0, 4),
      note: `Best guess ${top.sku} at ${Math.round(top.score * 100)}%. That is not a confident lock.`,
    };
  }
  return {
    judged: true,
    kind: "winner",
    hits: live.slice(0, 4),
    note: `${top.sku} at ${Math.round(top.score * 100)}%.`,
  };
}

export function mergeQueries(answers: SearchAnswer[]): SearchAnswer {
  if (!answers.length) {
    return { judged: false, code: "empty", why: "No photos in this query." };
  }
  if (answers.every((a) => a.judged === false)) return answers[0]!;
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
  return MOCKUPS.map((m) => ({
    sku: m.sku,
    name: m.name,
    src: m.src,
    category: m.category,
    material: m.material,
  }));
}

export function isLock(answer: SearchAnswer): boolean {
  return answer.judged === true && answer.kind === "winner";
}
