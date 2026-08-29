import { cn } from "@/lib/utils";

export type StudioTab = "studio" | "mockups" | "maker" | "jobs";

const TABS: { id: StudioTab; href: string; label: string }[] = [
  { id: "studio", href: "/", label: "Studio" },
  { id: "mockups", href: "/#catalog", label: "Mockups" },
  { id: "maker", href: "/maker", label: "AI Maker" },
  { id: "jobs", href: "/desk", label: "Design Jobs" },
];

export function StudioNav({ active }: { active: StudioTab }) {
  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Studio tools">
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <a
            key={t.id}
            href={t.href}
            className={cn(
              "flex h-11 shrink-0 items-center rounded-full px-3.5 text-xs font-semibold tracking-wide transition-colors duration-150",
              on ? "bg-orange text-navy" : "bg-transparent text-paper/70 hover:text-paper",
            )}
            aria-current={on ? "page" : undefined}
          >
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}
