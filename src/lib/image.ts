import { invertImageData } from "./warp";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

export function rasterizeLogo(
  img: HTMLImageElement,
  invert: boolean,
  size = 1024,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const nw = img.naturalWidth || img.width || size;
  const nh = img.naturalHeight || img.height || size;
  const r = Math.min(size / nw, size / nh);
  const w = nw * r;
  const h = nh * r;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  if (invert) {
    const data = ctx.getImageData(0, 0, size, size);
    invertImageData(data);
    ctx.putImageData(data, 0, 0);
  }
  return canvas;
}

export function renderWordmark(text: string, invert: boolean): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const size = 1024;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = invert ? "#f4f1ea" : "#111110";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const trimmed = text.trim() || "IMPRINT";
  const len = trimmed.length;
  const fontPx = len <= 6 ? 220 : len <= 10 ? 160 : 120;
  ctx.font = `500 ${fontPx}px "Instrument Serif", Georgia, serif`;
  ctx.fillText(trimmed, size / 2, size / 2);
  return canvas;
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export async function compressForScan(
  src: string,
  maxEdge = 720,
): Promise<string> {
  const img = await loadImage(src);
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  const r = Math.min(1, maxEdge / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * r));
  const h = Math.max(1, Math.round(nh * r));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export async function compressForEdit(
  src: string,
  maxEdge = 1024,
): Promise<string> {
  return compressForScan(src, maxEdge);
}
