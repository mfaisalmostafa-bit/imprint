import type { MethodId } from "./methods";
import { METHODS } from "./methods";
import type { Quad } from "./geometry";
import { poseFromQuad, quadArea } from "./geometry";

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

export function inspectPlacement(opts: {
  scale: number;
  maxScale: number;
  quad: Quad;
  method: MethodId;
  allowed: MethodId[];
  productTone: "light" | "mid" | "dark";
  invert: boolean;
}): QcFlag[] {
  const flags: QcFlag[] = [];
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
  const pose = poseFromQuad(opts.quad);
  if (Math.abs(pose.yawDeg) > 55) {
    flags.push({
      level: "warn",
      code: "angle",
      text: "Extreme yaw — the far edge will foreshorten the mark. Prefer a flatter SKU angle for the quote pack.",
    });
  }
  if (opts.productTone === "dark" && !opts.invert && METHODS[opts.method].ink) {
    flags.push({
      level: "warn",
      code: "contrast",
      text: "Dark product + dark ink. Invert or switch to a light spot colour.",
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
