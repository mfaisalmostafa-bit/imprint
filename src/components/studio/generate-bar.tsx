import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";

const SEEDS = [
  "White ceramic mug on oak, morning light, blank wall",
  "Oversized navy hoodie on a model, empty chest",
  "Urban billboard at dusk, empty white face",
  "Kraft mailer box 3/4, studio, unprinted",
  "Canvas tote against a plaster wall, blank panel",
];

export function GenerateBar({
  onGenerate,
  inputRef,
}: {
  onGenerate: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const prompt = useStudio((s) => s.imaginePrompt);
  const setPrompt = useStudio((s) => s.setImaginePrompt);
  const generating = useStudio((s) => s.generating);

  return (
    <div className="min-w-0 space-y-2 p-3">
      <form
        className="flex min-w-0 items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onGenerate();
        }}
      >
        <input
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Imagine a blank product to print on…"
          maxLength={400}
          className="h-11 min-w-0 flex-1 rounded-md bg-secondary px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" disabled={generating || prompt.trim().length < 4} size="sm">
          <Sparkles />
          {generating ? "Making…" : "Make"}
        </Button>
      </form>
      <div className="flex min-w-0 gap-2 overflow-x-auto">
        {SEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPrompt(s)}
            className={cn(
              "h-8 shrink-0 rounded-full bg-secondary px-3 text-[11px] text-muted-foreground hover:text-foreground",
              prompt === s && "text-foreground ring-1 ring-primary",
            )}
          >
            {s.split(",")[0]}
          </button>
        ))}
      </div>
    </div>
  );
}