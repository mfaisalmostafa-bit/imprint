import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import * as esbuild from "esbuild";

async function load() {
  const outfile = join(mkdtempSync(join(tmpdir(), "ps-")), "core.mjs");
  await esbuild.build({
    entryPoints: ["src/lib/photo-search.ts"],
    bundle: true,
    format: "esm",
    outfile,
    platform: "neutral",
  });
  return import(pathToFileURL(outfile).href);
}

function canvas(w, h, bg) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = 255;
  }
  return { w, h, data, naturalW: w, naturalH: h };
}

function paint(buf, x0, y0, x1, y1, col) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * buf.w + x) * 4;
      buf.data[i] = col[0];
      buf.data[i + 1] = col[1];
      buf.data[i + 2] = col[2];
    }
  }
}

function tumbler(w, h, cream, table = true) {
  const buf = canvas(w, h, table ? [120, 78, 36] : [245, 245, 245]);
  const col = cream ? [228, 216, 198] : [22, 22, 24];
  paint(buf, (w * 0.38) | 0, (h * 0.2) | 0, (w * 0.62) | 0, (h * 0.82) | 0, col);
  paint(buf, (w * 0.38) | 0, (h * 0.2) | 0, (w * 0.62) | 0, ((h * 0.2) | 0) + Math.max(3, (h * 0.08) | 0), cream ? [200, 120, 40] : [8, 8, 8]);
  return buf;
}

function flask(w, h, digital = false) {
  const buf = canvas(w, h, [8, 8, 10]);
  paint(buf, (w * 0.42) | 0, (h * 0.1) | 0, (w * 0.58) | 0, (h * 0.88) | 0, [18, 18, 20]);
  if (digital) {
    paint(
      buf,
      ((w * 0.42) | 0) + 2,
      ((h * 0.1) | 0) + 2,
      ((w * 0.58) | 0) - 2,
      ((h * 0.1) | 0) + ((h * 0.12) | 0),
      [40, 180, 220],
    );
  }
  return buf;
}

function bottle(w, h) {
  const buf = canvas(w, h, [240, 240, 238]);
  paint(buf, (w * 0.44) | 0, (h * 0.08) | 0, (w * 0.56) | 0, (h * 0.9) | 0, [28, 28, 30]);
  return buf;
}

function brick(w, h, white) {
  const buf = canvas(w, h, [40, 40, 42]);
  paint(buf, (w * 0.32) | 0, (h * 0.28) | 0, (w * 0.68) | 0, (h * 0.72) | 0, white ? [236, 236, 234] : [24, 24, 26]);
  return buf;
}

function pad(w, h) {
  const buf = canvas(w, h, [230, 230, 228]);
  paint(buf, (w * 0.22) | 0, (h * 0.3) | 0, (w * 0.78) | 0, (h * 0.7) | 0, [210, 210, 208]);
  return buf;
}

function row(m, sku, name, category, buf) {
  return {
    sku,
    name,
    category,
    src: "/",
    family: m.familyOf({ category, name }),
    feat: m.describePhoto(buf),
  };
}

test("family from category and name, never SKU", async () => {
  const m = await load();
  assert.equal(m.familyOf({ category: "Drinkware", name: "Brewbuddy tumbler" }), "tumbler");
  assert.equal(m.familyOf({ category: "Drinkware", name: "Shinny Digital Thermal Flask" }), "flask");
  assert.equal(m.familyOf({ category: "Tech", name: "Limestone Wireless Charger" }), "charger");
  assert.equal(m.familyOf({ category: "Tech", name: "Power Bank 5000mAh Compact" }), "powerbank");
  const src = readFileSync("src/lib/photo-search.ts", "utf8");
  assert.doesNotMatch(src, /sku\s*===\s*['"]/);
  assert.doesNotMatch(src, /TH164|BP70|NB146/);
});

test("cream tumbler on wood does not lock black drinkware, both framings", async () => {
  const m = await load();
  for (const size of [80, 140]) {
    const q = m.describePhoto(tumbler(size, size, true, true));
    const catalog = [
      row(m, "TM176", "Brewbuddy tumbler", "Drinkware", tumbler(size, size, false, false)),
      row(m, "FK-DG-SHN", "Shinny Digital Thermal Flask", "Drinkware", flask(size, size, true)),
      row(m, "F18", "Stainless Steel Vacuum Bottle", "Drinkware", bottle(size, size)),
    ];
    const embed = catalog.map((c) => ({ sku: c.sku, score: 0.56 }));
    const hits = m.rankHits(q, catalog, embed);
    const ans = m.interpretHits(hits);
    assert.equal(m.isLock(ans), false);
    assert.notEqual(ans.kind, "winner");
  }
});

test("white power bank drops the wireless pad", async () => {
  const m = await load();
  for (const size of [80, 140]) {
    const q = m.describePhoto(brick(size, size, true));
    const catalog = [
      row(m, "PWB-2", "Power Bank 5000mAh Compact", "Tech", brick(size, size, false)),
      row(m, "CE-WC2", "Limestone Wireless Charger", "Tech", pad(size, size)),
      row(m, "P-1111", "Power Bank 10000mAh", "Tech", brick(size, size, true)),
    ];
    const embed = [
      { sku: "PWB-2", score: 0.67 },
      { sku: "CE-WC2", score: 0.63 },
      { sku: "P-1111", score: 0.62 },
    ];
    const hits = m.rankHits(q, catalog, embed);
    assert.equal(hits.some((h) => h.sku === "CE-WC2"), false);
    assert.equal(hits[0].sku, "P-1111");
  }
});

test("identical flask locks; 56% is not a lock", async () => {
  const m = await load();
  const buf = flask(96, 96, true);
  const q = m.describePhoto(buf);
  const ans = m.interpretHits(m.rankHits(q, [row(m, "FLK", "Digital Thermal Flask", "Drinkware", buf)]));
  assert.equal(m.isLock(ans), true);
  const weak = m.interpretHits([
    { sku: "X", name: "X", src: "/", score: 0.56, familyAgree: true, colorCap: false },
    { sku: "Y", name: "Y", src: "/", score: 0.53, familyAgree: true, colorCap: false },
  ]);
  assert.equal(m.isLock(weak), false);
});

test("It fits stays disabled unless the answer is a winner", () => {
  const ui = readFileSync("src/components/jobs/search.tsx", "utf8");
  assert.match(ui, /disabled=\{!lock\}/);
  assert.match(ui, /Refused before ranking/);
  assert.match(ui, /Find the products/);
});
