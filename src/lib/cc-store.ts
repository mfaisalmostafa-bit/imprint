import { create } from "zustand";

export const TABS = [
  { id: "day", label: "My Day" },
  { id: "cockpit", label: "Cockpit" },
  { id: "orders", label: "Orders" },
  { id: "quotes", label: "Quotes" },
  { id: "pipeline", label: "Pipeline" },
  { id: "seasons", label: "Seasons" },
  { id: "clients", label: "Clients" },
  { id: "collections", label: "Collections" },
  { id: "target", label: "Target" },
  { id: "catalog", label: "Catalog" },
  { id: "laser", label: "Laser" },
  { id: "deadlines", label: "Deadlines" },
  { id: "graphic", label: "Graphic" },
  { id: "files", label: "Files" },
  { id: "new-order", label: "New Order" },
  { id: "set-builder", label: "Set Builder" },
  { id: "house", label: "House Rules" },
  { id: "people", label: "People" },
  { id: "robots", label: "Robots" },
  { id: "activity", label: "Activity" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export const PRIMARY: TabId[] = ["day", "catalog", "orders", "graphic", "collections"];

type CcState = {
  tab: TabId;
  more: boolean;
  sku: string | null;
  q: string;
  setTab: (t: TabId) => void;
  setMore: (v: boolean) => void;
  setSku: (s: string | null) => void;
  setQ: (s: string) => void;
};

export const useCc = create<CcState>((set) => ({
  tab: "day",
  more: false,
  sku: null,
  q: "",
  setTab: (tab) => set({ tab, more: false }),
  setMore: (more) => set({ more }),
  setSku: (sku) => set({ sku }),
  setQ: (q) => set({ q }),
}));
