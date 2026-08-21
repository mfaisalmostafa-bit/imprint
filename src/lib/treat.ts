import type { MethodId } from "./methods";
import { TPX_NAVY_RGB, TPX_ORANGE_RGB } from "./brand";

export type Treatment = "auto" | "full" | "knockout" | "one_color" | "tone";

/** Locked house pair — always from brand.ts, never a second navy. */
export const SPOT_NAVY: [number, number, number] = [
  TPX_NAVY_RGB[0],
  TPX_NAVY_RGB[1],
  TPX_NAVY_RGB[2],
];
export const SPOT_ORANGE: [number, number, number] = [
  TPX_ORANGE_RGB[0],
  TPX_ORANGE_RGB[1],
  TPX_ORANGE_RGB[2],
];

export const SPOT_SWATCHES: { id: string; label: string; rgb: [number, number, number] }[] = [
  { id: "navy", label: "TPX Navy", rgb: SPOT_NAVY },
  { id: "orange", label: "TPX Orange", rgb: SPOT_ORANGE },
  { id: "black", label: "Black", rgb: [22, 22, 24] },
  { id: "white", label: "White", rgb: [244, 241, 234] },
  { id: "silver", label: "Silver", rgb: [188, 192, 196] },
];

function rgbDist(r: number, g: number, b: number, br: number, bg: number, bb: number) {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function cornersAgree(data: ImageData) {
  const { data: d, width: w, height: h } = data;
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [d[i]!, d[i + 1]!, d[i + 2]!] as const;
  };
  const c = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  const mean = [0, 0, 0];
  for (const p of c) {
    mean[0] += p[0];
    mean[1] += p[1];
    mean[2] += p[2];
  }
  mean[0] /= 4;
  mean[1] /= 4;
  mean[2] /= 4;
  let spread = 0;
  for (const p of c) {
    spread += Math.abs(p[0] - mean[0]) + Math.abs(p[1] - mean[1]) + Math.abs(p[2] - mean[2]);
  }
  return { ok: spread / 4 < 75, bg: mean as [number, number, number] };
}

/** Colour-distance keying — survives a navy mark on black, not just white paper. */
export function keySolidBackground(data: ImageData): boolean {
  const { ok, bg } = cornersAgree(data);
  if (!ok) return false;
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const dist = rgbDist(d[i]!, d[i + 1]!, d[i + 2]!, bg[0], bg[1], bg[2]);
    const a = Math.max(0, Math.min(1, (dist - 18) / 22));
    d[i + 3] = Math.round(a * d[i + 3]!);
  }
  return true;
}

/** Drop near-white / studio-paper backgrounds so a raster logo keeps transparency. */
export function knockOutPaper(data: ImageData, threshold = 245) {
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i]! >= threshold && d[i + 1]! >= threshold && d[i + 2]! >= threshold) {
      d[i + 3] = 0;
    }
  }
}

export function prepareLogo(data: ImageData) {
  if (!keySolidBackground(data)) knockOutPaper(data);
}

export type LogoStats = {
  count: number;
  lum: number;
  sat: number;
  std: number;
};

export function logoStats(data: ImageData): LogoStats {
  const d = data.data;
  let n = 0;
  let lum = 0;
  let sat = 0;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! <= 128) continue;
    n++;
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    lum += 0.299 * r + 0.587 * g + 0.114 * b;
    sat += Math.max(r, g, b) - Math.min(r, g, b);
    sr += r;
    sg += g;
    sb += b;
  }
  if (n < 20) return { count: n, lum: 128, sat: 0, std: 0 };
  const mr = sr / n;
  const mg = sg / n;
  const mb = sb / n;
  let varSum = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! <= 128) continue;
    varSum += Math.abs(d[i]! - mr) + Math.abs(d[i + 1]! - mg) + Math.abs(d[i + 2]! - mb);
  }
  return { count: n, lum: lum / n, sat: sat / n, std: varSum / (3 * n) };
}

export function isMulticolor(data: ImageData, tol = 26) {
  return logoStats(data).std > tol;
}

export function isNeutral(data: ImageData, tol = 34) {
  return logoStats(data).sat < tol;
}

/** Recolour every opaque pixel, keep anti-aliased alpha. */
export function recolorSolid(data: ImageData, rgb: [number, number, number]) {
  const d = data.data;
  const [sr, sg, sb] = rgb;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 8) continue;
    d[i] = sr;
    d[i + 1] = sg;
    d[i + 2] = sb;
  }
}

/** Flatten to a spot colour — alias of recolorSolid. Light marks stay marks. */
export function toSpotColor(data: ImageData, rgb: [number, number, number]) {
  recolorSolid(data, rgb);
}

/**
 * Multi-colour logo on a dark body: whiten only dark-neutral ink,
 * keep colour accents (Agoda dots, a green leaf).
 */
export function knockoutDarkNeutral(data: ImageData, lumThr = 150, satThr = 45) {
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]!;
    if (a <= 40) continue;
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (lum < lumThr && sat < satThr) {
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
    }
  }
}

/**
 * House colour rule (Hossam's 108 proofs):
 *  - sublimation keeps brand colour on a dark body unless the mark is a dark neutral
 *  - other print on dark: white knockout for mono, selective for multi
 *  - print on light: native colour, unless a near-white neutral that would vanish
 */
export function houseTreatPrint(
  data: ImageData,
  opts: { substrateLum: number; method: MethodId },
) {
  const dark = opts.substrateLum < 105;
  const stats = logoStats(data);
  const mono = stats.std <= 26;
  const neutral = stats.sat < 34;
  const keepColor = opts.method === "sublimation";

  if (keepColor) {
    if (dark && neutral && stats.lum < 130) recolorSolid(data, [255, 255, 255]);
    return;
  }
  if (dark) {
    if (mono) recolorSolid(data, [255, 255, 255]);
    else knockoutDarkNeutral(data);
    return;
  }
  if (mono && neutral && stats.lum > 205) recolorSolid(data, [20, 20, 20]);
}

/** Substrate hue, luminance-shifted — kraft, silicone, tone-on-tone print. */
export function toneOnTone(
  data: ImageData,
  substrate: [number, number, number],
  lum: number,
) {
  const rgb: [number, number, number] =
    lum > 110
      ? [
          Math.max(0, substrate[0] * 0.68),
          Math.max(0, substrate[1] * 0.68),
          Math.max(0, substrate[2] * 0.68),
        ]
      : [
          Math.min(255, substrate[0] * 1.4 + 34),
          Math.min(255, substrate[1] * 1.4 + 34),
          Math.min(255, substrate[2] * 1.4 + 34),
        ];
  recolorSolid(data, rgb);
}

export function applyTreatment(
  data: ImageData,
  treatment: Treatment,
  spot: [number, number, number],
  house?: { substrateLum: number; method: MethodId; substrateRgb?: [number, number, number] },
) {
  prepareLogo(data);
  if (treatment === "one_color") {
    recolorSolid(data, spot);
    return;
  }
  if (treatment === "tone") {
    toneOnTone(data, house?.substrateRgb ?? [140, 110, 80], house?.substrateLum ?? 140);
    return;
  }
  if (treatment === "full" || treatment === "knockout") return;
  if (house) houseTreatPrint(data, house);
}
