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
const AWARD_NAME = /\b(award|trophy|plaque|key ?tag|keychain)\b/;
const DISPLAY_NAME = /\b(billboard|totem|signage|display)\b/;
const TECH_NAME = /\b(power ?bank|usb|electronics|key ?tag|keychain)\b/;

const EXPECTED_ASPECT: Record<MarkClass, number> = {
  pen: 2.4,
  bottle: 0.94,
  bag: 1.43,
  cable: 1,
  notebook: 3.12,
  apparel: 1.38,
  tech: 1.56,
  award: 1.25,
  display: 1.25,
  default: 1.25,
};

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

export function bodyTrusted(bodyWidth: number, cls?: MarkClass | null) {
  const spec = classScale(cls);
  return spec.bodyLow <= bodyWidth && bodyWidth < spec.bodyHigh;
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
      if (b.w > b.h * 1.15) return rectQuad(cx, cy, b.w * 0.32, b.h * 0.42);
      return rectQuad(cx, b.y + b.h * 0.48, b.w * 0.34, b.h * 0.36);
    case "bag":
      return rectQuad(cx, b.y + b.h * 0.44, b.w * 0.4, b.h * 0.28);
    case "cable": {
      const s = Math.min(b.w, b.h) * 0.48;
      return rectQuad(cx, cy, s, s);
    }
    case "notebook":
      return rectQuad(b.x + b.w * 0.4, b.y + b.h * 0.36, b.w * 0.5, b.h * 0.16);
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

export type HygieneFinding = { code: "lifestyle" | "spec-strip" | "chrome" | "existing-art"; text: string };

export type ZoneKind = "demo" | "panel" | "class";

export type ZoneCandidate = {
  id: ZoneKind;
  label: string;
  quad: Quad;
  score: number;
  veto: string | null;
};

export type SurfaceMaps = {
  strap: CropRect | null;
  clasp: CropRect | null;
  ribs: CropRect | null;
  specular: CropRect[];
  demo: CropRect | null;
  panel: CropRect | null;
};

function overlapFrac(a: CropRect, b: CropRect) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return (x * y) / Math.max(1e-6, a.w * a.h);
}

function boxToQuad(c: CropRect): Quad {
  return cropToQuad({
    x: clamp(c.x, 0.02, 0.96),
    y: clamp(c.y, 0.02, 0.96),
    w: clamp(c.w, 0.04, 0.96),
    h: clamp(c.h, 0.04, 0.96),
  });
}

function quadToBox(q: Quad): CropRect {
  return boxOf(q);
}

function shiftBox(b: CropRect, dx: number, dy: number): CropRect {
  return { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h };
}

function bodyBBox(w: number, h: number, mask: Uint8Array): CropRect | null {
  let x0 = w,
    y0 = h,
    x1 = 0,
    y1 = 0,
    n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (n < 20) return null;
  return { x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h };
}

function connectedBoxes(
  on: Uint8Array,
  gw: number,
  gh: number,
  ox: number,
  oy: number,
  cw: number,
  ch: number,
): CropRect[] {
  const seen = new Uint8Array(on.length);
  const out: CropRect[] = [];
  for (let i = 0; i < on.length; i++) {
    if (!on[i] || seen[i]) continue;
    const stack = [i];
    seen[i] = 1;
    let minX = gw,
      minY = gh,
      maxX = 0,
      maxY = 0,
      n = 0;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % gw;
      const y = (p / gw) | 0;
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const neigh = [p - 1, p + 1, p - gw, p + gw];
      const ok = [x > 0, x + 1 < gw, y > 0, y + 1 < gh];
      for (let k = 0; k < 4; k++) {
        if (!ok[k]) continue;
        const q = neigh[k]!;
        if (on[q] && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (n < 2) continue;
    out.push({
      x: ox + (minX / gw) * cw,
      y: oy + (minY / gh) * ch,
      w: ((maxX - minX + 1) / gw) * cw,
      h: ((maxY - minY + 1) / gh) * ch,
    });
  }
  out.sort((a, b) => b.w * b.h - a.w * a.h);
  return out;
}

/**
 * Read the product surface. Hardware, specular, ribs, and a flat panel —
 * all body-relative, so a packed catalogue shot and a 1400 canvas agree.
 */
export function readSurface(opts: {
  w: number;
  h: number;
  lum: Float32Array;
  mask: Uint8Array;
  body?: CropRect | null;
}): SurfaceMaps {
  const { w, h, lum, mask } = opts;
  const empty: SurfaceMaps = { strap: null, clasp: null, ribs: null, specular: [], demo: null, panel: null };
  const body = opts.body ?? bodyBBox(w, h, mask);
  if (!body) return empty;
  const GW = 24;
  const GH = 24;
  const mean = new Float32Array(GW * GH);
  const vari = new Float32Array(GW * GH);
  const gx = new Float32Array(GW * GH);
  const hit = new Uint8Array(GW * GH);
  const x0 = body.x * w;
  const y0 = body.y * h;
  const cw = body.w * w;
  const ch = body.h * h;
  const cellW = cw / GW;
  const cellH = ch / GH;
  const vals: number[] = [];
  for (let gy = 0; gy < GH; gy++) {
    for (let gx_ = 0; gx_ < GW; gx_++) {
      const i = gy * GW + gx_;
      const sx = x0 + gx_ * cellW;
      const sy = y0 + gy * cellH;
      let s = 0,
        s2 = 0,
        n = 0;
      const xA = Math.max(0, Math.floor(sx));
      const xB = Math.min(w, Math.ceil(sx + cellW));
      const yA = Math.max(0, Math.floor(sy));
      const yB = Math.min(h, Math.ceil(sy + cellH));
      for (let y = yA; y < yB; y++) {
        for (let x = xA; x < xB; x++) {
          if (!mask[y * w + x]) continue;
          const v = lum[y * w + x]!;
          s += v;
          s2 += v * v;
          n++;
        }
      }
      if (n < 2) continue;
      hit[i] = 1;
      const m = s / n;
      mean[i] = m;
      vari[i] = Math.max(0, s2 / n - m * m);
      vals.push(m);
    }
  }
  for (let gy = 0; gy < GH; gy++) {
    for (let gx_ = 0; gx_ < GW - 1; gx_++) {
      const i = gy * GW + gx_;
      if (hit[i] && hit[i + 1]) gx[i] = Math.abs(mean[i]! - mean[i + 1]!);
    }
  }
  if (vals.length < 8) return empty;
  const sorted = [...vals].sort((a, b) => a - b);
  const med = sorted[(sorted.length * 0.5) | 0]!;
  const p92 = sorted[(sorted.length * 0.92) | 0]!;
  const span = Math.max(8, p92 - sorted[(sorted.length * 0.1) | 0]!);

  const rowMean = new Float32Array(GH);
  const rowN = new Float32Array(GH);
  for (let gy = 0; gy < GH; gy++) {
    let s = 0,
      n = 0;
    for (let gx_ = 0; gx_ < GW; gx_++) {
      const i = gy * GW + gx_;
      if (!hit[i]) continue;
      s += mean[i]!;
      n++;
    }
    rowN[gy] = n;
    rowMean[gy] = n ? s / n : med;
  }
  let strap: CropRect | null = null;
  let bestStrap = 0;
  for (let a = 0; a < GH; a++) {
    for (let b = a; b < Math.min(GH, a + 4); b++) {
      let s = 0,
        n = 0;
      for (let y = a; y <= b; y++) {
        if (rowN[y] < GW * 0.35) continue;
        s += Math.abs(rowMean[y]! - med);
        n++;
      }
      const score = n ? s / n : 0;
      const thick = (b - a + 1) / GH;
      if (score > bestStrap && score > span * 0.22 && thick >= 0.04 && thick <= 0.16) {
        bestStrap = score;
        strap = {
          x: body.x,
          y: body.y + (a / GH) * body.h,
          w: body.w,
          h: thick * body.h,
        };
      }
    }
  }

  let clasp: CropRect | null = null;
  let bestClasp = 0;
  for (let gy = Math.floor(GH * 0.28); gy < GH * 0.78; gy++) {
    for (let gx_ = Math.floor(GW * 0.55); gx_ < GW - 1; gx_++) {
      for (let hh = 2; hh <= 6; hh++) {
        for (let ww = 2; ww <= 6; ww++) {
          if (gy + hh > GH || gx_ + ww > GW) continue;
          let s = 0,
            v = 0,
            n = 0;
          for (let y = gy; y < gy + hh; y++) {
            for (let x = gx_; x < gx_ + ww; x++) {
              const i = y * GW + x;
              if (!hit[i]) continue;
              s += mean[i]!;
              v += vari[i]!;
              n++;
            }
          }
          if (n < 3) continue;
          const aspect = ww / hh;
          if (aspect < 0.35 || aspect > 2.8) continue;
          const score = v / n + Math.abs(s / n - med);
          const area = (ww / GW) * (hh / GH);
          if (score > bestClasp && score > span * 0.18 && area >= 0.01 && area <= 0.12) {
            bestClasp = score;
            clasp = {
              x: body.x + (gx_ / GW) * body.w,
              y: body.y + (gy / GH) * body.h,
              w: (ww / GW) * body.w,
              h: (hh / GH) * body.h,
            };
          }
        }
      }
    }
  }

  const specOn = new Uint8Array(GW * GH);
  for (let i = 0; i < specOn.length; i++) {
    if (hit[i] && mean[i]! >= p92 && mean[i]! >= med + span * 0.35) specOn[i] = 1;
  }
  const specular = connectedBoxes(specOn, GW, GH, body.x, body.y, body.w, body.h).filter((c) => {
    const thin = Math.min(c.w, c.h) / Math.max(c.w, c.h) < 0.32;
    const small = c.w * c.h < body.w * body.h * 0.12;
    return thin || (small && Math.max(c.w, c.h) < Math.max(body.w, body.h) * 0.35);
  });

  const colGx = new Float32Array(GW);
  for (let gx_ = 0; gx_ < GW; gx_++) {
    let s = 0,
      n = 0;
    for (let gy = 0; gy < GH; gy++) {
      const i = gy * GW + gx_;
      if (!hit[i]) continue;
      s += gx[i]!;
      n++;
    }
    colGx[gx_] = n ? s / n : 0;
  }
  const gxMed = [...colGx].sort((a, b) => a - b)[(GW * 0.5) | 0] || 1;
  const ribCols: number[] = [];
  for (let gx_ = 0; gx_ < GW; gx_++) if (colGx[gx_]! > gxMed * 1.7) ribCols.push(gx_);
  let ribs: CropRect | null = null;
  if (ribCols.length >= GW * 0.28) {
    ribs = {
      x: body.x + (Math.min(...ribCols) / GW) * body.w,
      y: body.y,
      w: ((Math.max(...ribCols) - Math.min(...ribCols) + 1) / GW) * body.w,
      h: body.h,
    };
  }

  const flatOn = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx_ = 0; gx_ < GW; gx_++) {
      const i = gy * GW + gx_;
      if (!hit[i]) continue;
      const cell: CropRect = {
        x: body.x + (gx_ / GW) * body.w,
        y: body.y + (gy / GH) * body.h,
        w: body.w / GW,
        h: body.h / GH,
      };
      const hard =
        (strap && overlapFrac(cell, strap) > 0.35) ||
        (clasp && overlapFrac(cell, clasp) > 0.35) ||
        specular.some((s) => overlapFrac(cell, s) > 0.4);
      const ribbed = ribs && overlapFrac(cell, ribs) > 0.5 && gx[i]! > gxMed * 1.4;
      if (!hard && !ribbed && vari[i]! < span * span * 0.08) flatOn[i] = 1;
    }
  }
  const flats = connectedBoxes(flatOn, GW, GH, body.x, body.y, body.w, body.h);
  const panel = flats.find((c) => (c.w * c.h) / (body.w * body.h) >= 0.05) ?? null;

  let demo: CropRect | null = null;
  let bestDemo = 0;
  for (let gy = 2; gy < GH - 2; gy++) {
    for (let gx_ = 2; gx_ < GW - 2; gx_++) {
      for (let hh = 2; hh <= 7; hh++) {
        for (let ww = 3; ww <= 10; ww++) {
          if (gy + hh >= GH || gx_ + ww >= GW) continue;
          let s = 0,
            v = 0,
            n = 0;
          for (let y = gy; y < gy + hh; y++) {
            for (let x = gx_; x < gx_ + ww; x++) {
              const i = y * GW + x;
              if (!hit[i]) continue;
              s += mean[i]!;
              v += vari[i]!;
              n++;
            }
          }
          if (n < 6) continue;
          const box: CropRect = {
            x: body.x + (gx_ / GW) * body.w,
            y: body.y + (gy / GH) * body.h,
            w: (ww / GW) * body.w,
            h: (hh / GH) * body.h,
          };
          const area = (box.w * box.h) / (body.w * body.h);
          if (area < 0.03 || area > 0.18) continue;
          const aspect = box.w / Math.max(1e-6, box.h);
          if (aspect < 0.8 || aspect > 4) continue;
          if (strap && overlapFrac(box, strap) > 0.25) continue;
          if (clasp && overlapFrac(box, clasp) > 0.25) continue;
          if (specular.some((s) => overlapFrac(box, s) > 0.3)) continue;
          const struct = v / n;
          if (struct < span * 0.4 || struct > span * span * 0.5) continue;
          if (struct > bestDemo) {
            bestDemo = struct;
            demo = box;
          }
        }
      }
    }
  }

  return { strap, clasp, ribs, specular, demo, panel };
}

function fitInPanel(panel: CropRect, cls: MarkClass, body: CropRect): CropRect {
  const prior = quadToBox(zoneForClass(cropToQuad(body), cls));
  const tw = Math.min(panel.w * 0.9, prior.w);
  const th = Math.min(panel.h * 0.9, prior.h);
  return {
    x: clamp(panel.x + panel.w / 2 - tw / 2, panel.x, panel.x + panel.w - tw),
    y: clamp(panel.y + panel.h / 2 - th / 2, panel.y, panel.y + panel.h - th),
    w: tw,
    h: th,
  };
}

function obstaclesOf(maps: SurfaceMaps): CropRect[] {
  const o: CropRect[] = [];
  if (maps.strap) o.push(maps.strap);
  if (maps.clasp) o.push(maps.clasp);
  if (maps.ribs) o.push(maps.ribs);
  o.push(...maps.specular);
  return o;
}

function vetoOf(box: CropRect, maps: SurfaceMaps, cls: MarkClass): string | null {
  if (maps.strap && overlapFrac(box, maps.strap) > 0.22) return "hardware";
  if (maps.clasp && overlapFrac(box, maps.clasp) > 0.22) return "hardware";
  if (maps.specular.some((s) => overlapFrac(box, s) > 0.28)) return "specular";
  if (cls === "notebook" && maps.ribs && overlapFrac(box, maps.ribs) > 0.45) return "ribs";
  return null;
}

function nudgeOffHardware(box: CropRect, maps: SurfaceMaps, body: CropRect, cls: MarkClass): CropRect {
  const obs = obstaclesOf(maps);
  if (!obs.length) return box;
  const tries: CropRect[] = [box];
  if (maps.strap) {
    tries.push(shiftBox(box, 0, maps.strap.y - box.h - 0.02 - box.y));
    tries.push(shiftBox(box, 0, maps.strap.y + maps.strap.h + 0.02 - box.y));
  }
  if (maps.clasp) {
    tries.push(shiftBox(box, maps.clasp.x - box.w - 0.02 - box.x, 0));
  }
  if (cls === "bottle") {
    tries.push({ x: body.x + body.w * 0.33, y: body.y + body.h * 0.38, w: body.w * 0.34, h: body.h * 0.36 });
  }
  let best = box;
  let bestPen = 99;
  for (const t of tries) {
    if (t.w < 0.04 || t.h < 0.04) continue;
    const clamped = {
      x: clamp(t.x, body.x, body.x + body.w - t.w),
      y: clamp(t.y, body.y, body.y + body.h - t.h),
      w: t.w,
      h: t.h,
    };
    let pen = 0;
    for (const o of obs) pen += overlapFrac(clamped, o);
    if (pen < bestPen) {
      bestPen = pen;
      best = clamped;
    }
  }
  return best;
}

/**
 * Class recipe is a prior, not the lock.
 * Rank: existing demo print > detected flat panel > nudged class prior.
 * Specular, clasp, strap, ribs veto a candidate. The picker must not recommend a veto.
 */
export function pickZone(opts: {
  cls: MarkClass;
  body: Quad;
  w?: number;
  h?: number;
  lum?: Float32Array;
  mask?: Uint8Array;
}): { winner: ZoneCandidate; candidates: ZoneCandidate[]; maps: SurfaceMaps } {
  const cls = opts.cls;
  const bodyBox = boxOf(opts.body);
  const classBox0 = quadToBox(zoneForClass(opts.body, cls));
  let maps: SurfaceMaps = { strap: null, clasp: null, ribs: null, specular: [], demo: null, panel: null };
  if (opts.w && opts.h && opts.lum && opts.mask) {
    maps = readSurface({ w: opts.w, h: opts.h, lum: opts.lum, mask: opts.mask, body: bodyBox });
    const ph = cls === "tech" || cls === "default" ? placeholderRect({ w: opts.w, h: opts.h, lum: opts.lum, mask: opts.mask }) : null;
    if (ph && !maps.panel) maps.panel = ph;
    else if (ph && maps.panel && ph.w * ph.h < maps.panel.w * maps.panel.h * 1.4) {
      const specish = maps.specular.some((s) => overlapFrac(ph, s) > 0.4);
      if (!specish) maps.demo = maps.demo ?? ph;
    }
    if (maps.panel) maps.panel = fitInPanel(maps.panel, cls, bodyBox);
  }
  const classBox = nudgeOffHardware(classBox0, maps, bodyBox, cls);
  const candidates: ZoneCandidate[] = [];
  const push = (id: ZoneKind, label: string, box: CropRect | null, score: number) => {
    if (!box) return;
    candidates.push({
      id,
      label,
      quad: boxToQuad(box),
      score,
      veto: vetoOf(box, maps, cls),
    });
  };
  push("demo", "where the demo print already is", maps.demo, 100);
  push("panel", "the flat panel", maps.panel, 70);
  push("class", "the usual place for this category", classBox, 40);
  const live = candidates.filter((c) => !c.veto);
  const winner =
    live.sort((a, b) => b.score - a.score)[0] ??
    candidates.find((c) => c.id === "class") ??
    ({
      id: "class" as const,
      label: "the usual place for this category",
      quad: zoneForClass(opts.body, cls),
      score: 40,
      veto: null,
    } satisfies ZoneCandidate);
  return { winner, candidates, maps };
}

export function recommendPlacement(opts: {
  cls: MarkClass;
  body: Quad;
  w?: number;
  h?: number;
  lum?: Float32Array;
  mask?: Uint8Array;
}) {
  const picked = pickZone(opts);
  const byId = (id: ZoneKind) => picked.candidates.find((c) => c.id === id) ?? null;
  const order: ZoneKind[] = ["demo", "panel", "class"];
  const pick = order.find((id) => {
    const c = byId(id);
    return c && !c.veto;
  }) ?? "class";
  return { pick, choices: picked.candidates, winner: picked.winner, maps: picked.maps };
}

export function canvasHygiene(opts: {
  w: number;
  h: number;
  lum: Float32Array;
  mask: Uint8Array;
}): { ok: boolean; block: boolean; findings: HygieneFinding[] } {
  const { w, h, lum, mask } = opts;
  const findings: HygieneFinding[] = [];
  const pad = Math.max(2, Math.round(Math.min(w, h) * 0.08));
  const corner = (x0: number, y0: number) => {
    const vs: number[] = [];
    for (let y = y0; y < y0 + pad; y++) {
      for (let x = x0; x < x0 + pad; x++) vs.push(lum[y * w + x]!);
    }
    const s = vs.reduce((a, b) => a + b, 0) / vs.length;
    return s;
  };
  const corners = [corner(0, 0), corner(w - pad, 0), corner(0, h - pad), corner(w - pad, h - pad)];
  const cMin = Math.min(...corners);
  const cMax = Math.max(...corners);
  if (cMax - cMin > 48) {
    findings.push({
      code: "lifestyle",
      text: "Canvas is a lifestyle shot, not a studio plate. Isolate the product before sending.",
    });
  }
  const body = bodyBBox(w, h, mask);
  const topH = Math.max(3, Math.round(h * 0.12));
  let topEdges = 0;
  let topN = 0;
  for (let y = 1; y < topH; y++) {
    for (let x = 1; x < w - 1; x += 2) {
      topN++;
      if (Math.abs(lum[y * w + x]! - lum[y * w + x - 1]!) > 28) topEdges++;
    }
  }
  const topInBody = body ? Math.max(0, Math.min(body.y + body.h, topH / h) - body.y) / Math.max(1e-6, topH / h) : 0;
  if (topN && topEdges / topN > 0.22 && topInBody < 0.45) {
    findings.push({
      code: "chrome",
      text: "Catalog chrome sits on the canvas (title, spec). Crop it off before the mark.",
    });
  }
  if (body) {
    const margin = 0.06;
    let strip = false;
    const bx0 = Math.round(body.x * w);
    const by0 = Math.round(body.y * h);
    const bx1 = Math.round((body.x + body.w) * w);
    const by1 = Math.round((body.y + body.h) * h);
    const edgeBlob = (x0: number, y0: number, x1: number, y1: number) => {
      let n = 0;
      let on = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          n++;
          if (mask[y * w + x]) continue;
          const v = lum[y * w + x]!;
          if (v < 40 || v > 220) on++;
        }
      }
      return n && on / n > 0.12 && on > 8;
    };
    if (edgeBlob(0, Math.max(0, by1), w, h)) strip = true;
    if (edgeBlob(0, 0, w, Math.max(1, by0))) strip = true;
    if (body.x > margin && edgeBlob(0, 0, bx0, h)) strip = true;
    if (body.x + body.w < 1 - margin && edgeBlob(bx1, 0, w, h)) strip = true;
    if (strip) {
      findings.push({
        code: "spec-strip",
        text: "Spec strip on the canvas. Do not send until it is gone.",
      });
    }
  }
  const block = findings.some((f) => f.code === "spec-strip" || f.code === "chrome");
  return { ok: findings.length === 0, block, findings };
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
      return cy > b.y + b.h * 0.22 && cy < b.y + b.h * 0.78 && zb.w <= b.w * 0.55 && zb.h <= b.h * 0.5;
    case "bag":
      return zb.w / Math.max(1e-6, b.w) < 0.55 && cy < b.y + b.h * 0.7;
    case "cable":
      return Math.abs(zb.w - zb.h) < 0.04 && zb.w <= Math.min(b.w, b.h) * 0.6;
    case "notebook":
      return zb.h <= b.h * 0.28 && zb.w <= b.w * 0.75 && zb.w >= b.w * 0.2;
    default:
      return zb.w > 0.02 && zb.h > 0.02 && cx > b.x && cx < b.x + b.w;
  }
}

/** Ranked pick-sheet score. Geometry stays hard; quality is a score. */
export const OFFER_FLOOR = 25;
export const GLARE_PENALTY_CAP = 28;
export const UPRIGHT_DEG = 50;
export const SLIVER_MINOR = 0.05;
export const SLIVER_ELONG = 4;
export const SPECULAR_ROUTE = 0.55;
export const AUTO_LOCK_TOP = 90;
export const AUTO_LOCK_RUNNER = 50;

type XY = [number, number];

export function expectedAspect(cls?: MarkClass | null) {
  return EXPECTED_ASPECT[cls ?? "default"] ?? 1.25;
}

function asXY(p: { x: number; y: number } | XY | number[]): XY {
  if (Array.isArray(p)) return [Number(p[0]), Number(p[1])];
  return [p.x, p.y];
}

function asPt(p: XY): { x: number; y: number } {
  return { x: p[0], y: p[1] };
}

function quadXY(q: Quad | { x: number; y: number }[]): XY[] {
  return q.map(asXY);
}

function quadPts(q: XY[]): Quad {
  return [asPt(q[0]!), asPt(q[1]!), asPt(q[2]!), asPt(q[3]!)];
}

function segLen(a: XY, b: XY) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function segAng(a: XY, b: XY) {
  let deg = Math.abs((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI);
  if (deg > 90) deg = 180 - deg;
  return deg;
}

/** Long-axis angle — never the presented top edge. */
export function longAxisAngle(quad: Quad | { x: number; y: number }[]) {
  const q = quadXY(quad);
  if (q.length < 4) return 0;
  const d01 = segLen(q[0]!, q[1]!);
  const d12 = segLen(q[1]!, q[2]!);
  return d01 >= d12 ? segAng(q[0]!, q[1]!) : segAng(q[1]!, q[2]!);
}

function axesOf(quad: Quad | { x: number; y: number }[]) {
  const q = quadXY(quad);
  const d01 = segLen(q[0]!, q[1]!);
  const d12 = segLen(q[1]!, q[2]!);
  return { major: Math.max(d01, d12), minor: Math.min(d01, d12) };
}

/** Cycle so TL→TR is the long axis. Transform, not a reject. */
export function uprightQuad(quad: Quad | { x: number; y: number }[]): Quad {
  let q = quadXY(quad);
  if (q.length < 4) return quadPts(q);
  const d01 = segLen(q[0]!, q[1]!);
  const d12 = segLen(q[1]!, q[2]!);
  if (d12 > d01) q = [q[1]!, q[2]!, q[3]!, q[0]!];
  if (q[1]![0] + q[1]![1] * 0.01 < q[0]![0] + q[0]![1] * 0.01 && segLen(q[0]!, q[1]!) >= segLen(q[1]!, q[2]!)) {
    q = [q[1]!, q[0]!, q[3]!, q[2]!];
  }
  const ang = longAxisAngle(quadPts(q));
  if (ang > UPRIGHT_DEG && segLen(q[1]!, q[2]!) > segLen(q[0]!, q[1]!) * 0.98) {
    q = [q[1]!, q[2]!, q[3]!, q[0]!];
  }
  return quadPts(q);
}

function sampleMask(quad: Quad, w: number, h: number, mask: Uint8Array, n = 8) {
  const q = quadXY(uprightQuad(quad));
  let on = 0;
  let tot = 0;
  for (let j = 0; j < n; j++) {
    const v = (j + 0.5) / n;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const a = (1 - u) * (1 - v);
      const b = u * (1 - v);
      const c = u * v;
      const d = (1 - u) * v;
      const x = a * q[0]![0] + b * q[1]![0] + c * q[2]![0] + d * q[3]![0];
      const y = a * q[0]![1] + b * q[1]![1] + c * q[2]![1] + d * q[3]![1];
      const ix = Math.floor(x * w);
      const iy = Math.floor(y * h);
      tot++;
      if (ix >= 0 && iy >= 0 && ix < w && iy < h && mask[iy * w + ix]) on++;
    }
  }
  const cx = q.reduce((s, p) => s + p[0], 0) / 4;
  const cy = q.reduce((s, p) => s + p[1], 0) / 4;
  const ix = Math.floor(cx * w);
  const iy = Math.floor(cy * h);
  const centre = ix >= 0 && iy >= 0 && ix < w && iy < h && !!mask[iy * w + ix];
  return { frac: on / Math.max(1, tot), centre };
}

function chromeFrac(box: CropRect, w: number, h: number, lum: Float32Array) {
  const minPx = Math.max(1, Math.round(Math.min(w, h) * 0.0025));
  const maxPx = Math.max(5, Math.round(Math.min(w, h) * 0.0125));
  const x0 = Math.max(0, Math.floor(box.x * w));
  const y0 = Math.max(0, Math.floor(box.y * h));
  const x1 = Math.min(w, Math.floor((box.x + box.w) * w) + 1);
  const y1 = Math.min(h, Math.floor((box.y + box.h) * h) + 1);
  if (x1 <= x0 || y1 <= y0) return 0;
  let hits = 0;
  let n = 0;
  const consume = (run: number) => {
    if (run >= minPx && run <= maxPx) hits += run;
  };
  for (let y = y0; y < y1; y++) {
    let run = 0;
    const row = y * w;
    for (let x = x0; x < x1; x++) {
      n++;
      if (lum[row + x]! >= 220) run++;
      else {
        consume(run);
        run = 0;
      }
    }
    consume(run);
  }
  for (let x = x0; x < x1; x++) {
    let run = 0;
    for (let y = y0; y < y1; y++) {
      if (lum[y * w + x]! >= 220) run++;
      else {
        consume(run);
        run = 0;
      }
    }
    consume(run);
  }
  return hits / Math.max(1, n * 2);
}

function glareFrac(box: CropRect, specular?: CropRect[] | null) {
  if (!specular?.length) return 0;
  return Math.max(...specular.map((s) => overlapFrac(box, s)));
}

function hardwareFrac(box: CropRect, maps?: SurfaceMaps | null) {
  if (!maps) return 0;
  let best = 0;
  for (const o of [maps.strap, maps.clasp, maps.ribs]) {
    if (o) best = Math.max(best, overlapFrac(box, o));
  }
  return best;
}

function panelAgree(box: CropRect, maps?: SurfaceMaps | null) {
  if (!maps) return 0;
  let best = 0;
  for (const o of [maps.panel, maps.demo]) {
    if (o) best = Math.max(best, overlapFrac(box, o));
  }
  return best;
}

function fitFace(box: CropRect, cls: MarkClass, body: CropRect): CropRect {
  const prior = quadToBox(zoneForClass(cropToQuad(body), cls));
  let tw = Math.min(box.w * 0.95, Math.max(box.w * 0.35, prior.w));
  let th = Math.min(box.h * 0.95, Math.max(box.h * 0.35, prior.h));
  tw = Math.min(tw, box.w);
  th = Math.min(th, box.h);
  return {
    x: clamp(box.x + box.w / 2 - tw / 2, box.x, box.x + box.w - tw),
    y: clamp(box.y + box.h / 2 - th / 2, box.y, box.y + box.h - th),
    w: tw,
    h: th,
  };
}

export type ScoredCandidate = {
  id?: string;
  label?: string;
  quad: Quad;
  fittedQuad: Quad;
  score: number;
  offered: boolean;
  fitted: boolean;
  pickable: boolean;
  veto: string | null;
  reasons: string[];
  metrics: {
    angle: number;
    aspect: number;
    expectedAspect: number;
    elong: number;
    minorOfBody: number;
    onBody: number;
    centre: boolean;
    glare: number;
    chrome: number;
    hardware: number;
    panel: number;
    offBody: number;
    specularRoute: boolean;
    glarePen: number;
  };
};

export function scoreCandidate(opts: {
  quad: Quad;
  cls: MarkClass;
  body: Quad | CropRect;
  w?: number;
  h?: number;
  lum?: Float32Array;
  mask?: Uint8Array;
  maps?: SurfaceMaps | null;
  route?: string | null;
}): ScoredCandidate {
  const upright = uprightQuad(opts.quad);
  const box = boxOf(upright);
  const bodyBox: CropRect =
    "w" in opts.body && !Array.isArray(opts.body)
      ? { x: opts.body.x, y: opts.body.y, w: opts.body.w, h: opts.body.h }
      : boxOf(opts.body as Quad);
  const { major, minor } = axesOf(upright);
  const bodySpan = Math.max(bodyBox.w, bodyBox.h, 1e-6);
  const minorOfBody = minor / bodySpan;
  const elong = major / Math.max(1e-6, minor);
  const aspect = box.w / Math.max(1e-6, box.h);
  const expected = expectedAspect(opts.cls);
  const aspectRatio = Math.max(aspect, expected) / Math.max(1e-6, Math.min(aspect, expected));
  const angle = longAxisAngle(upright);
  let onBody = 1;
  let centre = true;
  if (opts.w && opts.h && opts.mask) {
    const s = sampleMask(upright, opts.w, opts.h, opts.mask);
    onBody = s.frac;
    centre = s.centre;
  }
  const offBody = Math.max(0, 1 - onBody);
  const glare = glareFrac(box, opts.maps?.specular);
  const chrome = opts.w && opts.h && opts.lum ? chromeFrac(box, opts.w, opts.h, opts.lum) : 0;
  const hardware = hardwareFrac(box, opts.maps);
  const panel = panelAgree(box, opts.maps);
  const specularRoute = opts.route === "specular" || glare >= SPECULAR_ROUTE;
  const reasons: string[] = [];
  let score = 100;
  let glarePen = 0;
  if (specularRoute) {
    reasons.push("glare waived — candidate is the specular route");
  } else {
    glarePen = Math.min(GLARE_PENALTY_CAP, glare * 48);
    if (glarePen) {
      score -= glarePen;
      reasons.push(`glare ${glare.toFixed(2)} −${glarePen.toFixed(1)}`);
    }
  }
  const chromePen = Math.min(32, chrome * 90);
  if (chromePen) {
    score -= chromePen;
    reasons.push(`chrome ${chrome.toFixed(2)} −${chromePen.toFixed(1)}`);
  }
  const offPen = Math.min(40, offBody * 70);
  if (offPen) {
    score -= offPen;
    reasons.push(`off-body ${offBody.toFixed(2)} −${offPen.toFixed(1)}`);
  }
  if (aspectRatio > 1.4) {
    const aspPen = Math.min(22, (aspectRatio - 1.4) * 12);
    score -= aspPen;
    reasons.push(`aspect ${aspect.toFixed(2)} vs ${expected.toFixed(2)} −${aspPen.toFixed(1)}`);
  }
  const hwPen = Math.min(26, hardware * 50);
  if (hwPen) {
    score -= hwPen;
    reasons.push(`hardware ${hardware.toFixed(2)} −${hwPen.toFixed(1)}`);
  }
  if (panel > 0.35) {
    const bonus = panel > 0.55 ? 18 : 12;
    score += bonus;
    reasons.push(`panel +${bonus}`);
  }
  score = clamp(score, 0, 100);
  let veto: string | null = null;
  if (!centre) veto = "off-body-centre";
  else if (onBody < 0.5) veto = "off-body-area";
  else if (minorOfBody < SLIVER_MINOR && elong > SLIVER_ELONG) veto = "sliver";
  const offered = veto === null && score >= OFFER_FLOOR;
  const fittedBox = offered ? fitFace(box, opts.cls, bodyBox) : box;
  const fitted = offered && fittedBox.w > 0.03 && fittedBox.h > 0.03;
  return {
    quad: upright,
    fittedQuad: cropToQuad(fittedBox),
    score,
    offered,
    fitted,
    pickable: offered && fitted && !veto,
    veto,
    reasons,
    metrics: {
      angle,
      aspect,
      expectedAspect: expected,
      elong,
      minorOfBody,
      onBody,
      centre,
      glare,
      chrome,
      hardware,
      panel,
      offBody,
      specularRoute,
      glarePen,
    },
  };
}

export function pickable(scored: { offered?: boolean; fitted?: boolean; veto?: string | null }) {
  return Boolean(scored.offered && scored.fitted && !scored.veto);
}

export function faceCandidates(opts: {
  cls: MarkClass;
  body: Quad | CropRect;
  w?: number;
  h?: number;
  lum?: Float32Array;
  mask?: Uint8Array;
  extras?: (Quad | { quad: Quad; id?: string; label?: string; route?: string })[];
}) {
  const bodyPts: Quad =
    "w" in opts.body && !Array.isArray(opts.body) ? cropToQuad(opts.body) : (opts.body as Quad);
  const bodyBox = boxOf(bodyPts);
  let maps: SurfaceMaps = { strap: null, clasp: null, ribs: null, specular: [], demo: null, panel: null };
  if (opts.w && opts.h && opts.lum && opts.mask) {
    maps = readSurface({ w: opts.w, h: opts.h, lum: opts.lum, mask: opts.mask, body: bodyBox });
    const ph =
      opts.cls === "tech" || opts.cls === "default" || opts.cls === "award"
        ? placeholderRect({ w: opts.w, h: opts.h, lum: opts.lum, mask: opts.mask })
        : null;
    if (ph && !maps.panel) maps.panel = ph;
    if (maps.panel) maps.panel = fitInPanel(maps.panel, opts.cls, bodyBox);
  }
  const raw: { id: string; label: string; quad: Quad; route?: string }[] = [];
  if (maps.demo) raw.push({ id: "demo", label: "where the demo print already is", quad: cropToQuad(maps.demo) });
  if (maps.panel) raw.push({ id: "panel", label: "the flat panel", quad: cropToQuad(maps.panel) });
  if (opts.cls === "cable") raw.push({ id: "hub", label: "the disc / hub", quad: discQuad(bodyPts) });
  raw.push({ id: "class", label: "the usual place for this category", quad: zoneForClass(bodyPts, opts.cls) });
  (opts.extras ?? []).forEach((item, i) => {
    if (Array.isArray(item)) {
      raw.push({ id: `extra-${i}`, label: "detected face", quad: item });
    } else {
      raw.push({
        id: item.id ?? `extra-${i}`,
        label: item.label ?? "detected face",
        quad: item.quad,
        route: item.route,
      });
    }
  });
  const seen = new Set<string>();
  const sheet: ScoredCandidate[] = [];
  for (const r of raw) {
    const b = boxOf(r.quad);
    const key = `${b.x.toFixed(3)}:${b.y.toFixed(3)}:${b.w.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const scored = scoreCandidate({
      quad: r.quad,
      cls: opts.cls,
      body: bodyPts,
      w: opts.w,
      h: opts.h,
      lum: opts.lum,
      mask: opts.mask,
      maps,
      route: r.route,
    });
    scored.id = r.id;
    scored.label = r.label;
    sheet.push(scored);
  }
  sheet.sort((a, b) => Number(b.pickable) - Number(a.pickable) || b.score - a.score);
  const live = sheet.filter((c) => c.pickable);
  const lock = autoLock(sheet);
  return { sheet, winner: live[0] ?? sheet[0] ?? null, maps, autoLock: lock };
}

export function autoLock(sheet: ScoredCandidate[]) {
  const live = sheet.filter((c) => c.pickable);
  const top = live[0] ?? null;
  const runner = live[1] ?? null;
  const topS = top?.score ?? 0;
  const runS = runner?.score ?? 0;
  const locked = Boolean(top && runner && topS >= AUTO_LOCK_TOP && runS <= AUTO_LOCK_RUNNER);
  return {
    locked,
    top: topS,
    runner: runS,
    winner: locked ? top : null,
    reason: locked
      ? `top ${topS.toFixed(1)} ≥ ${AUTO_LOCK_TOP}, runner ${runS.toFixed(1)} ≤ ${AUTO_LOCK_RUNNER}`
      : "gap too small to pre-confirm",
  };
}

