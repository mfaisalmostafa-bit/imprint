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

test("class scales replace the 0.18-0.72 body clamp", async () => {
  const m = await load("src/lib/fit-mark.ts");
  const slim = m.fitMarkScale({
    bodyWidth: 0.12,
    zoneWidth: 0.24,
    maxScale: 0.8,
    preferred: 0.62,
    markClass: "bottle",
  });
  assert.equal(slim.trusted, true, "TH164-class slim bottle must be trusted");
  assert.ok(slim.scale > 0.2, `bottle scale=${slim.scale}`);
  assert.ok(slim.scale <= 0.72);

  const pack = m.fitMarkScale({
    bodyWidth: 0.88,
    zoneWidth: 0.52,
    maxScale: 0.8,
    preferred: 0.58,
    markClass: "bag",
  });
  assert.equal(pack.trusted, true, "BP70-class full-frame bag must be trusted");
  assert.ok(m.markBodyRatio(pack.scale, 0.52, 0.88) <= 0.32);

  const pen = m.fitMarkScale({
    bodyWidth: 0.7,
    zoneWidth: 0.56,
    maxScale: 0.96,
    preferred: 0.84,
    markClass: "pen",
  });
  assert.equal(pen.trusted, true);
  assert.ok(pen.scale >= 0.55, `pen scale=${pen.scale}`);
});

test("applyScan and detect carry the high-side guard", () => {
  const store = readFileSync("src/lib/store.ts", "utf8");
  const detect = readFileSync("src/lib/detect-core.ts", "utf8");
  const brain = readFileSync("src/components/studio/brain-panel.tsx", "utf8");
  assert.match(store, /fitMarkScale/);
  assert.match(store, /zoneForFit/);
  assert.match(store, /scaleCap/);
  assert.match(store, /markClassOf/);
  assert.match(store, /judgeCatalogAngle/);
  assert.match(detect, /bodyTrusted/);
  assert.match(detect, /bodyWidth/);
  assert.match(detect, /pickZone/);
  assert.doesNotMatch(store + detect, /DEAD_IMAGE_CAP/);
  assert.doesNotMatch(brain, /min=\{0\.18\}/);
});
