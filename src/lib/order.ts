import type { MethodId } from "./methods";

export type OrderLine = {
  id: string;
  sku: string;
  name: string;
  qty: number;
  method: MethodId;
  notes: string;
  proofEligible: boolean;
};

const KEY = "tpx-order-v1";

function nid() {
  return `ln-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyLine(partial?: Partial<OrderLine>): OrderLine {
  return {
    id: nid(),
    sku: "",
    name: "",
    qty: 1,
    method: "uv_print",
    notes: "",
    proofEligible: false,
    ...partial,
  };
}

export function loadOrder(): OrderLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OrderLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOrder(lines: OrderLine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines.slice(0, 40)));
  } catch {
    /* quota */
  }
}
