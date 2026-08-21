import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { PhotoReportView, PhotoStripe } from "@/components/cc/photo-panel";
import { StudioApp } from "@/components/studio-app";
import {
  ACTIVITY,
  CATALOG_SKUS,
  CLIENTS,
  FILES,
  HOUSE_RULES,
  INVOICES,
  LASER,
  ORDERS,
  PEOPLE,
  QUOTES,
  ROBOTS,
  SEASONS,
  TARGET,
  ageBucket,
  attention,
  clientById,
  money,
  type CatalogSku,
} from "@/lib/cc-data";
import { copyText, toTsv } from "@/lib/copy-text";
import { METHODS, METHOD_ORDER, methodsForCategory, type MethodId } from "@/lib/methods";
import {
  checkArtwork,
  checkProductPhoto,
  loadPhotoBuf,
  rankFindings,
  type PhotoReport,
} from "@/lib/photo-check";
import { useCc, type TabId } from "@/lib/cc-store";
import { requireWrite } from "@/lib/write-guard";
import { cn } from "@/lib/utils";

function clientName(id: string) {
  return clientById(id)?.name ?? id;
}

function ScrollTable({ children }: { children: React.ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}

function Table({ cols, rows }: { cols: string[]; rows: string[][] }) {
  return (
    <ScrollTable>
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            {cols.map((c) => (
              <th key={c} className="px-3 py-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={cn("px-3 py-3", j > 0 && "tabular-nums")}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollTable>
  );
}

function CopyTsv({ rows, label }: { rows: string[][]; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        const yes = await copyText(toTsv(rows));
        setOk(yes);
      }}
    >
      {ok ? "Copied" : label}
    </Button>
  );
}

export function MyDay() {
  const setTab = useCc((s) => s.setTab);
  const items = attention();
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Needs you</p>
      {items.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => setTab(a.tab as TabId)}
          className="flex min-h-12 w-full items-start gap-3 rounded-xl bg-card p-4 text-left shadow-[var(--shadow-border)]"
        >
          <span
            className={cn(
              "mt-1 h-2 w-2 shrink-0 rounded-full",
              a.severity === "block" ? "bg-destructive" : "bg-primary",
            )}
          />
          <span>
            <span className="block text-sm font-medium text-foreground">{a.verb}</span>
            <span className="block text-sm text-muted-foreground">{a.detail}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function Cockpit({ active }: { active: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }
    let t = 0;
    const id = requestAnimationFrame(() => {
      void document.body.offsetHeight;
      t = window.setTimeout(() => setReady(true), 80);
    });
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [active]);

  const data = [
    { name: "Quote", n: QUOTES.length },
    { name: "Order", n: ORDERS.length },
    { name: "Invoice", n: INVOICES.length },
    { name: "Open AR", n: INVOICES.filter((i) => i.balance > 0).length },
  ];
  const ar = INVOICES.reduce((s, i) => s + i.balance, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Open quotes", String(QUOTES.length)],
          ["Live orders", String(ORDERS.length)],
          ["AR open", money(ar)],
          ["Laser jobs", String(LASER.length)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p>
            <p className="mt-2 font-display text-2xl tabular-nums text-foreground">{v}</p>
          </div>
        ))}
      </div>
      <div className="h-56 rounded-xl bg-card p-3 shadow-[var(--shadow-border)]">
        {ready ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="name" stroke="#8b919c" fontSize={11} />
              <YAxis stroke="#8b919c" fontSize={11} allowDecimals={false} />
              <RTooltip />
              <Bar dataKey="n" fill="#d1812e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Layout…</div>
        )}
      </div>
    </div>
  );
}

export function QuotesTab() {
  const rows = QUOTES.map((q) => [
    q.ref,
    clientName(q.clientId),
    money(q.amount),
    `${q.days}d`,
    q.season,
    String(q.lines),
  ]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Age is the story</p>
        <CopyTsv rows={[["ref", "client", "amount", "days", "season", "lines"], ...rows]} label="Copy TSV" />
      </div>
      <Table cols={["Quote", "Client", "Amount", "Age", "Season", "Lines"]} rows={rows} />
    </div>
  );
}

export function OrdersTab() {
  const rows = ORDERS.map((o) => [
    o.ref,
    clientName(o.clientId),
    money(o.amount),
    o.stage,
    METHODS[o.method].short,
    `${o.days}d`,
  ]);
  return (
    <div className="space-y-3">
      <CopyTsv rows={[["ref", "client", "amount", "stage", "method", "days"], ...rows]} label="Copy TSV" />
      <Table cols={["Order", "Client", "Amount", "Stage", "Method", "Age"]} rows={rows} />
    </div>
  );
}

export function PipelineTab() {
  const stages = ["Quote", "Sales Order", "Mockup", "Production", "QC", "Delivery", "Invoice", "Paid"];
  return (
    <div className="space-y-2">
      {stages.map((s) => {
        const n =
          s === "Quote"
            ? QUOTES.length
            : ORDERS.filter((o) => o.stage === s).length + (s === "Sales Order" ? ORDERS.length : 0);
        return (
          <div key={s} className="flex min-h-11 items-center justify-between rounded-lg bg-card px-4 shadow-[var(--shadow-border)]">
            <span className="text-sm">{s}</span>
            <span className="tabular-nums text-sm text-muted-foreground">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CollectionsTab() {
  const open = INVOICES.filter((i) => i.balance > 0);
  const buckets = ["0–30", "31–60", "61–90", "90+"].map((b) => ({
    b,
    n: open.filter((i) => ageBucket(i.days) === b).reduce((s, i) => s + i.balance, 0),
  }));
  const rows = open.map((i) => [
    i.ref,
    clientName(i.clientId),
    money(i.balance),
    `${i.days}d`,
    ageBucket(i.days),
  ]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {buckets.map((b) => (
          <div key={b.b} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{b.b}</p>
            <p className="mt-2 text-lg tabular-nums">{money(b.n)}</p>
          </div>
        ))}
      </div>
      <Table cols={["Invoice", "Client", "Balance", "Age", "Bucket"]} rows={rows} />
    </div>
  );
}

export function CatalogTab() {
  const q = useCc((s) => s.q);
  const setQ = useCc((s) => s.setQ);
  const sku = useCc((s) => s.sku);
  const setSku = useCc((s) => s.setSku);
  const [reports, setReports] = useState<Record<string, PhotoReport>>({});

  useEffect(() => {
    let live = true;
    (async () => {
      for (const s of CATALOG_SKUS) {
        const buf = s.src ? await loadPhotoBuf(s.src) : null;
        const r = checkProductPhoto(buf);
        if (!live) return;
        setReports((m) => ({ ...m, [s.sku]: r }));
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const needle = q.trim().toLowerCase();
  const list = CATALOG_SKUS.filter((s) => {
    if (s.hidden) return needle.length > 0;
    if (!needle) return true;
    return (
      s.sku.toLowerCase().includes(needle) ||
      s.name.toLowerCase().includes(needle) ||
      s.category.toLowerCase().includes(needle)
    );
  });

  const selected = CATALOG_SKUS.find((s) => s.sku === sku);
  const issues = CATALOG_SKUS.filter((s) => {
    const f = rankFindings(reports[s.sku] ?? { w: 0, h: 0, findings: [], unjudged: [] }, 1)[0];
    return f && (f.code === "missing" || f.code === "empty" || f.code === "tiny");
  });

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="SKU, name or category"
        className="h-11 w-full rounded-lg bg-secondary px-3 text-sm outline-none"
        aria-label="Search catalogue"
      />
      {issues.length ? (
        <p className="text-sm text-destructive">{issues.length} SKU{issues.length > 1 ? "s" : ""} cannot go on a quotation — no usable photo.</p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((s) => (
          <button
            key={s.sku}
            type="button"
            onClick={() => setSku(s.sku)}
            className={cn(
              "relative overflow-hidden rounded-xl bg-card text-left shadow-[var(--shadow-border)]",
              sku === s.sku && "ring-1 ring-primary",
            )}
          >
            <div className="absolute inset-y-0 left-0 z-10">
              <PhotoStripe report={reports[s.sku]} />
            </div>
            {s.src ? (
              <img src={s.src} alt="" className="h-28 w-full bg-[#efe8dc] object-contain" />
            ) : (
              <div className="flex h-28 items-center justify-center bg-secondary text-xs text-muted-foreground">No photo</div>
            )}
            <div className="p-2">
              <p className="text-xs tabular-nums text-muted-foreground">{s.sku}</p>
              <p className="text-sm text-foreground">{s.name}</p>
            </div>
          </button>
        ))}
      </div>
      {selected ? <SkuDetail sku={selected} report={reports[selected.sku]} /> : null}
    </div>
  );
}

function SkuDetail({ sku, report }: { sku: CatalogSku; report?: PhotoReport }) {
  return (
    <div className="space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs tabular-nums text-muted-foreground">{sku.sku}</p>
      <h3 className="text-lg font-semibold">{sku.name}</h3>
      <p className="text-sm text-muted-foreground">
        {sku.category} · {sku.material} · {METHODS[sku.methods[0]!].label}
      </p>
      {report ? <PhotoReportView report={report} /> : <p className="text-sm text-muted-foreground">Checking photo…</p>}
    </div>
  );
}

export function GraphicTab() {
  return (
    <div className="flex h-full min-h-[70vh] flex-col">
      <ArtworkCheck />
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl shadow-[var(--shadow-border)]">
        <StudioApp />
      </div>
    </div>
  );
}

function ArtworkCheck() {
  const [report, setReport] = useState<PhotoReport | null>(null);
  return (
    <div className="mb-3 rounded-xl bg-card p-3 shadow-[var(--shadow-border)]">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Client artwork</p>
      <input
        type="file"
        accept="image/*,.svg"
        className="mt-2 block w-full text-sm"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const isSvg = f.type.includes("svg") || f.name.toLowerCase().endsWith(".svg");
          if (isSvg) {
            setReport(checkArtwork(null, { isSvg: true }));
            return;
          }
          const url = URL.createObjectURL(f);
          const buf = await loadPhotoBuf(url);
          setReport(checkArtwork(buf, { printWmm: 80 }));
        }}
      />
      {report ? <div className="mt-3"><PhotoReportView report={report} /></div> : null}
    </div>
  );
}

export function NewOrderTab() {
  const [client, setClient] = useState(CLIENTS[0]!.id);
  const [sku, setSku] = useState(CATALOG_SKUS[0]!.sku);
  const rec = CATALOG_SKUS.find((s) => s.sku === sku)!;
  const allowed = rec.methods.length ? rec.methods : methodsForCategory(rec.category);
  const [method, setMethod] = useState<MethodId>(allowed[0]!);
  const [phrase, setPhrase] = useState("");
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed.includes(method)) setMethod(allowed[0]!);
  }, [sku]);

  const send = () => {
    const r = requireWrite("manager.create", phrase, {
      client,
      sku: rec.sku,
      method,
    });
    if (!r.ok) {
      setPlan(
        r.status === 423
          ? `Locked. Would create a sales order for ${clientName(client)} / ${rec.sku} / ${METHODS[method].label}. Type the phrase to show you mean it — writes still stay off on this phone.`
          : `Need the exact phrase: ${r.required}`,
      );
      return;
    }
    setPlan("Would have written. Writes are off.");
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label className="block text-sm">
        Client
        <select
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-secondary px-3"
        >
          {CLIENTS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        SKU
        <select
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg bg-secondary px-3"
        >
          {CATALOG_SKUS.filter((s) => !s.hidden && s.src).map((s) => (
            <option key={s.sku} value={s.sku}>
              {s.sku} {s.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <p className="text-sm">Decoration</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {METHOD_ORDER.map((id) => {
            const on = allowed.includes(id);
            return (
              <button
                key={id}
                type="button"
                disabled={!on}
                onClick={() => on && setMethod(id)}
                className={cn(
                  "min-h-11 rounded-lg px-3 text-sm",
                  !on && "cursor-not-allowed opacity-30",
                  on && method === id ? "bg-primary text-primary-foreground" : "bg-secondary",
                )}
              >
                {METHODS[id].short}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{METHODS[method].quoteLine}</p>
      </div>
      <label className="block text-sm">
        Confirm phrase
        <input
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="CREATE MANAGER RECORD"
          className="mt-1 h-11 w-full rounded-lg bg-secondary px-3 text-sm"
        />
      </label>
      <Button type="submit" className="h-11 w-full">
        Send to Manager
      </Button>
      {plan ? <p className="text-sm text-muted-foreground">{plan}</p> : null}
    </form>
  );
}

export function SetBuilderTab() {
  const [ids, setIds] = useState<string[]>(["TPX-PEN-01", "TPX-NTB-01", "TPX-TOT-01"]);
  const lines = ids
    .map((id) => CATALOG_SKUS.find((s) => s.sku === id))
    .filter((s): s is CatalogSku => !!s);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">SUM26 set — methods lock to the SKU.</p>
      {CATALOG_SKUS.filter((s) => !s.hidden && s.src).map((s) => {
        const on = ids.includes(s.sku);
        return (
          <button
            key={s.sku}
            type="button"
            onClick={() => setIds(on ? ids.filter((x) => x !== s.sku) : [...ids, s.sku])}
            className={cn(
              "flex min-h-12 w-full items-center justify-between rounded-lg px-3 text-left",
              on ? "bg-primary text-primary-foreground" : "bg-secondary",
            )}
          >
            <span className="text-sm">
              <span className="tabular-nums">{s.sku}</span> {s.name}
            </span>
            <span className="text-xs">{METHODS[s.methods[0]!].short}</span>
          </button>
        );
      })}
      <p className="text-sm tabular-nums text-muted-foreground">{lines.length} lines in the set</p>
    </div>
  );
}

export function RestTab({ id }: { id: TabId }) {
  if (id === "seasons") {
    return (
      <div className="space-y-3">
        {SEASONS.map((s) => (
          <div key={s.id} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs tabular-nums text-muted-foreground">{s.id}</p>
            <p className="text-lg font-medium">{s.name}</p>
            <p className="tabular-nums text-sm text-muted-foreground">
              {s.open} open · {money(s.amount)}
            </p>
          </div>
        ))}
      </div>
    );
  }
  if (id === "clients") {
    return (
      <Table
        cols={["Client", "City", "AM", "Open"]}
        rows={CLIENTS.map((c) => [c.name, c.city, c.am, money(c.open)])}
      />
    );
  }
  if (id === "target") {
    const pct = Math.round((TARGET.booked / TARGET.goal) * 100);
    return (
      <div className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{TARGET.year} booked</p>
        <p className="mt-2 font-display text-3xl tabular-nums">{money(TARGET.booked)}</p>
        <p className="mt-1 text-sm text-muted-foreground">of {money(TARGET.goal)} · {pct}%</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
  if (id === "laser") {
    return (
      <Table
        cols={["Order", "Type", "Lines", "Due"]}
        rows={LASER.map((j) => [j.ref, j.type, String(j.lines), j.due])}
      />
    );
  }
  if (id === "deadlines") {
    return (
      <Table
        cols={["Order", "Stage", "Age", "Client"]}
        rows={ORDERS.map((o) => [o.ref, o.stage, `${o.days}d`, clientName(o.clientId)])}
      />
    );
  }
  if (id === "files") {
    return (
      <div className="space-y-3">
        {FILES.slice(0, 6).map((f) => (
          <div key={f.order} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <p className="tabular-nums text-sm font-medium">{f.order}</p>
            <p className="mt-1 text-xs text-muted-foreground">{f.folders.join(" · ")}</p>
          </div>
        ))}
      </div>
    );
  }
  if (id === "house") {
    return (
      <div className="space-y-3">
        {HOUSE_RULES.map((h) => (
          <div key={h.id} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <p className="font-medium">{h.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{h.body}</p>
          </div>
        ))}
      </div>
    );
  }
  if (id === "people") {
    return (
      <Table
        cols={["Name", "Role", "City"]}
        rows={PEOPLE.map((p) => [p.name, p.role, p.city])}
      />
    );
  }
  if (id === "robots") {
    return (
      <div className="space-y-3">
        {ROBOTS.map((r) => (
          <div key={r.id} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <p className="font-medium">{r.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">Would: {r.would}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-primary">Dry run</p>
          </div>
        ))}
      </div>
    );
  }
  if (id === "activity") {
    return (
      <ul className="space-y-2">
        {ACTIVITY.map((a) => (
          <li key={a.t + a.text} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs tabular-nums text-muted-foreground">{a.t}</p>
            <p className="text-sm">{a.text}</p>
          </li>
        ))}
      </ul>
    );
  }
  return null;
}

export function TabBody({ tab }: { tab: TabId }) {
  if (tab === "day") return <MyDay />;
  if (tab === "cockpit") return <Cockpit active />;
  if (tab === "quotes") return <QuotesTab />;
  if (tab === "orders") return <OrdersTab />;
  if (tab === "pipeline") return <PipelineTab />;
  if (tab === "collections") return <CollectionsTab />;
  if (tab === "catalog") return <CatalogTab />;
  if (tab === "graphic") return <GraphicTab />;
  if (tab === "new-order") return <NewOrderTab />;
  if (tab === "set-builder") return <SetBuilderTab />;
  return <RestTab id={tab} />;
}
