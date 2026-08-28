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

export function markClassOf(input: {
  id?: string;
  sku?: string;
  category?: string;
  name?: string;
}): MarkClass {
  const id = (input.id ?? "").toLowerCase();
  const sku = (input.sku ?? "").toUpperCase();
  const cat = (input.category ?? "").toLowerCase();
  const name = (input.name ?? "").toLowerCase();
  const blob = `${id} ${sku} ${name}`;

  if (sku === "LR-CBL01" || sku.includes("CBL") || id === "lr-cbl01" || /\bcable\b|\bhub\b|\bdisc\b/.test(blob))
    return "cable";
  if (sku === "TH164" || id === "th164" || id === "flask" || id === "mug" || id === "cup" || cat === "drinkware")
    return "bottle";
  if (sku === "BP70" || id === "bp70" || id === "bag" || id === "tote" || /\bbackpack\b|\btote\b|\bbag\b/.test(blob))
    return "bag";
  if (sku === "NB146" || id === "nb146" || id === "notebook" || cat === "stationery") return "notebook";
  if (sku === "P202" || id === "p202" || id === "powerbank" || id === "usb") return "tech";
  if (id === "pen" || cat === "writing" || /\bpen\b/.test(blob)) return "pen";
  if (cat === "apparel" || id === "polo" || id === "tshirt" || id === "hoodie" || id === "cap") return "apparel";
  if (cat === "awards" || id === "award") return "award";
  if (cat === "display" || id === "billboard" || id === "totem") return "display";
  if (cat === "packaging" || id === "box") return "bag";
  if (cat === "tech") return "tech";
  return "default";
}

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

/**
 * Smart-canvas crop. Notebooks keep the full cover — never a clasp-only or rib-only clip.
 * Fill is class-specific; 0.72-of-frame is not used for stationery.
 */
export function smartCanvasCrop(body: CropRect, cls: MarkClass): CropRect {
  const spec = classScale(cls);
  const pad = spec.canvasPad;
  let x = body.x - pad * body.w;
  let y = body.y - pad * body.h;
  let w = body.w * (1 + 2 * pad);
  let h = body.h * (1 + 2 * pad);
  if (cls === "notebook") {
    const minW = body.w * 0.9;
    const minH = body.h * 0.9;
    if (w < minW) {
      x -= (minW - w) / 2;
      w = minW;
    }
    if (h < minH) {
      y -= (minH - h) / 2;
      h = minH;
    }
  }
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

export function notebookCropSane(crop: CropRect, body: CropRect) {
  const cover = (Math.min(crop.x + crop.w, body.x + body.w) - Math.max(crop.x, body.x)) *
    (Math.min(crop.y + crop.h, body.y + body.h) - Math.max(crop.y, body.y));
  const bodyA = Math.max(1e-6, body.w * body.h);
  return cover / bodyA >= 0.85;
}

/** Bright rectangular placeholder on a product face (P202 cork panel). */
export function placeholderRect(opts: {
  w: number;
  h: number;
  lum: Float32Array;
  mask: Uint8Array;
}): CropRect | null {
  const { w, h, lum, mask } = opts;
  const body: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) body.push(lum[i]!);
  if (body.length < 40) return null;
  const sorted = [...body].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length * 0.5)]!;
  const hi = sorted[Math.floor(sorted.length * 0.82)]!;
  if (hi - med < 18) return null;
  const thresh = med + (hi - med) * 0.45;
  const on = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) on[i] = mask[i] && lum[i]! >= thresh ? 1 : 0;
  let minX = w, minY = h, maxX = 0, maxY = 0, hits = 0;
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
  const bw = (maxX - minX + 1) / w;
  const bh = (maxY - minY + 1) / h;
  if (bw < 0.08 || bh < 0.05 || bw > 0.7 || bh > 0.55) return null;
  const aspect = bw / Math.max(0.001, bh);
  if (aspect < 0.7 || aspect > 4.5) return null;
  return {
    x: minX / w,
    y: minY / h,
    w: bw,
    h: bh,
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

/** Disc-only zone for cables / hubs. Square inset of the round face. */
export function discQuad(body: Quad): Quad {
  const b = boxOf(body);
  const s = Math.min(b.w, b.h) * 0.46;
  return rectQuad(b.x + b.w / 2, b.y + b.h / 2, s, s);
}

export function isDiscSku(sku: string) {
  const s = sku.toUpperCase();
  return s === "LR-CBL01" || s.includes("CBL") || s.includes("DISC");
}

export function isPlaceholderSku(sku: string) {
  const s = sku.toUpperCase();
  return s === "P202" || s.startsWith("P202");
}
