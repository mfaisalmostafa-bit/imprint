import type { Quad } from "./geometry";
import { cloneQuad } from "./geometry";
import type { WrapMode } from "./mockups";

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
