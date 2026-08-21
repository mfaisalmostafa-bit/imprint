import { TABS, PRIMARY, useCc, type TabId } from "@/lib/cc-store";
import { TabBody } from "@/components/cc/views";
import { cn } from "@/lib/utils";

export function CommandCenter() {
  const tab = useCc((s) => s.tab);
  const setTab = useCc((s) => s.setTab);
  const more = useCc((s) => s.more);
  const setMore = useCc((s) => s.setMore);
  const label = TABS.find((t) => t.id === tab)?.label ?? tab;

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <p className="text-xs font-semibold tracking-[0.22em] text-foreground">TEPEE-X</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-52 shrink-0 overflow-y-auto border-r border-border p-2 md:block">
          {TABS.map((t) => (
            <NavBtn key={t.id} id={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
        </nav>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 pb-24 md:pb-4">
          <TabBody tab={tab} />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-5">
          {PRIMARY.map((id) => {
            const t = TABS.find((x) => x.id === id)!;
            return (
              <NavBtn
                key={id}
                id={id}
                label={t.label}
                active={tab === id}
                onClick={() => setTab(id)}
                compact
              />
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setMore(!more)}
          className="flex h-11 w-full items-center justify-center text-xs uppercase tracking-wider text-muted-foreground"
        >
          {more ? "Close" : "More tabs"}
        </button>
      </nav>

      {more ? (
        <div className="fixed inset-x-0 bottom-24 z-30 max-h-[50vh] overflow-y-auto border-t border-border bg-card p-3 md:hidden">
          <div className="grid grid-cols-2 gap-2">
            {TABS.map((t) => (
              <NavBtn key={t.id} id={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavBtn({
  id,
  label,
  active,
  onClick,
  compact,
}: {
  id: TabId;
  label: string;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "min-h-11 rounded-lg px-2 text-xs",
        compact ? "flex flex-col items-center justify-center gap-1" : "w-full text-left",
        active ? "bg-secondary text-foreground" : "text-muted-foreground",
      )}
    >
      {compact ? label.split(" ")[0] : label}
    </button>
  );
}
