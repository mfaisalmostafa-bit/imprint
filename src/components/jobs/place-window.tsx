import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Minimize2,
  Redo2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { StageHandle } from "@/components/studio/stage-canvas";
import { METHODS, type MethodId } from "@/lib/methods";
import { CORNER_LABELS, LOUPE_PX, LOUPE_ZOOMS, formatUv, type PlaceTool } from "@/lib/place";
import type { WrapMode } from "@/lib/mockups";
import type { Quad } from "@/lib/geometry";
import { cn } from "@/lib/utils";

const WRAPS: WrapMode[] = ["plane", "cylinder", "taper", "cone", "sphere"];

export function PlaceWindow({
  stageRef,
  onLoupeCanvas,
  tool,
  onTool,
  sel,
  onSel,
  loupeZoom,
  onLoupeZoom,
  quad,
  scale,
  maxScale,
  onScale,
  wrap,
  onWrap,
  cylinderArc,
  onCurve,
  method,
  methods,
  onMethod,
  sku,
  name,
  source,
  note,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onReset,
  onUpload,
  onCopy,
  onSplit,
  compare,
  onClose,
  onGesture,
}: {
  stageRef: { current: StageHandle | null };
  onLoupeCanvas: (el: HTMLCanvasElement | null) => void;
  tool: PlaceTool;
  onTool: (t: PlaceTool) => void;
  sel: number;
  onSel: (i: number) => void;
  loupeZoom: number;
  onLoupeZoom: (z: number) => void;
  quad: Quad;
  scale: number;
  maxScale: number;
  onScale: (n: number) => void;
  wrap: WrapMode;
  onWrap: (w: WrapMode) => void;
  cylinderArc: number;
  onCurve: (n: number) => void;
  method: MethodId;
  methods: MethodId[];
  onMethod: (m: MethodId) => void;
  sku: string;
  name: string;
  source: "detected" | "override" | "edited";
  note: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onReset: () => void;
  onUpload: (file: File | null) => void;
  onCopy: () => void;
  onSplit: () => void;
  compare: boolean;
  onClose: () => void;
  onGesture: () => void;
}) {
  const hostRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    onLoupeCanvas(hostRef.current);
    return () => onLoupeCanvas(null);
  }, [onLoupeCanvas]);

  const pickCorner = (i: number) => {
    onSel(i);
    stageRef.current?.selectCorner(i);
    stageRef.current?.zoomCorner(i);
  };

  const pickTool = (t: PlaceTool) => {
    onTool(t);
    stageRef.current?.setTool(t);
  };

  return (
    <aside
      className="place-sheet fixed inset-x-0 bottom-0 z-40 flex max-h-[56%] flex-col overflow-hidden rounded-t-xl bg-card shadow-[var(--shadow-border)] md:relative md:inset-auto md:z-0 md:h-full md:max-h-none md:w-80 md:rounded-none md:border-l md:border-border md:shadow-none"
      aria-label="Placement window"
    >
      <div className="flex justify-center pt-2 md:hidden">
        <span className="h-1 w-10 rounded-full bg-border" />
      </div>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Place</p>
        <span className="text-xs tabular-nums text-muted-foreground">{sku || "—"}</span>
        <button
          type="button"
          className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground"
          aria-label="Minimise placement window"
          onClick={onClose}
        >
          <Minimize2 className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div>
          <h2 className="text-sm font-semibold leading-tight">{name}</h2>
          <p className="text-xs capitalize text-muted-foreground">
            {source} · {METHODS[method].label}
          </p>
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-paper shadow-[var(--shadow-border)]">
          <canvas
            ref={hostRef}
            width={LOUPE_PX}
            height={LOUPE_PX}
            className="block size-full touch-none"
            aria-label="Placement zoom window"
          />
          <p className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-xs font-medium text-primary">
            {CORNER_LABELS[sel]} · click to place
          </p>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {CORNER_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => pickCorner(i)}
              className={cn(
                "min-h-11 rounded-lg text-xs font-medium tabular-nums",
                sel === i ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-center text-xs tabular-nums text-muted-foreground">{formatUv(quad[sel]!)}</p>

        <div className="flex gap-1">
          {LOUPE_ZOOMS.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => onLoupeZoom(z)}
              className={cn(
                "min-h-11 flex-1 rounded-lg text-xs tabular-nums",
                loupeZoom === z ? "bg-secondary text-foreground" : "text-muted-foreground",
              )}
            >
              {z}×
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => pickTool("zone")}
            className={cn(
              "min-h-11 rounded-lg text-xs",
              tool === "zone" ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            Zone
          </button>
          <button
            type="button"
            onClick={() => pickTool("mark")}
            className={cn(
              "min-h-11 rounded-lg text-xs",
              tool === "mark" ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            Mark
          </button>
        </div>

        <div className="grid grid-cols-3 place-items-center gap-1">
          <span />
          <Nudge
            dir="up"
            onStart={onGesture}
            onHold={(coarse) => stageRef.current?.nudge(0, -1, coarse)}
          />
          <span />
          <Nudge
            dir="left"
            onStart={onGesture}
            onHold={(coarse) => stageRef.current?.nudge(-1, 0, coarse)}
          />
          <span className="text-xs text-muted-foreground">Hold · shift</span>
          <Nudge
            dir="right"
            onStart={onGesture}
            onHold={(coarse) => stageRef.current?.nudge(1, 0, coarse)}
          />
          <span />
          <Nudge
            dir="down"
            onStart={onGesture}
            onHold={(coarse) => stageRef.current?.nudge(0, 1, coarse)}
          />
          <span />
        </div>

        <label className="block">
          <span className="flex justify-between text-xs text-muted-foreground">
            Size <span className="tabular-nums">{Math.round(scale * 100)}</span>
          </span>
          <Slider min={0.2} max={maxScale} step={0.01} value={[scale]} onValueChange={(v) => onScale(v[0] ?? scale)} />
        </label>
        {wrap !== "plane" ? (
          <label className="block">
            <span className="flex justify-between text-xs text-muted-foreground">
              Curve <span className="tabular-nums">{cylinderArc.toFixed(2)}</span>
            </span>
            <Slider
              min={0.2}
              max={2}
              step={0.05}
              value={[cylinderArc]}
              onValueChange={(v) => onCurve(v[0] ?? cylinderArc)}
            />
          </label>
        ) : null}

        <div className="flex flex-wrap gap-1">
          <Mini onClick={() => stageRef.current?.zoomFit()}>Fit</Mini>
          <Mini onClick={() => stageRef.current?.zoomZone()}>Zone</Mini>
          <Mini onClick={() => stageRef.current?.zoomBy(0.8)}>−</Mini>
          <Mini onClick={() => stageRef.current?.zoomBy(1.25)}>+</Mini>
          <Mini onClick={onUndo} disabled={!canUndo}>
            <Undo2 className="size-3.5" />
          </Mini>
          <Mini onClick={onRedo} disabled={!canRedo}>
            <Redo2 className="size-3.5" />
          </Mini>
        </div>

        <div className="flex flex-wrap gap-1">
          {methods.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onMethod(id)}
              className={cn(
                "min-h-11 rounded-lg px-3 text-xs",
                method === id ? "bg-secondary text-foreground" : "text-muted-foreground",
              )}
            >
              {METHODS[id].short}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {WRAPS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onWrap(w)}
              className={cn(
                "min-h-11 rounded-lg px-3 text-xs capitalize",
                wrap === w ? "bg-secondary text-foreground" : "text-muted-foreground",
              )}
            >
              {w}
            </button>
          ))}
        </div>

        <Button className="h-11 w-full" onClick={onSave}>
          Save for this SKU
        </Button>
        <Button variant="secondary" className="h-11 w-full" onClick={onReset}>
          Reset to detected
        </Button>
        <label className="flex h-11 w-full cursor-pointer items-center justify-center rounded-md bg-secondary text-sm">
          Upload product photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              onUpload(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
        <div className="flex gap-1">
          <Button variant="secondary" className="h-11 flex-1" onClick={onSplit}>
            {compare ? "Hide split" : "Split"}
          </Button>
          <Button variant="secondary" className="h-11 flex-1" onClick={onCopy}>
            Copy JSON
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{note}</p>
      </div>
    </aside>
  );
}

function Nudge({
  dir,
  onStart,
  onHold,
}: {
  dir: "up" | "down" | "left" | "right";
  onStart: () => void;
  onHold: (coarse: boolean) => void;
}) {
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => stop, []);

  const Icon = dir === "up" ? ChevronUp : dir === "down" ? ChevronDown : dir === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={`Nudge ${dir}`}
      onPointerDown={(e) => {
        e.preventDefault();
        const coarse = e.shiftKey;
        onStart();
        onHold(coarse);
        timer.current = window.setInterval(() => onHold(coarse), 70);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className="flex size-11 items-center justify-center rounded-lg bg-secondary text-foreground"
    >
      <Icon className="size-4" />
    </button>
  );
}

function Mini({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 min-w-11 items-center justify-center rounded-lg bg-secondary px-3 text-xs disabled:opacity-40"
    >
      {children}
    </button>
  );
}
