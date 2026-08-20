import { useEffect, useRef, useState } from "react";
import { Download, SlidersHorizontal, Undo2, Redo2 } from "lucide-react";
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
import { compressForEdit, compressForScan } from "@/lib/image";
import { scanSurface } from "@/lib/scan";
import { detectSurface } from "@/lib/detect";
import { generateProduct, imagineEdit } from "@/lib/imagine";

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

  const editSource =
    editTarget === "logo" && logo.src
      ? logo.src
      : productSrc;

  const runLocalDetect = async (src: string) => {
    try {
      const local = await detectSurface(src);
      applyScan(local);
    } catch {
      /* keep current quad */
    }
  };

  const runScan = async () => {
    pushHistory();
    setScanning(true);
    setMode("studio");
    try {
      const local = await detectSurface(productSrc);
      applyScan(local);
      const dataUrl = await compressForScan(productSrc);
      const result = await scanSurface({ data: { imageDataUrl: dataUrl } });
      if (result.ok) {
        applyScan(result);
        toast("Plane locked");
      } else {
        setScanError(result.error);
        toast(local.notes);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan failed";
      setScanError(message);
      toast(message);
    }
  };

  const onExport = async () => {
    await stageRef.current?.exportPng();
    toast("Mockup saved");
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
      toast("Product made — scanning plane");
      await runLocalDetect(result.src);
      const dataUrl = await compressForScan(result.src);
      const scan = await scanSurface({ data: { imageDataUrl: dataUrl } });
      if (scan.ok) applyScan(scan);
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
      <header className="flex items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="font-serif text-xl italic leading-none text-foreground sm:text-2xl">IMPRINT</p>
          <p className="hidden text-xs text-muted-foreground sm:block">Edit. Place. Print.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} aria-label="Undo">
          <Undo2 />
        </Button>
        <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} aria-label="Redo">
          <Redo2 />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="lg:hidden"
          onClick={() => setBrainOpen(true)}
        >
          <SlidersHorizontal />
          Brain
        </Button>
        {mode === "edit" ? (
          <Button variant="secondary" size="sm" onClick={onImagineEdit}>
            Imagine edit
          </Button>
        ) : null}
        <Button size="sm" onClick={onExport}>
          <Download />
          Export
        </Button>
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
