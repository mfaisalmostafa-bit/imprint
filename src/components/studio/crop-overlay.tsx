import { useRef } from "react";
import type { AspectId, CropRect } from "@/lib/edit";
import { aspectValue, fitCropToAspect } from "@/lib/edit";
import { cn } from "@/lib/utils";

type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const HANDLES: { id: Handle; className: string }[] = [
  { id: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
  { id: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
  { id: "se", className: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
  { id: "sw", className: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
  { id: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize" },
  { id: "s", className: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize" },
  { id: "e", className: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
  { id: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
];

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function CropOverlay({
  crop,
  aspect,
  imageAspect,
  onChange,
  disabled,
}: {
  crop: CropRect;
  aspect: AspectId;
  imageAspect: number;
  onChange: (c: CropRect) => void;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    handle: Handle;
    start: CropRect;
    x: number;
    y: number;
  } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; crop: CropRect } | null>(null);

  const toUv = (clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  };

  const applyHandle = (handle: Handle, start: CropRect, dx: number, dy: number) => {
    let { x, y, w, h } = start;
    const ratio = aspectValue(aspect);
    const lock = ratio ? ratio / imageAspect : null;

    const setBox = (nx: number, ny: number, nw: number, nh: number) => {
      if (lock) {
        if (handle === "e" || handle === "w") nh = nw / lock;
        else if (handle === "n" || handle === "s") nw = nh * lock;
        else {
          const useW = Math.abs(dx) * imageAspect > Math.abs(dy);
          if (useW) nh = nw / lock;
          else nw = nh * lock;
        }
      }
      if (nw < 0.08) nw = 0.08;
      if (nh < 0.08) nh = 0.08;
      if (nx < 0) {
        nw += nx;
        nx = 0;
      }
      if (ny < 0) {
        nh += ny;
        ny = 0;
      }
      if (nx + nw > 1) nw = 1 - nx;
      if (ny + nh > 1) nh = 1 - ny;
      onChange(fitCropToAspect({ x: nx, y: ny, w: nw, h: nh }, imageAspect, ratio));
    };

    switch (handle) {
      case "move":
        onChange(
          fitCropToAspect(
            { x: clamp01(x + dx), y: clamp01(y + dy), w, h },
            imageAspect,
            null,
          ),
        );
        return;
      case "e":
        setBox(x, y, w + dx, h);
        return;
      case "w":
        setBox(x + dx, y, w - dx, h);
        return;
      case "s":
        setBox(x, y, w, h + dy);
        return;
      case "n":
        setBox(x, y + dy, w, h - dy);
        return;
      case "se":
        setBox(x, y, w + dx, h + dy);
        return;
      case "ne":
        setBox(x, y + dy, w + dx, h - dy);
        return;
      case "sw":
        setBox(x + dx, y, w - dx, h + dy);
        return;
      case "nw":
        setBox(x + dx, y + dy, w - dx, h - dy);
        return;
    }
  };

  const onPointerDown = (handle: Handle, e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const uv = toUv(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, uv);
    drag.current = { handle, start: { ...crop }, x: uv.x, y: uv.y };
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      pinch.current = { dist: Math.max(0.04, dist), crop: { ...crop } };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (disabled) return;
    const uv = toUv(e.clientX, e.clientY);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, uv);

    if (pointers.current.size >= 2 && pinch.current) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      const scale = dist / pinch.current.dist;
      const c = pinch.current.crop;
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      const w = c.w * scale;
      const h = c.h * scale;
      onChange(
        fitCropToAspect(
          { x: cx - w / 2, y: cy - h / 2, w, h },
          imageAspect,
          aspectValue(aspect),
        ),
      );
      return;
    }

    if (!drag.current) return;
    applyHandle(drag.current.handle, drag.current.start, uv.x - drag.current.x, uv.y - drag.current.y);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (drag.current) drag.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const left = `${crop.x * 100}%`;
  const top = `${crop.y * 100}%`;
  const width = `${crop.w * 100}%`;
  const height = `${crop.h * 100}%`;

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 touch-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute overflow-hidden"
        style={{
          left,
          top,
          width,
          height,
          boxShadow: "0 0 0 9999px rgb(9 9 11 / 0.62)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgb(244 241 234 / 0.28) 1px, transparent 1px), linear-gradient(to bottom, rgb(244 241 234 / 0.28) 1px, transparent 1px)",
            backgroundSize: "33.333% 33.333%",
          }}
        />
      </div>
      <div
        className={cn("absolute border border-primary", disabled && "pointer-events-none")}
        style={{ left, top, width, height }}
        onPointerDown={(e) => onPointerDown("move", e)}
      >
        {HANDLES.map((h) => (
          <button
            key={h.id}
            type="button"
            aria-label={`Crop ${h.id}`}
            className={cn(
              "absolute z-10 size-4 rounded-full bg-primary shadow-[var(--shadow-border)] after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2",
              h.className,
            )}
            onPointerDown={(e) => onPointerDown(h.id, e)}
          />
        ))}
      </div>
    </div>
  );
}
