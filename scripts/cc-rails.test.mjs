import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const files = {
  methods: readFileSync("src/lib/methods.ts", "utf8"),
  brand: readFileSync("src/lib/brand.ts", "utf8"),
  data: readFileSync("src/lib/cc-data.ts", "utf8"),
  views: readFileSync("src/components/cc/views.tsx", "utf8"),
  guard: readFileSync("src/lib/write-guard.ts", "utf8"),
};

function walk(dir, acc = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${name.name}`;
    if (name.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|mjs|md|json)$/.test(name.name)) acc.push(p);
  }
  return acc;
}

test("methods are exactly the five TePee-X sells", () => {
  const ids = [...files.methods.matchAll(/id: "([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(ids)],
    ["laser_engrave", "uv_print", "uv_dtf", "sublimation", "embroidery"],
  );
});

test("blacklisted decoration terms stay out of the method picker", () => {
  assert.match(files.methods, /BLACKLISTED_TERMS/);
  assert.doesNotMatch(files.methods, /id: "pad_|id: "screen_|id: "emboss|id: "deboss|id: "foil/);
  assert.doesNotMatch(files.views, /pad print|screen print|emboss|deboss|foil/i);
});

test("textiles are UV DTF, hard goods are UV printing", async () => {
  const outfile = join(mkdtempSync(join(tmpdir(), "m-")), "core.mjs");
  await esbuild.build({
    entryPoints: ["src/lib/methods.ts"],
    bundle: true,
    format: "esm",
    outfile,
    platform: "neutral",
  });
  const m = await import(pathToFileURL(outfile).href);
  assert.deepEqual(m.methodsForCategory("Apparel"), ["embroidery", "uv_dtf"]);
  assert.ok(m.methodsForCategory("Packaging").includes("uv_print"));
  assert.ok(!m.methodsForCategory("Packaging").includes("uv_dtf"));
  assert.match(m.describeMethodPairing("Apparel", "uv_print"), /UV DTF/);
});

test("supplier names never reach client-visible copy", () => {
  const blob = walk("src").map((p) => readFileSync(p, "utf8")).join("\n");
  assert.doesNotMatch(blob, /Beacon|Azab|Platinum|Sameh|Catalyst|Midocean|PfConcept/i);
});

test("price 0 is never treated as an error", () => {
  assert.match(files.data, /price: m\.category === "Display" \? 0/);
  assert.doesNotMatch(files.views, /price === 0|price == 0|price is 0|zero price/i);
  assert.match(files.data, /Price 0 is deliberate/);
});

test("writes require a confirm phrase and stay locked", async () => {
  const outfile = join(mkdtempSync(join(tmpdir(), "g-")), "core.mjs");
  await esbuild.build({
    entryPoints: ["src/lib/write-guard.ts"],
    bundle: true,
    format: "esm",
    outfile,
    platform: "neutral",
  });
  const g = await import(pathToFileURL(outfile).href);
  const blocked = g.requireWrite("manager.create", "CREATE MANAGER RECORD", { sku: "TPX-PEN-01" });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 423);
  const bad = g.requireWrite("manager.create", "please", {});
  assert.equal(bad.ok, false);
  const noPhrase = g.requireWrite("placement.save", "", { sku: "TPX-PEN-01" });
  assert.equal(noPhrase.ok, false);
  assert.equal(noPhrase.required, "SAVE PLACEMENT OVERRIDE");
  const placed = g.requireWrite("placement.save", "SAVE PLACEMENT OVERRIDE", { sku: "TPX-PEN-01" });
  assert.equal(placed.ok, true);
});

test("brand is navy #04263F and orange #D1812E", () => {
  assert.match(files.brand, /#04263F/);
  assert.match(files.brand, /#D1812E/);
});

test("no regex lookbehind in the command center", () => {
  assert.doesNotMatch(files.views + files.guard, /\(\?<=|\(\?<!/);
});
