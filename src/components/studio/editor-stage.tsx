import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw, RotateCw, FlipHorizontal, FlipVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { CropOverlay } from "@/components/studio/crop-overlay";
import {
  ASPECTS,
  FILTERS,
  applyEdit,
  canvasToDataUrl,
  cloneEdit,
  DEFAULT_EDIT,
  fitCropToAspect,
  type EditDraft,
} from "@/lib/edit";
import { loadImage } from "@/lib/image";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";

export function EditorStage({
  source,
  onApply,
  onCancel,
}: {
  source: string;
  onApply: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const draft = useStudio((s) => s.draft);
  const setDraft = useStudio((s) => s.setDraft);
  const tool = useStudio((s) => s.editTool);
  const target = useStudio((s) => s.editTarget);
  const setEditTarget = useStudio((s) => s.setEditTarget);
  const logo = useStudio((s) => s.logo);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fitted, setFitted] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    loadImage(source)
      .then((el) => {
        if (!cancelled) setImg(el);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [source]);

  const imageAspect = img ? (img.naturalWidth || img.width) / (img.naturalHeight || img.height || 1) : 1;

  useEffect(() => {
    const el = wrapRef.current?.parentElement;
    if (!el || !img) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      const pad = 24;
      const s = Math.min((r.width - pad) / nw, (r.height - pad) / nh);
      setFitted({ w: Math.max(80, nw * s), h: Math.max(80, nh * s) });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  useEffect(() => {
    if (!img) return;
    if (tool === "crop") {
      setPreview(null);
      return;
    }
    const canvas = applyEdit(img, draft, 720);
    setPreview(canvasToDataUrl(canvas, "image/jpeg", 0.82));
  }, [img, draft, tool]);

  const setCrop = (crop: EditDraft["crop"]) => {
    setDraft((d) => ({ ...d, crop }));
  };

  const rotate90 = (dir: 1 | -1) => {
    setDraft((d) => ({ ...d, rotation: ((d.rotation + dir * 90) % 360 + 360) % 360 }));
  };

  const commit = () => {
    if (!img) return;
    const canvas = applyEdit(img, draft, 2000);
    const opaque = target === "product";
    onApply(canvasToDataUrl(canvas, opaque ? "image/jpeg" : "image/png", 0.92));
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex rounded-md bg-secondary p-1">
          {(["logo", "product"] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={t === "logo" && logo.kind === "wordmark"}
              onClick={() => setEditTarget(t)}
              className={cn(
                "h-8 rounded-sm px-3 text-xs capitalize",
                target === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {t === "logo" ? "Mark" : "Product"}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {tool === "crop" ? "Drag handles · pinch to scale" : tool === "rotate" ? "Straighten the plane" : "Tone the frame"}
        </span>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full items-center justify-center p-3">
          <div
            ref={wrapRef}
            className="relative max-h-full max-w-full overflow-hidden rounded-md shadow-[var(--shadow-border)]"
            style={{
              width: fitted.w || "100%",
              height: fitted.h || "auto",
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          >
            {img ? (
              <img
                src={preview ?? source}
                alt=""
                className="block h-full w-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="size-full animate-pulse bg-secondary" />
            )}
            {tool === "crop" && img ? (
              <CropOverlay
                crop={draft.crop}
                aspect={draft.aspect}
                imageAspect={imageAspect}
                onChange={setCrop}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-card px-3 py-3">
        {tool === "crop" ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    aspect: a.id,
                    crop: fitCropToAspect(d.crop, imageAspect, a.value),
                  }))
                }
                className={cn(
                  "h-10 shrink-0 rounded-md px-3 text-xs shadow-[var(--shadow-border)]",
                  draft.aspect === a.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        ) : null}

        {tool === "rotate" ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => rotate90(-1)}>
                <RotateCcw />
                90
              </Button>
              <Button variant="secondary" size="sm" onClick={() => rotate90(1)}>
                <RotateCw />
                90
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDraft((d) => ({ ...d, flipH: !d.flipH }))}
              >
                <FlipHorizontal />
                Flip
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDraft((d) => ({ ...d, flipV: !d.flipV }))}
              >
                <FlipVertical />
                Flip
              </Button>
            </div>
            <label className="block space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="uppercase tracking-wider">Straighten</span>
                <span className="tabular-nums">{draft.straighten.toFixed(1)}°</span>
              </div>
              <Slider
                min={-15}
                max={15}
                step={0.1}
                value={[draft.straighten]}
                onValueChange={(v) => setDraft((d) => ({ ...d, straighten: v[0] ?? 0 }))}
              />
            </label>
            <label className="block space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="uppercase tracking-wider">Rotate</span>
                <span className="tabular-nums">{Math.round(draft.rotation)}°</span>
              </div>
              <Slider
                min={-180}
                max={180}
                step={1}
                value={[draft.rotation]}
                onValueChange={(v) => setDraft((d) => ({ ...d, rotation: v[0] ?? 0 }))}
              />
            </label>
          </div>
        ) : null}

        {tool === "adjust" ? (
          <div className="grid max-h-40 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
            {(
              [
                ["exposure", "Exposure"],
                ["contrast", "Contrast"],
                ["highlights", "Highlights"],
                ["shadows", "Shadows"],
                ["saturation", "Saturation"],
                ["warmth", "Warmth"],
                ["vignette", "Vignette"],
                ["sharpen", "Sharpen"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-wider">{label}</span>
                  <span className="tabular-nums">{draft.adjustments[key].toFixed(2)}</span>
                </div>
                <Slider
                  min={key === "vignette" || key === "sharpen" ? 0 : -1}
                  max={1}
                  step={0.01}
                  value={[draft.adjustments[key]]}
                  onValueChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      adjustments: { ...d.adjustments, [key]: v[0] ?? 0 },
                    }))
                  }
                />
              </label>
            ))}
          </div>
        ) : null}

        {tool === "filter" ? (
          <div className="flex gap-2 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, filter: f.id }))}
                className={cn(
                  "h-10 shrink-0 rounded-md px-3 text-xs shadow-[var(--shadow-border)]",
                  draft.filter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => {
              setDraft(cloneEdit(DEFAULT_EDIT));
              onCancel();
            }}
          >
            <X />
            Cancel
          </Button>
          <Button className="flex-1" onClick={commit} disabled={!img}>
            <Check />
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
