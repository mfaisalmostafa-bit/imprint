import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import * as esbuild from "esbuild";

async function load(entry) {
  const outfile = join(mkdtempSync(join(tmpdir(), "maker-")), "core.mjs");
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    outfile,
    platform: "neutral",
  });
  return import(pathToFileURL(outfile).href);
}

test("machine pairing: fiber AI8 EPS, CO2 AI10 PDF, print colour PDF", async () => {
  const m = await load("src/lib/maker.ts");
  assert.equal(m.MACHINES.fiber.format, "eps");
  assert.equal(m.MACHINES.fiber.aiVersion, 8);
  assert.equal(m.MACHINES.co2.format, "pdf");
  assert.equal(m.MACHINES.co2.aiVersion, 10);
  assert.equal(m.MACHINES.print.color, true);
  assert.equal(m.MACHINES.print.format, "pdf");
  m.assertPairing("fiber");
  m.assertPairing("co2");
  m.assertPairing("print");
  const blob = `${m.MACHINES.fiber.label} ${m.MACHINES.co2.label} ${m.MACHINES.print.label} ${m.MACHINES.print.substrates}`;
  assert.match(blob, /UV/);
  assert.doesNotMatch(blob, /pad print|screen print|emboss|deboss/i);
});

test("machine file is sized in mm and named without banned terms", async () => {
  const m = await load("src/lib/maker.ts");
  const w = 32,
    h = 20;
  const mask = new Uint8Array(w * h);
  for (let y = 4; y < 16; y++) for (let x = 6; x < 26; x++) mask[y * w + x] = 1;
  const fiber = m.buildMachineFile({ machine: "fiber", mask, w, h, widthMm: 100, name: "North mark" });
  assert.equal(fiber.format, "eps");
  assert.equal(fiber.aiVersion, 8);
  assert.match(fiber.body, /%!PS-Adobe-3.0 EPSF-3.0/);
  assert.match(fiber.body, /Adobe Illustrator\(TM\) 8\.0/);
  assert.match(fiber.filename, /100mm_fiber\.eps$/);
  assert.equal(fiber.widthMm, 100);
  const co2 = m.buildMachineFile({ machine: "co2", mask, w, h, widthMm: 80, name: "North mark" });
  assert.equal(co2.format, "pdf");
  assert.equal(co2.aiVersion, 10);
  assert.match(co2.body, /%PDF-1\./);
  assert.match(co2.body, /%AI-10/);
  const print = m.buildMachineFile({ machine: "print", mask, w, h, widthMm: 120, onColour: true, name: "logo" });
  assert.equal(print.format, "pdf");
  assert.ok(print.heightMm > 0);
});

test("background key punches corner-matched pixels", async () => {
  const m = await load("src/lib/maker.ts");
  const w = 8,
    h = 8;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 240;
    rgba[i + 1] = 240;
    rgba[i + 2] = 240;
    rgba[i + 3] = 255;
  }
  for (let y = 2; y < 6; y++) {
    for (let x = 2; x < 6; x++) {
      const i = (y * w + x) * 4;
      rgba[i] = 20;
      rgba[i + 1] = 20;
      rgba[i + 2] = 20;
    }
  }
  const keyed = m.keyBackground(rgba, w, h, 30);
  assert.equal(keyed[3], 0);
  const mid = (4 * w + 4) * 4 + 3;
  assert.equal(keyed[mid], 255);
});

test("maker source has no SKU classifier and no banned print words", () => {
  const ui = readFileSync("src/components/maker/app.tsx", "utf8");
  assert.doesNotMatch(ui, /sku\s*===/);
  assert.doesNotMatch(ui, /TH164|BP70|NB146|P202|LR-CBL01|CH-1011-B-G/);
  assert.doesNotMatch(ui, /pad print|screen print|emboss|deboss/i);
  assert.match(ui, /Make the \.ai file/);
  assert.match(ui, /Remove the background/);
  assert.match(ui, /3D models/i);
});
