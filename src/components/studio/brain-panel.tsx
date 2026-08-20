import { ScanSearch, RotateCcw, Box } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useStudio } from "@/lib/store";
import { formatDeg, homography, poseFromQuad, UNIT_QUAD } from "@/lib/geometry";
import { type BlendMode, type WrapMode } from "@/lib/mockups";
import { cn } from "@/lib/utils";

const BLENDS: { id: BlendMode; label: string }[] = [
  { id: "multiply", label: "Multiply" },
  { id: "screen", label: "Screen" },
  { id: "overlay", label: "Overlay" },
  { id: "soft-light", label: "Soft" },
  { id: "source-over", label: "Normal" },
];

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {value ? <span className="font-sans text-xs tabular-nums text-foreground">{value}</span> : null}
      </div>
      {children}
    </label>
  );
}

export function BrainPanel({ onScan }: { onScan: () => void }) {
  const quad = useStudio((s) => s.quad);
  const scale = useStudio((s) => s.scale);
  const opacity = useStudio((s) => s.opacity);
  const lighting = useStudio((s) => s.lighting);
  const blend = useStudio((s) => s.blend);
  const wrap = useStudio((s) => s.wrap);
  const cylinderArc = useStudio((s) => s.cylinderArc);
  const invert = useStudio((s) => s.invert);
  const showGuides = useStudio((s) => s.showGuides);
  const scanning = useStudio((s) => s.scanning);
  const scanError = useStudio((s) => s.scanError);
  const brainNote = useStudio((s) => s.brainNote);
  const confidence = useStudio((s) => s.confidence);
  const surfaceLabel = useStudio((s) => s.surfaceLabel);
  const material = useStudio((s) => s.material);

  const setScale = useStudio((s) => s.setScale);
  const setOpacity = useStudio((s) => s.setOpacity);
  const setLighting = useStudio((s) => s.setLighting);
  const setBlend = useStudio((s) => s.setBlend);
  const setWrap = useStudio((s) => s.setWrap);
  const setCylinderArc = useStudio((s) => s.setCylinderArc);
  const setInvert = useStudio((s) => s.setInvert);
  const setShowGuides = useStudio((s) => s.setShowGuides);
  const resetPlacement = useStudio((s) => s.resetPlacement);

  const pose = poseFromQuad(quad);
  let matrix: string[] = ["—", "—", "—", "—", "—", "—", "—", "—", "—"];
  try {
    matrix = homography(UNIT_QUAD, quad).map((n) => n.toFixed(2));
  } catch {
    /* keep dashes */
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-4">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Brain</p>
        <h2 className="font-serif text-2xl leading-tight text-foreground">{surfaceLabel}</h2>
        <p className="text-sm capitalize text-muted-foreground">{material}</p>
      </header>

      <div className="space-y-3 rounded-lg bg-secondary p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Lock</span>
          {confidence != null ? (
            <span className="text-xs tabular-nums text-foreground">
              {Math.round(confidence * 100)}%
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Unscanned</span>
          )}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-background">
          <div
            className="h-full bg-primary"
            style={{ width: `${Math.round((confidence ?? 0) * 100)}%` }}
          />
        </div>
        {brainNote ? <p className="text-sm leading-snug text-muted-foreground">{brainNote}</p> : null}
        {scanError ? <p className="text-sm text-destructive">{scanError}</p> : null}
        <Button className="w-full" onClick={onScan} disabled={scanning}>
          <ScanSearch />
          {scanning ? "Reading plane…" : "Scan surface"}
        </Button>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pose</p>
        <div
          className="flex h-28 items-center justify-center rounded-lg bg-secondary"
          style={{ perspective: "420px" }}
        >
          <div
            className="gizmo-plane size-16 rounded-sm bg-primary/20 shadow-[var(--shadow-border)]"
            style={{
              transform: `rotateX(${(-pose.pitchDeg).toFixed(1)}deg) rotateY(${pose.yawDeg.toFixed(1)}deg) rotateZ(${pose.rollDeg.toFixed(1)}deg)`,
              transition: "transform 150ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div className="flex size-full items-center justify-center">
              <Box className="size-5 text-primary" />
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Yaw", formatDeg(pose.yawDeg)],
            ["Pitch", formatDeg(pose.pitchDeg)],
            ["Roll", formatDeg(pose.rollDeg)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-secondary px-1 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="font-sans text-sm tabular-nums text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-center text-xs tabular-nums text-muted-foreground">
          Aspect {pose.aspect.toFixed(2)} · Fx {pose.foreshortenX.toFixed(2)} · Fy {pose.foreshortenY.toFixed(2)}
        </p>
        <div className="grid grid-cols-3 gap-x-2 gap-y-1 font-sans text-[10px] tabular-nums text-faint">
          {matrix.map((n, i) => (
            <span key={i} className="text-right">
              {n}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <Row label="Scale" value={`${Math.round(scale * 100)}%`}>
          <Slider min={0.18} max={1.15} step={0.01} value={[scale]} onValueChange={(v) => setScale(v[0] ?? scale)} />
        </Row>
        <Row label="Ink" value={`${Math.round(opacity * 100)}%`}>
          <Slider min={0.2} max={1} step={0.01} value={[opacity]} onValueChange={(v) => setOpacity(v[0] ?? opacity)} />
        </Row>
        <Row label="Light match" value={`${Math.round(lighting * 100)}%`}>
          <Slider min={0} max={1} step={0.01} value={[lighting]} onValueChange={(v) => setLighting(v[0] ?? lighting)} />
        </Row>
        <Row label="Cylinder arc" value={`${Math.round((cylinderArc * 180) / Math.PI)}°`}>
          <Slider
            min={0.4}
            max={2.2}
            step={0.02}
            value={[cylinderArc]}
            onValueChange={(v) => setCylinderArc(v[0] ?? cylinderArc)}
            disabled={wrap !== "cylinder"}
          />
        </Row>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Wrap</p>
        <div className="grid grid-cols-2 gap-2">
          {(["plane", "cylinder"] as WrapMode[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWrap(w)}
              className={cn(
                "h-11 rounded-md text-sm capitalize shadow-[var(--shadow-border)]",
                wrap === w ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
              )}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Blend</p>
        <div className="flex flex-wrap gap-2">
          {BLENDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBlend(b.id)}
              className={cn(
                "h-9 rounded-md px-3 text-xs shadow-[var(--shadow-border)]",
                blend === b.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex h-11 items-center justify-between gap-3 rounded-md bg-secondary px-3 text-sm">
          Invert mark
          <input
            type="checkbox"
            checked={invert}
            onChange={(e) => setInvert(e.target.checked)}
            className="size-4 accent-primary"
          />
        </label>
        <label className="flex h-11 items-center justify-between gap-3 rounded-md bg-secondary px-3 text-sm">
          Show plane
          <input
            type="checkbox"
            checked={showGuides}
            onChange={(e) => setShowGuides(e.target.checked)}
            className="size-4 accent-primary"
          />
        </label>
        <Button variant="secondary" onClick={resetPlacement}>
          <RotateCcw />
          Reset placement
        </Button>
      </div>
    </div>
  );
}
