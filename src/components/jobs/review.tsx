import { useEffect, useMemo, useRef, useState } from "react";
import { StageCanvas, type StageHandle } from "@/components/studio/stage-canvas";
import { Button } from "@/components/ui/button";
import { MOCKUPS, type WrapMode } from "@/lib/mockups";
import { useStudio } from "@/lib/store";
import { detectSurface } from "@/lib/detect";
import {
  SAVE_PHRASE,
  packOverrides,
  saveOverride,
  engineToQuad,
  wrapFromSurface,
  formatQuadLines,
  quadToEngine,
  isSku,
} from "@/lib/engine";
import { fetchOverride, listOverrides, persistOverride } from "@/lib/placement-api";
import { copyText } from "@/lib/copy-text";
import { METHODS } from "@/lib/methods";
import { cn } from "@/lib/utils";

const WRAPS: WrapMode[] = ["plane", "cylinder", "taper", "cone", "sphere"];

function fingerprint(quad: ReturnType<typeof quadToEngine>, wrap: WrapMode, arc: number) {
  return JSON.stringify({ quad, wrap, arc });
}

export function ReviewScreen() {
  const stageRef = useRef<StageHandle>(null);
  const mockup = useStudio((s) => s.mockup());
  const mockupId = useStudio((s) => s.mockupId);
  const selectMockup = useStudio((s) => s.selectMockup);
  const applyScan = useStudio((s) => s.applyScan);
  const setCustomProduct = useStudio((s) => s.setCustomProduct);
  const productSrc = useStudio((s) => s.productSrc());
  const setQuad = useStudio((s) => s.setQuad);
  const setWrap = useStudio((s) => s.setWrap);
  const setMethod = useStudio((s) => s.setMethod);
  const sku = "sku" in mockup ? mockup.sku : "";
  const method = useStudio((s) => s.method);
  const wrap = useStudio((s) => s.wrap);
  const cylinderArc = useStudio((s) => s.cylinderArc);
  const quad = useStudio((s) => s.quad);
  const [note, setNote] = useState("Drag a corner. Warp follows.");
  const [origin, setOrigin] = useState<"detected" | "override">("detected");
  const [base, setBase] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [saving, setSaving] = useState(false);

  const engineQuad = quadToEngine(quad);
  const dirty = useMemo(
    () => fingerprint(engineQuad, wrap, cylinderArc) !== base,
    [engineQuad, wrap, cylinderArc, base],
  );
  const source = dirty ? "edited" : origin;

  useEffect(() => {
    let live = true;
    (async () => {
      if (!isSku(sku)) {
        const s = useStudio.getState();
        setOrigin("detected");
        setBase(fingerprint(quadToEngine(s.quad), s.wrap, s.cylinderArc));
        return;
      }
      try {
        const ov = await fetchOverride({ data: { sku } });
        if (!live) return;
        if (ov) {
          setQuad(engineToQuad(ov.quad));
          useStudio.setState({ wrap: wrapFromSurface(ov.surface), cylinderArc: ov.curvature ?? 0 });
          setOrigin("override");
          setBase(fingerprint(ov.quad, wrapFromSurface(ov.surface), ov.curvature ?? 0));
          setNote(`Override loaded for ${sku}.`);
          return;
        }
        const s = useStudio.getState();
        setOrigin("detected");
        setBase(fingerprint(quadToEngine(s.quad), s.wrap, s.cylinderArc));
      } catch {
        if (!live) return;
        const s = useStudio.getState();
        setOrigin("detected");
        setBase(fingerprint(quadToEngine(s.quad), s.wrap, s.cylinderArc));
      }
    })();
    return () => {
      live = false;
    };
  }, [sku, setQuad]);

  const openSave = () => {
    if (!isSku(sku)) {
      setNote("Pick a catalogue SKU. Custom photos are not a proof.");
      return;
    }
    setPhrase("");
    setConfirmOpen(true);
  };

  const onConfirm = async () => {
    const r = saveOverride(sku, quad, wrap, cylinderArc, phrase);
    if (!r.ok) {
      setNote(r.error + (r.required ? ` — ${r.required}` : ""));
      return;
    }
    setSaving(true);
    try {
      const persisted = await persistOverride({ data: { confirm: phrase, doc: r.doc } });
      if (!persisted.ok) {
        setNote(persisted.error + (persisted.required ? ` — ${persisted.required}` : ""));
        return;
      }
      setOrigin("override");
      setBase(fingerprint(r.doc.quad, wrap, cylinderArc));
      setConfirmOpen(false);
      setNote(`Saved for ${sku}. Next mockup of this product starts here.`);
    } catch {
      setNote("Could not write the override. Copy the JSON and hand it to the engine.");
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    useStudio.getState().setScanning(true);
    const prior = "quad" in mockup ? mockup.quad : undefined;
    const d = await detectSurface(productSrc, prior);
    applyScan(d);
    const s = useStudio.getState();
    setOrigin("detected");
    setBase(fingerprint(quadToEngine(s.quad), s.wrap, s.cylinderArc));
    setNote(d.accepted ? "Reset to detected plane." : d.notes);
  };

  const onCopy = async () => {
    const docs = await listOverrides();
    const ok = await copyText(packOverrides(docs));
    setNote(ok ? "Override pack copied." : "Copy failed.");
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCustomProduct(url, file.name.replace(/\.[^.]+$/, "") || "Product photo");
    useStudio.getState().setScanning(true);
    const d = await detectSurface(url);
    applyScan(d);
    const s = useStudio.getState();
    setOrigin("detected");
    setBase(fingerprint(quadToEngine(s.quad), s.wrap, s.cylinderArc));
    setNote(d.accepted ? "Detected the branding face. Drag corners to correct." : d.notes);
  };

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <aside className="flex shrink-0 gap-2 overflow-x-auto border-b border-border p-2 md:h-full md:w-40 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
        {MOCKUPS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => selectMockup(m.id)}
            className={cn(
              "relative h-16 w-24 shrink-0 overflow-hidden rounded-lg md:h-20 md:w-full",
              mockupId === m.id && "ring-1 ring-primary",
            )}
          >
            <img src={m.src} alt="" className="size-full bg-paper object-contain" />
            <span className="absolute inset-x-0 bottom-0 bg-background/80 px-1 py-0.5 text-xs tabular-nums">
              {m.sku}
            </span>
          </button>
        ))}
      </aside>
      <div className="relative min-h-0 min-w-0 flex-1 bg-paper">
        <StageCanvas ref={stageRef} />
        <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/80 px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">
          {source === "override" ? "Override" : source === "edited" ? "Edited" : "Detected"}
        </p>
      </div>
      <aside className="shrink-0 space-y-3 border-t border-border p-4 md:w-72 md:overflow-y-auto md:border-l md:border-t-0">
        <p className="text-xs tabular-nums text-muted-foreground">{sku || "—"}</p>
        <h2 className="text-lg font-semibold leading-tight">{mockup.name}</h2>
        <p className="text-sm text-muted-foreground">{METHODS[method].label}</p>
        <div className="flex flex-wrap gap-1">
          {mockup.methods.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMethod(id)}
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
              onClick={() => setWrap(w)}
              className={cn(
                "min-h-11 rounded-lg px-3 text-xs capitalize",
                wrap === w ? "bg-secondary text-foreground" : "text-muted-foreground",
              )}
            >
              {w}
            </button>
          ))}
        </div>
        <Button className="h-11 w-full" onClick={openSave}>
          Save for this SKU
        </Button>
        <Button variant="secondary" className="h-11 w-full" onClick={() => void onReset()}>
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
              void onUpload(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
        <Button variant="secondary" className="h-11 w-full" onClick={() => void onCopy()}>
          Copy override JSON
        </Button>
        <p className="text-sm text-muted-foreground">{note}</p>
      </aside>

      {confirmOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-background/70 p-3 md:items-center">
          <div className="w-full max-w-md space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <h3 className="font-medium">Write print zone for {sku}</h3>
            <p className="text-sm text-muted-foreground">
              This correction is shared. The next mockup of this product starts from these four corners.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs tabular-nums">{formatQuadLines(engineQuad)}</pre>
            <p className="text-xs text-muted-foreground">
              Type <span className="font-medium text-foreground">{SAVE_PHRASE}</span> to confirm.
            </p>
            <input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="h-11 w-full rounded-md bg-secondary px-3 text-sm outline-none ring-ring focus:ring-2"
              placeholder={SAVE_PHRASE}
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="h-11 flex-1" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button className="h-11 flex-1" disabled={saving || phrase !== SAVE_PHRASE} onClick={() => void onConfirm()}>
                {saving ? "Writing" : "Write"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
