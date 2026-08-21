import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import * as esbuild from "esbuild";

function walk(dir, acc = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${name.name}`;
    if (name.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|mjs|sql)$/.test(name.name)) acc.push(p);
  }
  return acc;
}

const srcBlob = walk("src").map((p) => readFileSync(p, "utf8")).join("\n");
const engineSrc = readFileSync("src/lib/engine.ts", "utf8");
const reviewSrc = readFileSync("src/components/jobs/review.tsx", "utf8");
const stageSrc = readFileSync("src/components/studio/stage-canvas.tsx", "utf8");
const placeWin = readFileSync("src/components/jobs/place-window.tsx", "utf8");
const jobsApp = readFileSync("src/components/jobs/app.tsx", "utf8");
const searchUi = readFileSync("src/components/jobs/search.tsx", "utf8");
const opticsSrc = readFileSync("src/lib/optics-audit.ts", "utf8");
const apiSrc = readFileSync("src/lib/placement-api.ts", "utf8");
const mig = readFileSync("migrations/0002_placement_overrides.sql", "utf8");

async function load(entry) {
  const outfile = join(mkdtempSync(join(tmpdir(), "j-")), "core.mjs");
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    outfile,
    platform: "neutral",
  });
  return import(pathToFileURL(outfile).href);
}

test("home is three jobs, not twenty tabs", () => {
  assert.match(jobsApp, /id: "review"/);
  assert.match(jobsApp, /id: "optics"/);
  assert.match(jobsApp, /id: "search"/);
  assert.doesNotMatch(jobsApp, /My Day|Cockpit|Robots/);
  const ids = [...jobsApp.matchAll(/id: "([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ["review", "optics", "search"]);
});

test("command center still exists at /cc", () => {
  assert.match(readFileSync("src/routes/cc.tsx", "utf8"), /CommandCenter/);
  assert.match(jobsApp, /href="\/cc"/);
});

test("supplier names never reach client-visible copy", () => {
  assert.doesNotMatch(srcBlob, /Beacon|Azab|Platinum|Sameh|Catalyst|Midocean|PfConcept/i);
  assert.doesNotMatch(srcBlob, /\bParker\b|\bBIC\b/i);
});

test("decoration methods stay locked to the five TePee-X sells", () => {
  assert.doesNotMatch(srcBlob, /id: "pad_print"|id: "screen_print"|id: "deboss"|id: "emboss"|id: "foil"/);
  assert.match(readFileSync("src/lib/methods.ts", "utf8"), /uv_print/);
  assert.match(readFileSync("src/lib/methods.ts", "utf8"), /uv_dtf/);
});

test("price 0 is never flagged", () => {
  assert.doesNotMatch(srcBlob, /price === 0|zero price|price is 0/i);
});

test("brand navy and orange have one source", () => {
  const brand = readFileSync("src/lib/brand.ts", "utf8");
  assert.match(brand, /#04263F/);
  assert.match(brand, /#D1812E/);
});

test("engine quad is TL TR BR BL in 0-1", async () => {
  const e = await load("src/lib/engine.ts");
  const q = [
    { x: 0.1, y: 0.2 },
    { x: 0.9, y: 0.2 },
    { x: 0.9, y: 0.8 },
    { x: 0.1, y: 0.8 },
  ];
  const eng = e.quadToEngine(q);
  assert.deepEqual(eng[0], [0.1, 0.2]);
  assert.deepEqual(eng[1], [0.9, 0.2]);
  assert.deepEqual(eng[2], [0.9, 0.8]);
  assert.deepEqual(eng[3], [0.1, 0.8]);
  assert.deepEqual(e.engineToQuad(eng), q);
});

test("save without the phrase is refused", async () => {
  const e = await load("src/lib/engine.ts");
  const q = [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ];
  const blank = e.saveOverride("TPX-PEN-01", q, "cylinder", 1.1, "");
  assert.equal(blank.ok, false);
  assert.equal(blank.required, "SAVE PLACEMENT OVERRIDE");
  const nope = e.saveOverride("TPX-PEN-01", q, "cylinder", 1.1, "please");
  assert.equal(nope.ok, false);
  const ok = e.saveOverride("TPX-PEN-01", q, "cylinder", 1.1, "SAVE PLACEMENT OVERRIDE");
  assert.equal(ok.ok, true);
  assert.equal(ok.doc._sku, "TPX-PEN-01");
  assert.equal(ok.doc.surface, "cylinder");
});

test("custom photos cannot be saved as a SKU override", async () => {
  const e = await load("src/lib/engine.ts");
  const q = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const r = e.saveOverride("CUSTOM", q, "plane", 0, "SAVE PLACEMENT OVERRIDE");
  assert.equal(r.ok, false);
});

test("placement persist is shared SQL, not browser-local", () => {
  assert.doesNotMatch(engineSrc, /localStorage/);
  assert.match(apiSrc, /placement_overrides/);
  assert.match(apiSrc, /persistOverride/);
  assert.doesNotMatch(apiSrc, /authMiddleware|requireUserId|user_id/);
  assert.doesNotMatch(mig, /user_id\s/);
  assert.doesNotMatch(mig, /delete from placement_overrides/);
  assert.match(reviewSrc, /persistOverride/);
  assert.match(reviewSrc, /SAVE_PHRASE/);
  assert.match(reviewSrc, /phrase !== SAVE_PHRASE/);
  assert.match(engineSrc, /SAVE PLACEMENT OVERRIDE/);
});

test("touch handles are at least 44px", () => {
  assert.match(stageSrc, /size-11/);
  assert.match(stageSrc, /after:size-12/);
  assert.match(placeWin, /Reset to detected/);
});

test("Place is the main job and the placement window can minimise", () => {
  assert.match(jobsApp, /label: "Place"/);
  assert.match(reviewSrc, /Open placement window/);
  assert.match(placeWin, /Minimise placement window/);
  assert.match(stageSrc, /Placement zoom window/);
  assert.match(stageSrc, /Move edge/);
  assert.match(placeWin, /md:w-80/);
  assert.match(placeWin, /CORNER_LABELS/);
  assert.match(placeWin, /Placement zoom window/);
  assert.match(placeWin, /click to place/);
  assert.match(stageSrc, /click to place/);
  assert.match(placeWin, /Catalog angle/);
});

test("placement math moves corners, edges, and refuses a concave quad", async () => {
  const p = await load("src/lib/place.ts");
  const q = [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ];
  const c = p.moveCorner(q, 0, { x: 0.25, y: 0.25 });
  assert.equal(c[0].x, 0.25);
  const e = p.moveEdge(q, 0, 0, 0.1);
  assert.ok(Math.abs(e[0].y - 0.3) < 1e-9);
  assert.ok(Math.abs(e[1].y - 0.3) < 1e-9);
  const bad = p.moveCorner(q, 0, { x: 0.9, y: 0.9 });
  assert.equal(bad, null);
  const t = p.translateQuad(q, 0.1, 0);
  assert.ok(t[0].x > q[0].x);
  const n = p.nudgeCorner(q, 1, 1, 0, false);
  assert.ok(n[1].x > q[1].x);
  assert.equal(p.pointInQuad(q, { x: 0.5, y: 0.5 }), true);
  assert.equal(p.pointInQuad(q, { x: 0.01, y: 0.01 }), false);
  const mid = p.loupeToWorld({ x: 0.4, y: 0.4 }, 0.5, 0.5, 1000, 1000, 5);
  assert.ok(Math.abs(mid.x - 0.4) < 1e-9);
  assert.ok(Math.abs(mid.y - 0.4) < 1e-9);
  const right = p.loupeToWorld({ x: 0.4, y: 0.4 }, 1, 0.5, 1000, 1000, 5);
  assert.ok(right.x > 0.4);
  const back = p.worldToLoupe(right, { x: 0.4, y: 0.4 }, 1000, 1000, 5, 240);
  assert.ok(Math.abs(back.x - 240) < 1e-6);
});

test("interpretHits: 40% is not a lock, 95% is", async () => {
  const m = await load("src/lib/photo-search.ts");
  const hit = (sku, score) => ({ sku, name: sku, src: "/", score });
  const weak = m.interpretHits([hit("TPX-PEN-01", 0.4), hit("TPX-FLK-01", 0.2)]);
  assert.equal(weak.judged, false);
  assert.notEqual(weak.kind, "winner");
  assert.equal(m.isLock(weak), false);
  const mid = m.interpretHits([hit("TPX-PEN-01", 0.7), hit("TPX-FLK-01", 0.4)]);
  assert.equal(mid.judged, true);
  assert.equal(mid.kind, "weak");
  assert.equal(m.isLock(mid), false);
  const win = m.interpretHits([hit("TPX-PEN-01", 0.95), hit("TPX-FLK-01", 0.7)]);
  assert.equal(win.kind, "winner");
  assert.equal(m.isLock(win), true);
});

test("cluster when leaders are within 0.06", async () => {
  const m = await load("src/lib/photo-search.ts");
  const hit = (sku, score) => ({ sku, name: sku, src: "/", score });
  const clustered = m.interpretHits([hit("TPX-PEN-01", 0.9), hit("TPX-USB-01", 0.86)]);
  assert.equal(clustered.kind, "cluster");
  assert.match(clustered.note, /too close to separate/);
  assert.equal(m.isLock(clustered), false);
});

function solid(w, h, r, g, b) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { w, h, data, naturalW: w, naturalH: h };
}

function checker(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const on = ((x / 8) | 0) % 2 !== ((y / 8) | 0) % 2;
      const i = (y * w + x) * 4;
      const v = on ? 240 : 20;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { w, h, data, naturalW: w, naturalH: h };
}

test("inspectQuery refuses blur, dark, empty, far before ranking", async () => {
  const m = await load("src/lib/photo-search.ts");
  assert.equal(m.inspectQuery(null).code, "empty");
  assert.equal(m.inspectQuery(solid(200, 200, 4, 4, 4)).code, "dark");
  assert.equal(m.inspectQuery(solid(40, 40, 200, 200, 200)).code, "far");
  const blur = solid(200, 200, 180, 180, 180);
  assert.equal(m.inspectQuery(blur).code, "blur");
  assert.equal(m.inspectQuery(checker(200, 200)), null);
});

test("multiple photos of one item become one answer", async () => {
  const m = await load("src/lib/photo-search.ts");
  const hit = (sku, score) => ({ sku, name: sku, src: "/", score });
  const a = m.interpretHits([hit("TPX-PEN-01", 0.95), hit("TPX-FLK-01", 0.4)]);
  const b = m.interpretHits([hit("TPX-PEN-01", 0.9), hit("TPX-FLK-01", 0.5)]);
  const merged = m.mergeQueries([a, b]);
  assert.equal(merged.judged, true);
  assert.equal(merged.hits[0].sku, "TPX-PEN-01");
  assert.equal(m.isLock(merged), true);
});

test("It fits is disabled unless the answer is a winner", () => {
  assert.match(searchUi, /disabled=\{!lock\}/);
  assert.match(searchUi, /Refused before ranking/);
});

test("optics findings use catalogue photos and do not patch Python", () => {
  assert.match(opticsSrc, /\/mockups\/pen\.jpg/);
  assert.match(opticsSrc, /\/mockups\/award\.jpg/);
  assert.match(opticsSrc, /\/mockups\/cup\.jpg/);
  assert.match(readFileSync("src/components/jobs/optics.tsx", "utf8"), /We do not patch their Python/);
  assert.doesNotMatch(srcBlob, /render_engrave\s*=/);
});

test("no retrying copy unless something retries", () => {
  assert.doesNotMatch(jobsApp + reviewSrc + searchUi, /retrying/i);
});

test("auto mark size uses a high-side body guard", () => {
  const fit = readFileSync("src/lib/fit-mark.ts", "utf8");
  const store = readFileSync("src/lib/store.ts", "utf8");
  assert.match(fit, /BODY_HIGH = 0.95/);
  assert.match(fit, /DEAD_IMAGE_CAP/);
  assert.match(store, /fitMarkScale/);
  assert.match(store, /bodyTrusted/);
});
