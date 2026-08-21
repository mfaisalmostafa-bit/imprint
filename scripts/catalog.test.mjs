import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import * as esbuild from "esbuild";

const outfile = join(mkdtempSync(join(tmpdir(), "cat-")), "core.mjs");
await esbuild.build({
  entryPoints: ["src/lib/catalog.ts"],
  bundle: true,
  format: "esm",
  outfile,
  platform: "neutral",
});
const { loadCatalog, searchCatalog, pickFrontImage, recordToMockup } = await import(
  pathToFileURL(outfile).href
);

test("catalogue has more than the hardcoded photo set and SKUs stay TPX-XXX-NN", () => {
  const all = loadCatalog();
  assert.ok(all.length > 40);
  for (const r of all) {
    assert.match(r.sku, /^TPX-[A-Z]{3}-\d{2}$/);
  }
  assert.ok(all.some((r) => r.proofEligible));
  assert.ok(all.some((r) => !r.proofEligible));
});

test("search filters by SKU and category", () => {
  const pens = searchCatalog({ q: "PEN", category: "Writing" });
  assert.ok(pens.length >= 1);
  assert.ok(pens.every((r) => r.category === "Writing"));
  const empty = searchCatalog({ q: "zzzz-no-such" });
  assert.equal(empty.length, 0);
});

test("pending SKUs cannot become a proof mockup", () => {
  const pending = loadCatalog().find((r) => !r.proofEligible);
  assert.ok(pending);
  assert.equal(recordToMockup(pending), null);
});

test("front image picker prefers a hero/front over a collage", () => {
  const src = pickFrontImage(["/a/collage.jpg", "/a/front.jpg", "/a/back.jpg"]);
  assert.equal(src, "/a/front.jpg");
});
