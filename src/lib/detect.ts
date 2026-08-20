import { loadImage } from "./image";
import { detectFromRgb, type DetectResult } from "./detect-core";
import type { BlendMode, SurfaceTone } from "./mockups";
import type { Quad } from "./geometry";

export type { DetectResult } from "./detect-core";
export { detectFromRgb } from "./detect-core";

/**
 * Client-side printable-plane lock. No API.
 * Contrast against the backdrop; refuses empty frames; no centre-weight clip.
 */
export async function detectSurface(src: string, prior?: Quad): Promise<DetectResult> {
  const img = await loadImage(src);
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  const max = 220;
  const scale = Math.min(1, max / Math.max(nw, nh));
  const w = Math.max(32, Math.round(nw * scale));
  const h = Math.max(32, Math.round(nh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No canvas");
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const n = w * h;
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    r[p] = data[i]!;
    g[p] = data[i + 1]!;
    b[p] = data[i + 2]!;
  }
  return detectFromRgb({ w, h, r, g, b }, prior);
}

function lumAt(data: Uint8ClampedArray, i: number) {
  return (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255;
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
    const x =
      quad[0].x * (1 - u) * (1 - v) + quad[1].x * u * (1 - v) + quad[2].x * u * v + quad[3].x * (1 - u) * v;
    const y =
      quad[0].y * (1 - u) * (1 - v) + quad[1].y * u * (1 - v) + quad[2].y * u * v + quad[3].y * (1 - u) * v;
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
