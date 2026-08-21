import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { useStudio } from "@/lib/store";
import { loadImage, rasterizeLogo, renderWordmark } from "@/lib/image";
import { applySurfaceLighting, finishPrint, warpImageToQuad } from "@/lib/warp";
import { compositeDecoration } from "@/lib/etch";
import { treatLogo } from "@/lib/render";
import { SPOT_SWATCHES } from "@/lib/treat";
import { TPX_NAVY_RGB } from "@/lib/brand";
import { clamp, cloneQuad, insetLogoQuad, type Quad } from "@/lib/geometry";
import {
  CORNER_LABELS,
  LOUPE_PX,
  LOUPE_ZOOM,
  edgeMid,
  loupeRadiusPx,
  loupeToWorld,
  moveCorner,
  moveEdge,
  nudgeCorner,
  nudgeQuad,
  pointInQuad,
  translateQuad,
  viewForCorner,
  viewForZone,
  worldToLoupe,
  type PlaceTool,
} from "@/lib/place";
import { cn } from "@/lib/utils";

export type StageHandle = {
  exportPng: () => Promise<void>;
  getFrames: () => Promise<{ original: HTMLCanvasElement; branded: HTMLCanvasElement } | null>;
  zoomFit: () => void;
  zoomZone: () => void;
  zoomCorner: (i?: number) => void;
  zoomBy: (factor: number) => void;
  nudge: (dx: number, dy: number, coarse?: boolean) => void;
  setTool: (t: PlaceTool) => void;
  selectCorner: (i: number) => void;
  tool: () => PlaceTool;
};

type StageCanvasProps = {
  loupeCanvas?: HTMLCanvasElement | null;
  loupeZoom?: number;
  hideLoupe?: boolean;
  sel?: number;
  onSel?: (i: number) => void;
  tool?: PlaceTool;
};

function capSize(w: number, h: number, max = 1600) {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

export const StageCanvas = forwardRef<StageHandle, StageCanvasProps>(function StageCanvas(
  { loupeCanvas = null, loupeZoom = LOUPE_ZOOM, hideLoupe = false, sel: selProp, onSel, tool: toolProp },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const floatLoupeRef = useRef<HTMLCanvasElement>(null);
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
  const opacity = useStudio((s) => s.opacity);
  const wrap = useStudio((s) => s.wrap);
  const cylinderArc = useStudio((s) => s.cylinderArc);
  const lighting = useStudio((s) => s.lighting);
  const showGuides = useStudio((s) => s.showGuides);
  const scanning = useStudio((s) => s.scanning);
  const generating = useStudio((s) => s.generating);
  const dragging = useStudio((s) => s.dragging);
  const setQuad = useStudio((s) => s.setQuad);
  const setDragging = useStudio((s) => s.setDragging);
  const setOffset = useStudio((s) => s.setOffset);
  const method = useStudio((s) => s.method);
  const treatment = useStudio((s) => s.treatment);
  const spotId = useStudio((s) => s.spotId);
  const compare = useStudio((s) => s.compare);
  const material = useStudio((s) => s.material);
  const productTone = useStudio((s) => {
    const m = s.mockup();
    return "tone" in m ? m.tone : "mid";
  });

  const [fitted, setFitted] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [logoTick, setLogoTick] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [toolInner, setToolInner] = useState<PlaceTool>("zone");
  const [selInner, setSelInner] = useState(0);
  const tool = toolProp ?? toolInner;
  const sel = selProp ?? selInner;
  const setSel = (i: number) => {
    onSel?.(i);
    if (selProp === undefined) setSelInner(i);
  };
  const dragIndex = useRef<number>(-1);
  const dragEdge = useRef<number>(-1);
  const moveDrag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const zoneDrag = useRef<{ x: number; y: number; q: Quad } | null>(null);
  const panDrag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number; panX: number; panY: number } | null>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const toolRef = useRef<PlaceTool>("zone");
  const selRef = useRef(0);
  const loupeOrigin = useRef<Quad | null>(null);
  const loupeZoomRef = useRef(loupeZoom);
  zoomRef.current = zoom;
  panRef.current = pan;
  toolRef.current = tool;
  selRef.current = sel;
  loupeZoomRef.current = loupeZoom;

  const activeLoupe = () => loupeCanvas ?? floatLoupeRef.current;

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

      compositeDecoration(ctx, product, layer, dest, method, material, opacity);

      if (compare) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w / 2, h);
        ctx.clip();
        ctx.drawImage(product, 0, 0, w, h);
        ctx.restore();
        ctx.fillStyle = "rgb(209, 129, 46)";
        ctx.fillRect(w / 2 - 1, 0, 2, h);
      }

      if (withGuides) {
        ctx.save();
        ctx.strokeStyle = "rgba(209, 129, 46, 0.85)";
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
    [quad, scale, offsetX, offsetY, opacity, wrap, cylinderArc, lighting, method, material, compare],
  );

  const paintLoupe = useCallback(() => {
    const loupe = activeLoupe();
    const product = productRef.current;
    if (!loupe || !product) return;
    const ctx = loupe.getContext("2d");
    if (!ctx) return;
    const i = selRef.current;
    const live = quad[i]!;
    const origin = loupeOrigin.current?.[i] ?? live;
    const nw = product.naturalWidth || product.width;
    const nh = product.naturalHeight || product.height;
    const z = loupeZoomRef.current;
    const r = loupeRadiusPx(nw, nh, z);
    const sx = origin.x * nw - r;
    const sy = origin.y * nh - r;
    loupe.width = LOUPE_PX;
    loupe.height = LOUPE_PX;
    ctx.fillStyle = "#efe8dc";
    ctx.fillRect(0, 0, LOUPE_PX, LOUPE_PX);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(product, sx, sy, r * 2, r * 2, 0, 0, LOUPE_PX, LOUPE_PX);

    ctx.strokeStyle = "rgba(4, 38, 63, 0.18)";
    ctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) {
      const t = (LOUPE_PX * g) / 4;
      ctx.beginPath();
      ctx.moveTo(t, 0);
      ctx.lineTo(t, LOUPE_PX);
      ctx.moveTo(0, t);
      ctx.lineTo(LOUPE_PX, t);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(209, 129, 46, 0.95)";
    ctx.lineWidth = 1.5;
    const prev = quad[(i + 3) % 4]!;
    const next = quad[(i + 1) % 4]!;
    const a = worldToLoupe(prev, origin, nw, nh, z, LOUPE_PX);
    const b = worldToLoupe(live, origin, nw, nh, z, LOUPE_PX);
    const c = worldToLoupe(next, origin, nw, nh, z, LOUPE_PX);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(209, 129, 46, 0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x, 8);
    ctx.lineTo(b.x, LOUPE_PX - 8);
    ctx.moveTo(8, b.y);
    ctx.lineTo(LOUPE_PX - 8, b.y);
    ctx.stroke();
    ctx.fillStyle = "rgb(209, 129, 46)";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }, [quad, loupeCanvas]);

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
            a.download = "tpx-proof.png";
            a.click();
            URL.revokeObjectURL(url);
            resolve();
          }, "image/png");
        });
        paint(showGuides, dragging ? "live" : "full");
      },
      getFrames: async () => {
        const product = productRef.current;
        const canvas = canvasRef.current;
        if (!product || !canvas) return null;
        paint(false, "full");
        const branded = document.createElement("canvas");
        branded.width = canvas.width;
        branded.height = canvas.height;
        branded.getContext("2d")?.drawImage(canvas, 0, 0);
        const original = document.createElement("canvas");
        original.width = canvas.width;
        original.height = canvas.height;
        original.getContext("2d")?.drawImage(product, 0, 0, canvas.width, canvas.height);
        paint(showGuides, "full");
        return { original, branded };
      },
      zoomFit: () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      },
      zoomZone: () => {
        const v = viewForZone(useStudio.getState().quad, fitted);
        setZoom(v.zoom);
        setPan({ x: v.panX, y: v.panY });
      },
      zoomCorner: (i) => {
        const idx = i ?? selRef.current;
        const v = viewForCorner(useStudio.getState().quad, idx, fitted);
        setZoom(v.zoom);
        setPan({ x: v.panX, y: v.panY });
      },
      zoomBy: (factor) => {
        setZoom((z) => clamp(z * factor, 1, 8));
      },
      nudge: (dx, dy, coarse = false) => {
        const s = useStudio.getState();
        if (toolRef.current === "mark") {
          s.setOffset(clamp(s.offsetX + dx * 0.01, -0.4, 0.4), clamp(s.offsetY + dy * 0.01, -0.4, 0.4));
          return;
        }
        const next =
          selRef.current >= 0
            ? nudgeCorner(s.quad, selRef.current, dx, dy, coarse)
            : nudgeQuad(s.quad, dx, dy, coarse);
        if (next) s.setQuad(next);
      },
      setTool: (t) => setToolInner(t),
      selectCorner: (i) => setSel(i),
      tool: () => toolRef.current,
    }),
    [paint, showGuides, dragging, fitted],
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
        setZoom(1);
        setPan({ x: 0, y: 0 });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [productSrc]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const spot = SPOT_SWATCHES.find((s) => s.id === spotId)?.rgb ?? [...TPX_NAVY_RGB];
      if (logo.kind === "wordmark") {
        const canvas = renderWordmark(wordmark, invert);
        const lum = productTone === "dark" ? 70 : productTone === "light" ? 200 : 128;
        treatLogo(canvas, treatment, spot, { substrateLum: lum, method });
        logoRef.current = canvas;
        if (!cancelled) setLogoTick((n) => n + 1);
        return;
      }
      if (!logo.src) return;
      const img = await loadImage(logo.src);
      if (cancelled) return;
      const canvas = rasterizeLogo(img, invert);
      const lum = productTone === "dark" ? 70 : productTone === "light" ? 200 : 128;
      treatLogo(canvas, treatment, spot, { substrateLum: lum, method });
      logoRef.current = canvas;
      setLogoTick((n) => n + 1);
    };
    run().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [logo, wordmark, invert, treatment, spotId, method, productTone]);

  useEffect(() => {
    if (!ready) return;
    paint(showGuides, dragging ? "live" : "full");
  }, [ready, paint, showGuides, dragging, logoTick, productSrc]);

  useEffect(() => {
    paintLoupe();
  }, [paintLoupe, sel, ready, loupeZoom]);

  useEffect(() => {
    const el = viewRef.current;
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

  const uvAt = (clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return { x: 0, y: 0 };
    return {
      x: clamp((clientX - rect.left) / rect.width, 0, 1),
      y: clamp((clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const applyLoupe = (clientX: number, clientY: number, target: HTMLElement) => {
    const origin = loupeOrigin.current;
    const p = origin?.[selRef.current];
    const product = productRef.current;
    if (!origin || !p || !product) return;
    const box = target.getBoundingClientRect();
    if (!box.width) return;
    const nx = clamp((clientX - box.left) / box.width, 0, 1);
    const ny = clamp((clientY - box.top) / box.height, 0, 1);
    const nw = product.naturalWidth || product.width;
    const nh = product.naturalHeight || product.height;
    const world = loupeToWorld(p, nx, ny, nw, nh, loupeZoomRef.current);
    const next = moveCorner(origin, selRef.current, world);
    if (next) setQuad(next);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      const d = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      const z = clamp(pinch.current.zoom * (d / pinch.current.dist), 1, 8);
      setZoom(z);
      return;
    }
    if (dragIndex.current >= 0 && loupeOrigin.current && (e.currentTarget as HTMLElement).dataset.loupe) {
      applyLoupe(e.clientX, e.clientY, e.currentTarget as HTMLElement);
      return;
    }
    const { x, y } = uvAt(e.clientX, e.clientY);
    if (dragIndex.current >= 0 && !loupeOrigin.current) {
      const next = moveCorner(quad, dragIndex.current, { x, y });
      if (next) setQuad(next);
      return;
    }
    if (dragEdge.current >= 0 && zoneDrag.current) {
      const next = moveEdge(zoneDrag.current.q, dragEdge.current, x - zoneDrag.current.x, y - zoneDrag.current.y);
      if (next) setQuad(next);
      return;
    }
    if (zoneDrag.current) {
      const next = translateQuad(zoneDrag.current.q, x - zoneDrag.current.x, y - zoneDrag.current.y);
      if (next) setQuad(next);
      return;
    }
    if (moveDrag.current) {
      const dx = (x - moveDrag.current.x) * 1.6;
      const dy = (y - moveDrag.current.y) * 1.6;
      setOffset(clamp(moveDrag.current.ox + dx, -0.4, 0.4), clamp(moveDrag.current.oy + dy, -0.4, 0.4));
    }
    if (panDrag.current) {
      setPan({
        x: panDrag.current.px + (e.clientX - panDrag.current.x),
        y: panDrag.current.py + (e.clientY - panDrag.current.y),
      });
    }
  };

  const endDrag = (e: React.PointerEvent | PointerEvent) => {
    const target = e.currentTarget as HTMLElement | null;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (dragIndex.current < 0 && dragEdge.current < 0 && !moveDrag.current && !zoneDrag.current && !panDrag.current) {
      return;
    }
    dragIndex.current = -1;
    dragEdge.current = -1;
    moveDrag.current = null;
    zoneDrag.current = null;
    panDrag.current = null;
    loupeOrigin.current = null;
    setDragging(false);
    useStudio.getState().rememberNow();
    if (target) {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    paintLoupe();
  };

  const startOnStage = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) || 1,
        zoom: zoomRef.current,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      zoneDrag.current = null;
      moveDrag.current = null;
      panDrag.current = null;
      return;
    }
    if (dragIndex.current >= 0 || dragEdge.current >= 0) return;
    const { x, y } = uvAt(e.clientX, e.clientY);
    if (e.altKey || e.button === 1) {
      panDrag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (tool === "zone" && pointInQuad(quad, { x, y })) {
      useStudio.getState().pushHistory();
      zoneDrag.current = { x, y, q: cloneQuad(quad) };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (tool === "mark") {
      useStudio.getState().pushHistory();
      moveDrag.current = { x, y, ox: offsetX, oy: offsetY };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    panDrag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 40 && !e.shiftKey) {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      return;
    }
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.12;
    setZoom((z) => clamp(z * factor, 1, 8));
  };

  const onKey = (e: React.KeyboardEvent) => {
    const cornerKeys: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
    if (e.key in cornerKeys) {
      e.preventDefault();
      setSel(cornerKeys[e.key]!);
      return;
    }
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    const s = useStudio.getState();
    const next = nudgeCorner(s.quad, selRef.current, d[0], d[1], e.shiftKey);
    if (next) s.setQuad(next);
  };

  const startLoupeOn = (e: PointerEvent, target: HTMLCanvasElement) => {
    e.preventDefault();
    useStudio.getState().pushHistory();
    loupeOrigin.current = cloneQuad(useStudio.getState().quad);
    dragIndex.current = selRef.current;
    setDragging(true);
    target.setPointerCapture(e.pointerId);
    applyLoupe(e.clientX, e.clientY, target);
  };

  useEffect(() => {
    const el = loupeCanvas;
    if (!el) return;
    const down = (e: PointerEvent) => startLoupeOn(e, el);
    const move = (e: PointerEvent) => {
      if (dragIndex.current < 0 || !loupeOrigin.current) return;
      applyLoupe(e.clientX, e.clientY, el);
    };
    const up = (e: PointerEvent) => endDrag(e);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    paintLoupe();
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [loupeCanvas, paintLoupe]);

  const handleScale = 1 / zoom;
  const showFloatLoupe = showGuides && !hideLoupe && !loupeCanvas;

  return (
    <div
      ref={viewRef}
      tabIndex={0}
      className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden p-2 outline-none"
      onWheel={onWheel}
      onKeyDown={onKey}
    >
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
        }}
        className="relative"
      >
        <div
          ref={wrapRef}
          className="relative max-h-full max-w-full"
          style={{
            width: fitted.w ? fitted.w : "100%",
            height: fitted.h ? fitted.h : "auto",
            maxWidth: "100%",
            maxHeight: "100%",
          }}
          onPointerDown={startOnStage}
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
            [0, 1, 2, 3].map((edge) => {
              const m = edgeMid(quad, edge);
              return (
                <button
                  key={`e${edge}`}
                  type="button"
                  aria-label={`Move edge ${edge}`}
                  className="absolute z-10 size-8 -translate-x-1/2 -translate-y-1/2 touch-none rounded-sm bg-primary/90 shadow-[var(--shadow-border)] after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2"
                  style={{
                    left: `${m.x * 100}%`,
                    top: `${m.y * 100}%`,
                    transform: `translate(-50%, -50%) scale(${handleScale})`,
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    useStudio.getState().pushHistory();
                    const uv = uvAt(e.clientX, e.clientY);
                    dragEdge.current = edge;
                    zoneDrag.current = { x: uv.x, y: uv.y, q: cloneQuad(quad) };
                    setDragging(true);
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                />
              );
            })}
          {showGuides &&
            quad.map((p, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Move ${CORNER_LABELS[i]} corner`}
                className={cn(
                  "absolute z-20 size-11 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full bg-primary text-xs font-semibold tracking-wide text-primary-foreground shadow-[var(--shadow-border)] after:absolute after:left-1/2 after:top-1/2 after:size-12 after:-translate-x-1/2 after:-translate-y-1/2",
                  sel === i ? "ring-2 ring-foreground" : "opacity-80",
                )}
                style={{
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  transform: `translate(-50%, -50%) scale(${handleScale})`,
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  useStudio.getState().pushHistory();
                  dragIndex.current = i;
                  setSel(i);
                  setDragging(true);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSel(i);
                  const v = viewForCorner(quad, i, fitted);
                  setZoom(v.zoom);
                  setPan({ x: v.panX, y: v.panY });
                }}
              >
                {CORNER_LABELS[i]}
              </button>
            ))}
          {(scanning || generating) && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-background/20" />
              <div className="absolute inset-x-0 top-0 h-px bg-primary scan-sweep" />
            </div>
          )}
          {!ready && <div className="absolute inset-0 animate-pulse bg-secondary" />}
        </div>
      </div>

      {showFloatLoupe ? (
        <div
          className="absolute z-30 overflow-hidden rounded-xl bg-paper shadow-[var(--shadow-border)]"
          style={{ width: LOUPE_PX, height: LOUPE_PX, right: 12, top: 12 }}
        >
          <canvas
            ref={floatLoupeRef}
            width={LOUPE_PX}
            height={LOUPE_PX}
            data-loupe="1"
            className="block size-full touch-none"
            aria-label="Placement zoom window"
            onPointerDown={(e) => startLoupeOn(e.nativeEvent, e.currentTarget)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
          <p className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-xs font-medium text-primary">
            {CORNER_LABELS[sel]} · click to place
          </p>
        </div>
      ) : null}

      <p
        className={cn(
          "pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-muted-foreground",
          !showGuides && "hidden",
        )}
      >
        {compare
          ? "SKU  ·  branded"
          : tool === "zone"
            ? "Corners lock the face · click the zoom window to pin · pinch to zoom"
            : "Drag the mark inside the zone"}
      </p>
    </div>
  );
});
