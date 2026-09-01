import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, FileUp, PenLine, Scissors } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StudioNav } from "@/components/studio/studio-nav";
import { MOCKUPS } from "@/lib/mockups";
import { useStudio } from "@/lib/store";
import {
  DEFAULT_TUNE,
  DEFAULT_WIDTH_MM,
  MACHINE_ORDER,
  MACHINES,
  buildMachineFile,
  clampWidthMm,
  downloadTextFile,
  keyBackground,
  machineOf,
  rgbaToMask,
  type FineTune,
  type MakerMachine,
} from "@/lib/maker";
import { cn } from "@/lib/utils";

type Art = { name: string; src: string; kind: string };
type ShelfItem = { id: string; name: string; src: string };

const SHELF_KEY = "tpx-maker-shelf";

function loadShelf(): ShelfItem[] {
  try {
    const raw = localStorage.getItem(SHELF_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ShelfItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 24) : [];
  } catch {
    return [];
  }
}

export function MakerApp() {
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [art, setArt] = useState<Art | null>(null);
  const [machine, setMachine] = useState<MakerMachine>("fiber");
  const [widthMm, setWidthMm] = useState(DEFAULT_WIDTH_MM);
  const [tuneOpen, setTuneOpen] = useState(false);
  const [tune, setTune] = useState<FineTune>(DEFAULT_TUNE);
  const [onColour, setOnColour] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [catalogQ, setCatalogQ] = useState("");
  const [shelf, setShelf] = useState<ShelfItem[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const selectMockup = useStudio((s) => s.selectMockup);

  useEffect(() => {
    setShelf(loadShelf());
  }, []);

  const def = machineOf(machine);
  const products = useMemo(() => {
    const q = catalogQ.trim().toLowerCase();
    return MOCKUPS.filter((m) => {
      if (!q) return true;
      return `${m.name} ${m.sku} ${m.category}`.toLowerCase().includes(q);
    }).slice(0, 12);
  }, [catalogQ]);

  const loadFile = (file: File, as: "art" | "photo") => {
    const ok =
      file.type.startsWith("image/") ||
      file.type === "application/pdf" ||
      /\.(ai|eps|svg|webp|png|jpe?g|pdf)$/i.test(file.name);
    if (!ok) {
      toast("PNG, JPG, WEBP, PDF or an Illustrator file.");
      return;
    }
    const url = URL.createObjectURL(file);
    if (as === "photo") {
      const item: ShelfItem = { id: `p-${Date.now()}`, name: file.name.replace(/\.[^.]+$/, ""), src: url };
      setShelf((prev) => {
        const next = [item, ...prev].slice(0, 24);
        try {
          localStorage.setItem(SHELF_KEY, JSON.stringify(next));
        } catch {
          /* quota */
        }
        return next;
      });
      toast("Photo on the shelf — ask for a model from Studio.");
      return;
    }
    setArt({ name: file.name, src: url, kind: file.type || "image" });
    setPreview(url);
    toast("Artwork loaded");
  };

  const onPaste = useCallback((e: ClipboardEvent) => {
    const f = e.clipboardData?.files?.[0];
    if (f) loadFile(f, "art");
  }, []);

  useEffect(() => {
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onPaste]);

  const rasterize = async (src: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not read the artwork"));
      img.src = src;
    });
    const max = 900;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(8, Math.round(img.width * scale));
    const h = Math.max(8, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    ctx.drawImage(img, 0, 0, w, h);
    return { canvas, ctx, w, h };
  };

  const onRemoveBg = async () => {
    if (!art) {
      toast("Choose artwork first");
      return;
    }
    setBusy(true);
    try {
      const { canvas, ctx, w, h } = await rasterize(art.src);
      const img = ctx.getImageData(0, 0, w, h);
      const keyed = keyBackground(img.data, w, h);
      img.data.set(keyed);
      ctx.putImageData(img, 0, 0);
      const src = canvas.toDataURL("image/png");
      setArt({ ...art, src, name: art.name.replace(/\.[^.]+$/, "") + "-cut" });
      setPreview(src);
      toast("Background pulled");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not cut the background");
    } finally {
      setBusy(false);
    }
  };

  const onMake = async () => {
    if (!art) {
      toast("Choose artwork first");
      return;
    }
    setBusy(true);
    try {
      const { ctx, w, h } = await rasterize(art.src);
      const img = ctx.getImageData(0, 0, w, h);
      const mask = rgbaToMask(img.data, w, h, tune);
      const file = buildMachineFile({
        machine,
        mask,
        w,
        h,
        widthMm,
        onColour,
        name: art.name,
      });
      downloadTextFile(file.filename, file.body, file.mime);
      toast(`${def.hint} · ${file.widthMm} × ${file.heightMm} mm`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not write the machine file");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-paper text-navy">
      <header className="relative shrink-0 border-b border-navy/10 bg-navy px-3 py-2.5 sm:px-5">
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-orange" aria-hidden />
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <p className="shrink-0 font-sans text-[15px] font-semibold tracking-[0.18em] text-paper">TEPEE-X</p>
          <div className="min-w-0 flex-1">
            <StudioNav active="maker" />
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5 pb-28">
          <section className="flex gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-navy text-orange">
              <PenLine className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">AI Maker</h1>
              <p className="text-sm leading-snug text-navy/70">
                Any logo → the .ai file the laser cuts. Pick the machine, set the size, done — plus 3D product models
                straight from the catalog.
              </p>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(4,38,63,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-navy/55">1 · The artwork</p>
            <p className="mt-2 text-sm text-navy/70">
              PNG, JPG, WEBP, PDF or an Illustrator file. Up to 25 MB. Drag a file in, or paste one from your clipboard.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,.ai,.eps,.svg,.webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f, "art");
                e.target.value = "";
              }}
            />
            <Button className="mt-4 bg-orange text-navy hover:bg-orange/90" onClick={() => fileRef.current?.click()}>
              <FileUp />
              Choose a file
            </Button>
            <p className="mt-3 text-sm text-navy/55">{art ? art.name : "Nothing chosen yet."}</p>
            {preview ? (
              <img
                src={preview}
                alt="Artwork"
                className="mt-3 max-h-40 rounded-xl border border-navy/10 bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] object-contain"
              />
            ) : null}
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(4,38,63,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-navy/55">2 · Make the machine file</p>
            <p className="mt-2 text-sm text-navy/70">
              Pick the machine and the size. The file comes out as .ai, ready for the laser software — nothing else to
              choose.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MACHINE_ORDER.map((id) => {
                const m = MACHINES[id];
                const on = machine === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMachine(id)}
                    className={cn(
                      "min-h-14 rounded-xl px-4 py-3 text-left text-sm font-semibold leading-snug transition-colors duration-150",
                      on ? "bg-orange text-navy" : "bg-white text-navy shadow-[0_0_0_1px_rgba(4,38,63,0.14)]",
                    )}
                  >
                    {m.label}
                    <span className={cn("mt-0.5 block text-[11px] font-medium", on ? "text-navy/70" : "text-navy/50")}>
                      {m.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            <label className="mt-4 block text-sm font-medium text-navy/70">
              Width on the product (mm)
              <input
                type="number"
                min={8}
                max={400}
                value={widthMm}
                onChange={(e) => setWidthMm(clampWidthMm(Number(e.target.value)))}
                className="mt-1.5 h-11 w-full rounded-xl border border-navy/15 bg-white px-3 text-base text-navy outline-none focus:border-orange"
              />
            </label>
            <button
              type="button"
              className="mt-3 text-sm font-medium text-navy/70"
              onClick={() => setTuneOpen((v) => !v)}
            >
              {tuneOpen ? "Hide fine-tune" : "Fine-tune (usually not needed)"}
            </button>
            {tuneOpen ? (
              <div className="mt-3 space-y-3 rounded-xl bg-navy/[0.04] p-3">
                <label className="flex items-center justify-between text-sm">
                  Invert cut
                  <input
                    type="checkbox"
                    checked={tune.invert}
                    onChange={(e) => setTune({ ...tune, invert: e.target.checked })}
                    className="size-5 accent-orange"
                  />
                </label>
                <label className="block text-sm">
                  Threshold {Math.round(tune.threshold * 100)}
                  <input
                    type="range"
                    min={0.2}
                    max={0.85}
                    step={0.01}
                    value={tune.threshold}
                    onChange={(e) => setTune({ ...tune, threshold: Number(e.target.value) })}
                    className="mt-1 w-full accent-orange"
                  />
                </label>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="bg-orange text-navy hover:bg-orange/90" disabled={busy} onClick={() => void onMake()}>
                <PenLine />
                Make the .ai file
              </Button>
              <Button
                variant="outline"
                className="border-navy/15 bg-white text-navy"
                disabled={busy}
                onClick={() => void onRemoveBg()}
              >
                <Scissors />
                Remove the background
              </Button>
            </div>
            <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-navy/80">
              <input
                type="checkbox"
                checked={onColour}
                onChange={(e) => setOnColour(e.target.checked)}
                className="size-5 accent-orange"
              />
              put it on a colour instead of clear
            </label>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(4,38,63,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-navy/55">3 · 3D models</p>
            <p className="mt-2 text-sm text-navy/70">
              Pick a product — its catalog photo becomes a real 3D model you can spin, for a client presentation or the
              website. Finished models land on this shelf.
            </p>
            <input
              value={catalogQ}
              onChange={(e) => setCatalogQ(e.target.value)}
              placeholder="Pick a product from the catalog…"
              className="mt-4 h-11 w-full rounded-xl border border-navy/15 bg-white px-3 text-sm text-navy outline-none placeholder:text-navy/40 focus:border-orange"
            />
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f, "photo");
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="mt-3 border-navy/15 bg-white text-navy"
              onClick={() => photoRef.current?.click()}
            >
              <Camera />
              …or photograph something new
            </Button>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPicked(p.id);
                    selectMockup(p.id);
                    toast(`${p.name} — open Studio to spin the proof`);
                  }}
                  className={cn(
                    "overflow-hidden rounded-xl text-left shadow-[0_0_0_1px_rgba(4,38,63,0.1)]",
                    picked === p.id && "ring-2 ring-orange",
                  )}
                >
                  <img src={p.src} alt="" className="aspect-square w-full object-cover" />
                  <span className="block truncate px-2 py-1.5 text-[11px] font-medium text-navy/80">{p.name}</span>
                </button>
              ))}
            </div>
            {shelf.length ? (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-navy/55">On the shelf</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {shelf.map((s) => (
                    <figure key={s.id} className="overflow-hidden rounded-xl bg-navy/5">
                      <img src={s.src} alt="" className="aspect-square w-full object-cover" />
                      <figcaption className="truncate px-1.5 py-1 text-[10px] text-navy/70">{s.name}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-navy/55">Nothing here yet — photograph a product and ask for a model.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
