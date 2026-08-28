import type { MethodId } from "./methods";
import { METHODS } from "./methods";
import type { Quad } from "./geometry";
import { poseFromQuad, quadArea } from "./geometry";
import { logoDpi } from "./mark-size";
import { markBodyRatio } from "./fit-mark";
import { classScale, markClassOf } from "./imprint-engine";
import { judgeCatalogAngle, judgePoseRoll } from "./angle";

export type QcFlag = {
  level: "warn" | "block";
  code: string;
  text: string;
};

export function inspectLogo(img: HTMLImageElement | null, naturalHint?: { w: number; h: number }): QcFlag[] {
  const flags: QcFlag[] = [];
  const w = img?.naturalWidth || naturalHint?.w || 0;
  const h = img?.naturalHeight || naturalHint?.h || 0;
  if (w && h && Math.max(w, h) < 400) {
    flags.push({
      level: "warn",
      code: "low_res",
      text: `Logo is ${w}×${h}. Under 400px on the long edge will soften on the print area.`,
    });
  }
  if (w && h && Math.max(w, h) < 180) {
    flags.push({
      level: "block",
      code: "unusable",
      text: "Logo is too small to proof. Request a vector or 1000px+ PNG.",
    });
  }
  return flags;
}

export function inspectPrintSize(opts: {
  logoPxW: number;
  markWmm: number;
  markHmm: number;
  scale: number;
  maxScale: number;
}): QcFlag[] {
  const flags: QcFlag[] = [];
  const dpi = logoDpi(opts.logoPxW, opts.markWmm);
  if (opts.logoPxW > 0 && dpi > 0 && dpi < 100) {
    flags.push({
      level: "block",
      code: "dpi",
      text: `Logo is ${Math.round(dpi)} dpi at ${opts.markWmm} mm wide. Under 100 dpi will pixelate. Request vector.`,
    });
  } else if (opts.logoPxW > 0 && dpi > 0 && dpi < 150) {
    flags.push({
      level: "warn",
      code: "dpi",
      text: `Logo is ${Math.round(dpi)} dpi at ${opts.markWmm} mm. Soft on press — 300 dpi is print-safe.`,
    });
  }
  if (opts.scale > opts.maxScale * 0.92) {
    flags.push({
      level: "warn",
      code: "edge",
      text: "Mark is close to a seam or edge of the print zone.",
    });
  }
  return flags;
}

export function inspectSubstrate(opts: {
  method: MethodId;
  material: string;
  category: string;
}): QcFlag[] {
  const flags: QcFlag[] = [];
  const m = opts.material.toLowerCase();
  const cat = opts.category.toLowerCase();
  const textile = cat === "apparel" || m.includes("cotton") || m.includes("fleece") || m.includes("pique") || m.includes("twill") || m.includes("jersey");
  const hard =
    m.includes("metal") ||
    m.includes("aluminum") ||
    m.includes("steel") ||
    m.includes("plastic") ||
    m.includes("paper") ||
    m.includes("cardboard") ||
    m.includes("crystal") ||
    cat === "packaging" ||
    cat === "display" ||
    cat === "tech" ||
    cat === "writing";
  if (opts.method === "uv_dtf" && hard && !textile) {
    flags.push({
      level: "block",
      code: "hold",
      text: "UV DTF is not quoted on hard goods. Use UV Printing.",
    });
  }
  if (opts.method === "uv_print" && textile) {
    flags.push({
      level: "block",
      code: "hold",
      text: "Do not quote UV Printing on textiles. Non-embroidery apparel is UV DTF.",
    });
  }
  if (opts.method === "laser_engrave" && (textile || m.includes("paper") || m.includes("cotton"))) {
    flags.push({
      level: "block",
      code: "hold",
      text: "Laser will not hold on this substrate.",
    });
  }
  if (opts.method === "sublimation" && !m.includes("ceramic") && !m.includes("polymer") && !m.includes("coat")) {
    flags.push({
      level: "warn",
      code: "hold",
      text: "Sublimation needs a polymer coat. Confirm the substrate is sublimation-ready.",
    });
  }
  return flags;
}

export function inspectPlacement(opts: {
  scale: number;
  maxScale: number;
  quad: Quad;
  method: MethodId;
  allowed: MethodId[];
  productTone: "light" | "mid" | "dark";
  invert: boolean;
  bodyWidth?: number;
  zoneWidth?: number;
  catalogQuad?: Quad;
  category?: string;
  sku?: string;
  id?: string;
}): QcFlag[] {
  const flags: QcFlag[] = [];
  const cls = markClassOf({ id: opts.id, sku: opts.sku, category: opts.category });
  const spec = classScale(cls);
  if (!opts.allowed.includes(opts.method)) {
    flags.push({
      level: "block",
      code: "method",
      text: `${METHODS[opts.method].label} is not quoted on this SKU. A wrong method is a quoting error.`,
    });
  }
  if (opts.scale > opts.maxScale + 0.001) {
    flags.push({
      level: "block",
      code: "oversize",
      text: `Mark exceeds the print-safe scale (${Math.round(opts.maxScale * 100)}%). Pull it back from seams.`,
    });
  }
  if (
    opts.bodyWidth !== undefined &&
    opts.zoneWidth !== undefined &&
    opts.bodyWidth < spec.bodyHigh &&
    opts.bodyWidth >= spec.bodyLow
  ) {
    const ratio = markBodyRatio(opts.scale, opts.zoneWidth, opts.bodyWidth);
    if (ratio > 1) {
      flags.push({
        level: "block",
        code: "oversize",
        text: `Mark is ${ratio.toFixed(2)}× the product body. Size from the print zone.`,
      });
    } else if (ratio > spec.markOfBody * 1.25) {
      flags.push({
        level: "warn",
        code: "oversize",
        text: `Mark is large for the ${spec.zone} (${Math.round(ratio * 100)}% of body). ${spec.badge}.`,
      });
    }
  }
  if (opts.scale > opts.maxScale * 0.92) {
    flags.push({
      level: "warn",
      code: "tight",
      text: "Mark is near the edge of the print zone. Confirm with production before sending.",
    });
  }
  if (quadArea(opts.quad) < 0.01) {
    flags.push({
      level: "warn",
      code: "zone",
      text: "Print zone is tiny. Check the SKU photo lock.",
    });
  }
  if (opts.catalogQuad) {
    const judged = judgeCatalogAngle(opts.quad, opts.catalogQuad);
    if (judged.band !== "ok") {
      flags.push({
        level: "warn",
        code: "angle",
        text: judged.note,
      });
    }
  } else {
    const roll = judgePoseRoll(poseFromQuad(opts.quad));
    if (roll) {
      flags.push({
        level: "warn",
        code: "angle",
        text: roll.note,
      });
    }
  }
  if (opts.productTone === "dark" && !opts.invert) {
    flags.push({
      level: "warn",
      code: "contrast",
      text: "Dark product needs a light mark. Invert for laser etch or use a light spot colour.",
    });
  }
  if (opts.productTone === "light" && opts.invert && METHODS[opts.method].ink) {
    flags.push({
      level: "warn",
      code: "contrast",
      text: "Light product with an inverted (white) mark — confirm this is the specified colourway.",
    });
  }
  return flags;
}
