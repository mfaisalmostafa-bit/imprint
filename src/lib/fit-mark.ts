/** Auto mark size. Scale is a fraction of the print zone, capped per product class. */

import { clamp, quadBBox, type Quad } from "./geometry";
import {
  classScale,
  type MarkClass,
} from "./imprint-engine";

/** Silhouette filled the frame — cannot separate a dark product from a dark set. */
export const BODY_HIGH = 0.95;
export const BODY_LOW = 0.08;
/** Default mark-of-body. Real sizing uses classScale(markClass).markOfBody. */
export const MARK_OF_BODY = 0.38;

/**
 * Their Python cap is 0.70 × body. When body reads 1.0 the cap is 0.70 of the
 * photo, which is larger than every print zone, so it never bites.
 * We never use that number as a cap.
 */
export const DEAD_IMAGE_CAP = 0.7;

export function bodyTrusted(bodyWidth: number, markClass?: MarkClass | null) {
  const spec = classScale(markClass);
  return bodyWidth >= spec.bodyLow && bodyWidth < spec.bodyHigh;
}

export type FitMark = {
  scale: number;
  trusted: boolean;
  cap: number;
  note: string;
};

export function fitMarkScale(opts: {
  bodyWidth: number;
  zoneWidth: number;
  maxScale: number;
  preferred: number;
  markClass?: MarkClass | null;
}): FitMark {
  const spec = classScale(opts.markClass);
  const maxScale = Math.max(spec.minScale, Math.min(opts.maxScale, spec.maxScale));
  const zoneW = Math.max(0.04, opts.zoneWidth);
  const trusted = bodyTrusted(opts.bodyWidth, opts.markClass);

  if (!trusted) {
    const cap = maxScale;
    const lo = Math.min(spec.minScale, cap);
    const scale = clamp(opts.preferred, lo, cap);
    return {
      scale,
      trusted: false,
      cap,
      note: "Body filled the frame — sized from the print zone, not the photo.",
    };
  }

  const fromBody = (spec.markOfBody * opts.bodyWidth) / zoneW;
  const cap = Math.min(maxScale, fromBody);
  const lo = Math.min(spec.minScale, cap);
  const preferred = clamp(opts.preferred, lo, maxScale);
  return {
    scale: clamp(Math.min(preferred, cap), lo, cap),
    trusted: true,
    cap,
    note: `${spec.badge} — mark capped to the product body.`,
  };
}

/** mark width in image space ÷ body width. >1 means the logo is larger than the product. */
export function markBodyRatio(scale: number, zoneWidth: number, bodyWidth: number) {
  return (scale * Math.max(0.04, zoneWidth)) / Math.max(1e-6, bodyWidth);
}

/**
 * An untrusted full-frame lock is not a print zone.
 * Catalogue callers keep their authored quad; custom shots fall back to a
 * conservative centre face so the mark cannot eat the photograph.
 */
export function zoneForFit(quad: Quad, trusted: boolean): Quad {
  const bb = quadBBox(quad);
  if (trusted || (bb.w < BODY_HIGH && bb.h < BODY_HIGH)) return quad;
  const wx = 0.42;
  const hy = 0.36;
  return [
    { x: 0.5 - wx / 2, y: 0.5 - hy / 2 },
    { x: 0.5 + wx / 2, y: 0.5 - hy / 2 },
    { x: 0.5 + wx / 2, y: 0.5 + hy / 2 },
    { x: 0.5 - wx / 2, y: 0.5 + hy / 2 },
  ];
}
