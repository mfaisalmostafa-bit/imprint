import { useRef, useState } from "react";
import { Download, ScanSearch, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StageCanvas, type StageHandle } from "@/components/studio/stage-canvas";
import { BrainPanel } from "@/components/studio/brain-panel";
import { Catalog } from "@/components/studio/catalog";
import { LogoDock } from "@/components/studio/logo-dock";
import { useStudio } from "@/lib/store";
import { compressForScan } from "@/lib/image";
import { scanSurface } from "@/lib/scan";

export function StudioApp() {
  const stageRef = useRef<StageHandle>(null);
  const [brainOpen, setBrainOpen] = useState(false);
  const productSrc = useStudio((s) => s.productSrc());
  const mockupId = useStudio((s) => s.mockupId);
  const scanning = useStudio((s) => s.scanning);
  const setScanning = useStudio((s) => s.setScanning);
  const applyScan = useStudio((s) => s.applyScan);
  const setScanError = useStudio((s) => s.setScanError);
  const setLogo = useStudio((s) => s.setLogo);

  const runScan = async () => {
    setScanning(true);
    try {
      const dataUrl = await compressForScan(productSrc);
      const result = await scanSurface({ data: { imageDataUrl: dataUrl } });
      if (result.ok) {
        applyScan(result);
        toast("Plane locked");
      } else {
        setScanError(result.error);
        toast(result.error);
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

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setLogo({
      id: "upload",
      name: file.name.replace(/\.[^.]+$/, "") || "Logo",
      src: url,
      kind: "image",
    });
    toast("Logo loaded");
  };

  return (
    <div
      className="flex h-dvh min-h-0 min-w-0 flex-col overflow-x-hidden bg-background text-foreground"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <header className="flex items-center gap-3 border-b border-border px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="font-serif text-xl italic leading-none text-foreground sm:text-2xl">IMPRINT</p>
          <p className="hidden text-xs text-muted-foreground sm:block">The angle of the product</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="lg:hidden"
          onClick={() => setBrainOpen(true)}
        >
          <SlidersHorizontal />
          Brain
        </Button>
        <Button variant="secondary" size="sm" onClick={runScan} disabled={scanning} className="hidden sm:inline-flex">
          <ScanSearch />
          Scan
        </Button>
        <Button size="sm" onClick={onExport}>
          <Download />
          Export
        </Button>
      </header>

      <div className="studio-shell min-h-0 flex-1">
        <aside className="hidden min-h-0 min-w-0 border-r border-border lg:block">
          <Catalog layout="side" />
        </aside>

        <section className="relative min-h-0 min-w-0 overflow-hidden bg-background">
          <StageCanvas ref={stageRef} />
        </section>

        <aside className="hidden min-h-0 border-l border-border lg:block">
          <BrainPanel onScan={runScan} />
        </aside>

        <div className="border-t border-border lg:col-span-3">
          <LogoDock />
        </div>

        <div className="border-t border-border lg:hidden">
          <Catalog layout="row" />
        </div>
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
              <BrainPanel onScan={runScan} />
            </div>
          </div>
        </div>
      ) : null}

      <span className="sr-only">{mockupId}</span>
    </div>
  );
}
