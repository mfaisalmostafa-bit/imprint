/** Placement stack. A pick that does not write the render quad is a lying control.

Priority, earlier wins:

  1. drawn   — hand-drawn box on THIS photo
  2. pick    — "Where does the logo go?" confirm on THIS session
  3. saved   — stored HUMAN override, only if it is still a print-face
  4. engine  — live pickZone winner (demo > panel > class)
  5. class   — category recipe, never a lock

Aug-29 class: a saved human override beats the engine. The engine
must not clobber a staff lock. A saved override on the neck / a
skewed shoulder diamond is not a human lock — drop it, then the
engine may run. Classify by class, never SKU.
*/

import { boxOf, type BodyBox, type MarkClass, zoneForClass } from "./imprint-engine";
import { cloneQuad, type Quad } from "./geometry";

export type PlaceSource = "drawn" | "pick" | "engine" | "saved" | "class";

export type PlaceChoice = {
  id: "demo" | "panel" | "class" | "drawn";
  letter: string;
  label: string;
  quad: Quad;
  lock: boolean;
  veto: string | null;
};

export type ResolveInput = {
  cls: MarkClass;
  /** Product body, or the catalog print face when the body is unknown. */
  body?: Quad | null;
  drawn?: Quad | null;
  pick?: Quad | null;
  engine?: Quad | null;
  saved?: Quad | null;
};

export type ResolveResult = {
  quad: Quad;
  source: PlaceSource;
  dropped: string | null;
};

function mag(ax: number, ay: number) {
  return Math.hypot(ax, ay);
}

function centre(q: Quad) {
  return {
    x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4,
    y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4,
  };
}

function fold90(deg: number) {
  let d = Math.abs(deg) % 180;
  if (d > 90) d = 180 - d;
  return d;
}

function edgeDeg(a: { x: number; y: number }, b: { x: number; y: number }) {
  return fold90((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
}

function nearAxis(deg: number) {
  return Math.min(deg, 90 - deg) <= 22;
}

function asBody(body?: Quad | null): BodyBox | null {
  if (!body || body.length < 4) return null;
  return boxOf(body);
}

/**
 * A print-face is an upright band on the printable panel.
 * Bottle/tumbler: not the neck, not a diamond on the shoulder.
 * Control (not a SKU branch): the MG-4018 stale quad
 *   (0.457,0.214), (0.511,0.294), (0.526,0.420), (0.379,0.459)
 * fails both the neck-band and the skew tests against a mid-body ref.
 */
export function printFaceOk(
  quad: Quad,
  cls: MarkClass,
  ref?: Quad | null,
): { ok: boolean; reason: string | null } {
  if (!quad?.length) return { ok: false, reason: "empty" };
  const b = boxOf(quad);
  if (b.w < 0.02 || b.h < 0.02) return { ok: false, reason: "tiny" };
  const c = centre(quad);
  const top = edgeDeg(quad[0], quad[1]);
  const side = edgeDeg(quad[1], quad[2]);
  const axisLike = nearAxis(top) || nearAxis(side);
  if (!axisLike) return { ok: false, reason: "skewed" };

  if (cls === "bottle") {
    const body = asBody(ref);
    if (body) {
      const relY = (c.y - body.y) / Math.max(1e-6, body.h);
      if (relY < 0.32) return { ok: false, reason: "neck" };
      const topBand = body.y + body.h * 0.32;
      if (c.y < topBand) return { ok: false, reason: "neck" };
    } else if (c.y < 0.32 && b.h < 0.28) {
      return { ok: false, reason: "neck" };
    }
    const prior = zoneForClass(
      ref ?? [
        { x: 0.2, y: 0.15 },
        { x: 0.8, y: 0.15 },
        { x: 0.8, y: 0.9 },
        { x: 0.2, y: 0.9 },
      ],
      "bottle",
    );
    const pb = boxOf(prior);
    if (b.w > pb.w * 1.65) return { ok: false, reason: "too-wide" };
  }
  return { ok: true, reason: null };
}

export function letterChoices(
  candidates: { id: "demo" | "panel" | "class"; label: string; quad: Quad; veto?: string | null }[],
): PlaceChoice[] {
  const live = candidates.filter((c) => !c.veto);
  const letters = ["A", "B", "C"];
  return live.map((c, i) => ({
    id: c.id,
    letter: letters[i] ?? String(i + 1),
    label: c.label,
    quad: cloneQuad(c.quad),
    lock: c.id !== "class",
    veto: c.veto ?? null,
  }));
}

export function resolvePlacement(input: ResolveInput): ResolveResult {
  const { cls } = input;
  const ref = input.body ?? input.engine ?? null;

  let dropped: string | null = null;
  let savedOk: Quad | null = null;
  if (input.saved) {
    const face = printFaceOk(input.saved, cls, ref ?? input.saved);
    if (face.ok) savedOk = input.saved;
    else dropped = face.reason ?? "stale";
  }

  if (input.drawn) {
    return { quad: cloneQuad(input.drawn), source: "drawn", dropped };
  }
  if (input.pick) {
    return { quad: cloneQuad(input.pick), source: "pick", dropped };
  }
  if (savedOk) {
    return { quad: cloneQuad(savedOk), source: "saved", dropped: null };
  }
  if (input.engine) {
    return { quad: cloneQuad(input.engine), source: "engine", dropped };
  }

  const body =
    input.body ??
    ([
      { x: 0.2, y: 0.15 },
      { x: 0.8, y: 0.15 },
      { x: 0.8, y: 0.9 },
      { x: 0.2, y: 0.9 },
    ] satisfies Quad);
  return { quad: zoneForClass(body, cls), source: "class", dropped };
}

/** MG-4018 control. Geometry only — do not branch on the SKU. */
export const NECK_OVERRIDE_CONTROL: Quad = [
  { x: 0.457, y: 0.214 },
  { x: 0.511, y: 0.294 },
  { x: 0.526, y: 0.42 },
  { x: 0.379, y: 0.459 },
];

export function dropSaved(quad: Quad, cls: MarkClass, ref?: Quad | null) {
  const face = printFaceOk(quad, cls, ref);
  return face.ok ? null : face.reason ?? "stale";
}

export { mag };
