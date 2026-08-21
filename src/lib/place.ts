/** Manual print-zone placement. Quad is TL, TR, BR, BL in 0–1. */

import {
  clamp,
  cloneQuad,
  isConvexQuad,
  quadBBox,
  type Point,
  type Quad,
} from "./geometry";

export type PlaceTool = "zone" | "mark";
export const CORNER_LABELS = ["TL", "TR", "BR", "BL"] as const;
export const EDGE_PAIRS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
];

const STEP = 0.002;
const STEP_SHIFT = 0.012;

export function acceptQuad(next: Quad): Quad | null {
  const q = cloneQuad(next);
  for (const p of q) {
    p.x = clamp(p.x, 0, 1);
    p.y = clamp(p.y, 0, 1);
  }
  return isConvexQuad(q) ? q : null;
}

export function moveCorner(q: Quad, i: number, p: Point): Quad | null {
  const next = cloneQuad(q);
  next[i] = { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) };
  return acceptQuad(next);
}

export function moveEdge(q: Quad, edge: number, dx: number, dy: number): Quad | null {
  const pair = EDGE_PAIRS[edge];
  if (!pair) return null;
  const next = cloneQuad(q);
  for (const i of pair) {
    next[i] = { x: q[i]!.x + dx, y: q[i]!.y + dy };
  }
  return acceptQuad(next);
}

export function translateQuad(q: Quad, dx: number, dy: number): Quad | null {
  const next = cloneQuad(q);
  for (const p of next) {
    p.x += dx;
    p.y += dy;
  }
  const xs = next.map((p) => p.x);
  const ys = next.map((p) => p.y);
  let ox = 0;
  let oy = 0;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (minX < 0) ox = -minX;
  if (maxX > 1) ox = 1 - maxX;
  if (minY < 0) oy = -minY;
  if (maxY > 1) oy = 1 - maxY;
  if (ox) for (const p of next) p.x += ox;
  if (oy) for (const p of next) p.y += oy;
  return acceptQuad(next);
}

export function nudgeCorner(q: Quad, i: number, dx: number, dy: number, coarse = false): Quad | null {
  const s = coarse ? STEP_SHIFT : STEP;
  return moveCorner(q, i, { x: q[i]!.x + dx * s, y: q[i]!.y + dy * s });
}

export function nudgeQuad(q: Quad, dx: number, dy: number, coarse = false): Quad | null {
  const s = coarse ? STEP_SHIFT : STEP;
  return translateQuad(q, dx * s, dy * s);
}

export function edgeMid(q: Quad, edge: number): Point {
  const pair = EDGE_PAIRS[edge]!;
  const a = q[pair[0]]!;
  const b = q[pair[1]]!;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function pointInQuad(q: Quad, p: Point): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i]!;
    const b = q[(i + 1) % 4]!;
    const z = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (Math.abs(z) < 1e-12) continue;
    const s = z > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

export function viewForZone(
  q: Quad,
  fitted: { w: number; h: number },
): { zoom: number; panX: number; panY: number } {
  const bb = quadBBox(q);
  const pad = 0.16;
  const zw = Math.max(0.08, bb.w + pad * 2);
  const zh = Math.max(0.08, bb.h + pad * 2);
  const zoom = clamp(Math.min(1 / zw, 1 / zh), 1, 6);
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  return {
    zoom,
    panX: -(cx - 0.5) * fitted.w * zoom,
    panY: -(cy - 0.5) * fitted.h * zoom,
  };
}

export function viewForCorner(
  q: Quad,
  i: number,
  fitted: { w: number; h: number },
  zoom = 4,
): { zoom: number; panX: number; panY: number } {
  const p = q[i] ?? q[0]!;
  const z = clamp(zoom, 1, 8);
  return {
    zoom: z,
    panX: -(p.x - 0.5) * fitted.w * z,
    panY: -(p.y - 0.5) * fitted.h * z,
  };
}

export const LOUPE_ZOOM = 5;
export const LOUPE_ZOOMS = [3, 5, 8, 12] as const;
export const LOUPE_PX = 240;

/** Half-size of the loupe crop, in source pixels. */
export function loupeRadiusPx(nw: number, nh: number, zoom: number) {
  return Math.max(8, Math.min(nw, nh) / (2 * Math.max(1, zoom)));
}

/** Map a click in the loupe (0–1) onto the photo, relative to a frozen origin corner. */
export function loupeToWorld(
  origin: Point,
  nx: number,
  ny: number,
  nw: number,
  nh: number,
  zoom: number,
): Point {
  const rx = loupeRadiusPx(nw, nh, zoom) / Math.max(1, nw);
  const ry = loupeRadiusPx(nw, nh, zoom) / Math.max(1, nh);
  return {
    x: origin.x + (nx - 0.5) * 2 * rx,
    y: origin.y + (ny - 0.5) * 2 * ry,
  };
}

export function worldToLoupe(
  p: Point,
  origin: Point,
  nw: number,
  nh: number,
  zoom: number,
  px: number,
): Point {
  const rx = loupeRadiusPx(nw, nh, zoom) / Math.max(1, nw);
  const ry = loupeRadiusPx(nw, nh, zoom) / Math.max(1, nh);
  return {
    x: ((p.x - origin.x) / (2 * rx) + 0.5) * px,
    y: ((p.y - origin.y) / (2 * ry) + 0.5) * px,
  };
}

export function formatUv(p: Point) {
  return `${p.x.toFixed(4)}  ${p.y.toFixed(4)}`;
}
