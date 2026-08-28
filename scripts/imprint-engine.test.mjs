import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import * as esbuild from "esbuild";

async function load(entry) {
  const outfile = join(mkdtempSync(join(tmpdir(), "imp-")), "core.mjs");
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    outfile,
    platform: "neutral",
  });
  return import(pathToFileURL(outfile).href);
}

test("SKU classes: pens barrel, bottles mid-body, bags panel, cables disc, notebooks band", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  assert.equal(m.markClassOf({ sku: "TPX-PEN-01", id: "pen" }), "pen");
  assert.equal(m.markClassOf({ sku: "TH164", id: "th164" }), "bottle");
  assert.equal(m.markClassOf({ sku: "BP70", id: "bp70" }), "bag");
  assert.equal(m.markClassOf({ sku: "NB146", id: "nb146" }), "notebook");
  assert.equal(m.markClassOf({ sku: "P202", id: "p202" }), "tech");
  assert.equal(m.markClassOf({ sku: "LR-CBL01", id: "lr-cbl01" }), "cable");
  assert.equal(m.classScale("bag").markOfBody < 0.55, true);
  assert.ok(m.classScale("pen").minScale >= 0.5);
  assert.ok(m.classScale("bottle").bodyLow < 0.18);
  assert.ok(m.classScale("bag").bodyHigh > 0.72);
});

test("notebook smart-canvas crop keeps the cover, never a clasp clip", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  const body = { x: 0.18, y: 0.12, w: 0.64, h: 0.76 };
  const crop = m.smartCanvasCrop(body, "notebook");
  assert.ok(m.notebookCropSane(crop, body));
  assert.ok(m.classScale("notebook").canvasFill < 0.72);
  const zone = m.zoneForClass(
    [
      { x: body.x, y: body.y },
      { x: body.x + body.w, y: body.y },
      { x: body.x + body.w, y: body.y + body.h },
      { x: body.x, y: body.y + body.h },
    ],
    "notebook",
  );
  const h = zone[2].y - zone[1].y;
  assert.ok(h < body.h * 0.28, `band h=${h}`);
  assert.ok(zone[0].y > body.y + body.h * 0.4, "band sits below the clasp");
});

test("cable disc is square-on the round face; P202 is a placeholder SKU", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  assert.equal(m.isDiscSku("LR-CBL01"), true);
  assert.equal(m.isPlaceholderSku("P202"), true);
  const body = [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ];
  const disc = m.discQuad(body);
  const bw = disc[1].x - disc[0].x;
  const bh = disc[2].y - disc[1].y;
  assert.ok(Math.abs(bw - bh) < 0.02);
  assert.ok(bw < 0.55);
});

test("house rails still hold in the engine", () => {
  const blob = ["src/lib/imprint-engine.ts", "src/lib/fit-mark.ts", "src/lib/mockups.ts"]
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  assert.doesNotMatch(blob, /Beacon|Azab|Platinum|Sameh|Catalyst|Midocean|PfConcept/i);
  assert.doesNotMatch(blob, /pad_print|screen_print|deboss|emboss/);
  const mockups = readFileSync("src/lib/mockups.ts", "utf8");
  assert.match(mockups, /sku: "TH164"/);
  assert.match(mockups, /sku: "BP70"/);
  assert.match(mockups, /sku: "NB146"/);
  assert.match(mockups, /sku: "P202"/);
  assert.match(mockups, /sku: "LR-CBL01"/);
  const pen = mockups.split('id: "pen"')[1]?.slice(0, 900) ?? "";
  assert.match(pen, /invert: true/);
});
