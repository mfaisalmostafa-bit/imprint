import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";

async function load(entry) {
  const outfile = join(mkdtempSync(join(tmpdir(), "fit-")), "core.mjs");
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    outfile,
    platform: "neutral",
  });
  return import(pathToFileURL(outfile).href);
}

test("high-side body 1.0 sizes from the zone — the 0.70 image cap never applies", async () => {
  const m = await load("src/lib/fit-mark.ts");
  assert.ok(m.DEAD_IMAGE_CAP > 0.6);
  const fit = m.fitMarkScale({
    bodyWidth: 1.0,
    zoneWidth: 0.52,
    maxScale: 0.6,
    preferred: 0.58,
  });
  assert.equal(fit.trusted, false);
  assert.ok(fit.scale <= 0.6);
  assert.ok(fit.scale <= 0.58);
  assert.notEqual(fit.scale, m.DEAD_IMAGE_CAP);
  assert.match(fit.note, /print zone/);
});

test("trusted body caps the mark so it cannot exceed the product", async () => {
  const m = await load("src/lib/fit-mark.ts");
  const over = m.markBodyRatio(0.58, 1.0, 0.28);
  assert.ok(over > 1.8, `ratio=${over}`);
  const fit = m.fitMarkScale({
    bodyWidth: 0.28,
    zoneWidth: 1.0,
    maxScale: 0.8,
    preferred: 0.58,
  });
  assert.equal(fit.trusted, true);
  assert.ok(m.markBodyRatio(fit.scale, 1.0, 0.28) <= m.MARK_OF_BODY + 1e-9);
});

test("untrusted full-frame lock is not used as the print zone", async () => {
  const m = await load("src/lib/fit-mark.ts");
  const full = [
    { x: 0.02, y: 0.02 },
    { x: 0.98, y: 0.02 },
    { x: 0.98, y: 0.98 },
    { x: 0.02, y: 0.98 },
  ];
  const z = m.zoneForFit(full, false);
  const w = z[1].x - z[0].x;
  assert.ok(w < 0.5, `zone w=${w}`);
  const kept = m.zoneForFit(full, true);
  assert.equal(kept[0].x, 0.02);
});

test("applyScan and detect carry the high-side guard", () => {
  const store = readFileSync("src/lib/store.ts", "utf8");
  const detect = readFileSync("src/lib/detect-core.ts", "utf8");
  assert.match(store, /fitMarkScale/);
  assert.match(store, /zoneForFit/);
  assert.match(store, /scaleCap/);
  assert.match(store, /judgeCatalogAngle/);
  assert.match(detect, /bodyTrusted/);
  assert.match(detect, /bodyWidth/);
  assert.doesNotMatch(store + detect, /DEAD_IMAGE_CAP/);
});
