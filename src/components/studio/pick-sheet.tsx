import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlaceChoice } from "@/lib/resolve-placement";
import type { Quad } from "@/lib/geometry";

/**
 * "Where does the logo go?" — a pick here MUST write the render quad.
 * Class-only sheets are not a lock. Next still stamps the box on screen.
 */
export function PickSheet({
  src,
  sku,
  choices,
  selected,
  onSelect,
  onNext,
  onDraw,
  onSkip,
}: {
  src: string;
  sku?: string;
  choices: PlaceChoice[];
  selected: number;
  onSelect: (i: number) => void;
  onNext: () => void;
  onDraw: () => void;
  onSkip: () => void;
}) {
  const current = choices[selected] ?? choices[0];
  const quad: Quad | null = current?.quad ?? null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-navy text-paper">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-paper/10 px-4">
        <p className="text-sm font-semibold">Where does the logo go?</p>
        <span className="rounded-full bg-paper/10 px-2 py-0.5 text-xs tabular-nums">
          {Math.min(selected + 1, choices.length)}/{Math.max(choices.length, 1)}
        </span>
        <button type="button" className="min-h-11 px-3 text-xs text-paper/70" onClick={onSkip}>
          Skip all
        </button>
      </header>

      <div className="relative min-h-0 flex-1 bg-navy px-3 py-3">
        {sku ? (
          <p className="absolute left-1/2 top-2 z-10 -translate-x-1/2 text-xs tabular-nums text-paper/60">
            {sku}
          </p>
        ) : null}
        <div className="relative mx-auto h-full max-w-lg overflow-hidden rounded-2xl bg-paper">
          <img src={src} alt="" className="size-full object-contain" />
          {quad ? (
            <button
              type="button"
              aria-label={`Candidate ${current.letter}`}
              className="absolute border-2 border-orange bg-orange/15"
              style={{
                left: `${Math.min(quad[0].x, quad[3].x) * 100}%`,
                top: `${Math.min(quad[0].y, quad[1].y) * 100}%`,
                width: `${Math.abs(quad[1].x - quad[0].x) * 100}%`,
                height: `${Math.abs(quad[3].y - quad[0].y) * 100}%`,
              }}
            >
              <span className="absolute inset-0 flex items-center justify-center font-display text-3xl font-semibold text-navy">
                {current.letter}
              </span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 space-y-3 border-t border-paper/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {current ? (
          <div className="rounded-xl border border-orange bg-navy px-4 py-3 text-center">
            <p className="font-display text-lg font-semibold">{current.letter}</p>
            <p className="text-sm text-paper/80">{current.label}</p>
            {current.lock ? null : (
              <p className="mt-1 text-xs text-orange">not sure — draw your own</p>
            )}
          </div>
        ) : null}
        {choices.length > 1 ? (
          <div className="flex gap-2">
            {choices.map((c, i) => (
              <button
                key={c.letter}
                type="button"
                onClick={() => onSelect(i)}
                className={cn(
                  "min-h-11 min-w-11 rounded-lg px-3 text-sm",
                  i === selected ? "bg-orange text-navy" : "bg-paper/10 text-paper",
                )}
              >
                {c.letter}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex gap-3">
          <Button variant="secondary" className="h-12 flex-1" onClick={onDraw}>
            Somewhere else
          </Button>
          <Button className="h-12 flex-1 bg-orange text-navy" onClick={onNext} disabled={!current}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
