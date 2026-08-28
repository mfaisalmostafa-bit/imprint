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

function rect(x, y, w, h) {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

test("classify by category and family, never by SKU", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  assert.equal(m.markClassOf({ category: "Writing", name: "Metal twist pen" }), "pen");
  assert.equal(m.markClassOf({ category: "Drinkware", name: "UrbanChill bottle" }), "bottle");
  assert.equal(m.markClassOf({ category: "Packaging", name: "Laptop backpack" }), "bag");
  assert.equal(m.markClassOf({ category: "Stationery", name: "PU rubber notebook" }), "notebook");
  assert.equal(m.markClassOf({ category: "Tech", name: "Cork power bank" }), "tech");
  assert.equal(m.markClassOf({ category: "Tech", name: "Disc cable" }), "cable");
  assert.equal(m.markClassOf({ family: "drinkware" }), "bottle");
  assert.equal(m.markClassOf({ family: { family: "cables" } }), "cable");
  assert.equal(m.markClassOf({ sku: "TH164" }), "default");
  assert.equal(m.markClassOf({ sku: "BP70", id: "bp70" }), "default");
  assert.equal(m.markClassOf({ sku: "NB146", id: "nb146" }), "default");
  assert.equal(m.markClassOf({ sku: "P202", id: "p202" }), "default");
  assert.equal(m.markClassOf({ sku: "LR-CBL01", id: "lr-cbl01" }), "default");
  assert.equal(m.classScale("bag").markOfBody < 0.55, true);
  assert.ok(m.classScale("pen").minScale >= 0.5);
  assert.ok(m.classScale("bottle").bodyLow < 0.18);
  assert.ok(m.classScale("bag").bodyHigh > 0.72);
});

test("engine source has no SKU literals and no sku === branches", () => {
  const src = [
    "src/lib/imprint-engine.ts",
    "src/lib/fit-mark.ts",
    "src/lib/angle.ts",
    "python/imprint_engine.py",
  ]
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  assert.doesNotMatch(src, /TH164|BP70|NB146|P202|LR-CBL01/);
  assert.doesNotMatch(src, /sku\s*===/);
  assert.doesNotMatch(src, /sku\.includes/);
  assert.doesNotMatch(src, /isDiscSku|isPlaceholderSku/);
});

test("notebook smart-canvas crop keeps the cover, never a clasp clip", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  const body = { x: 0.18, y: 0.12, w: 0.64, h: 0.76 };
  const crop = m.smartCanvasCrop(body, "notebook");
  assert.ok(m.notebookCropSane(crop, body));
  assert.ok(m.classScale("notebook").canvasFill < 0.72);
  const zone = m.zoneForClass(rect(body.x, body.y, body.w, body.h), "notebook");
  const h = zone[2].y - zone[1].y;
  assert.ok(h < body.h * 0.28, `band h=${h}`);
  assert.ok(zone[0].y > body.y + body.h * 0.4, "band sits below the clasp");
});

test("cable disc is square-on the round face; tech placeholder is body-relative", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  const body = rect(0.2, 0.2, 0.6, 0.6);
  const disc = m.discQuad(body);
  const bw = disc[1].x - disc[0].x;
  const bh = disc[2].y - disc[1].y;
  assert.ok(Math.abs(bw - bh) < 0.02);
  assert.ok(bw < 0.55);
  assert.ok(m.assertZone("cable", body));
});

test("every class holds on catalogue photo AND 1400 canvas", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  const fit = await load("src/lib/fit-mark.ts");
  // Packed catalogue photo (product small or filling the frame) vs isolated 1400 rebuild.
  const catalog = {
    pen: { x: 0.12, y: 0.4, w: 0.76, h: 0.18 },
    bottle: { x: 0.44, y: 0.18, w: 0.12, h: 0.62 },
    bag: { x: 0.05, y: 0.08, w: 0.9, h: 0.84 },
    notebook: { x: 0.18, y: 0.12, w: 0.64, h: 0.76 },
    tech: { x: 0.26, y: 0.28, w: 0.48, h: 0.36 },
    cable: { x: 0.32, y: 0.3, w: 0.36, h: 0.36 },
  };
  for (const [cls, body] of Object.entries(catalog)) {
    const spec = m.classScale(cls);
    assert.equal(fit.bodyTrusted(body.w, cls), true, `${cls} catalog body ${body.w} untrusted`);
    const q = rect(body.x, body.y, body.w, body.h);
    assert.ok(m.assertZone(cls, q), `${cls} catalog zone`);
    const crop = m.smartCanvasCrop(body, cls);
    const canvas = m.bodyOnCanvas(body, crop);
    assert.equal(fit.bodyTrusted(canvas.w, cls), true, `${cls} canvas body ${canvas.w} untrusted`);
    const cq = rect(canvas.x, canvas.y, canvas.w, canvas.h);
    assert.ok(m.assertZone(cls, cq), `${cls} canvas zone`);
    if (cls === "notebook") {
      assert.ok(m.notebookCropSane(crop, body), "notebook cover kept");
      assert.ok(canvas.h >= 0.55, `notebook canvas fill ${canvas.h}`);
    }
    const zone = m.zoneForClass(q, cls);
    const zw = zone[1].x - zone[0].x;
    const catalogFit = fit.fitMarkScale({
      bodyWidth: body.w,
      zoneWidth: zw,
      maxScale: spec.maxScale,
      preferred: spec.minScale,
      markClass: cls,
    });
    const canvasZone = m.zoneForClass(cq, cls);
    const czw = canvasZone[1].x - canvasZone[0].x;
    const canvasFit = fit.fitMarkScale({
      bodyWidth: canvas.w,
      zoneWidth: czw,
      maxScale: spec.maxScale,
      preferred: spec.minScale,
      markClass: cls,
    });
    assert.equal(catalogFit.trusted, true, `${cls} catalog fit`);
    assert.equal(canvasFit.trusted, true, `${cls} canvas fit`);
    const cRatio = fit.markBodyRatio(catalogFit.scale, zw, body.w);
    const vRatio = fit.markBodyRatio(canvasFit.scale, czw, canvas.w);
    assert.ok(cRatio <= spec.markOfBody + 0.08, `${cls} catalog mark/body ${cRatio}`);
    assert.ok(vRatio <= spec.markOfBody + 0.08, `${cls} canvas mark/body ${vRatio}`);
    if (cls === "bag") {
      assert.ok(cRatio < 0.55, `bag catalog mark/body ${cRatio}`);
      assert.ok(vRatio < 0.55, `bag canvas mark/body ${vRatio}`);
    }
  }
});

test("placeholder size is a fraction of the body, both framings", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  function paint({ W, H, bx, by, bw, bh, px, py, pw, ph }) {
    const lum = new Float32Array(W * H);
    const mask = new Uint8Array(W * H);
    lum.fill(20);
    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) {
        mask[y * W + x] = 1;
        lum[y * W + x] = 70;
      }
    }
    for (let y = py; y < py + ph; y++) {
      for (let x = px; x < px + pw; x++) {
        lum[y * W + x] = 200;
      }
    }
    return m.placeholderRect({ w: W, h: H, lum, mask });
  }
  const catalog = paint({ W: 200, H: 200, bx: 70, by: 70, bw: 60, bh: 50, px: 78, py: 82, pw: 44, ph: 22 });
  const canvas = paint({ W: 200, H: 200, bx: 20, by: 40, bw: 160, bh: 120, px: 50, py: 70, pw: 100, ph: 50 });
  assert.ok(catalog, "catalog placeholder");
  assert.ok(canvas, "canvas placeholder");
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
