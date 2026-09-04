import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import * as esbuild from "esbuild";

async function load() {
  const outfile = join(mkdtempSync(join(tmpdir(), "rp-")), "core.mjs");
  await esbuild.build({
    entryPoints: ["src/lib/resolve-placement.ts"],
    bundle: true,
    format: "esm",
    outfile,
    platform: "neutral",
  });
  return import(pathToFileURL(outfile).href);
}

function rect(x, y, w, h) {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

const BODY = rect(0.28, 0.12, 0.44, 0.76);
const MID = rect(0.38, 0.42, 0.24, 0.28);

test("MG-4018 control quad is not a print face", async () => {
  const m = await load();
  const face = m.printFaceOk(m.NECK_OVERRIDE_CONTROL, "bottle", BODY);
  assert.equal(face.ok, false);
  assert.equal(face.reason, "neck");
});

test("mid-body bottle band is a print face", async () => {
  const m = await load();
  assert.equal(m.printFaceOk(MID, "bottle", BODY).ok, true);
});

test("drawn > pick > saved-if-print-face > engine; neck saved drops", async () => {
  const m = await load();
  const drawn = rect(0.4, 0.5, 0.2, 0.2);
  const pick = rect(0.41, 0.48, 0.18, 0.2);
  const staff = rect(0.39, 0.44, 0.22, 0.24);
  let r = m.resolvePlacement({ cls: "bottle", body: BODY, drawn, pick, engine: MID, saved: staff });
  assert.equal(r.source, "drawn");
  r = m.resolvePlacement({ cls: "bottle", body: BODY, pick, engine: MID, saved: staff });
  assert.equal(r.source, "pick");
  r = m.resolvePlacement({ cls: "bottle", body: BODY, engine: MID, saved: staff });
  assert.equal(r.source, "saved");
  r = m.resolvePlacement({ cls: "bottle", body: BODY, engine: MID, saved: m.NECK_OVERRIDE_CONTROL });
  assert.equal(r.source, "engine");
  assert.equal(r.dropped, "neck");
});

test("class is never a lock letter", async () => {
  const m = await load();
  const letters = m.letterChoices([
    { id: "class", label: "the usual place for this category", quad: MID, veto: null },
  ]);
  assert.equal(letters[0].letter, "A");
  assert.equal(letters[0].lock, false);
  assert.equal(letters[0].id, "class");
});

test("no SKU branch in the resolver", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/lib/resolve-placement.ts", "utf8");
  assert.doesNotMatch(src, /sku\s*===?\s*['"]MG-/);
});
