import {
  applyMat3,
  cylinderSrcU,
  homography,
  type Point,
  type Quad,
  UNIT_QUAD,
} from "./geometry";

function fillTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  d0: Point,
  d1: Point,
  d2: Point,
  s0: Point,
  s1: Point,
  s2: Point,
) {
  const x0 = d0.x,
    y0 = d0.y;
  const x1 = d1.x,
    y1 = d1.y;
  const x2 = d2.x,
    y2 = d2.y;
  const u0 = s0.x,
    v0 = s0.y;
  const u1 = s1.x,
    v1 = s1.y;
  const u2 = s2.x,
    v2 = s2.y;

  const dx1 = x1 - x0,
    dy1 = y1 - y0;
  const dx2 = x2 - x0,
    dy2 = y2 - y0;
  const du1 = u1 - u0,
    dv1 = v1 - v0;
  const du2 = u2 - u0,
    dv2 = v2 - v0;
  const det = du1 * dv2 - du2 * dv1;
  if (Math.abs(det) < 1e-8) return;
  const inv = 1 / det;
  const a = (dx1 * dv2 - dx2 * dv1) * inv;
  const b = (dy1 * dv2 - dy2 * dv1) * inv;
  const c = (dx2 * du1 - dx1 * du2) * inv;
  const d = (dy2 * du1 - dy1 * du2) * inv;
  const e = x0 - a * u0 - c * v0;
  const f = y0 - b * u0 - d * v0;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function outset(p: Point, c: Point, px: number): Point {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const m = Math.hypot(dx, dy) || 1;
  return { x: p.x + (dx / m) * px, y: p.y + (dy / m) * px };
}

export type WarpOpts = {
  subdivisions?: number;
  wrap?: "plane" | "cylinder";
  cylinderArc?: number;
};

export function warpImageToQuad(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  srcW: number,
  srcH: number,
  destQuad: Quad,
  opts: WarpOpts = {},
) {
  const n = Math.max(2, Math.round(opts.subdivisions ?? 18));
  const wrap = opts.wrap ?? "plane";
  const arc = opts.cylinderArc ?? 1.4;
  let H;
  try {
    H = homography(UNIT_QUAD, destQuad);
  } catch {
    return;
  }

  const srcAt = (u: number, v: number): Point => {
    const su = wrap === "cylinder" ? cylinderSrcU(u, arc) : u;
    return { x: su * srcW, y: v * srcH };
  };
  const dstAt = (u: number, v: number): Point => applyMat3(H, u, v);

  for (let j = 0; j < n; j++) {
    const v0 = j / n;
    const v1 = (j + 1) / n;
    for (let i = 0; i < n; i++) {
      const u0 = i / n;
      const u1 = (i + 1) / n;
      const s00 = srcAt(u0, v0);
      const s10 = srcAt(u1, v0);
      const s11 = srcAt(u1, v1);
      const s01 = srcAt(u0, v1);
      const d00 = dstAt(u0, v0);
      const d10 = dstAt(u1, v0);
      const d11 = dstAt(u1, v1);
      const d01 = dstAt(u0, v1);

      const c1 = {
        x: (d00.x + d10.x + d11.x) / 3,
        y: (d00.y + d10.y + d11.y) / 3,
      };
      const c2 = {
        x: (d00.x + d11.x + d01.x) / 3,
        y: (d00.y + d11.y + d01.y) / 3,
      };
      fillTexturedTriangle(
        ctx,
        img,
        outset(d00, c1, 0.6),
        outset(d10, c1, 0.6),
        outset(d11, c1, 0.6),
        s00,
        s10,
        s11,
      );
      fillTexturedTriangle(
        ctx,
        img,
        outset(d00, c2, 0.6),
        outset(d11, c2, 0.6),
        outset(d01, c2, 0.6),
        s00,
        s11,
        s01,
      );
    }
  }
}

export function applySurfaceLighting(
  logoCanvas: HTMLCanvasElement,
  product: CanvasImageSource,
  amount: number,
) {
  if (amount <= 0.01) return;
  const w = logoCanvas.width;
  const h = logoCanvas.height;
  const lctx = logoCanvas.getContext("2d");
  if (!lctx) return;
  const probe = document.createElement("canvas");
  probe.width = w;
  probe.height = h;
  const pctx = probe.getContext("2d");
  if (!pctx) return;
  pctx.drawImage(product, 0, 0, w, h);
  const logo = lctx.getImageData(0, 0, w, h);
  const prod = pctx.getImageData(0, 0, w, h);
  const ld = logo.data;
  const pd = prod.data;
  const mix = amount;
  for (let i = 0; i < ld.length; i += 4) {
    if (ld[i + 3]! < 4) continue;
    const lum =
      (0.2126 * pd[i]! + 0.7152 * pd[i + 1]! + 0.0722 * pd[i + 2]!) / 255;
    const f = 1 - mix * 0.62 * (1 - lum);
    ld[i] = Math.min(255, ld[i]! * f);
    ld[i + 1] = Math.min(255, ld[i + 1]! * f);
    ld[i + 2] = Math.min(255, ld[i + 2]! * f);
  }
  lctx.putImageData(logo, 0, 0);
}

export function invertImageData(data: ImageData) {
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i]!;
    d[i + 1] = 255 - d[i + 1]!;
    d[i + 2] = 255 - d[i + 2]!;
  }
}
