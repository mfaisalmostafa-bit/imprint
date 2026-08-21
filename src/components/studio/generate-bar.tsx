import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/store";
import { angleGuideFor } from "@/lib/angle";
import { cn } from "@/lib/utils";

const SEEDS = [
  "White ceramic mug, catalog 3/4, print wall to camera, handle at 3 o'clock",
  "Navy hoodie, dead-front chest, print panel filling the frame",
  "Urban billboard square-on, empty white face filling the frame",
  "Kraft mailer box 3/4, front panel to camera, studio",
  "Canvas tote 3/4, blank front panel to camera",
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
  const mockup = useStudio((s) => s.mockup());
  const guide = angleGuideFor({ id: mockup.id, category: mockup.category });

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
          placeholder={`${guide.label} — concept still only`}
          maxLength={400}
          className="h-11 min-w-0 flex-1 rounded-md bg-secondary px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" disabled={generating || prompt.trim().length < 4} size="sm">
          <Sparkles />
          {generating ? "Making…" : "Make"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">{guide.prompt}</p>
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