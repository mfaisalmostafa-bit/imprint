/** Auto mark size. Body width is a fraction of the photograph, scale is a fraction of the print zone. */

import { clamp, quadBBox, type Quad } from "./geometry";

/** Silhouette filled the frame — cannot separate a dark product from a dark set. */
export const BODY_HIGH = 0.95;
export const BODY_LOW = 0.08;
/** Mark as a fraction of a *trusted* body, in image space. */
export const MARK_OF_BODY = 0.55;
/**
 * Their Python cap is 0.70 × body. When body reads 1.0 the cap is 0.70 of the
 * photo, which is larger than every print zone, so it never bites.
 * We never use that number as a cap.
 */
export const DEAD_IMAGE_CAP = 0.7;

export function bodyTrusted(bodyWidth: number) {
  return bodyWidth >= BODY_LOW && bodyWidth < BODY_HIGH;
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
}): FitMark {
  const maxScale = Math.max(0.15, opts.maxScale);
  const preferred = clamp(opts.preferred, 0.15, maxScale);
  const zoneW = Math.max(0.04, opts.zoneWidth);
  const trusted = bodyTrusted(opts.bodyWidth);

  if (!trusted) {
    const cap = maxScale;
    const scale = Math.min(preferred, cap);
    return {
      scale,
      trusted: false,
      cap,
      note: "Body filled the frame — sized from the print zone, not the photo.",
    };
  }

  const fromBody = (MARK_OF_BODY * opts.bodyWidth) / zoneW;
  const cap = Math.min(maxScale, fromBody);
  return {
    scale: clamp(Math.min(preferred, cap), 0.15, maxScale),
    trusted: true,
    cap,
    note: "Mark capped to the product body.",
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
