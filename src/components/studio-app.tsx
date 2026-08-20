import { useEffect, useRef, useState } from "react";
import { Download, SlidersHorizontal, Undo2, Redo2, Columns2, FileText, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StageCanvas, type StageHandle } from "@/components/studio/stage-canvas";
import { BrainPanel } from "@/components/studio/brain-panel";
import { Catalog } from "@/components/studio/catalog";
import { LogoDock } from "@/components/studio/logo-dock";
import { ToolRail } from "@/components/studio/tool-rail";
import { EditorStage } from "@/components/studio/editor-stage";
import { GenerateBar } from "@/components/studio/generate-bar";
import { useStudio } from "@/lib/store";
import { compressForEdit } from "@/lib/image";
import { detectSurface } from "@/lib/detect";
import { generateProduct, imagineEdit } from "@/lib/imagine";
import { listClients, saveProof } from "@/lib/cc";
import { downloadProofPdf } from "@/lib/pdf";
import { inspectPlacement } from "@/lib/qc";
import { METHODS } from "@/lib/methods";
import type { JobKind } from "@/lib/cc";

export function StudioApp() {
  const stageRef = useRef<StageHandle>(null);
  const imagineRef = useRef<HTMLInputElement>(null);
  const [brainOpen, setBrainOpen] = useState(false);
  const productSrc = useStudio((s) => s.productSrc());
  const mockupId = useStudio((s) => s.mockupId);
  const scanning = useStudio((s) => s.scanning);
  const setScanning = useStudio((s) => s.setScanning);
  const applyScan = useStudio((s) => s.applyScan);
  const setScanError = useStudio((s) => s.setScanError);
  const setLogo = useStudio((s) => s.setLogo);
  const setCustomProduct = useStudio((s) => s.setCustomProduct);
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  const editTarget = useStudio((s) => s.editTarget);
  const logo = useStudio((s) => s.logo);
  const imaginePrompt = useStudio((s) => s.imaginePrompt);
  const setGenerating = useStudio((s) => s.setGenerating);
  const pushHistory = useStudio((s) => s.pushHistory);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.canUndo());
  const canRedo = useStudio((s) => s.canRedo());
  const clientId = useStudio((s) => s.clientId);
  const jobKind = useStudio((s) => s.jobKind);
  const jobRef = useStudio((s) => s.jobRef);
  const compare = useStudio((s) => s.compare);
  const setClientId = useStudio((s) => s.setClientId);
  const setJobKind = useStudio((s) => s.setJobKind);
  const setJobRef = useStudio((s) => s.setJobRef);
  const setCompare = useStudio((s) => s.setCompare);
  const method = useStudio((s) => s.method);
  const mockup = useStudio((s) => s.mockup());
  const scale = useStudio((s) => s.scale);
  const quad = useStudio((s) => s.quad);
  const invert = useStudio((s) => s.invert);

  const editSource =
    editTarget === "logo" && logo.src
      ? logo.src
      : productSrc;

  const runLocalDetect = async (src: string) => {
    try {
      const local = await detectSurface(src);
      if (local.accepted) applyScan(local);
      else {
        useStudio.getState().setScanError(local.notes);
        useStudio.getState().setScanning(false);
      }
    } catch {
      /* keep current quad */
    }
  };

  const runScan = async () => {
    pushHistory();
    setScanning(true);
    setMode("studio");
    try {
      const local = await detectSurface(
        productSrc,
        mockupId === "custom" ? undefined : quad,
      );
      if (local.accepted) {
        applyScan(local);
        toast(`Plane locked · ${Math.round(local.confidence * 100)}%`);
      } else {
        setScanError(local.notes);
        toast(local.notes);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan failed";
      setScanError(message);
      toast(message);
    } finally {
      setScanning(false);
    }
  };

  const onExport = async () => {
    await stageRef.current?.exportPng();
    toast("Proof PNG saved");
  };

  const onPdf = async () => {
    const frames = await stageRef.current?.getFrames();
    if (!frames) {
      toast("Stage not ready");
      return;
    }
    const client = listClients().find((c) => c.id === clientId);
    const sku = "sku" in mockup ? mockup.sku : "CUSTOM";
    const flags = inspectPlacement({
      scale,
      maxScale: "maxScale" in mockup ? mockup.maxScale : 0.9,
      quad,
      method,
      allowed: "methods" in mockup ? mockup.methods : [method],
      productTone: "tone" in mockup ? mockup.tone : "mid",
      invert,
    });
    await downloadProofPdf({
      client: client?.name ?? "Walk-in",
      jobKind,
      jobRef,
      sku,
      skuName: mockup.name,
      method,
      original: frames.original,
      branded: frames.branded,
      qc: flags.map((f) => f.text),
      settings: `v1  ${method}  scale ${Math.round(scale * 100)}%  ${"substrate" in mockup ? mockup.substrate : ""}`,
    });
    toast("Branded PDF downloaded");
  };

  const onApprove = async () => {
    const frames = await stageRef.current?.getFrames();
    if (!frames) return;
    const sku = "sku" in mockup ? mockup.sku : "CUSTOM";
    saveProof({
      clientId,
      jobKind,
      jobRef,
      sku,
      skuName: mockup.name,
      method: METHODS[method].label,
      branded: frames.branded.toDataURL("image/jpeg", 0.82),
      settings: `scale ${Math.round(scale * 100)}%`,
      status: "approved",
    });
    toast("Approved into Command Center");
  };

  const onGenerate = async () => {
    const prompt = imaginePrompt.trim();
    if (prompt.length < 4) return;
    pushHistory();
    setGenerating(true);
    setMode("studio");
    try {
      const result = await generateProduct({ data: { prompt } });
      if (!result.ok) {
        setScanError(result.error);
        toast(result.error);
        return;
      }
      setCustomProduct(result.src, prompt.slice(0, 42));
      toast("Product made — locking plane");
      await runLocalDetect(result.src);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generate failed";
      setScanError(message);
      toast(message);
    } finally {
      setGenerating(false);
    }
  };

  const onImagineEdit = async () => {
    const prompt = imaginePrompt.trim();
    if (prompt.length < 3) {
      toast("Describe the change first");
      return;
    }
    pushHistory();
    setGenerating(true);
    try {
      const src = editTarget === "logo" && logo.src ? logo.src : productSrc;
      const dataUrl = await compressForEdit(src);
      const result = await imagineEdit({ data: { prompt, imageDataUrl: dataUrl } });
      if (!result.ok) {
        toast(result.error);
        return;
      }
      if (editTarget === "logo") {
        setLogo({ id: "upload", name: "Edited mark", src: result.src, kind: "image" });
      } else {
        setCustomProduct(result.src, "Edited product");
        await runLocalDetect(result.src);
      }
      toast("Imagine edit applied");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Edit failed");
    } finally {
      setGenerating(false);
    }
  };

  const onApplyEdit = (dataUrl: string) => {
    pushHistory();
    if (editTarget === "logo") {
      setLogo({
        id: "upload",
        name: logo.name || "Edited mark",
        src: dataUrl,
        kind: "image",
      });
    } else {
      setCustomProduct(dataUrl, "Edited product");
      void runLocalDetect(dataUrl);
    }
    setMode("studio");
    toast("Edit applied");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    pushHistory();
    if (mode === "edit" && editTarget === "product") {
      setCustomProduct(url, file.name.replace(/\.[^.]+$/, "") || "Your product");
      void runLocalDetect(url);
      toast("Product loaded");
      return;
    }
    setLogo({
      id: "upload",
      name: file.name.replace(/\.[^.]+$/, "") || "Logo",
      src: url,
      kind: "image",
    });
    toast("Logo loaded");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (k === "escape") {
        setMode("studio");
        setBrainOpen(false);
      }
      if (k === "c") useStudio.getState().setEditTool("crop");
      if (k === "r") useStudio.getState().setEditTool("rotate");
      if (k === "t") useStudio.getState().setEditTool("adjust");
      if (k === "s" && !e.metaKey && !e.ctrlKey) void runScan();
      if (k === "e") void onExport();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [redo, undo]);

  return (
    <div
      className="flex h-dvh min-h-0 min-w-0 flex-col overflow-x-hidden bg-background text-foreground"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <p className="font-sans text-lg font-semibold tracking-tight text-foreground">TPX</p>
          <p className="hidden text-xs text-muted-foreground sm:block">TePee-X  ·  Command Center</p>
        </div>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="h-9 min-w-0 max-w-40 rounded-md bg-secondary px-2 text-xs text-foreground"
          aria-label="Client"
        >
          {listClients().map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={jobKind}
          onChange={(e) => setJobKind(e.target.value as JobKind)}
          className="h-9 rounded-md bg-secondary px-2 text-xs text-foreground"
          aria-label="Job type"
        >
          <option value="quote">Quote</option>
          <option value="sample">Sample</option>
          <option value="order">Order</option>
        </select>
        <input
          value={jobRef}
          onChange={(e) => setJobRef(e.target.value)}
          className="h-9 w-24 rounded-md bg-secondary px-2 text-xs tabular-nums text-foreground"
          aria-label="Job reference"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} aria-label="Undo">
            <Undo2 />
          </Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} aria-label="Redo">
            <Redo2 />
          </Button>
          <Button
            variant={compare ? "default" : "secondary"}
            size="sm"
            onClick={() => setCompare(!compare)}
          >
            <Columns2 />
            Split
          </Button>
          <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setBrainOpen(true)}>
            <SlidersHorizontal />
            Brain
          </Button>
          {mode === "edit" ? (
            <Button variant="secondary" size="sm" onClick={onImagineEdit}>
              Imagine edit
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => void onPdf()}>
            <FileText />
            PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void onApprove()}>
            <Check />
            Approve
          </Button>
          <Button size="sm" onClick={onExport}>
            <Download />
            PNG
          </Button>
        </div>
      </header>

      <div className={mode === "edit" ? "studio-shell studio-shell-edit min-h-0 flex-1" : "studio-shell min-h-0 flex-1"}>
        <aside className="studio-rail min-h-0 min-w-0 border-b border-border lg:border-b-0 lg:border-r">
          <ToolRail
            onScan={() => void runScan()}
            onFocusImagine={() => imagineRef.current?.focus()}
          />
        </aside>

        {mode === "studio" ? (
          <aside className="studio-catalog hidden min-h-0 min-w-0 border-r border-border lg:block">
            <Catalog layout="side" />
          </aside>
        ) : null}

        <section className="studio-stage relative min-h-0 min-w-0 overflow-hidden bg-background">
          {mode === "edit" ? (
            <EditorStage
              source={editSource}
              onApply={onApplyEdit}
              onCancel={() => setMode("studio")}
            />
          ) : (
            <StageCanvas ref={stageRef} />
          )}
        </section>

        {mode === "studio" ? (
          <aside className="studio-brain hidden min-h-0 border-l border-border lg:block">
            <BrainPanel onScan={() => void runScan()} />
          </aside>
        ) : null}

        <div className="studio-dock border-t border-border">
          {mode === "studio" ? (
            <>
              <GenerateBar onGenerate={() => void onGenerate()} inputRef={imagineRef} />
              <LogoDock />
            </>
          ) : (
            <GenerateBar onGenerate={() => void onImagineEdit()} inputRef={imagineRef} />
          )}
        </div>

        {mode === "studio" ? (
          <div className="studio-film border-t border-border lg:hidden">
            <Catalog layout="row" />
          </div>
        ) : null}
      </div>

      {brainOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/70"
            aria-label="Close brain"
            onClick={() => setBrainOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-hidden rounded-t-xl bg-card shadow-[var(--shadow-border)]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="font-serif text-lg">Brain</p>
              <Button variant="ghost" size="sm" onClick={() => setBrainOpen(false)}>
                Close
              </Button>
            </div>
            <div className="max-h-[75dvh] overflow-y-auto">
              <BrainPanel onScan={() => void runScan()} />
            </div>
          </div>
        </div>
      ) : null}

      <span className="sr-only">{mockupId} {scanning ? "scanning" : ""}</span>
    </div>
  );
}
