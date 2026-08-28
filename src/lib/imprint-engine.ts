/** Category mark scale. One global 0.18–0.72 body clamp misses slim bottles and full-frame bags. */

import { clamp, type Quad } from "./geometry";

export type MarkClass =
  | "pen"
  | "bottle"
  | "bag"
  | "cable"
  | "notebook"
  | "apparel"
  | "tech"
  | "award"
  | "display"
  | "default";

export type ClassScale = {
  id: MarkClass;
  /** Mark width as a fraction of a trusted body. */
  markOfBody: number;
  minScale: number;
  maxScale: number;
  /**
   * Body-width trust band, as a fraction of the *current frame*.
   * Catalogue photos pack the product small; the 1400 canvas fills it.
   * Bands are wide enough that both framings stay trusted.
   */
  bodyLow: number;
  bodyHigh: number;
  zone: string;
  badge: string;
  /** Studio-canvas fill. Notebooks stay under 0.72 so the cover is not clipped. */
  canvasFill: number;
  canvasPad: number;
};

export const CLASS_SCALE: Record<MarkClass, ClassScale> = {
  pen: {
    id: "pen",
    markOfBody: 0.78,
    minScale: 0.55,
    maxScale: 0.96,
    bodyLow: 0.03,
    bodyHigh: 0.99,
    zone: "barrel",
    badge: "PEN · barrel",
    canvasFill: 0.7,
    canvasPad: 0.08,
  },
  bottle: {
    id: "bottle",
    markOfBody: 0.42,
    minScale: 0.28,
    maxScale: 0.72,
    bodyLow: 0.05,
    bodyHigh: 0.92,
    zone: "mid-body",
    badge: "BOTTLE · mid-body",
    canvasFill: 0.68,
    canvasPad: 0.1,
  },
  bag: {
    id: "bag",
    markOfBody: 0.3,
    minScale: 0.22,
    maxScale: 0.48,
    bodyLow: 0.22,
    bodyHigh: 0.995,
    zone: "front panel",
    badge: "BAG · front panel",
    canvasFill: 0.7,
    canvasPad: 0.06,
  },
  cable: {
    id: "cable",
    markOfBody: 0.55,
    minScale: 0.55,
    maxScale: 0.92,
    bodyLow: 0.08,
    bodyHigh: 0.95,
    zone: "disc",
    badge: "CABLE · disc",
    canvasFill: 0.64,
    canvasPad: 0.1,
  },
  notebook: {
    id: "notebook",
    markOfBody: 0.36,
    minScale: 0.32,
    maxScale: 0.7,
    bodyLow: 0.18,
    bodyHigh: 0.96,
    zone: "cover band",
    badge: "NOTEBOOK · band",
    canvasFill: 0.62,
    canvasPad: 0.12,
  },
  apparel: {
    id: "apparel",
    markOfBody: 0.22,
    minScale: 0.45,
    maxScale: 0.92,
    bodyLow: 0.2,
    bodyHigh: 0.96,
    zone: "chest",
    badge: "APPAREL · chest",
    canvasFill: 0.72,
    canvasPad: 0.06,
  },
  tech: {
    id: "tech",
    markOfBody: 0.42,
    minScale: 0.32,
    maxScale: 0.86,
    bodyLow: 0.1,
    bodyHigh: 0.95,
    zone: "face",
    badge: "TECH · face",
    canvasFill: 0.68,
    canvasPad: 0.08,
  },
  award: {
    id: "award",
    markOfBody: 0.28,
    minScale: 0.3,
    maxScale: 0.78,
    bodyLow: 0.12,
    bodyHigh: 0.92,
    zone: "face",
    badge: "AWARD · face",
    canvasFill: 0.7,
    canvasPad: 0.08,
  },
  display: {
    id: "display",
    markOfBody: 0.7,
    minScale: 0.5,
    maxScale: 0.92,
    bodyLow: 0.2,
    bodyHigh: 0.98,
    zone: "print face",
    badge: "DISPLAY · face",
    canvasFill: 0.78,
    canvasPad: 0.04,
  },
  default: {
    id: "default",
    markOfBody: 0.38,
    minScale: 0.22,
    maxScale: 0.72,
    bodyLow: 0.08,
    bodyHigh: 0.95,
    zone: "print face",
    badge: "ENGINE · print face",
    canvasFill: 0.7,
    canvasPad: 0.08,
  },
};

/**
 * decoration.resolve family / catalogue category → mark class.
 * Keys are lowercased tokens. Never SKU codes.
 */
const FAMILY_CLASS: Record<string, MarkClass> = {
  pen: "pen",
  pens: "pen",
  writing: "pen",
  pencil: "pen",
  bottle: "bottle",
  bottles: "bottle",
  drinkware: "bottle",
  tumbler: "bottle",
  flask: "bottle",
  mug: "bottle",
  cup: "bottle",
  thermos: "bottle",
  bag: "bag",
  bags: "bag",
  tote: "bag",
  backpack: "bag",
  rucksack: "bag",
  packaging: "bag",
  notebook: "notebook",
  notebooks: "notebook",
  stationery: "notebook",
  journal: "notebook",
  cable: "cable",
  cables: "cable",
  hub: "cable",
  tech: "tech",
  electronics: "tech",
  usb: "tech",
  powerbank: "tech",
  apparel: "apparel",
  textile: "apparel",
  clothing: "apparel",
  award: "award",
  awards: "award",
  display: "display",
  signage: "display",
};

const CATEGORY_CLASS: Record<string, MarkClass> = {
  writing: "pen",
  drinkware: "bottle",
  stationery: "notebook",
  apparel: "apparel",
  awards: "award",
  display: "display",
  packaging: "bag",
  tech: "tech",
};

const CABLE_NAME = /\b(cable|cables|hub|charging disc)\b/;
const PEN_NAME = /\b(pen|pens|pencil|ballpoint)\b/;
const BOTTLE_NAME = /\b(bottle|flask|tumbler|mug|cup|thermos|drinkware)\b/;
const BAG_NAME = /\b(backpack|rucksack|tote|bag|bags)\b/;
const NOTE_NAME = /\b(notebook|journal|diary|stationery)\b/;
const APPAREL_NAME = /\b(polo|t-?shirt|hoodie|cap|apparel|textile)\b/;
const AWARD_NAME = /\b(award|trophy|plaque)\b/;
const DISPLAY_NAME = /\b(billboard|totem|signage|display)\b/;
const TECH_NAME = /\b(power ?bank|usb|electronics)\b/;

function tokeniseFamily(family?: string | { family?: string; kind?: string; class?: string } | null): string[] {
  if (!family) return [];
  const raw =
    typeof family === "string"
      ? family
      : family.family || family.kind || family.class || "";
  return raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export type ClassifyInput = {
  category?: string;
  name?: string;
  material?: string;
  /** decoration.resolve family (string or {family|kind|class}). */
  family?: string | { family?: string; kind?: string; class?: string };
  /** Accepted but ignored — classification is never by SKU. */
  sku?: string;
  id?: string;
};

/**
 * Classify by category / decoration family / name tokens.
 * Never by SKU literal. The catalogue is 1,486 products; SKU branches do not scale.
 */
export function markClassOf(input: ClassifyInput): MarkClass {
  const cat = (input.category ?? "").trim().toLowerCase();
  const blob = `${input.name ?? ""} ${input.material ?? ""}`.toLowerCase();

  for (const tok of tokeniseFamily(input.family)) {
    const mapped = FAMILY_CLASS[tok];
    if (mapped) {
      if (mapped === "tech" && CABLE_NAME.test(blob)) return "cable";
      return mapped;
    }
  }

  const fromCat = CATEGORY_CLASS[cat];
  if (fromCat) {
    if (fromCat === "tech" && CABLE_NAME.test(blob)) return "cable";
    return fromCat;
  }

  if (CABLE_NAME.test(blob)) return "cable";
  if (PEN_NAME.test(blob)) return "pen";
  if (NOTE_NAME.test(blob)) return "notebook";
  if (BAG_NAME.test(blob)) return "bag";
  if (BOTTLE_NAME.test(blob)) return "bottle";
  if (APPAREL_NAME.test(blob)) return "apparel";
  if (AWARD_NAME.test(blob)) return "award";
  if (DISPLAY_NAME.test(blob)) return "display";
  if (TECH_NAME.test(blob)) return "tech";
  return "default";
}

export const classify = markClassOf;

export function classScale(cls?: MarkClass | null): ClassScale {
  return CLASS_SCALE[cls ?? "default"] ?? CLASS_SCALE.default;
}

function rectQuad(cx: number, cy: number, w: number, h: number): Quad {
  const hw = w / 2;
  const hh = h / 2;
  return [
    { x: clamp(cx - hw, 0.02, 0.98), y: clamp(cy - hh, 0.02, 0.98) },
    { x: clamp(cx + hw, 0.02, 0.98), y: clamp(cy - hh, 0.02, 0.98) },
    { x: clamp(cx + hw, 0.02, 0.98), y: clamp(cy + hh, 0.02, 0.98) },
    { x: clamp(cx - hw, 0.02, 0.98), y: clamp(cy + hh, 0.02, 0.98) },
  ];
}

export type BodyBox = { x: number; y: number; w: number; h: number };

export function boxOf(q: Quad): BodyBox {
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Print zone from a product body, per class. Catalog quads still win when authored. */
export function zoneForClass(body: Quad, cls: MarkClass): Quad {
  const b = boxOf(body);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  switch (cls) {
    case "pen": {
      const horiz = b.w > b.h * 1.25;
      if (horiz) return rectQuad(cx, cy, b.w * 0.58, b.h * 0.62);
      return rectQuad(cx, cy - b.h * 0.06, b.w * 0.62, b.h * 0.32);
    }
    case "bottle":
      return rectQuad(cx, b.y + b.h * 0.5, b.w * 0.7, b.h * 0.32);
    case "bag":
      return rectQuad(cx, b.y + b.h * 0.44, b.w * 0.4, b.h * 0.28);
    case "cable": {
      const s = Math.min(b.w, b.h) * 0.48;
      return rectQuad(cx, cy, s, s);
    }
    case "notebook":
      return rectQuad(cx, b.y + b.h * 0.62, b.w * 0.56, b.h * 0.18);
    case "apparel":
      return rectQuad(b.x + b.w * 0.38, b.y + b.h * 0.34, b.w * 0.22, b.h * 0.16);
    case "tech":
      return rectQuad(cx, cy, b.w * 0.56, b.h * 0.36);
    default:
      return rectQuad(cx, cy, b.w * 0.5, b.h * 0.4);
  }
}

export type CropRect = { x: number; y: number; w: number; h: number };

function clampCrop(c: CropRect): CropRect {
  let { x, y, w, h } = c;
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  if (w < 0.2) w = Math.min(1, 0.2);
  if (h < 0.2) h = Math.min(1, 0.2);
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1), w: clamp(w, 0.08, 1), h: clamp(h, 0.08, 1) };
}

/**
 * Smart-canvas crop. Body occupies `canvasFill` of the 1400 frame.
 * Notebooks keep the full cover — never a clasp-only or rib-only clip.
 */
export function smartCanvasCrop(body: CropRect, cls: MarkClass): CropRect {
  const spec = classScale(cls);
  const pad = spec.canvasPad;
  const fill = spec.canvasFill;
  const w = Math.max(body.w * (1 + 2 * pad), Math.min(1, body.w / fill));
  const h = Math.max(body.h * (1 + 2 * pad), Math.min(1, body.h / fill));
  let crop: CropRect = {
    x: body.x + body.w / 2 - w / 2,
    y: body.y + body.h / 2 - h / 2,
    w,
    h,
  };
  if (cls === "notebook") {
    crop.w = Math.max(crop.w, body.w * 0.9);
    crop.h = Math.max(crop.h, body.h * 0.9);
    crop.x = body.x + body.w / 2 - crop.w / 2;
    crop.y = body.y + body.h / 2 - crop.h / 2;
  }
  return clampCrop(crop);
}

export function notebookCropSane(crop: CropRect, body: CropRect) {
  const cover =
    (Math.min(crop.x + crop.w, body.x + body.w) - Math.max(crop.x, body.x)) *
    (Math.min(crop.y + crop.h, body.y + body.h) - Math.max(crop.y, body.y));
  const bodyA = Math.max(1e-6, body.w * body.h);
  return cover / bodyA >= 0.85;
}

/** Body box as a fraction of the 1400 canvas after smart crop. */
export function bodyOnCanvas(body: CropRect, crop: CropRect): CropRect {
  return {
    x: (body.x - crop.x) / Math.max(1e-6, crop.w),
    y: (body.y - crop.y) / Math.max(1e-6, crop.h),
    w: body.w / Math.max(1e-6, crop.w),
    h: body.h / Math.max(1e-6, crop.h),
  };
}

/**
 * Bright rectangular placeholder on a product face.
 * Size is a fraction of the *body* (mask), not the frame, so a packed
 * catalogue photo and a 1400 canvas rebuild hit the same band.
 * Contrast is percentile-relative, not an absolute 18-grey floor.
 */
export function placeholderRect(opts: {
  w: number;
  h: number;
  lum: Float32Array;
  mask: Uint8Array;
}): CropRect | null {
  const { w, h, lum, mask } = opts;
  const body: number[] = [];
  let bminX = w,
    bminY = h,
    bmaxX = 0,
    bmaxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      body.push(lum[i]!);
      if (x < bminX) bminX = x;
      if (x > bmaxX) bmaxX = x;
      if (y < bminY) bminY = y;
      if (y > bmaxY) bmaxY = y;
    }
  }
  if (body.length < 40) return null;
  const sorted = [...body].sort((a, b) => a - b);
  const n = sorted.length;
  const lo = sorted[Math.floor(n * 0.18)]!;
  const med = sorted[Math.floor(n * 0.5)]!;
  const hi = sorted[Math.floor(n * 0.82)]!;
  const span = hi - lo;
  if (span < 8) return null;
  if (hi - med < span * 0.18) return null;
  const thresh = med + (hi - med) * 0.45;
  const on = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) on[i] = mask[i] && lum[i]! >= thresh ? 1 : 0;
  let minX = w,
    minY = h,
    maxX = 0,
    maxY = 0,
    hits = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on[y * w + x]) continue;
      hits++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (hits < 12) return null;
  const bodyWpx = Math.max(1, bmaxX - bminX + 1);
  const bodyHpx = Math.max(1, bmaxY - bminY + 1);
  const pw = (maxX - minX + 1) / bodyWpx;
  const ph = (maxY - minY + 1) / bodyHpx;
  if (pw < 0.15 || ph < 0.08 || pw > 0.85 || ph > 0.7) return null;
  const aspect = pw / Math.max(0.001, ph);
  if (aspect < 0.7 || aspect > 4.5) return null;
  return {
    x: minX / w,
    y: minY / h,
    w: (maxX - minX + 1) / w,
    h: (maxY - minY + 1) / h,
  };
}

export function cropToQuad(c: CropRect): Quad {
  return [
    { x: c.x, y: c.y },
    { x: c.x + c.w, y: c.y },
    { x: c.x + c.w, y: c.y + c.h },
    { x: c.x, y: c.y + c.h },
  ];
}

/** Disc-only zone for cables / hubs. Square inset of the round face — body-relative, not pixel radius. */
export function discQuad(body: Quad): Quad {
  const b = boxOf(body);
  const s = Math.min(b.w, b.h) * 0.46;
  return rectQuad(b.x + b.w / 2, b.y + b.h / 2, s, s);
}

export function assertZone(cls: MarkClass, body: Quad) {
  const z = zoneForClass(body, cls);
  const b = boxOf(body);
  const zb = boxOf(z);
  const cx = zb.x + zb.w / 2;
  const cy = zb.y + zb.h / 2;
  switch (cls) {
    case "pen":
      return zb.w >= b.w * 0.4 && zb.h <= b.h * 0.8;
    case "bottle":
      return cy > b.y + b.h * 0.28 && cy < b.y + b.h * 0.72 && zb.h <= b.h * 0.45;
    case "bag":
      return zb.w / Math.max(1e-6, b.w) < 0.55 && cy < b.y + b.h * 0.7;
    case "cable":
      return Math.abs(zb.w - zb.h) < 0.04 && zb.w <= Math.min(b.w, b.h) * 0.6;
    case "notebook":
      return zb.y > b.y + b.h * 0.4 && zb.h <= b.h * 0.28;
    default:
      return zb.w > 0.02 && zb.h > 0.02 && cx > b.x && cx < b.x + b.w;
  }
}
