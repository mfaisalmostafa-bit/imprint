export type Treatment = "full" | "knockout" | "one_color";

/** Drop near-white / studio-paper backgrounds so a raster logo keeps transparency. */
export function knockOutPaper(data: ImageData, threshold = 242) {
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    if (r >= threshold && g >= threshold && b >= threshold) {
      d[i + 3] = 0;
    }
  }
}

/** Flatten opaque pixels to a single print-safe spot colour, keep alpha. */
export function toSpotColor(data: ImageData, rgb: [number, number, number]) {
  const d = data.data;
  const [sr, sg, sb] = rgb;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]!;
    if (a < 8) continue;
    const lum = (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255;
    const mark = lum < 0.82;
    if (!mark) {
      d[i + 3] = 0;
      continue;
    }
    d[i] = sr;
    d[i + 1] = sg;
    d[i + 2] = sb;
  }
}

export const SPOT_SWATCHES: { id: string; label: string; rgb: [number, number, number] }[] = [
  { id: "navy", label: "TPX Navy", rgb: [11, 31, 58] },
  { id: "orange", label: "TPX Orange", rgb: [232, 93, 4] },
  { id: "black", label: "Black", rgb: [22, 22, 24] },
  { id: "white", label: "White", rgb: [244, 241, 234] },
  { id: "silver", label: "Silver", rgb: [188, 192, 196] },
];
