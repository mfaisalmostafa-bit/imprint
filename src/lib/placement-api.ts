/** Shared per-SKU print-zone store. Unowned rows. No auth. No delete-all. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import {
  SAVE_PHRASE,
  SKU_RE,
  type EngineQuad,
  type OverrideDoc,
} from "@/lib/engine";
import { requireWrite } from "@/lib/write-guard";

const Point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
const EngineQuadZ = z.tuple([Point, Point, Point, Point]);
const SurfaceZ = z.enum(["flat", "cylinder", "curved", "taper", "cone", "sphere"]);

const DocZ = z.object({
  _sku: z.string().regex(SKU_RE),
  quad: EngineQuadZ,
  rect: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  surface: SurfaceZ,
  curvature: z.number().optional(),
});

const SaveZ = z.object({
  confirm: z.string(),
  doc: DocZ,
});

type Row = {
  sku: string;
  quad: string;
  rect: string;
  surface: string;
  curvature: number;
};

function parseDoc(row: Row): OverrideDoc | null {
  try {
    const quad = JSON.parse(row.quad) as EngineQuad;
    const rect = JSON.parse(row.rect) as OverrideDoc["rect"];
    const surface = SurfaceZ.parse(row.surface);
    if (!Array.isArray(quad) || quad.length !== 4) return null;
    return {
      _sku: row.sku,
      quad,
      rect,
      surface,
      curvature: Number(row.curvature) || 0,
    };
  } catch {
    return null;
  }
}

export const fetchOverride = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ sku: z.string() }).parse(input))
  .handler(async ({ data }): Promise<OverrideDoc | null> => {
    if (!SKU_RE.test(data.sku)) return null;
    const sql = await getSql();
    const rows = await sql.query<Row>(
      "select sku, quad, rect, surface, curvature from placement_overrides where sku = $1",
      [data.sku],
    );
    const row = rows[0];
    return row ? parseDoc(row) : null;
  });

export const listOverrides = createServerFn({ method: "GET" }).handler(async (): Promise<OverrideDoc[]> => {
  const sql = await getSql();
  const rows = await sql.query<Row>(
    "select sku, quad, rect, surface, curvature from placement_overrides order by sku",
  );
  return rows.map(parseDoc).filter((d): d is OverrideDoc => d !== null);
});

export const persistOverride = createServerFn({ method: "POST" })
  .validator((input: unknown) => SaveZ.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; doc: OverrideDoc } | { ok: false; error: string; required?: string }> => {
    const gated = requireWrite("placement.save", data.confirm, { sku: data.doc._sku });
    if (!gated.ok) {
      return { ok: false, error: gated.error, required: gated.required };
    }
    if (data.confirm !== SAVE_PHRASE) {
      return { ok: false, error: "confirmation phrase required", required: SAVE_PHRASE };
    }
    const sql = await getSql();
    const doc = data.doc;
    await sql.query(
      `insert into placement_overrides (sku, quad, rect, surface, curvature, updated_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (sku) do update set
         quad = excluded.quad,
         rect = excluded.rect,
         surface = excluded.surface,
         curvature = excluded.curvature,
         updated_at = now()`,
      [
        doc._sku,
        JSON.stringify(doc.quad),
        JSON.stringify(doc.rect),
        doc.surface,
        doc.curvature ?? 0,
      ],
    );
    return { ok: true, doc };
  });
