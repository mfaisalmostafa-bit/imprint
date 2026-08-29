import { useState } from "react";
import { ReviewScreen } from "@/components/jobs/review";
import { OpticsScreen } from "@/components/jobs/optics";
import { SearchScreen } from "@/components/jobs/search";
import { StudioNav } from "@/components/studio/studio-nav";
import { cn } from "@/lib/utils";

const JOBS = [
  { id: "review", label: "Place" },
  { id: "optics", label: "Optics" },
  { id: "search", label: "Search" },
] as const;

type JobId = (typeof JOBS)[number]["id"];

export function JobsApp() {
  const [job, setJob] = useState<JobId>("review");

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <p className="text-xs font-semibold tracking-[0.22em]">TEPEE-X</p>
        <StudioNav active="jobs" />
        <a href="/cc" className="sr-only">
          Command center
        </a>
        <nav className="ml-auto flex gap-1">
          {JOBS.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => setJob(j.id)}
              className={cn(
                "min-h-11 min-w-16 rounded-lg px-3 text-xs transition-colors duration-150",
                job === j.id ? "bg-secondary text-foreground" : "text-muted-foreground",
              )}
            >
              {j.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">
        {job === "review" ? <ReviewScreen /> : null}
        {job === "optics" ? <OpticsScreen /> : null}
        {job === "search" ? <SearchScreen /> : null}
      </main>
    </div>
  );
}
