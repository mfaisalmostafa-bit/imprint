import { MOCKUPS, type Category, type Mockup } from "./mockups";
import type { MethodId } from "./methods";
import { defaultCenterQuad } from "./geometry";

export type CatalogRecord = {
  sku: string;
  name: string;
  category: Category;
  images: string[];
  material: string;
  proofEligible: boolean;
  templateId: string;
};

export type CatalogQuery = {
  q?: string;
  category?: Category | "all";
};

const FAMILIES: { templateId: string; prefix: string; count: number }[] = [
  { templateId: "pen", prefix: "PEN", count: 8 },
  { templateId: "flask", prefix: "FLK", count: 6 },
  { templateId: "usb", prefix: "USB", count: 6 },
  { templateId: "powerbank", prefix: "PWR", count: 6 },
  { templateId: "award", prefix: "AWD", count: 5 },
  { templateId: "mug", prefix: "MUG", count: 8 },
  { templateId: "cup", prefix: "CUP", count: 5 },
  { templateId: "notebook", prefix: "NTB", count: 6 },
  { templateId: "polo", prefix: "POL", count: 8 },
  { templateId: "tshirt", prefix: "TEE", count: 8 },
  { templateId: "hoodie", prefix: "HOD", count: 6 },
  { templateId: "cap", prefix: "CAP", count: 6 },
  { templateId: "tote", prefix: "TOT", count: 6 },
  { templateId: "bag", prefix: "BAG", count: 6 },
  { templateId: "box", prefix: "BOX", count: 5 },
  { templateId: "totem", prefix: "TTM", count: 4 },
  { templateId: "billboard", prefix: "BLB", count: 3 },
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function fromMockup(m: Mockup): CatalogRecord {
  return {
    sku: m.sku,
    name: m.name,
    category: m.category,
    images: [m.src],
    material: m.material,
    proofEligible: true,
    templateId: m.id,
  };
}

let cached: CatalogRecord[] | null = null;

/** Read-only catalogue. JSON today, a live API later — callers only see records. */
export function loadCatalog(): CatalogRecord[] {
  if (cached) return cached;
  const records: CatalogRecord[] = MOCKUPS.map(fromMockup);
  const seen = new Set(records.map((r) => r.sku));
  for (const fam of FAMILIES) {
    const template = MOCKUPS.find((m) => m.id === fam.templateId);
    if (!template) continue;
    for (let n = 1; n <= fam.count; n++) {
      const sku = `TPX-${fam.prefix}-${pad(n)}`;
      if (seen.has(sku)) continue;
      records.push({
        sku,
        name: `${template.name} ${pad(n)}`,
        category: template.category,
        images: [],
        material: template.material,
        proofEligible: false,
        templateId: template.id,
      });
      seen.add(sku);
    }
  }
  cached = records;
  return records;
}

export function pickFrontImage(images: string[]): string | null {
  if (!images.length) return null;
  const scored = images.map((src, i) => {
    const s = src.toLowerCase();
    let score = 100 - i;
    if (s.includes("front") || s.includes("hero") || s.includes("main")) score += 40;
    if (s.includes("back") || s.includes("detail") || s.includes("lifestyle")) score -= 20;
    if (s.includes("collage") || s.includes("set")) score -= 30;
    return { src, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.src ?? null;
}

export function searchCatalog(query: CatalogQuery): CatalogRecord[] {
  const all = loadCatalog();
  const q = (query.q ?? "").trim().toLowerCase();
  const cat = query.category ?? "all";
  return all.filter((r) => {
    if (cat !== "all" && r.category !== cat) return false;
    if (!q) return true;
    return (
      r.sku.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.material.toLowerCase().includes(q)
    );
  });
}

export function recordToMockup(r: CatalogRecord): Mockup | null {
  if (!r.proofEligible) return null;
  return MOCKUPS.find((m) => m.id === r.templateId) ?? null;
}

export function categoriesInCatalog(): Category[] {
  return [...new Set(loadCatalog().map((r) => r.category))];
}

export function defaultMethodFor(r: CatalogRecord): MethodId {
  const m = MOCKUPS.find((x) => x.id === r.templateId);
  return m?.defaultMethod ?? "uv_print";
}

export function emptyZone() {
  return defaultCenterQuad();
}
