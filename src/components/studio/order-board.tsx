import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/store";
import { emptyLine, loadOrder, saveOrder, type OrderLine } from "@/lib/order";
import { METHODS } from "@/lib/methods";
import { MOCKUPS } from "@/lib/mockups";

export function OrderBoard() {
  const mockup = useStudio((s) => s.mockup());
  const method = useStudio((s) => s.method);
  const [lines, setLines] = useState<OrderLine[]>([]);

  useEffect(() => {
    setLines(loadOrder());
  }, []);

  const persist = (next: OrderLine[]) => {
    setLines(next);
    saveOrder(next);
  };

  const addCurrent = () => {
    const sku = "sku" in mockup ? mockup.sku : "";
    if (!sku || sku === "CUSTOM") return;
    if (lines.some((l) => l.sku === sku && l.method === method)) return;
    persist([
      ...lines,
      emptyLine({
        sku,
        name: mockup.name,
        method,
        proofEligible: true,
      }),
    ]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Order lines</p>
        <Button variant="secondary" size="sm" onClick={addCurrent}>
          <Plus />
          Add SKU
        </Button>
      </div>
      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add SKUs, then export one branded PDF for the whole order.</p>
      ) : null}
      <ul className="space-y-1">
        {lines.map((l) => (
          <li key={l.id} className="flex items-center gap-2 rounded-md bg-secondary px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs tabular-nums text-foreground">
                {l.sku}  {l.name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {METHODS[l.method].short} · qty {l.qty}
              </p>
            </div>
            <input
              type="number"
              min={1}
              value={l.qty}
              onChange={(e) =>
                persist(lines.map((x) => (x.id === l.id ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))
              }
              className="h-8 w-12 rounded bg-background px-1 text-center text-xs tabular-nums"
              aria-label="Quantity"
            />
            <button
              type="button"
              aria-label="Remove line"
              onClick={() => persist(lines.filter((x) => x.id !== l.id))}
              className="text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <p className="hidden text-[10px] text-muted-foreground">
        {MOCKUPS.length} catalogue photos on disk. Search finds SKUs still awaiting a shot.
      </p>
    </div>
  );
}
