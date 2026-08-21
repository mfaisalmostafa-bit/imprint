/** Contract with the TePee-X mockup engine. Quad is theirs: TL, TR, BR, BL in 0–1. */

import type { Quad } from "./geometry";
import { cloneQuad } from "./geometry";
import { requireWrite } from "./write-guard";
import type { WrapMode } from "./mockups";

export type EngineQuad = [[number, number], [number, number], [number, number], [number, number]];

export type OverrideDoc = {
  _sku: string;
  quad: EngineQuad;
  rect: [number, number, number, number];
  surface: "flat" | "cylinder" | "curved" | "taper" | "cone" | "sphere";
  curvature?: number;
};

export const SAVE_PHRASE = "SAVE PLACEMENT OVERRIDE";
export const SKU_RE = /^TPX-[A-Z]{3}-\d{2}$/;

export function quadToEngine(q: Quad): EngineQuad {
  return [
    [round4(q[0].x), round4(q[0].y)],
    [round4(q[1].x), round4(q[1].y)],
    [round4(q[2].x), round4(q[2].y)],
    [round4(q[3].x), round4(q[3].y)],
  ];
}

export function engineToQuad(e: EngineQuad): Quad {
  return [
    { x: e[0][0], y: e[0][1] },
    { x: e[1][0], y: e[1][1] },
    { x: e[2][0], y: e[2][1] },
    { x: e[3][0], y: e[3][1] },
  ];
}

export function rectFromQuad(q: Quad): [number, number, number, number] {
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return [
    round4((minX + maxX) / 2),
    round4((minY + maxY) / 2),
    round4(maxX - minX),
    round4(maxY - minY),
  ];
}

export function surfaceFromWrap(wrap: WrapMode): OverrideDoc["surface"] {
  if (wrap === "plane") return "flat";
  if (wrap === "cylinder") return "cylinder";
  return wrap;
}

export function wrapFromSurface(s: OverrideDoc["surface"]): WrapMode {
  if (s === "flat" || s === "curved") return s === "curved" ? "cylinder" : "plane";
  return s;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

export function isSku(value: string): boolean {
  return SKU_RE.test(value);
}

export function buildOverrideDoc(
  sku: string,
  quad: Quad,
  wrap: WrapMode,
  curvature: number,
): OverrideDoc {
  return {
    _sku: sku,
    quad: quadToEngine(cloneQuad(quad)),
    rect: rectFromQuad(quad),
    surface: surfaceFromWrap(wrap),
    curvature,
  };
}

/** Gate + pack. Does not persist — persistence is the shared server write. */
export function saveOverride(
  sku: string,
  quad: Quad,
  wrap: WrapMode,
  curvature: number,
  confirm: string,
): { ok: true; doc: OverrideDoc } | { ok: false; error: string; required?: string } {
  if (!isSku(sku)) {
    return { ok: false, error: "Pick a catalogue SKU. Custom photos are not a proof." };
  }
  const gated = requireWrite("placement.save", confirm, { sku });
  if (!gated.ok) {
    return { ok: false, error: gated.error, required: gated.required };
  }
  return { ok: true, doc: buildOverrideDoc(sku, quad, wrap, curvature) };
}

export function packOverrides(docs: OverrideDoc[]): string {
  const map: Record<string, OverrideDoc> = {};
  for (const d of docs) map[d._sku] = d;
  return JSON.stringify(map, null, 2);
}

export function formatQuadLines(q: EngineQuad): string {
  const labels = ["TL", "TR", "BR", "BL"] as const;
  return labels.map((l, i) => `${l}  ${q[i]![0].toFixed(4)}  ${q[i]![1].toFixed(4)}`).join("\n");
}
