import type { MethodId } from "./methods";
import type { Quad } from "./geometry";

function clampByte(n: number) {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}

function substrateFor(material: string): [number, number, number] {
  const m = material.toLowerCase();
  if (m.includes("brass") || m.includes("gold")) return [196, 154, 72];
  if (m.includes("wood") || m.includes("kraft") || m.includes("cardboard")) return [62, 38, 22];
  if (m.includes("crystal") || m.includes("glass")) return [210, 220, 228];
  if (m.includes("stainless") || m.includes("steel")) return [176, 182, 188];
  if (m.includes("aluminum") || m.includes("aluminium")) return [186, 190, 194];
  if (m.includes("silver")) return [198, 202, 206];
  // coated black metal — laser reveals aluminum
  return [214, 218, 222];
}

/**
 * Composite a warped logo layer onto the product using a real decoration method.
 * Laser / deboss / foil read as substrate change, not a blend mode.
 */
export function compositeDecoration(
  ctx: CanvasRenderingContext2D,
  product: CanvasImageSource,
  mask: HTMLCanvasElement,
  destQuad: Quad,
  method: MethodId,
  material: string,
  opacity: number,
) {
  const w = mask.width;
  const h = mask.height;
  const mctx = mask.getContext("2d");
  if (!mctx) return;
  const probe = document.createElement("canvas");
  probe.width = w;
  probe.height = h;
  const pctx = probe.getContext("2d");
  if (!pctx) return;
  pctx.drawImage(product, 0, 0, w, h);

  const xs = destQuad.map((p) => p.x);
  const ys = destQuad.map((p) => p.y);
  const minX = Math.max(1, Math.floor(Math.min(...xs)) - 2);
  const maxX = Math.min(w - 1, Math.ceil(Math.max(...xs)) + 2);
  const minY = Math.max(1, Math.floor(Math.min(...ys)) - 2);
  const maxY = Math.min(h - 1, Math.ceil(Math.max(...ys)) + 2);

  const md = mctx.getImageData(0, 0, w, h);
  const pd = pctx.getImageData(0, 0, w, h);
  const out = pctx.getImageData(0, 0, w, h);
  const M = md.data;
  const P = pd.data;
  const O = out.data;

  let lumSum = 0;
  let lumN = 0;
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const i = (y * w + x) * 4;
      if (M[i + 3]! < 8) continue;
      lumSum += 0.2126 * M[i]! + 0.7152 * M[i + 1]! + 0.0722 * M[i + 2]!;
      lumN++;
    }
  }
  const meanLum = lumN ? lumSum / lumN / 255 : 0.2;
  const darkMark = meanLum < 0.55;
  const [sr, sg, sb] = substrateFor(material);
  const amt = Math.max(0.15, Math.min(1, opacity));

  const etchAt = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const a = M[i + 3]! / 255;
    if (a < 0.02) return 0;
    const lum = (0.2126 * M[i]! + 0.7152 * M[i + 1]! + 0.0722 * M[i + 2]!) / 255;
    const mark = darkMark ? Math.max(0.4, 1 - lum) : Math.max(0.4, lum);
    return a * mark;
  };

  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const i = (y * w + x) * 4;
      const a0 = M[i + 3]!;
      if (a0 < 4) continue;
      const etch = etchAt(x, y) * amt;
      if (etch < 0.02) continue;
      let pr = P[i]!;
      let pg = P[i + 1]!;
      let pb = P[i + 2]!;
      const lr = M[i]!;
      const lg = M[i + 1]!;
      const lb = M[i + 2]!;

      if (method === "laser_engrave") {
        const eL = etchAt(x - 1, y);
        const eR = etchAt(x + 1, y);
        const eU = etchAt(x, y - 1);
        const eD = etchAt(x, y + 1);
        const gx = eR - eL;
        const gy = eD - eU;
        const inner = Math.max(0, -gx * 0.6 - gy * 0.8);
        const spec = Math.max(0, gx * 0.35 - gy * 0.7);
        const t = Math.min(1, etch * 1.2);
        pr = pr + (sr - pr) * t - inner * 50 + spec * 48;
        pg = pg + (sg - pg) * t - inner * 50 + spec * 44;
        pb = pb + (sb - pb) * t - inner * 44 + spec * 52;
      } else if (method === "deboss") {
        const eL = etchAt(x - 1, y);
        const eU = etchAt(x, y - 1);
        const inner = Math.max(0, etch - eL * 0.5 - eU * 0.5);
        const t = etch * 0.55;
        pr = pr * (1 - t) - inner * 28;
        pg = pg * (1 - t) - inner * 28;
        pb = pb * (1 - t) - inner * 24;
      } else if (method === "foil") {
        const t = Math.min(1, etch * 1.1);
        const shine = 0.72 + 0.28 * Math.sin((x + y) * 0.04);
        pr = pr + (212 * shine - pr) * t;
        pg = pg + (168 * shine - pg) * t;
        pb = pb + (72 * shine - pb) * t;
      } else if (method === "sublimation") {
        const t = (a0 / 255) * amt * 0.9;
        pr = pr + (lr - pr) * t;
        pg = pg + (lg - pg) * t;
        pb = pb + (lb - pb) * t;
      } else if (method === "uv_dtf") {
        const t = (a0 / 255) * amt;
        const e = etchAt(x, y) - etchAt(x - 1, y - 1);
        pr = pr + (lr - pr) * t + Math.max(0, e) * 18;
        pg = pg + (lg - pg) * t + Math.max(0, e) * 18;
        pb = pb + (lb - pb) * t + Math.max(0, e) * 16;
      } else if (method === "pad_print" || method === "screen_print") {
        const t = etch * 0.96;
        pr = pr + (lr - pr) * t;
        pg = pg + (lg - pg) * t;
        pb = pb + (lb - pb) * t;
      } else if (method === "embroidery") {
        const stitch = 0.82 + 0.18 * Math.sin(x * 0.9 + y * 0.12);
        const t = (a0 / 255) * amt;
        pr = pr + (lr * stitch - pr) * t;
        pg = pg + (lg * stitch - pg) * t;
        pb = pb + (lb * stitch - pb) * t;
      }

      O[i] = clampByte(pr);
      O[i + 1] = clampByte(pg);
      O[i + 2] = clampByte(pb);
    }
  }

  ctx.putImageData(out, 0, 0);
}
