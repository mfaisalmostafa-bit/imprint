import { MOCKUPS, type Category } from "./mockups";
import type { MethodId } from "./methods";
import { defaultMethodFor } from "./methods";

export type Stage =
  | "Quote"
  | "Sales Order"
  | "Mockup"
  | "Production"
  | "QC"
  | "Delivery"
  | "Invoice"
  | "Paid";

export type ClientRec = {
  id: string;
  name: string;
  city: string;
  am: string;
  open: number;
};

export type QuoteRec = {
  ref: string;
  clientId: string;
  amount: number;
  days: number;
  season: string;
  lines: number;
};

export type OrderRec = {
  ref: string;
  clientId: string;
  amount: number;
  stage: Stage;
  days: number;
  season: string;
  method: MethodId;
  laser?: "fiber" | "co2" | null;
};

export type InvoiceRec = {
  ref: string;
  clientId: string;
  amount: number;
  balance: number;
  days: number;
};

export type PersonRec = {
  id: string;
  name: string;
  role: string;
  city: string;
};

export type LaserJob = {
  ref: string;
  type: "fiber" | "co2";
  lines: number;
  due: string;
};

export type FileFolder = {
  order: string;
  folders: string[];
};

export type ActivityRec = {
  t: string;
  text: string;
};

export type Attention = {
  id: string;
  verb: string;
  detail: string;
  tab: string;
  severity: "block" | "act" | "note";
};

export const PEOPLE: PersonRec[] = [
  { id: "p-am1", name: "Hossam", role: "Account manager", city: "Cairo" },
  { id: "p-am2", name: "Nour", role: "Account manager", city: "Cairo" },
  { id: "p-ops", name: "Eslam", role: "Production", city: "Cairo" },
  { id: "p-art", name: "Mariam", role: "Graphic", city: "Cairo" },
  { id: "p-fin", name: "Dina", role: "Collections", city: "Cairo" },
];

export const CLIENTS: ClientRec[] = [
  { id: "c-nile", name: "Nile Hotels Group", city: "Cairo", am: "Hossam", open: 184200 },
  { id: "c-delta", name: "Delta Cement", city: "Alexandria", am: "Nour", open: 62100 },
  { id: "c-bank", name: "East Bank", city: "New Cairo", am: "Hossam", open: 91000 },
  { id: "c-port", name: "Port Said Logistics", city: "Port Said", am: "Nour", open: 0 },
  { id: "c-pharma", name: "Cairo Pharma", city: "Giza", am: "Hossam", open: 44500 },
  { id: "c-cotton", name: "Alex Cotton", city: "Alexandria", am: "Nour", open: 12800 },
  { id: "c-red", name: "Red Sea Resorts", city: "Hurghada", am: "Hossam", open: 210000 },
  { id: "c-ins", name: "Misr Insurance", city: "Cairo", am: "Dina", open: 42000 },
  { id: "c-food", name: "Giza Foods", city: "Giza", am: "Nour", open: 7800 },
  { id: "c-suez", name: "Suez Ports", city: "Suez", am: "Hossam", open: 15600 },
];

export const QUOTES: QuoteRec[] = [
  { ref: "Q-2408-01", clientId: "c-nile", amount: 184200, days: 2, season: "SUM26", lines: 8 },
  { ref: "Q-2408-04", clientId: "c-bank", amount: 91000, days: 21, season: "SUM26", lines: 5 },
  { ref: "Q-2407-18", clientId: "c-delta", amount: 62100, days: 9, season: "SUM26", lines: 6 },
  { ref: "Q-2407-02", clientId: "c-pharma", amount: 44500, days: 45, season: "WIN25", lines: 4 },
  { ref: "Q-2408-09", clientId: "c-red", amount: 210000, days: 4, season: "SUM26", lines: 11 },
  { ref: "Q-2406-22", clientId: "c-cotton", amount: 12800, days: 61, season: "WIN25", lines: 3 },
];

export const ORDERS: OrderRec[] = [
  { ref: "SO-1882", clientId: "c-nile", amount: 64000, stage: "Mockup", days: 3, season: "SUM26", method: "laser_engrave", laser: "fiber" },
  { ref: "SO-1874", clientId: "c-delta", amount: 22100, stage: "Production", days: 6, season: "SUM26", method: "uv_print" },
  { ref: "SO-1861", clientId: "c-red", amount: 88000, stage: "QC", days: 11, season: "SUM26", method: "embroidery" },
  { ref: "SO-1840", clientId: "c-pharma", amount: 19300, stage: "Delivery", days: 18, season: "SUM26", method: "sublimation" },
  { ref: "SO-1822", clientId: "c-bank", amount: 41000, stage: "Invoice", days: 24, season: "SUM26", method: "uv_dtf" },
  { ref: "SO-1798", clientId: "c-suez", amount: 15600, stage: "Paid", days: 40, season: "WIN25", method: "laser_engrave", laser: "co2" },
  { ref: "SO-1888", clientId: "c-food", amount: 7800, stage: "Sales Order", days: 1, season: "SUM26", method: "uv_print" },
];

export const INVOICES: InvoiceRec[] = [
  { ref: "INV-1102", clientId: "c-ins", amount: 42000, balance: 42000, days: 61 },
  { ref: "INV-1094", clientId: "c-bank", amount: 41000, balance: 18000, days: 24 },
  { ref: "INV-1081", clientId: "c-delta", amount: 22100, balance: 22100, days: 38 },
  { ref: "INV-1066", clientId: "c-nile", amount: 54000, balance: 0, days: 12 },
  { ref: "INV-1040", clientId: "c-pharma", amount: 19300, balance: 4500, days: 9 },
  { ref: "INV-1012", clientId: "c-cotton", amount: 8900, balance: 8900, days: 94 },
];

export const LASER: LaserJob[] = [
  { ref: "SO-1882", type: "fiber", lines: 4, due: "22 Aug" },
  { ref: "SO-1798", type: "co2", lines: 2, due: "done" },
  { ref: "SO-1891", type: "fiber", lines: 8, due: "24 Aug" },
];

export const FILES: FileFolder[] = ORDERS.map((o) => ({
  order: o.ref,
  folders: ["01_Vector", "02_Proof", "03_Production", "04_QC"],
}));

export const ACTIVITY: ActivityRec[] = [
  { t: "05:40", text: "SO-1882 mockup waiting on Graphic." },
  { t: "05:12", text: "Q-2408-04 still open 21 days — East Bank." },
  { t: "Yesterday", text: "INV-1102 aged past 60 days — Misr Insurance." },
  { t: "Yesterday", text: "SO-1861 moved to QC." },
  { t: "20 Aug", text: "SUM26 set for Nile Hotels, 8 lines." },
];

export const SEASONS = [
  { id: "SUM26", name: "Summer 2026", open: 4, amount: 591400 },
  { id: "WIN25", name: "Winter 2025", open: 2, amount: 21700 },
];

export const TARGET = { year: 2026, goal: 4200000, booked: 1876400 };

export const ROBOTS = [
  { id: "ops-cycle", name: "Ops cycle", would: "Create 02_Proof for SO-1882", dry: true },
  { id: "ar-nudge", name: "AR nudge", would: "Draft chase for INV-1102", dry: true },
  { id: "wix-hide", name: "Hidden no-image", would: "List 0 products to hide (price 0 is ignored)", dry: true },
];

export function clientById(id: string) {
  return CLIENTS.find((c) => c.id === id);
}

export function money(n: number) {
  return n.toLocaleString("en-EG") + " EGP";
}

export function ageBucket(days: number) {
  if (days <= 30) return "0–30";
  if (days <= 60) return "31–60";
  if (days <= 90) return "61–90";
  return "90+";
}

export function attention(): Attention[] {
  const items: Attention[] = [];
  for (const q of QUOTES) {
    if (q.days >= 14) {
      items.push({
        id: q.ref,
        verb: "Chase",
        detail: `${clientById(q.clientId)?.name} quote ${q.ref} · ${q.days} days`,
        tab: "quotes",
        severity: q.days >= 45 ? "block" : "act",
      });
    }
  }
  for (const o of ORDERS) {
    if (o.stage === "Mockup") {
      items.push({
        id: o.ref,
        verb: "Proof",
        detail: `${o.ref} is waiting on a branded mockup`,
        tab: "graphic",
        severity: "act",
      });
    }
  }
  for (const i of INVOICES) {
    if (i.balance > 0 && i.days >= 30) {
      items.push({
        id: i.ref,
        verb: "Collect",
        detail: `${money(i.balance)} · ${clientById(i.clientId)?.name} · ${i.days} days`,
        tab: "collections",
        severity: i.days >= 90 ? "block" : "act",
      });
    }
  }
  return items.sort((a, b) => (a.severity === "block" ? -1 : 1) - (b.severity === "block" ? -1 : 1));
}

export type CatalogSku = {
  sku: string;
  name: string;
  category: Category;
  src: string;
  material: string;
  price: number;
  hidden: boolean;
  printWmm: number;
  printHmm: number;
  methods: MethodId[];
};

export const CATALOG_SKUS: CatalogSku[] = [
  ...MOCKUPS.map((m) => ({
    sku: m.sku,
    name: m.name,
    category: m.category,
    src: m.src,
    material: m.material,
    price: m.category === "Display" ? 0 : 1,
    hidden: false,
    printWmm: m.printWmm,
    printHmm: m.printHmm,
    methods: m.methods,
  })),
  {
    sku: "TPX-PEN-09",
    name: "Metal twist pen 09",
    category: "Writing",
    src: "",
    material: "coated black metal",
    price: 0,
    hidden: true,
    printWmm: 45,
    printHmm: 8,
    methods: ["laser_engrave", "uv_print"],
  },
];

export function methodForSku(sku: CatalogSku): MethodId {
  return sku.methods[0] ?? defaultMethodFor(sku.category);
}

export const HOUSE_RULES = [
  {
    id: "supplier",
    title: "No supplier names on a client screen",
    body: "Neutral codes only: SUM26-XX, TPX-XX, SUP-01. Never in a SKU, filename, alt text, export, PDF or tooltip.",
  },
  {
    id: "methods",
    title: "Five decoration methods",
    body: "Laser engraving, UV printing, UV DTF, sublimation, embroidery. Screen, pad, emboss and deboss are never offered.",
  },
  {
    id: "uv",
    title: "UV printing is not UV DTF",
    body: "Hard goods, bags, boxes → UV Printing. Textiles and non-embroidery apparel → UV DTF.",
  },
  {
    id: "price0",
    title: "Price 0 is deliberate",
    body: "A Wix product at 0 is B2B config. Never flag it, never fix it, never surface it as an error.",
  },
  {
    id: "writes",
    title: "No live write without confirmation",
    body: "Manager.io and Wix writes are irreversible from a phone. Confirm phrase, or it does not happen.",
  },
];
