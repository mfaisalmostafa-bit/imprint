import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { useStudio } from "@/lib/store";
import { loadImage, rasterizeLogo, renderWordmark } from "@/lib/image";
import { applySurfaceLighting, finishPrint, warpImageToQuad } from "@/lib/warp";
import {
  clamp,
  cloneQuad,
  insetLogoQuad,
  isConvexQuad,
  type Quad,
} from "@/lib/geometry";
import { cn } from "@/lib/utils";

export type StageHandle = {
  exportPng: () => Promise<void>;
};

function capSize(w: number, h: number, max = 1600) {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

export const StageCanvas = forwardRef<StageHandle>(function StageCanvas(_, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const productRef = useRef<HTMLImageElement | null>(null);
  const logoRef = useRef<HTMLCanvasElement | null>(null);

  const productSrc = useStudio((s) => s.productSrc());
  const logo = useStudio((s) => s.logo);
  const wordmark = useStudio((s) => s.wordmark);
  const invert = useStudio((s) => s.invert);
  const quad = useStudio((s) => s.quad);
  const scale = useStudio((s) => s.scale);
  const offsetX = useStudio((s) => s.offsetX);
  const offsetY = useStudio((s) => s.offsetY);
  const setOffset = useStudio((s) => s.setOffset);
  const opacity = useStudio((s) => s.opacity);
  const blend = useStudio((s) => s.blend);
  const wrap = useStudio((s) => s.wrap);
  const cylinderArc = useStudio((s) => s.cylinderArc);
  const lighting = useStudio((s) => s.lighting);
  const showGuides = useStudio((s) => s.showGuides);
  const scanning = useStudio((s) => s.scanning);
  const generating = useStudio((s) => s.generating);
  const dragging = useStudio((s) => s.dragging);
  const setQuad = useStudio((s) => s.setQuad);
  const setDragging = useStudio((s) => s.setDragging);

  const [fitted, setFitted] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [logoTick, setLogoTick] = useState(0);
  const dragIndex = useRef<number>(-1);
  const moveDrag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const paint = useCallback(
    (withGuides: boolean, quality: "live" | "full") => {
      const canvas = canvasRef.current;
      const product = productRef.current;
      const logoCanvas = logoRef.current;
      if (!canvas || !product || !logoCanvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = quality === "full" ? "high" : "medium";
      ctx.drawImage(product, 0, 0, w, h);

      const surface = [
        { x: quad[0].x * w, y: quad[0].y * h },
        { x: quad[1].x * w, y: quad[1].y * h },
        { x: quad[2].x * w, y: quad[2].y * h },
        { x: quad[3].x * w, y: quad[3].y * h },
      ] as Quad;
      const logoAspect = logoCanvas.width / logoCanvas.height;
      const dest = insetLogoQuad(surface, logoAspect, scale, offsetX, offsetY);

      const layer = document.createElement("canvas");
      layer.width = w;
      layer.height = h;
      const lctx = layer.getContext("2d");
      if (!lctx) return;
      lctx.imageSmoothingEnabled = true;
      warpImageToQuad(lctx, logoCanvas, logoCanvas.width, logoCanvas.height, dest, {
        subdivisions: quality === "full" ? 28 : 12,
        wrap,
        cylinderArc,
      });
      if (quality === "full") {
        applySurfaceLighting(layer, product, lighting);
        finishPrint(layer, dest, wrap, cylinderArc);
      }

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = blend;
      ctx.drawImage(layer, 0, 0);
      ctx.restore();

      if (withGuides) {
        ctx.save();
        ctx.strokeStyle = "rgba(200, 204, 212, 0.85)";
        ctx.lineWidth = Math.max(1.5, w / 700);
        ctx.setLineDash([w / 80, w / 90]);
        ctx.beginPath();
        ctx.moveTo(surface[0].x, surface[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(surface[i].x, surface[i].y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(244, 241, 234, 0.35)";
        ctx.lineWidth = Math.max(1, w / 900);
        ctx.beginPath();
        ctx.moveTo(dest[0].x, dest[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(dest[i].x, dest[i].y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    },
    [quad, scale, offsetX, offsetY, opacity, blend, wrap, cylinderArc, lighting],
  );

  useImperativeHandle(
    ref,
    () => ({
      exportPng: async () => {
        paint(false, "full");
        const canvas = canvasRef.current;
        if (!canvas) return;
        await new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) return resolve();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "imprint-mockup.png";
            a.click();
            URL.revokeObjectURL(url);
            resolve();
          }, "image/png");
        });
        paint(showGuides, dragging ? "live" : "full");
      },
    }),
    [paint, showGuides, dragging],
  );

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    loadImage(productSrc)
      .then((img) => {
        if (cancelled) return;
        productRef.current = img;
        const { w, h } = capSize(img.naturalWidth, img.naturalHeight);
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = w;
          canvas.height = h;
        }
        setReady(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [productSrc]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (logo.kind === "wordmark") {
        logoRef.current = renderWordmark(wordmark, invert);
        if (!cancelled) setLogoTick((n) => n + 1);
        return;
      }
      if (!logo.src) return;
      const img = await loadImage(logo.src);
      if (cancelled) return;
      logoRef.current = rasterizeLogo(img, invert);
      setLogoTick((n) => n + 1);
    };
    run().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [logo, wordmark, invert]);

  useEffect(() => {
    if (!ready) return;
    paint(showGuides, dragging ? "live" : "full");
  }, [ready, paint, showGuides, dragging, logoTick, productSrc]);

  useEffect(() => {
    const el = wrapRef.current?.parentElement;
    if (!el) return;
    const canvas = canvasRef.current;
    const apply = () => {
      const cw = canvas?.width || 1;
      const ch = canvas?.height || 1;
      const r = el.getBoundingClientRect();
      const pad = 16;
      const s = Math.min((r.width - pad) / cw, (r.height - pad) / ch);
      setFitted({ w: Math.max(40, cw * s), h: Math.max(40, ch * s) });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready, productSrc]);

  const onPointerMove = (e: React.PointerEvent) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    if (dragIndex.current >= 0) {
      const next = cloneQuad(quad);
      next[dragIndex.current] = { x, y };
      if (isConvexQuad(next)) setQuad(next);
      return;
    }
    if (moveDrag.current) {
      const dx = (x - moveDrag.current.x) * 1.6;
      const dy = (y - moveDrag.current.y) * 1.6;
      setOffset(
        clamp(moveDrag.current.ox + dx, -0.4, 0.4),
        clamp(moveDrag.current.oy + dy, -0.4, 0.4),
      );
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragIndex.current < 0 && !moveDrag.current) return;
    dragIndex.current = -1;
    moveDrag.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const startMove = (e: React.PointerEvent) => {
    if (dragIndex.current >= 0) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    moveDrag.current = { x, y, ox: offsetX, oy: offsetY };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const labels = ["TL", "TR", "BR", "BL"];

  return (
    <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden p-2">
      <div
        ref={wrapRef}
        className="relative max-h-full max-w-full"
        style={{
          width: fitted.w ? fitted.w : "100%",
          height: fitted.h ? fitted.h : "auto",
          maxWidth: "100%",
          maxHeight: "100%",
        }}
        onPointerDown={startMove}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <canvas
          ref={canvasRef}
          className="block max-h-full max-w-full outline outline-1 -outline-offset-1 outline-foreground/10"
          style={{ width: "100%", height: "100%" }}
        />
        {showGuides &&
          quad.map((p, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Move ${labels[i]} corner`}
              className="absolute z-10 size-7 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full bg-primary text-[9px] font-semibold tracking-wide text-primary-foreground shadow-[var(--shadow-border)] after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dragIndex.current = i;
                setDragging(true);
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
            >
              {labels[i]}
            </button>
          ))}
        {(scanning || generating) && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-background/20" />
            <div
              className="absolute inset-x-0 top-0 h-px bg-primary scan-sweep"
              style={{ boxShadow: "0 0 24px 2px color-mix(in oklab, var(--color-primary) 50%, transparent)" }}
            />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgb(200 204 212 / 0.18) 1px, transparent 1px), linear-gradient(to bottom, rgb(200 204 212 / 0.18) 1px, transparent 1px)",
                backgroundSize: "12% 12%",
              }}
            />
          </div>
        )}
        {!ready && (
          <div className="absolute inset-0 animate-pulse bg-secondary" />
        )}
      </div>
      <p
        className={cn(
          "pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-muted-foreground",
          !showGuides && "hidden",
        )}
      >
        Drag the mark · corners lock the plane
      </p>
    </div>
  );
});
