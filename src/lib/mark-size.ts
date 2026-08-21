/** Physical mark size from the SKU print zone and the fitted logo. */

export function markSizeMm(opts: {
  printWmm: number;
  printHmm: number;
  scale: number;
  logoAspect: number;
}): { w: number; h: number } {
  const zoneA = opts.printWmm / Math.max(1, opts.printHmm);
  const a = opts.logoAspect || 1;
  let w: number;
  let h: number;
  if (a >= zoneA) {
    w = opts.printWmm * opts.scale;
    h = w / a;
  } else {
    h = opts.printHmm * opts.scale;
    w = h * a;
  }
  return { w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 };
}

export function formatMarkSize(w: number, h: number, surface: string) {
  return `Logo ${w} × ${h} mm on the ${surface.toLowerCase()}`;
}

/** 300 dpi is print-safe; under 150 warns; under 100 blocks. */
export function logoDpi(logoPxW: number, markWmm: number) {
  const inches = markWmm / 25.4;
  if (inches <= 0.01) return 0;
  return logoPxW / inches;
}
