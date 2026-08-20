export type AspectId = "free" | "1:1" | "4:5" | "3:2" | "4:3" | "16:9" | "9:16";

export type CropRect = { x: number; y: number; w: number; h: number };

export type FilterId =
  | "none"
  | "film"
  | "silver"
  | "ink"
  | "frost"
  | "punch"
  | "muted"
  | "night";

export type Adjustments = {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  saturation: number;
  warmth: number;
  vignette: number;
  sharpen: number;
};

export type EditDraft = {
  crop: CropRect;
  aspect: AspectId;
  rotation: number;
  straighten: number;
  flipH: boolean;
  flipV: boolean;
  adjustments: Adjustments;
  filter: FilterId;
};

export const ASPECTS: { id: AspectId; label: string; value: number | null }[] = [
  { id: "free", label: "Free", value: null },
  { id: "1:1", label: "1:1", value: 1 },
  { id: "4:5", label: "4:5", value: 4 / 5 },
  { id: "3:2", label: "3:2", value: 3 / 2 },
  { id: "4:3", label: "4:3", value: 4 / 3 },
  { id: "16:9", label: "16:9", value: 16 / 9 },
  { id: "9:16", label: "9:16", value: 9 / 16 },
];

export const FILTERS: { id: FilterId; label: string }[] = [
  { id: "none", label: "None" },
  { id: "film", label: "Film" },
  { id: "silver", label: "Silver" },
  { id: "ink", label: "Ink" },
  { id: "frost", label: "Frost" },
  { id: "punch", label: "Punch" },
  { id: "muted", label: "Mute" },
  { id: "night", label: "Night" },
];

export const DEFAULT_ADJUST: Adjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  warmth: 0,
  vignette: 0,
  sharpen: 0,
};

export const DEFAULT_EDIT: EditDraft = {
  crop: { x: 0, y: 0, w: 1, h: 1 },
  aspect: "free",
  rotation: 0,
  straighten: 0,
  flipH: false,
  flipV: false,
  adjustments: { ...DEFAULT_ADJUST },
  filter: "none",
};

export function cloneEdit(e: EditDraft): EditDraft {
  return {
    ...e,
    crop: { ...e.crop },
    adjustments: { ...e.adjustments },
  };
}

export function editIsIdentity(e: EditDraft): boolean {
  const a = e.adjustments;
  const c = e.crop;
  return (
    c.x === 0 &&
    c.y === 0 &&
    c.w === 1 &&
    c.h === 1 &&
    e.rotation === 0 &&
    e.straighten === 0 &&
    !e.flipH &&
    !e.flipV &&
    e.filter === "none" &&
    a.exposure === 0 &&
    a.contrast === 0 &&
    a.highlights === 0 &&
    a.shadows === 0 &&
    a.saturation === 0 &&
    a.warmth === 0 &&
    a.vignette === 0 &&
    a.sharpen === 0
  );
}

export function aspectValue(id: AspectId): number | null {
  return ASPECTS.find((a) => a.id === id)?.value ?? null;
}

export function clampCrop(c: CropRect, aspect: number | null = null): CropRect {
  let w = Math.max(0.08, Math.min(1, c.w));
  let h = Math.max(0.08, Math.min(1, c.h));
  if (aspect && aspect > 0) {
    const imgAspect = 1;
    const target = aspect / imgAspect;
    if (w / h > target) w = h * target;
    else h = w / target;
    w = Math.max(0.08, Math.min(1, w));
    h = Math.max(0.08, Math.min(1, h));
  }
  const x = Math.max(0, Math.min(1 - w, c.x));
  const y = Math.max(0, Math.min(1 - h, c.y));
  return { x, y, w, h };
}

/** Fit a crop to an aspect using the image's pixel aspect (w/h). */
export function fitCropToAspect(
  crop: CropRect,
  imageAspect: number,
  aspect: number | null,
): CropRect {
  if (!aspect) return clampCrop(crop);
  const target = aspect / imageAspect;
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  let w = crop.w;
  let h = crop.h;
  if (w / h > target) w = h * target;
  else h = w / target;
  if (w > 1) {
    h *= 1 / w;
    w = 1;
  }
  if (h > 1) {
    w *= 1 / h;
    h = 1;
  }
  return clampCrop({ x: cx - w / 2, y: cy - h / 2, w, h });
}

function clampByte(n: number) {
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function applyFilterMatrix(
  r: number,
  g: number,
  b: number,
  filter: FilterId,
): [number, number, number] {
  if (filter === "none") return [r, g, b];
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  switch (filter) {
    case "silver":
      return [lum * 1.04, lum, lum * 0.96];
    case "ink": {
      const v = lum > 140 ? 245 : lum < 70 ? 18 : lum * 1.15;
      return [v, v, v];
    }
    case "film":
      return [r * 1.06 + 6, g * 0.98 + 2, b * 0.9];
    case "frost":
      return [r * 0.86 + 28, g * 0.88 + 26, b * 0.92 + 30];
    case "punch":
      return [
        (r - 128) * 1.22 + 128,
        (g - 128) * 1.18 + 128,
        (b - 128) * 1.12 + 128,
      ];
    case "muted":
      return [
        lum * 0.45 + r * 0.55,
        lum * 0.45 + g * 0.55,
        lum * 0.5 + b * 0.5,
      ];
    case "night":
      return [r * 0.72, g * 0.82, b * 1.08 + 8];
    default:
      return [r, g, b];
  }
}

function processPixels(data: ImageData, edit: EditDraft) {
  const a = edit.adjustments;
  const d = data.data;
  const w = data.width;
  const h = data.height;
  const exp = Math.pow(2, a.exposure);
  const contrast = 1 + a.contrast;
  const sat = 1 + a.saturation;
  const warm = a.warmth * 36;
  const hi = a.highlights;
  const sh = a.shadows;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 2) continue;
    let r = d[i]! * exp;
    let g = d[i + 1]! * exp;
    let b = d[i + 2]! * exp;
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const t = lum / 255;
    const lift = sh * (1 - t) * 48;
    const drop = hi * t * -40;
    r += lift + drop;
    g += lift + drop;
    b += lift + drop;
    r = lum + (r - lum) * sat + warm;
    g = lum + (g - lum) * sat;
    b = lum + (b - lum) * sat - warm * 0.7;
    [r, g, b] = applyFilterMatrix(r, g, b, edit.filter);
    d[i] = clampByte(r);
    d[i + 1] = clampByte(g);
    d[i + 2] = clampByte(b);
  }

  if (a.vignette > 0.01) {
    const cx = w / 2;
    const cy = h / 2;
    const maxD = Math.hypot(cx, cy) || 1;
    const amt = a.vignette;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3]! < 2) continue;
        const f = Math.pow(Math.hypot(x - cx, y - cy) / maxD, 1.6) * amt;
        const m = 1 - f * 0.72;
        d[i] = clampByte(d[i]! * m);
        d[i + 1] = clampByte(d[i + 1]! * m);
        d[i + 2] = clampByte(d[i + 2]! * m);
      }
    }
  }

  if (a.sharpen > 0.02) {
    const copy = new Uint8ClampedArray(d);
    const k = a.sharpen * 0.55;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        if (copy[i + 3]! < 2) continue;
        for (let c = 0; c < 3; c++) {
          const c0 = copy[i + c]!;
          const blur =
            (copy[((y - 1) * w + x) * 4 + c]! +
              copy[((y + 1) * w + x) * 4 + c]! +
              copy[(y * w + (x - 1)) * 4 + c]! +
              copy[(y * w + (x + 1)) * 4 + c]!) /
            4;
          d[i + c] = clampByte(c0 + (c0 - blur) * k * 2);
        }
      }
    }
  }
}

export function applyEdit(
  img: HTMLImageElement,
  edit: EditDraft,
  maxEdge = 1800,
): HTMLCanvasElement {
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  const crop = edit.crop;
  const sx = crop.x * nw;
  const sy = crop.y * nh;
  const sw = Math.max(1, crop.w * nw);
  const sh = Math.max(1, crop.h * nh);
  const angle = ((edit.rotation + edit.straighten) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  let bw = sw * cos + sh * sin;
  let bh = sw * sin + sh * cos;
  const scale = Math.min(1, maxEdge / Math.max(bw, bh));
  bw = Math.max(1, Math.round(bw * scale));
  bh = Math.max(1, Math.round(bh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = bw;
  canvas.height = bh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(bw / 2, bh / 2);
  ctx.rotate(angle);
  ctx.scale(edit.flipH ? -1 : 1, edit.flipV ? -1 : 1);
  ctx.drawImage(img, sx, sy, sw, sh, (-sw * scale) / 2, (-sh * scale) / 2, sw * scale, sh * scale);

  const pixels = ctx.getImageData(0, 0, bw, bh);
  processPixels(pixels, edit);
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality = 0.92,
): string {
  return canvas.toDataURL(type, quality);
}
