import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { loadPhotoBuf } from "@/lib/photo-check";
import {
  catalogSkus,
  describePhoto,
  familyOf,
  inspectQuery,
  interpretHits,
  isLock,
  mergeQueries,
  rankHits,
  type CatalogVec,
  type SearchAnswer,
} from "@/lib/photo-search";
import { cn } from "@/lib/utils";

export function SearchScreen() {
  const [catalog, setCatalog] = useState<CatalogVec[] | null>(null);
  const [answer, setAnswer] = useState<SearchAnswer | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [pending, setPending] = useState<{ buf: Awaited<ReturnType<typeof loadPhotoBuf>> }[]>([]);
  const [n, setN] = useState(0);
  const [fit, setFit] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const rows: CatalogVec[] = [];
      for (const s of catalogSkus()) {
        const buf = await loadPhotoBuf(s.src);
        if (!live) return;
        if (!buf) continue;
        rows.push({ ...s, family: familyOf(s), feat: describePhoto(buf) });
      }
      if (live) setCatalog(rows);
    })();
    return () => {
      live = false;
    };
  }, []);

  const runBufs = async (bufs: { buf: Awaited<ReturnType<typeof loadPhotoBuf>> }[]) => {
    if (!catalog) return;
    const answers: SearchAnswer[] = [];
    for (const item of bufs) {
      const refuse = inspectQuery(item.buf);
      if (refuse) {
        answers.push(refuse);
        continue;
      }
      answers.push(interpretHits(rankHits(describePhoto(item.buf!), catalog)));
    }
    setPending(bufs);
    setN(bufs.length);
    setFit(false);
    setAnswer(answers.length === 1 ? answers[0]! : mergeQueries(answers));
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length || !catalog) return;
    const bufs = [];
    const urls: string[] = [];
    for (const f of [...files]) {
      const url = URL.createObjectURL(f);
      urls.push(url);
      const buf = await loadPhotoBuf(url);
      bufs.push({ buf });
    }
    setPreviews(urls);
    await runBufs(bufs);
  };

  const onCatalogShot = async (src: string) => {
    if (!catalog) return;
    setPreviews([src]);
    const buf = await loadPhotoBuf(src);
    const bufs = [{ buf }];
    setPending(bufs);
    await runBufs(bufs);
  };

  const startOver = () => {
    setAnswer(null);
    setPreviews([]);
    setPending([]);
    setFit(false);
    setN(0);
  };

  return (
    <div className="h-full overflow-y-auto bg-paper p-4 text-navy">
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-navy px-3 py-1.5 font-semibold text-paper">Photo Search</span>
        <span className="rounded-full bg-navy/10 px-3 py-1.5">Browse</span>
        <span className="rounded-full bg-navy/10 px-3 py-1.5">Loader</span>
      </div>
      <h1 className="text-xl font-semibold">Photo Search</h1>
      <p className="mt-2 max-w-xl text-sm text-navy/70">
        Snap or upload a photo of an item — TePee finds the matching website product. Tap It fits only when the match is a lock. 56% is not a lock.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          className="h-11 bg-orange text-navy"
          disabled={!catalog}
          onClick={() => camRef.current?.click()}
        >
          Take a photo
        </Button>
        <Button
          className="h-11 bg-navy text-paper"
          disabled={!catalog}
          onClick={() => galRef.current?.click()}
        >
          From gallery
        </Button>
        <Button className="h-11 bg-ok text-paper" disabled={!catalog || !pending.length} onClick={() => void runBufs(pending)}>
          Find the products
        </Button>
        <Button variant="secondary" className="h-11" onClick={startOver}>
          Start over
        </Button>
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {previews.length ? (
        <div className="mt-4 flex gap-2">
          {previews.map((src) => (
            <img key={src} src={src} alt="" className="size-16 rounded-lg object-cover ring-1 ring-navy/10" />
          ))}
        </div>
      ) : null}
      <p className="mt-6 mb-2 text-xs uppercase tracking-wider text-navy/50">Or search with a catalogue shot</p>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(catalog ?? []).map((c) => (
          <button
            key={c.sku}
            type="button"
            disabled={!catalog}
            onClick={() => void onCatalogShot(c.src)}
            className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg ring-1 ring-navy/10"
          >
            <img src={c.src} alt="" className="size-full bg-paper object-contain" />
            <span className="absolute inset-x-0 bottom-0 bg-navy/80 px-1 text-[10px] text-paper">{c.sku}</span>
          </button>
        ))}
      </div>
      {!catalog ? <p className="text-sm text-navy/50">Loading catalogue…</p> : null}
      {answer ? <AnswerView answer={answer} n={n} fit={fit} onFit={() => setFit(true)} /> : null}
    </div>
  );
}

function AnswerView({
  answer,
  n,
  fit,
  onFit,
}: {
  answer: SearchAnswer;
  n: number;
  fit: boolean;
  onFit: () => void;
}) {
  if (!answer.judged) {
    return (
      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-navy/10">
        <p className="text-xs font-medium uppercase tracking-wider text-destructive">Not matched</p>
        <p className="mt-2 text-sm">{answer.why}</p>
        <p className="mt-2 text-xs text-navy/50">Refused before ranking.</p>
      </div>
    );
  }
  const lock = isLock(answer);
  return (
    <div className="mt-4 space-y-3">
      {n > 1 ? <p className="text-xs text-navy/50">{n} photos, one answer</p> : null}
      <p className={cn("text-sm", lock ? "text-ok" : "text-orange")}>{answer.note}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {answer.hits.map((h, i) => {
          const pct = Math.round(h.score * 100);
          const lead = i === 0;
          const weak = pct < 82;
          return (
            <div key={h.sku} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-navy/10">
              <img src={h.src} alt="" className="mb-3 aspect-square w-full rounded-xl bg-paper object-contain" />
              <p className="text-sm font-semibold">
                {h.sku}{" "}
                <span className={cn("font-normal", weak ? "text-navy/50" : "text-ok")}>
                  {weak ? `weak · ${pct}%` : `${pct}% match`}
                </span>
              </p>
              <p className="truncate text-sm text-navy/70">{h.name}</p>
              {h.family ? <p className="mt-1 text-xs uppercase tracking-wider text-navy/40">{h.family}</p> : null}
              {h.colorCap ? (
                <p className="mt-2 rounded-lg bg-navy/5 p-2 text-xs text-navy/70">Same shape, different colour — confirm by eye.</p>
              ) : null}
              {lead && lock ? (
                <Button className="mt-3 h-11 w-full bg-ok text-paper" onClick={onFit}>
                  {fit ? "Recorded as a fit" : "It fits"}
                </Button>
              ) : (
                <Button variant="secondary" className="mt-3 h-11 w-full" disabled={!lock}>
                  {fit ? "Recorded as a fit" : "It fits"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {!lock ? <p className="text-xs text-navy/50">Do not send this as a lock. Confirm by eye.</p> : null}
    </div>
  );
}
