import {
  clampQuad,
  isConvexQuad,
  quadArea,
  type Quad,
} from "./geometry";
import type { BlendMode, SurfaceTone, WrapMode } from "./mockups";

export type DetectResult = {
  accepted: boolean;
  surface: string;
  material: string;
  quad: Quad;
  wrap: WrapMode;
  cylinderArc: number;
  surfaceTone: SurfaceTone;
  suggestedBlend: BlendMode;
  invert: boolean;
  confidence: number;
  coverage: number;
  contrast: number;
  topWidth: number;
  botWidth: number;
  notes: string;
};

export type RgbBuffers = {
  w: number;
  h: number;
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
};

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function lum(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function dilate(src: Uint8Array, w: number, h: number, rad: number) {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let hit = 0;
      for (let dy = -rad; dy <= rad && !hit; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -rad; dx <= rad; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          if (src[yy * w + xx]) {
            hit = 1;
            break;
          }
        }
      }
      out[y * w + x] = hit;
    }
  }
  return out;
}

function erode(src: Uint8Array, w: number, h: number, rad: number) {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ok = 1;
      for (let dy = -rad; dy <= rad && ok; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) {
          ok = 0;
          break;
        }
        for (let dx = -rad; dx <= rad; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w || !src[yy * w + xx]) {
            ok = 0;
            break;
          }
        }
      }
      out[y * w + x] = ok;
    }
  }
  return out;
}

function largestComponent(mask: Uint8Array, w: number, h: number) {
  const seen = new Uint8Array(mask.length);
  const keep = new Uint8Array(mask.length);
  let best: number[] = [];
  const stack = new Int32Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    let n = 0;
    let top = 0;
    stack[top++] = i;
    seen[i] = 1;
    const cells: number[] = [];
    while (top) {
      const p = stack[--top]!;
      cells.push(p);
      const x = p % w;
      const y = (p / w) | 0;
      const neigh = [p - 1, p + 1, p - w, p + w];
      const ok = [x > 0, x + 1 < w, y > 0, y + 1 < h];
      for (let k = 0; k < 4; k++) {
        if (!ok[k]) continue;
        const q = neigh[k]!;
        if (mask[q] && !seen[q]) {
          seen[q] = 1;
          stack[top++] = q;
        }
      }
      n++;
    }
    if (n > best.length) best = cells;
  }
  for (const p of best) keep[p] = 1;
  return { mask: keep, count: best.length };
}

function refused(contrast: number, extra: string): DetectResult {
  return {
    accepted: false,
    surface: "Printable plane",
    material: "unknown",
    quad: [
      { x: 0.3, y: 0.32 },
      { x: 0.7, y: 0.32 },
      { x: 0.7, y: 0.68 },
      { x: 0.3, y: 0.68 },
    ],
    wrap: "plane",
    cylinderArc: 0,
    surfaceTone: "mid",
    suggestedBlend: "multiply",
    invert: false,
    confidence: 0.12,
    coverage: 0,
    contrast,
    topWidth: 0,
    botWidth: 0,
    notes: extra,
  };
}

/**
 * Contrast-vs-backdrop silhouette. No centre weighting.
 * Refuses a lock when the frame is empty / uniform — a false silhouette is worse than none.
 * Existing marks on the product are ignored (holes filled); the plane under them is kept.
 */
export function detectFromRgb(buf: RgbBuffers, prior?: Quad): DetectResult {
  const { w, h, r, g, b } = buf;
  const n = w * h;
  const pad = Math.max(2, Math.round(Math.min(w, h) * 0.06));
  const cR: number[] = [];
  const cG: number[] = [];
  const cB: number[] = [];
  const sampleCorner = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        cR.push(r[i]!);
        cG.push(g[i]!);
        cB.push(b[i]!);
      }
    }
  };
  sampleCorner(0, 0, pad, pad);
  sampleCorner(w - pad, 0, w, pad);
  sampleCorner(0, h - pad, pad, h);
  sampleCorner(w - pad, h - pad, w, h);
  const bgR = median(cR);
  const bgG = median(cG);
  const bgB = median(cB);

  const dist = new Float32Array(n);
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    const dr = r[i]! - bgR;
    const dg = g[i]! - bgG;
    const db = b[i]! - bgB;
    const d = Math.sqrt(dr * dr + dg * dg + db * db);
    dist[i] = d;
    if ((i & 7) === 0) samples.push(d);
  }
  samples.sort((a, b) => a - b);
  const p90 = samples[Math.floor(samples.length * 0.9)] ?? 0;
  const p50 = samples[Math.floor(samples.length * 0.5)] ?? 0;
  const cornerDist = cR.map((_, i) => {
    const dr = cR[i]! - bgR;
    const dg = cG[i]! - bgG;
    const db = cB[i]! - bgB;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  });
  const bgNoise = median(cornerDist);
  // RGB euclidean. Claude's floor is ~34 on 0–255. Below that the frame is paper.
  const CONTRAST_FLOOR = 28;
  if (p90 < CONTRAST_FLOOR) {
    return refused(
      p90,
      "No product against the backdrop. A false silhouette is worse than none — drag the corners onto the print face.",
    );
  }

  const thresh = Math.max(CONTRAST_FLOOR, bgNoise * 4.2, p50 * 0.55);
  let raw = new Uint8Array(n);
  let on = 0;
  for (let i = 0; i < n; i++) {
    if (dist[i]! >= thresh) {
      raw[i] = 1;
      on++;
    }
  }
  const coverage0 = on / n;
  if (coverage0 < 0.04 || coverage0 > 0.92) {
    return refused(
      p90,
      coverage0 > 0.92
        ? "Frame is uniform — nothing to lock. Drag the corners."
        : "Product contrast is below the floor. Drag the corners onto the print face.",
    );
  }

  // Close holes so a supplier logo already on the product does not punch the mask.
  const rad = Math.max(1, Math.round(Math.min(w, h) * 0.012));
  raw = erode(dilate(raw, w, h, rad), w, h, rad);
  const { mask, count } = largestComponent(raw, w, h);
  const coverage = count / n;
  if (coverage < 0.04) {
    return refused(p90, "No coherent product mass. Drag the corners onto the print face.");
  }

  const rowLeft = new Int16Array(h).fill(-1);
  const rowRight = new Int16Array(h).fill(-1);
  const rowW: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (rowLeft[y] < 0) rowLeft[y] = x;
      rowRight[y] = x;
    }
    if (rowLeft[y] >= 0) rowW.push(rowRight[y]! - rowLeft[y]!);
  }
  const medW = median(rowW);
  // Drop stray whiskers, keep a real taper (top can be ~40% of bottom).
  const minW = medW * 0.28;
  for (let y = 0; y < h; y++) {
    if (rowLeft[y] < 0) continue;
    if (rowRight[y]! - rowLeft[y]! < minW) {
      rowLeft[y] = -1;
      rowRight[y] = -1;
    }
  }

  let y0 = 0;
  let y1 = h - 1;
  while (y0 < h && rowLeft[y0] < 0) y0++;
  while (y1 > y0 && rowLeft[y1] < 0) y1--;
  if (y1 - y0 < h * 0.1) {
    return refused(p90, "Silhouette is too thin to lock. Drag the corners.");
  }

  const band = Math.max(1, Math.round((y1 - y0) * 0.1));
  const edge = (from: number, to: number, pick: "left" | "right") => {
    const vals: number[] = [];
    for (let y = from; y <= to; y++) {
      const v = pick === "left" ? rowLeft[y] : rowRight[y];
      if (v >= 0) vals.push(v);
    }
    return vals.length ? median(vals) : pick === "left" ? w * 0.25 : w * 0.75;
  };

  const tlx = edge(y0, y0 + band, "left") / w;
  const trx = edge(y0, y0 + band, "right") / w;
  const blx = edge(y1 - band, y1, "left") / w;
  const brx = edge(y1 - band, y1, "right") / w;
  const topWidth = Math.max(0, trx - tlx);
  const botWidth = Math.max(0, brx - blx);
  const inset = 0.07;
  const top = y0 / h;
  const bot = (y1 + 1) / h;
  const quad = clampQuad([
    { x: tlx + (trx - tlx) * inset, y: top + (bot - top) * inset },
    { x: trx - (trx - tlx) * inset, y: top + (bot - top) * inset },
    { x: brx - (brx - blx) * inset, y: bot - (bot - top) * inset },
    { x: blx + (brx - blx) * inset, y: bot - (bot - top) * inset },
  ]);

  if (!isConvexQuad(quad) || quadArea(quad) < 0.02) {
    return refused(p90, "Could not form a convex print zone. Drag the corners.");
  }

  let meanL = 0;
  let leftMean = 0;
  let rightMean = 0;
  let midMean = 0;
  let ln = 0;
  let rn = 0;
  let mn = 0;
  let pn = 0;
  const x0 = Math.round(Math.min(quad[0].x, quad[3].x) * w);
  const x1 = Math.round(Math.max(quad[1].x, quad[2].x) * w);
  const yy0 = Math.round(Math.min(quad[0].y, quad[1].y) * h);
  const yy1 = Math.round(Math.max(quad[2].y, quad[3].y) * h);
  for (let y = yy0; y < yy1; y++) {
    if (y < 0 || y >= h) continue;
    for (let x = x0; x < x1; x++) {
      if (x < 0 || x >= w) continue;
      if (!mask[y * w + x]) continue;
      const v = lum(r[y * w + x]!, g[y * w + x]!, b[y * w + x]!) / 255;
      meanL += v;
      pn++;
      const t = (x - x0) / Math.max(1, x1 - x0);
      if (t < 0.22) {
        leftMean += v;
        ln++;
      } else if (t > 0.78) {
        rightMean += v;
        rn++;
      } else {
        midMean += v;
        mn++;
      }
    }
  }
  meanL = pn ? meanL / pn : 0.5;
  leftMean = ln ? leftMean / ln : meanL;
  rightMean = rn ? rightMean / rn : meanL;
  midMean = mn ? midMean / mn : meanL;
  const falloff = midMean - (leftMean + rightMean) / 2;
  const aspect = (yy1 - yy0) / Math.max(1, x1 - x0);
  const wrap: WrapMode = falloff > 0.07 && aspect > 0.7 ? "cylinder" : "plane";
  const surfaceTone: SurfaceTone = meanL < 0.38 ? "dark" : meanL > 0.72 ? "light" : "mid";
  const invert = surfaceTone === "dark";
  const suggestedBlend: BlendMode =
    surfaceTone === "dark" ? "screen" : surfaceTone === "light" ? "multiply" : "overlay";

  const contrast = p90;
  const confidence = Math.min(
    0.91,
    0.38 + Math.min(0.3, (contrast - CONTRAST_FLOOR) / 180) + Math.min(0.22, coverage) + 0.1,
  );

  let outQuad = quad;
  if (prior && isConvexQuad(prior)) {
    let sx = 0;
    let sy = 0;
    let sw = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        sx += x;
        sy += y;
        sw++;
      }
    }
    if (sw > 0) {
      const cx = sx / sw / w;
      const cy = sy / sw / h;
      const ocx = (prior[0].x + prior[1].x + prior[2].x + prior[3].x) / 4;
      const ocy = (prior[0].y + prior[1].y + prior[2].y + prior[3].y) / 4;
      const dx = cx - ocx;
      const dy = cy - ocy;
      const moved = prior.map((p) => ({
        x: Math.min(0.97, Math.max(0.03, p.x + dx)),
        y: Math.min(0.97, Math.max(0.03, p.y + dy)),
      })) as Quad;
      if (isConvexQuad(moved) && quadArea(moved) >= 0.01) outQuad = clampQuad(moved);
    }
  }

  return {
    accepted: true,
    surface: wrap === "cylinder" ? "Curved wall" : "Printable plane",
    material: "unknown",
    quad: outQuad,
    wrap,
    cylinderArc: wrap === "cylinder" ? 1.35 : 0,
    surfaceTone,
    suggestedBlend,
    invert,
    confidence,
    coverage,
    contrast,
    topWidth,
    botWidth,
    notes:
      wrap === "cylinder"
        ? "Local lock — curved wall from side falloff. Existing marks ignored."
        : "Local lock — silhouette vs backdrop. Existing marks ignored.",
  };
}
