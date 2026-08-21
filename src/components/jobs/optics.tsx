import { OPTICS, type OpticsFinding } from "@/lib/optics-audit";
import { cn } from "@/lib/utils";

const TOPICS: { id: OpticsFinding["topic"]; label: string }[] = [
  { id: "metal", label: "Metal" },
  { id: "contact", label: "Contact" },
  { id: "crystal", label: "Crystal" },
  { id: "curve", label: "Curve" },
  { id: "small", label: "Small" },
];

export function OpticsScreen() {
  return (
    <div className="h-full overflow-y-auto p-4">
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Against their renderer, on the real catalogue photos. We do not patch their Python.
      </p>
      {TOPICS.map((t) => (
        <section key={t.id} className="mb-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.label}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {OPTICS.filter((f) => f.topic === t.id).map((f) => (
              <article key={f.id} className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
                <img src={f.src} alt="" className="h-40 w-full bg-paper object-contain" />
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs tabular-nums text-muted-foreground">{f.sku}</p>
                    <p
                      className={cn(
                        "text-xs uppercase tracking-wider",
                        f.verdict === "keep" ? "text-ok" : "text-primary",
                      )}
                    >
                      {f.verdict === "keep" ? "Keep" : "Off"}
                    </p>
                  </div>
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="text-sm text-foreground">{f.off}</p>
                  <p className="text-sm text-muted-foreground">{f.theirs}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
