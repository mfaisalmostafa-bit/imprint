import { loadImage, rasterizeLogo, renderWordmark } from "./image";
import { knockOutPaper, toSpotColor, type Treatment } from "./treat";
import { insetLogoQuad, type Quad } from "./geometry";
import { applySurfaceLighting, finishPrint, warpImageToQuad } from "./warp";
import { compositeDecoration } from "./etch";
import type { MethodId } from "./methods";
import type { BlendMode, WrapMode } from "./mockups";

export type RenderOpts = {
  productSrc: string;
  logoSrc: string | null;
  wordmark: string;
  logoKind: "image" | "wordmark";
  invert: boolean;
  treatment: Treatment;
  spot: [number, number, number];
  quad: Quad;
  scale: number;
  offsetX: number;
  offsetY: number;
  wrap: WrapMode;
  cylinderArc: number;
  lighting: number;
  opacity: number;
  blend: BlendMode;
  method: MethodId;
  material: string;
  maxEdge?: number;
  guides?: boolean;
};

function cap(w: number, h: number, max: number) {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

export function treatLogo(canvas: HTMLCanvasElement, treatment: Treatment, spot: [number, number, number]) {
  if (treatment === "full") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (treatment === "knockout") knockOutPaper(data);
  if (treatment === "one_color") toSpotColor(data, spot);
  ctx.putImageData(data, 0, 0);
}

export async function renderBranded(opts: RenderOpts): Promise<HTMLCanvasElement> {
  const product = await loadImage(opts.productSrc);
  const { w, h } = cap(product.naturalWidth || product.width, product.naturalHeight || product.height, opts.maxEdge ?? 1600);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(product, 0, 0, w, h);

  let logo: HTMLCanvasElement;
  if (opts.logoKind === "wordmark") {
    logo = renderWordmark(opts.wordmark, opts.invert);
  } else if (opts.logoSrc) {
    const img = await loadImage(opts.logoSrc);
    logo = rasterizeLogo(img, opts.invert);
  } else {
    return canvas;
  }
  treatLogo(logo, opts.treatment, opts.spot);

  const surface: Quad = [
    { x: opts.quad[0].x * w, y: opts.quad[0].y * h },
    { x: opts.quad[1].x * w, y: opts.quad[1].y * h },
    { x: opts.quad[2].x * w, y: opts.quad[2].y * h },
    { x: opts.quad[3].x * w, y: opts.quad[3].y * h },
  ];
  const dest = insetLogoQuad(surface, logo.width / logo.height, opts.scale, opts.offsetX, opts.offsetY);
  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  const lctx = layer.getContext("2d");
  if (!lctx) return canvas;
  warpImageToQuad(lctx, logo, logo.width, logo.height, dest, {
    subdivisions: 24,
    wrap: opts.wrap,
    cylinderArc: opts.cylinderArc,
  });
  applySurfaceLighting(layer, product, opts.lighting);
  finishPrint(layer, dest, opts.wrap, opts.cylinderArc);
  compositeDecoration(ctx, product, layer, dest, opts.method, opts.material, opts.opacity);
  return canvas;
}
