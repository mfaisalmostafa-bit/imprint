export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];
export type Mat3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export const UNIT_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(a: Point, s: number): Point {
  return { x: a.x * s, y: a.y * s };
}

export function mag(a: Point): number {
  return Math.hypot(a.x, a.y);
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function cloneQuad(q: Quad): Quad {
  return [{ ...q[0] }, { ...q[1] }, { ...q[2] }, { ...q[3] }];
}

export function scaleQuad(q: Quad, w: number, h: number): Quad {
  return [
    { x: q[0].x * w, y: q[0].y * h },
    { x: q[1].x * w, y: q[1].y * h },
    { x: q[2].x * w, y: q[2].y * h },
    { x: q[3].x * w, y: q[3].y * h },
  ];
}

export function normalizeQuad(q: Quad, w: number, h: number): Quad {
  return [
    { x: q[0].x / w, y: q[0].y / h },
    { x: q[1].x / w, y: q[1].y / h },
    { x: q[2].x / w, y: q[2].y / h },
    { x: q[3].x / w, y: q[3].y / h },
  ];
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let max = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(M[r]![i]!) > Math.abs(M[max]![i]!)) max = r;
    }
    const tmp = M[i]!;
    M[i] = M[max]!;
    M[max] = tmp;
    const piv = M[i]![i]!;
    if (Math.abs(piv) < 1e-12) {
      throw new Error("singular");
    }
    for (let j = i; j <= n; j++) M[i]![j]! /= piv;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = M[r]![i]!;
      for (let j = i; j <= n; j++) M[r]![j]! -= f * M[i]![j]!;
    }
  }
  return M.map((row) => row[n]!);
}

/** Homography mapping src quad → dst quad. */
export function homography(src: Quad, dst: Quad): Mat3 {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]!;
    const { x: X, y: Y } = dst[i]!;
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  const h = solveLinearSystem(A, b);
  return [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];
}

export function applyMat3(H: Mat3, x: number, y: number): Point {
  const w = H[6] * x + H[7] * y + H[8];
  const inv = w === 0 ? 1 : 1 / w;
  return {
    x: (H[0] * x + H[1] * y + H[2]) * inv,
    y: (H[3] * x + H[4] * y + H[5]) * inv,
  };
}

export function invertMat3(H: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = H;
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const D = c * h - b * i;
  const E = a * i - c * g;
  const F = b * g - a * h;
  const G = b * f - c * e;
  const Hh = c * d - a * f;
  const I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) {
    throw new Error("singular homography");
  }
  const inv = 1 / det;
  return [
    A * inv,
    D * inv,
    G * inv,
    B * inv,
    E * inv,
    Hh * inv,
    C * inv,
    F * inv,
    I * inv,
  ];
}

export function isConvexQuad(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i]!;
    const b = q[(i + 1) % 4]!;
    const c = q[(i + 2) % 4]!;
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-12) continue;
    const s = z > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

export function quadArea(q: Quad): number {
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i]!;
    const b = q[(i + 1) % 4]!;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

export function clampQuad(q: Quad): Quad {
  const clampP = (p: Point): Point => ({
    x: clamp(p.x, 0, 1),
    y: clamp(p.y, 0, 1),
  });
  return [clampP(q[0]), clampP(q[1]), clampP(q[2]), clampP(q[3])];
}

export function quadBBox(q: Quad) {
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export type Pose = {
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  aspect: number;
  foreshortenX: number;
  foreshortenY: number;
  area: number;
};

/** Estimate camera-relative plane pose from a normalized (or pixel) quad. */
export function poseFromQuad(q: Quad): Pose {
  const [tl, tr, br, bl] = q;
  const top = sub(tr, tl);
  const bot = sub(br, bl);
  const left = sub(bl, tl);
  const right = sub(br, tr);
  const topLen = mag(top) || 1e-6;
  const botLen = mag(bot) || 1e-6;
  const leftLen = mag(left) || 1e-6;
  const rightLen = mag(right) || 1e-6;

  const roll = Math.atan2(top.y + bot.y, top.x + bot.x);

  const lr = (leftLen - rightLen) / ((leftLen + rightLen) / 2);
  const yaw = Math.asin(clamp(lr * 0.55, -1, 1));

  const tb = (botLen - topLen) / ((topLen + botLen) / 2);
  const pitch = Math.asin(clamp(tb * 0.55, -1, 1));

  const width = (topLen + botLen) / 2;
  const height = (leftLen + rightLen) / 2;

  return {
    yawDeg: (yaw * 180) / Math.PI,
    pitchDeg: (pitch * 180) / Math.PI,
    rollDeg: (roll * 180) / Math.PI,
    aspect: width / height,
    foreshortenX: rightLen / leftLen,
    foreshortenY: topLen / botLen,
    area: quadArea(q),
  };
}

export function formatDeg(n: number): string {
  const abs = Math.abs(n).toFixed(1);
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${abs}°`;
}

/** Map a UV in 0–1 into the destination quad via homography. */
export function uvToQuad(q: Quad, u: number, v: number): Point {
  const H = homography(UNIT_QUAD, q);
  return applyMat3(H, u, v);
}

export function insetLogoQuad(
  surface: Quad,
  logoAspect: number,
  scale: number,
  ox: number,
  oy: number,
): Quad {
  const pose = poseFromQuad(surface);
  const surfaceAspect = pose.aspect || 1;
  let uw: number;
  let vh: number;
  if (logoAspect > surfaceAspect) {
    uw = scale;
    vh = (scale * surfaceAspect) / logoAspect;
  } else {
    vh = scale;
    uw = (scale * logoAspect) / surfaceAspect;
  }
  const cx = clamp(0.5 + ox, 0.05, 0.95);
  const cy = clamp(0.5 + oy, 0.05, 0.95);
  const u0 = clamp(cx - uw / 2, 0, 1);
  const u1 = clamp(cx + uw / 2, 0, 1);
  const v0 = clamp(cy - vh / 2, 0, 1);
  const v1 = clamp(cy + vh / 2, 0, 1);
  let H: Mat3;
  try {
    H = homography(UNIT_QUAD, surface);
  } catch {
    return cloneQuad(surface);
  }
  return [
    applyMat3(H, u0, v0),
    applyMat3(H, u1, v0),
    applyMat3(H, u1, v1),
    applyMat3(H, u0, v1),
  ];
}

export function defaultCenterQuad(): Quad {
  return [
    { x: 0.32, y: 0.32 },
    { x: 0.68, y: 0.32 },
    { x: 0.68, y: 0.68 },
    { x: 0.32, y: 0.68 },
  ];
}

export function cylinderSrcU(destU: number, arcRad: number): number {
  const maxT = Math.max(0.05, arcRad / 2);
  const xN = (destU - 0.5) * 2;
  const s = Math.sin(maxT);
  const inner = clamp(xN * s, -1, 1);
  const theta = Math.asin(inner);
  return clamp((theta / maxT + 1) / 2, 0, 1);
}
