import { ScanSearch, RotateCcw, Box, Check } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useStudio } from "@/lib/store";
import { formatDeg, poseFromQuad } from "@/lib/geometry";
import { METHODS } from "@/lib/methods";
import { inspectPlacement } from "@/lib/qc";
import { SPOT_SWATCHES, type Treatment } from "@/lib/treat";
import { cn } from "@/lib/utils";

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
  const method = useStudio((s) => s.method);
  const treatment = useStudio((s) => s.treatment);
  const spotId = useStudio((s) => s.spotId);
  const mockup = useStudio((s) => s.mockup());

  const setScale = useStudio((s) => s.setScale);
  const setOpacity = useStudio((s) => s.setOpacity);
  const setLighting = useStudio((s) => s.setLighting);
  const setCylinderArc = useStudio((s) => s.setCylinderArc);
  const setInvert = useStudio((s) => s.setInvert);
  const setShowGuides = useStudio((s) => s.setShowGuides);
  const resetPlacement = useStudio((s) => s.resetPlacement);
  const setMethod = useStudio((s) => s.setMethod);
  const setTreatment = useStudio((s) => s.setTreatment);
  const setSpotId = useStudio((s) => s.setSpotId);

  const pose = poseFromQuad(quad);

  const allowed = "methods" in mockup ? mockup.methods : [];
  const maxScale = "maxScale" in mockup ? mockup.maxScale : 0.9;
  const sku = "sku" in mockup ? mockup.sku : "CUSTOM";
  const flags = inspectPlacement({
    scale,
    maxScale,
    quad,
    method,
    allowed,
    productTone: "tone" in mockup ? mockup.tone : "mid",
    invert,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-4">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{sku}</p>
        <h2 className="font-sans text-lg font-semibold leading-tight text-foreground">{surfaceLabel}</h2>
        <p className="text-sm capitalize text-muted-foreground">{material}</p>
        {"printWmm" in mockup ? (
          <p className="text-xs tabular-nums text-muted-foreground">
            Print {mockup.printWmm} × {mockup.printHmm} mm
          </p>
        ) : null}
      </header>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Decoration</p>
        <div className="flex flex-wrap gap-2">
          {allowed.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMethod(id)}
              className={cn(
                "h-10 rounded-md px-3 text-xs shadow-[var(--shadow-border)]",
                method === id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
              )}
            >
              {METHODS[id].short}
            </button>
          ))}
        </div>
        <p className="text-xs leading-snug text-muted-foreground">{METHODS[method].quoteLine}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mark treatment</p>
        <div className="grid grid-cols-2 gap-2">
          {(["auto", "knockout", "full", "one_color"] as Treatment[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTreatment(t)}
              className={cn(
                "h-10 rounded-md text-[11px] shadow-[var(--shadow-border)]",
                treatment === t ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
              )}
            >
              {t === "auto" ? "Auto" : t === "knockout" ? "Knockout" : t === "full" ? "Full colour" : "1-colour"}
            </button>
          ))}
        </div>
        {treatment === "one_color" ? (
          <div className="flex flex-wrap gap-2">
            {SPOT_SWATCHES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-label={s.label}
                onClick={() => setSpotId(s.id)}
                className={cn(
                  "size-8 rounded-full shadow-[var(--shadow-border)]",
                  spotId === s.id && "ring-2 ring-primary",
                )}
                style={{ background: `rgb(${s.rgb.join(",")})` }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2 rounded-lg bg-secondary p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">QC</p>
        {flags.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-ok">
            <Check className="size-3.5" />
            Print-safe
          </p>
        ) : (
          flags.map((f) => (
            <p
              key={f.code + f.text}
              className={cn("text-sm leading-snug", f.level === "block" ? "text-destructive" : "text-foreground")}
            >
              {f.level === "block" ? "Block — " : "Warn — "}
              {f.text}
            </p>
          ))
        )}
        {scanError ? <p className="text-sm text-destructive">{scanError}</p> : null}
        {brainNote ? <p className="text-xs text-muted-foreground">{brainNote}</p> : null}
        {confidence != null ? (
          <p className="text-xs tabular-nums text-muted-foreground">
            Confidence {Math.round(confidence * 100)}%
          </p>
        ) : null}
        <Button className="w-full" onClick={onScan} disabled={scanning}>
          <ScanSearch />
          {scanning ? "Reading zone…" : "Lock print zone"}
        </Button>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pose</p>
        <div className="flex h-24 items-center justify-center rounded-lg bg-secondary" style={{ perspective: "420px" }}>
          <div
            className="gizmo-plane size-14 rounded-sm bg-primary/20 shadow-[var(--shadow-border)]"
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
      </div>

      <div className="space-y-5">
        <Row label="Scale" value={`${Math.round(scale * 100)}%`}>
          <Slider min={0.18} max={maxScale} step={0.01} value={[scale]} onValueChange={(v) => setScale(v[0] ?? scale)} />
        </Row>
        <Row label="Depth" value={`${Math.round(opacity * 100)}%`}>
          <Slider min={0.2} max={1} step={0.01} value={[opacity]} onValueChange={(v) => setOpacity(v[0] ?? opacity)} />
        </Row>
        <Row label="Light match" value={`${Math.round(lighting * 100)}%`}>
          <Slider min={0} max={1} step={0.01} value={[lighting]} onValueChange={(v) => setLighting(v[0] ?? lighting)} />
        </Row>
        {wrap === "cylinder" ? (
          <Row label="Cylinder arc" value={`${Math.round((cylinderArc * 180) / Math.PI)}°`}>
            <Slider
              min={0.4}
              max={2.2}
              step={0.02}
              value={[cylinderArc]}
              onValueChange={(v) => setCylinderArc(v[0] ?? cylinderArc)}
            />
          </Row>
        ) : null}
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
          Show zone
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
