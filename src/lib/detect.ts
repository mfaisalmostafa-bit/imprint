import {
  clampQuad,
  isConvexQuad,
  quadArea,
  type Quad,
} from "./geometry";
import { loadImage } from "./image";
import type { BlendMode, SurfaceTone, WrapMode } from "./mockups";

export type DetectResult = {
  surface: string;
  material: string;
  quad: Quad;
  wrap: WrapMode;
  cylinderArc: number;
  surfaceTone: SurfaceTone;
  suggestedBlend: BlendMode;
  invert: boolean;
  confidence: number;
  notes: string;
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function lumAt(data: Uint8ClampedArray, i: number) {
  return (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255;
}

/**
 * Client-side printable-plane lock.
 * Finds the largest coherent product region, builds a perspective quad from
 * the mask silhouette, and reads tone / cylinder falloff.
 */
export async function detectSurface(src: string): Promise<DetectResult> {
  const img = await loadImage(src);
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  const max = 160;
  const r = Math.min(1, max / Math.max(nw, nh));
  const w = Math.max(24, Math.round(nw * r));
  const h = Math.max(24, Math.round(nh * r));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No canvas");
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) lum[p] = lumAt(data, i);

  const pad = Math.max(2, Math.round(Math.min(w, h) * 0.06));
  const corners: number[] = [];
  for (let y = 0; y < pad; y++) {
    for (let x = 0; x < pad; x++) {
      corners.push(lum[y * w + x]!, lum[y * w + (w - 1 - x)]!);
    }
  }
  for (let y = h - pad; y < h; y++) {
    for (let x = 0; x < pad; x++) {
      corners.push(lum[y * w + x]!, lum[y * w + (w - 1 - x)]!);
    }
  }
  const bg = median(corners);

  const varMap = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = lum[y * w + x]!;
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const d = lum[(y + dy) * w + (x + dx)]! - c;
          s += d * d;
        }
      }
      varMap[y * w + x] = s / 9;
    }
  }

  const score = new Float32Array(w * h);
  let maxScore = 0;
  for (let y = 0; y < h; y++) {
    const cy = (y / (h - 1) - 0.5) * 2;
    for (let x = 0; x < w; x++) {
      const cx = (x / (w - 1) - 0.5) * 2;
      const center = 1 - Math.min(1, (cx * cx + cy * cy) * 0.72);
      const diff = Math.abs(lum[y * w + x]! - bg);
      const flat = 1 / (1 + varMap[y * w + x]! * 28);
      const s = diff * 0.55 + flat * 0.45;
      const v = s * (0.35 + 0.65 * center);
      score[y * w + x] = v;
      if (v > maxScore) maxScore = v;
    }
  }

  const thresh = maxScore * 0.42;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = score[i]! >= thresh ? 1 : 0;

  const rowLeft = new Int16Array(h).fill(-1);
  const rowRight = new Int16Array(h).fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (rowLeft[y] < 0) rowLeft[y] = x;
      rowRight[y] = x;
    }
  }

  let y0 = 0;
  let y1 = h - 1;
  while (y0 < h && rowLeft[y0] < 0) y0++;
  while (y1 > y0 && rowLeft[y1] < 0) y1--;
  if (y1 - y0 < h * 0.12) {
    return fallbackCenter(bg);
  }

  const band = Math.max(1, Math.round((y1 - y0) * 0.08));
  const avgEdge = (from: number, to: number, pick: "left" | "right") => {
    let s = 0;
    let n = 0;
    for (let y = from; y <= to; y++) {
      const v = pick === "left" ? rowLeft[y] : rowRight[y];
      if (v >= 0) {
        s += v;
        n++;
      }
    }
    return n ? s / n : pick === "left" ? w * 0.25 : w * 0.75;
  };

  const tlx = avgEdge(y0, y0 + band, "left") / w;
  const trx = avgEdge(y0, y0 + band, "right") / w;
  const blx = avgEdge(y1 - band, y1, "left") / w;
  const brx = avgEdge(y1 - band, y1, "right") / w;
  const inset = 0.06;
  const top = y0 / h;
  const bot = (y1 + 1) / h;
  const quad = clampQuad([
    { x: tlx + (trx - tlx) * inset, y: top + (bot - top) * inset },
    { x: trx - (trx - tlx) * inset, y: top + (bot - top) * inset },
    { x: brx - (brx - blx) * inset, y: bot - (bot - top) * inset },
    { x: blx + (brx - blx) * inset, y: bot - (bot - top) * inset },
  ]);

  if (!isConvexQuad(quad) || quadArea(quad) < 0.04) {
    return fallbackCenter(bg);
  }

  let mean = 0;
  let leftMean = 0;
  let rightMean = 0;
  let midMean = 0;
  let n = 0;
  const x0 = Math.round(Math.min(quad[0].x, quad[3].x) * w);
  const x1 = Math.round(Math.max(quad[1].x, quad[2].x) * w);
  const yy0 = Math.round(Math.min(quad[0].y, quad[1].y) * h);
  const yy1 = Math.round(Math.max(quad[2].y, quad[3].y) * h);
  for (let y = yy0; y < yy1; y++) {
    for (let x = x0; x < x1; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const v = lum[y * w + x]!;
      mean += v;
      n++;
      const t = (x - x0) / Math.max(1, x1 - x0);
      if (t < 0.22) leftMean += v;
      else if (t > 0.78) rightMean += v;
      else midMean += v;
    }
  }
  mean = n ? mean / n : 0.5;
  const ln = Math.max(1, ((yy1 - yy0) * (x1 - x0) * 0.22) | 0);
  leftMean /= ln;
  rightMean /= ln;
  midMean /= Math.max(1, n - 2 * ln);

  const falloff = midMean - (leftMean + rightMean) / 2;
  const wrap: WrapMode = falloff > 0.07 && (yy1 - yy0) / Math.max(1, x1 - x0) > 0.7 ? "cylinder" : "plane";
  const surfaceTone: SurfaceTone = mean < 0.38 ? "dark" : mean > 0.72 ? "light" : "mid";
  const invert = surfaceTone === "dark";
  const suggestedBlend: BlendMode =
    surfaceTone === "dark" ? "screen" : surfaceTone === "light" ? "multiply" : "overlay";

  const coverage = n / (w * h);
  const confidence = Math.min(0.88, 0.45 + coverage * 0.5 + (isConvexQuad(quad) ? 0.12 : 0));

  return {
    surface: wrap === "cylinder" ? "Curved wall" : "Printable plane",
    material: "unknown",
    quad,
    wrap,
    cylinderArc: wrap === "cylinder" ? 1.35 : 0,
    surfaceTone,
    suggestedBlend,
    invert,
    confidence,
    notes: wrap === "cylinder"
      ? "Local brain locked a curved wall from side falloff."
      : "Local brain locked a printable plane from the product silhouette.",
  };
}

function fallbackCenter(bg: number): DetectResult {
  const tone: SurfaceTone = bg < 0.4 ? "dark" : bg > 0.7 ? "light" : "mid";
  return {
    surface: "Printable plane",
    material: "unknown",
    quad: [
      { x: 0.28, y: 0.28 },
      { x: 0.72, y: 0.28 },
      { x: 0.72, y: 0.72 },
      { x: 0.28, y: 0.72 },
    ],
    wrap: "plane",
    cylinderArc: 0,
    surfaceTone: tone,
    suggestedBlend: tone === "dark" ? "screen" : "multiply",
    invert: tone === "dark",
    confidence: 0.35,
    notes: "Could not lock a silhouette — drag the corners onto the surface.",
  };
}

export function sampleTone(
  img: HTMLImageElement,
  quad: Quad,
): { mean: number; tone: SurfaceTone; invert: boolean; blend: BlendMode } {
  const w = 64;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { mean: 0.5, tone: "mid", invert: false, blend: "multiply" };
  }
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let s = 0;
  let n = 0;
  for (let i = 0; i < 80; i++) {
    const u = 0.15 + 0.7 * Math.random();
    const v = 0.15 + 0.7 * Math.random();
    const x = quad[0].x * (1 - u) * (1 - v) + quad[1].x * u * (1 - v) + quad[2].x * u * v + quad[3].x * (1 - u) * v;
    const y = quad[0].y * (1 - u) * (1 - v) + quad[1].y * u * (1 - v) + quad[2].y * u * v + quad[3].y * (1 - u) * v;
    const px = Math.max(0, Math.min(w - 1, Math.round(x * w)));
    const py = Math.max(0, Math.min(h - 1, Math.round(y * h)));
    const idx = (py * w + px) * 4;
    s += lumAt(data, idx);
    n++;
  }
  const mean = s / n;
  const tone: SurfaceTone = mean < 0.38 ? "dark" : mean > 0.72 ? "light" : "mid";
  return {
    mean,
    tone,
    invert: tone === "dark",
    blend: tone === "dark" ? "screen" : tone === "light" ? "multiply" : "overlay",
  };
}
