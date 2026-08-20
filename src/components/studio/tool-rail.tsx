import {
  Crop,
  RotateCw,
  SlidersHorizontal,
  Aperture,
  ScanSearch,
  Move,
  Sparkles,
} from "lucide-react";
import { useStudio, type EditTool, type StudioMode } from "@/lib/store";
import { cn } from "@/lib/utils";

const TOOLS: {
  id: string;
  label: string;
  icon: typeof Crop;
  mode: StudioMode;
  tool?: EditTool;
}[] = [
  { id: "place", label: "Place", icon: Move, mode: "studio" },
  { id: "crop", label: "Crop", icon: Crop, mode: "edit", tool: "crop" },
  { id: "rotate", label: "Rotate", icon: RotateCw, mode: "edit", tool: "rotate" },
  { id: "adjust", label: "Tone", icon: SlidersHorizontal, mode: "edit", tool: "adjust" },
  { id: "filter", label: "Look", icon: Aperture, mode: "edit", tool: "filter" },
];

export function ToolRail({
  onScan,
  onFocusImagine,
}: {
  onScan: () => void;
  onFocusImagine: () => void;
}) {
  const mode = useStudio((s) => s.mode);
  const editTool = useStudio((s) => s.editTool);
  const setMode = useStudio((s) => s.setMode);
  const setEditTool = useStudio((s) => s.setEditTool);
  const scanning = useStudio((s) => s.scanning);

  return (
    <nav
      className="flex min-w-0 items-center gap-1 overflow-x-auto p-2 lg:h-full lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden"
      aria-label="Studio tools"
    >
      {TOOLS.map((t) => {
        const active = t.mode === "studio" ? mode === "studio" : mode === "edit" && editTool === t.tool;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              if (t.mode === "studio") setMode("studio");
              else if (t.tool) setEditTool(t.tool);
            }}
            className={cn(
              "flex size-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] uppercase tracking-wider",
              active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {t.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onScan}
        disabled={scanning}
        className="flex size-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <ScanSearch className="size-4" />
        Scan
      </button>
      <button
        type="button"
        onClick={onFocusImagine}
        className="flex size-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <Sparkles className="size-4" />
        Make
      </button>
    </nav>
  );
}
