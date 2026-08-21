import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import * as esbuild from "esbuild";

async function load(entry) {
  const outfile = join(mkdtempSync(join(tmpdir(), "ang-")), "core.mjs");
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    outfile,
    platform: "neutral",
  });
  return import(pathToFileURL(outfile).href);
}

const mug = [
  { x: 0.34, y: 0.22 },
  { x: 0.66, y: 0.22 },
  { x: 0.66, y: 0.68 },
  { x: 0.34, y: 0.70 },
];

const handleHero = [
  { x: 0.72, y: 0.30 },
  { x: 0.95, y: 0.28 },
  { x: 0.96, y: 0.72 },
  { x: 0.72, y: 0.74 },
];

const topDown = [
  { x: 0.20, y: 0.20 },
  { x: 0.80, y: 0.20 },
  { x: 0.80, y: 0.80 },
  { x: 0.20, y: 0.80 },
];

test("guide follows SKU, not a generic 3/4", async () => {
  const a = await load("src/lib/angle.ts");
  assert.equal(a.angleGuideFor({ id: "pen" }).id, "barrel");
  assert.equal(a.angleGuideFor({ id: "cap" }).id, "crown");
  assert.equal(a.angleGuideFor({ id: "billboard" }).id, "face");
  assert.equal(a.angleGuideFor({ category: "Apparel" }).id, "chest");
  assert.equal(a.angleGuideFor({ category: "Drinkware" }).id, "wall");
  assert.equal(a.angleGuideFor({ id: "unknown", category: "Other" }).id, "hero");
  assert.match(a.ANGLE_PROMPT, /Never top-down/);
});

test("catalog photo is the recommended camera — relative, not absolute yaw", async () => {
  const a = await load("src/lib/angle.ts");
  const on = a.judgeCatalogAngle(mug, mug);
  assert.equal(on.band, "ok");
  assert.equal(on.ok, true);
  const off = a.judgeCatalogAngle(handleHero, mug);
  assert.equal(off.ok, false);
  assert.equal(off.band, "off");
  assert.match(off.note, /catalog angle/);
  const far = a.judgeCatalogAngle(topDown, mug);
  assert.equal(far.ok, false);
});

test("inspectPlacement does not warn on catalog yaw; flags a different face", async () => {
  const q = await load("src/lib/qc.ts");
  const g = await load("src/lib/geometry.ts");
  const yaw = Math.abs(g.poseFromQuad(mug).yawDeg);
  assert.ok(yaw < 90);
  const base = {
    scale: 0.5,
    maxScale: 0.9,
    method: "uv_print",
    allowed: ["uv_print"],
    productTone: "mid",
    invert: false,
  };
  const on = q.inspectPlacement({ ...base, quad: mug, catalogQuad: mug });
  assert.equal(on.some((f) => f.code === "angle"), false);
  const off = q.inspectPlacement({ ...base, quad: handleHero, catalogQuad: mug });
  assert.equal(off.some((f) => f.code === "angle"), true);
  const noCatalog = q.inspectPlacement({ ...base, quad: mug });
  assert.equal(noCatalog.some((f) => f.code === "angle"), false);
  assert.doesNotMatch(
    readFileSync("src/lib/qc.ts", "utf8"),
    /yawDeg\) > 55|Extreme yaw/,
  );
});

test("Generate, Scan, Place, and applyScan all follow the catalog angle", () => {
  const store = readFileSync("src/lib/store.ts", "utf8");
  const imagine = readFileSync("src/lib/imagine.ts", "utf8");
  const scan = readFileSync("src/lib/scan.ts", "utf8");
  const place = readFileSync("src/components/jobs/place-window.tsx", "utf8");
  const review = readFileSync("src/components/jobs/review.tsx", "utf8");
  const studio = readFileSync("src/components/studio-app.tsx", "utf8");
  assert.match(store, /judgeCatalogAngle/);
  assert.doesNotMatch(store, /fitNote|judgedNote/);
  assert.match(imagine, /ANGLE_PROMPT/);
  assert.match(imagine, /data\.angle/);
  assert.match(scan, /ANGLE_PROMPT/);
  assert.match(place, /Catalog angle/);
  assert.match(review, /onCatalogAngle/);
  assert.match(review, /resetPlacement/);
  assert.match(studio, /angle: guide.prompt/);
});
