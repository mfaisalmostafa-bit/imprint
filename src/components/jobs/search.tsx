import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { loadPhotoBuf } from "@/lib/photo-check";
import {
  catalogSkus,
  inspectQuery,
  interpretHits,
  isLock,
  mergeQueries,
  rankHits,
  vectorize,
  type CatalogVec,
  type SearchAnswer,
} from "@/lib/photo-search";
import { cn } from "@/lib/utils";

export function SearchScreen() {
  const [catalog, setCatalog] = useState<CatalogVec[] | null>(null);
  const [answer, setAnswer] = useState<SearchAnswer | null>(null);
  const [n, setN] = useState(0);
  const [fit, setFit] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const rows: CatalogVec[] = [];
      for (const s of catalogSkus()) {
        const buf = await loadPhotoBuf(s.src);
        if (!live) return;
        if (!buf) continue;
        rows.push({ ...s, vec: vectorize(buf) });
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
      answers.push(interpretHits(rankHits(vectorize(item.buf!), catalog)));
    }
    setN(bufs.length);
    setFit(false);
    setAnswer(answers.length === 1 ? answers[0]! : mergeQueries(answers));
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length || !catalog) return;
    const bufs = [];
    for (const f of [...files]) {
      const url = URL.createObjectURL(f);
      const buf = await loadPhotoBuf(url);
      bufs.push({ buf });
    }
    await runBufs(bufs);
  };

  const onCatalogShot = async (src: string) => {
    if (!catalog) return;
    const buf = await loadPhotoBuf(src);
    await runBufs([{ buf }]);
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <p className="mb-3 max-w-xl text-sm text-muted-foreground">
        One item, one answer. A 40% hit does not look like a 95% hit. If the photo cannot be matched, we say so before ranking.
      </p>
      <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-secondary px-4 text-sm">
        {catalog ? "Add one or more photos of the same item" : "Loading catalogue vectors…"}
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          disabled={!catalog}
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <p className="mt-4 mb-2 text-xs uppercase tracking-wider text-muted-foreground">Or search with a catalogue shot</p>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(catalog ?? []).map((c) => (
          <button
            key={c.sku}
            type="button"
            disabled={!catalog}
            onClick={() => void onCatalogShot(c.src)}
            className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg"
          >
            <img src={c.src} alt="" className="size-full bg-paper object-contain" />
            <span className="absolute inset-x-0 bottom-0 bg-background/80 px-1 text-xs tabular-nums">{c.sku}</span>
          </button>
        ))}
      </div>
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
      <div className="mt-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="text-xs font-medium uppercase tracking-wider text-destructive">Not matched</p>
        <p className="mt-2 text-sm">{answer.why}</p>
        <p className="mt-2 text-xs text-muted-foreground">Refused before ranking.</p>
      </div>
    );
  }
  const lock = isLock(answer);
  return (
    <div className="mt-4 space-y-3">
      {n > 1 ? <p className="text-xs text-muted-foreground">{n} photos, one answer</p> : null}
      <p className={cn("text-sm", lock ? "text-ok" : "text-primary")}>{answer.note}</p>
      {answer.hits.map((h, i) => {
        const pct = Math.round(h.score * 100);
        const lead = i === 0;
        return (
          <div key={h.sku} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-[var(--shadow-border)]">
            <img src={h.src} alt="" className="size-16 rounded-md bg-paper object-contain" />
            <div className="min-w-0 flex-1">
              <p className="text-xs tabular-nums text-muted-foreground">{h.sku}</p>
              <p className="truncate text-sm">{h.name}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full", lead && lock ? "bg-ok" : lead && answer.kind === "weak" ? "bg-faint" : "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <p className={cn("text-sm tabular-nums", lead && lock ? "text-ok" : "text-muted-foreground")}>{pct}%</p>
          </div>
        );
      })}
      {!lock ? (
        <p className="text-xs text-muted-foreground">Do not send this as a lock. Confirm by eye.</p>
      ) : null}
      <Button variant="secondary" className="h-11" disabled={!lock} onClick={onFit}>
        {fit ? "Recorded as a fit" : "It fits"}
      </Button>
    </div>
  );
}
