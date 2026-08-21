import type { PhotoReport } from "@/lib/photo-check";
import { rankFindings } from "@/lib/photo-check";
import { cn } from "@/lib/utils";

export function PhotoStripe({ report }: { report?: PhotoReport }) {
  if (!report) return <span className="block h-full w-1 bg-border" />;
  const top = rankFindings(report, 1)[0];
  const color = !top
    ? "bg-ok"
    : top.severity === "block"
      ? "bg-destructive"
      : top.severity === "act"
        ? "bg-primary"
        : "bg-ok";
  return <span className={cn("block h-full w-1", color)} />;
}

export function PhotoReportView({ report }: { report: PhotoReport }) {
  const top = rankFindings(report, 3);
  return (
    <div className="space-y-3">
      {top.length === 0 ? (
        <p className="text-sm text-ok">Photo holds for a quotation.</p>
      ) : (
        top.map((f) => (
          <div key={f.code} className="rounded-lg bg-secondary p-3">
            <p
              className={cn(
                "text-xs font-medium uppercase tracking-wider",
                f.severity === "block" ? "text-destructive" : "text-primary",
              )}
            >
              {f.severity === "block" ? "Stop" : f.severity === "act" ? "Act" : "Note"}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{f.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{f.action}</p>
          </div>
        ))
      )}
      {report.unjudged.length ? (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Not judged</p>
          {report.unjudged.map((u) => (
            <p key={u.code} className="text-xs text-muted-foreground">
              {u.why}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
