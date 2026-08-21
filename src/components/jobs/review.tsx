import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { StageCanvas, type StageHandle } from "@/components/studio/stage-canvas";
import { LogoDock } from "@/components/studio/logo-dock";
import { PlaceWindow } from "@/components/jobs/place-window";
import { Button } from "@/components/ui/button";
import { MOCKUPS } from "@/lib/mockups";
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
import { LOUPE_ZOOM, type PlaceTool } from "@/lib/place";
import { angleGuideFor, judgeCatalogAngle } from "@/lib/angle";
import { cn } from "@/lib/utils";

function fingerprint(quad: ReturnType<typeof quadToEngine>, wrap: string, arc: number) {
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
  const setScale = useStudio((s) => s.setScale);
  const setCylinderArc = useStudio((s) => s.setCylinderArc);
  const setCompare = useStudio((s) => s.setCompare);
  const pushHistory = useStudio((s) => s.pushHistory);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.canUndo());
  const canRedo = useStudio((s) => s.canRedo());
  const sku = "sku" in mockup ? mockup.sku : "";
  const method = useStudio((s) => s.method);
  const wrap = useStudio((s) => s.wrap);
  const cylinderArc = useStudio((s) => s.cylinderArc);
  const scale = useStudio((s) => s.scale);
  const compare = useStudio((s) => s.compare);
  const quad = useStudio((s) => s.quad);
  const maxScale = "maxScale" in mockup ? mockup.maxScale : 0.96;
  const scaleCap = useStudio((s) => s.scaleCap);
  const resetPlacement = useStudio((s) => s.resetPlacement);
  const [note, setNote] = useState("Click the zoom window to pin a corner. Minimise it when you need the photo.");
  const [origin, setOrigin] = useState<"detected" | "override">("detected");
  const [base, setBase] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [saving, setSaving] = useState(false);
  const [winOpen, setWinOpen] = useState(true);
  const [tool, setTool] = useState<PlaceTool>("zone");
  const [sel, setSel] = useState(0);
  const [loupeZoom, setLoupeZoom] = useState<number>(LOUPE_ZOOM);
  const [loupeCanvas, setLoupeCanvas] = useState<HTMLCanvasElement | null>(null);

  const bindLoupe = useCallback((el: HTMLCanvasElement | null) => {
    setLoupeCanvas((prev) => (prev === el ? prev : el));
  }, []);

  const engineQuad = quadToEngine(quad);
  const dirty = useMemo(
    () => fingerprint(engineQuad, wrap, cylinderArc) !== base,
    [engineQuad, wrap, cylinderArc, base],
  );
  const source = dirty ? "edited" : origin;
  const guide = angleGuideFor({ id: mockup.id, category: mockup.category });
  const catalogQuad = mockupId !== "custom" && "quad" in mockup ? mockup.quad : null;
  const judged = catalogQuad ? judgeCatalogAngle(quad, catalogQuad) : null;

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
    setNote(
      d.accepted
        ? d.bodyTrusted === false
          ? d.notes
          : "Reset to detected plane."
        : d.notes,
    );
    stageRef.current?.zoomFit();
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
    setNote(
      d.accepted
        ? d.bodyTrusted === false
          ? d.notes
          : "Detected the branding face. Drag corners to correct."
        : d.notes,
    );
    stageRef.current?.zoomZone();
  };

  const pickTool = (t: PlaceTool) => {
    setTool(t);
    stageRef.current?.setTool(t);
    setNote(t === "zone" ? "Print zone. Corners and edges." : "Mark. Drag the logo inside the zone.");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex shrink-0 gap-2 overflow-x-auto border-b border-border p-2 md:h-full md:w-36 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
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
          <StageCanvas
            ref={stageRef}
            loupeCanvas={winOpen ? loupeCanvas : null}
            hideLoupe
            loupeZoom={loupeZoom}
            sel={sel}
            onSel={setSel}
            tool={tool}
          />
          {!winOpen ? (
            <button
              type="button"
              onClick={() => setWinOpen(true)}
              className="absolute bottom-3 left-3 z-40 flex min-h-11 items-center gap-2 rounded-xl bg-card px-4 text-xs font-medium shadow-[var(--shadow-border)]"
              aria-label="Open placement window"
            >
              <Maximize2 className="size-4" />
              Place
            </button>
          ) : null}
        </div>
        {winOpen ? (
          <PlaceWindow
            stageRef={stageRef}
            onLoupeCanvas={bindLoupe}
            tool={tool}
            onTool={pickTool}
            sel={sel}
            onSel={setSel}
            loupeZoom={loupeZoom}
            onLoupeZoom={setLoupeZoom}
            quad={quad}
            scale={scale}
            maxScale={Math.min(maxScale, scaleCap)}
            onScale={setScale}
            wrap={wrap}
            onWrap={setWrap}
            cylinderArc={cylinderArc}
            onCurve={setCylinderArc}
            method={method}
            methods={mockup.methods}
            onMethod={setMethod}
            sku={sku}
            name={mockup.name}
            source={source}
            note={note}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onSave={openSave}
            onReset={() => void onReset()}
            onUpload={(f) => void onUpload(f)}
            onCopy={() => void onCopy()}
            onSplit={() => setCompare(!compare)}
            compare={compare}
            onClose={() => {
              bindLoupe(null);
              setWinOpen(false);
            }}
            onGesture={pushHistory}
            guideLabel={guide.label}
            angleBand={judged?.band ?? null}
            onCatalogAngle={
              catalogQuad
                ? () => {
                    resetPlacement();
                    setNote(guide.label + ". " + guide.prompt);
                    stageRef.current?.zoomFit();
                  }
                : null
            }
          />
        ) : null}
      </div>
      <LogoDock />

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
