import type { Quad } from "./geometry";
import { cloneQuad } from "./geometry";
import type { WrapMode } from "./mockups";
import { markClassOf, type MarkClass } from "./imprint-engine";
import { dropSaved } from "./resolve-placement";

export type PlacementMemory = {
  quad: Quad;
  scale: number;
  offsetX: number;
  offsetY: number;
  wrap: WrapMode;
  cylinderArc: number;
};

const KEY = "tpx-place-v1";

function loadAll(): Record<string, PlacementMemory> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PlacementMemory>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function recallPlacement(sku: string): PlacementMemory | null {
  const hit = loadAll()[sku];
  if (!hit?.quad?.length) return null;
  return {
    ...hit,
    quad: cloneQuad(hit.quad),
  };
}

/**
 * Saved override only if it is still a print-face.
 * Neck / skewed diamonds are dropped, not rendered. Never a SKU branch.
 */
export function recallPrintFace(
  sku: string,
  cls: MarkClass,
  ref?: Quad | null,
): { mem: PlacementMemory | null; dropped: string | null } {
  const hit = recallPlacement(sku);
  if (!hit) return { mem: null, dropped: null };
  const why = dropSaved(hit.quad, cls, ref ?? hit.quad);
  if (why) {
    forgetPlacement(sku);
    return { mem: null, dropped: why };
  }
  return { mem: hit, dropped: null };
}

export function rememberPlacement(sku: string, mem: PlacementMemory) {
  if (!sku || sku === "CUSTOM") return;
  try {
    const all = loadAll();
    all[sku] = {
      quad: cloneQuad(mem.quad),
      scale: mem.scale,
      offsetX: mem.offsetX,
      offsetY: mem.offsetY,
      wrap: mem.wrap,
      cylinderArc: mem.cylinderArc,
    };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
}

export function forgetPlacement(sku: string) {
  if (!sku) return;
  try {
    const all = loadAll();
    if (!(sku in all)) return;
    delete all[sku];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
}

export function classOfSku(category?: string, name?: string): MarkClass {
  return markClassOf({ category, name });
}
