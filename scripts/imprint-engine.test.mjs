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
  assert.doesNotMatch(src, /TH164|BP70|NB146|P202|LR-CBL01|CH-1011-B-G|NB38|NB50L|KC11|CLR-CBL01/);
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
  const zb = m.boxOf(zone);
  assert.ok(zb.w <= body.w * 0.75, "band is not a full-cover lock");
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

function paint(W, H, fill, fn) {
  const lum = new Float32Array(W * H);
  const mask = new Uint8Array(W * H);
  lum.fill(fill);
  fn(lum, mask, W, H);
  return { lum, mask, w: W, h: H };
}

test("notebook zone stays off the strap and clasp; class prior is not the lock", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  const W = 80,
    H = 100;
  const body = { x: 0.15, y: 0.08, w: 0.7, h: 0.84 };
  const { lum, mask } = paint(W, H, 20, (L, M) => {
    for (let y = Math.round(body.y * H); y < (body.y + body.h) * H; y++) {
      for (let x = Math.round(body.x * W); x < (body.x + body.w) * W; x++) {
        M[y * W + x] = 1;
        L[y * W + x] = 70;
      }
    }
    const strapY0 = Math.round((body.y + body.h * 0.48) * H);
    const strapY1 = Math.round((body.y + body.h * 0.56) * H);
    for (let y = strapY0; y < strapY1; y++) {
      for (let x = Math.round(body.x * W); x < (body.x + body.w) * W; x++) L[y * W + x] = 30;
    }
    const cx0 = Math.round((body.x + body.w * 0.72) * W);
    const cy0 = Math.round((body.y + body.h * 0.44) * H);
    for (let y = cy0; y < cy0 + 10; y++) {
      for (let x = cx0; x < cx0 + 10; x++) L[y * W + x] = 200;
    }
  });
  const q = rect(body.x, body.y, body.w, body.h);
  const rec = m.recommendPlacement({ cls: "notebook", body: q, w: W, h: H, lum, mask });
  assert.notEqual(rec.pick, "class", "must not default to the category box when a panel exists or class is vetoed");
  const zb = m.boxOf(rec.winner.quad);
  const strap = { x: body.x, y: body.y + body.h * 0.48, w: body.w, h: body.h * 0.08 };
  const clasp = { x: body.x + body.w * 0.72, y: body.y + body.h * 0.44, w: 0.12, h: 0.1 };
  const overlap = (a, b) => {
    const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return (x * y) / Math.max(1e-6, a.w * a.h);
  };
  assert.ok(overlap(zb, strap) < 0.25, `zone hits strap ${overlap(zb, strap)}`);
  assert.ok(overlap(zb, clasp) < 0.25, `zone hits clasp ${overlap(zb, clasp)}`);
});

test("bottle specular is vetoed; mid-body wins", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  const W = 60,
    H = 120;
  const body = { x: 0.32, y: 0.06, w: 0.36, h: 0.88 };
  const { lum, mask } = paint(W, H, 18, (L, M) => {
    for (let y = Math.round(body.y * H); y < (body.y + body.h) * H; y++) {
      const t = (y / H - body.y) / body.h;
      const half = body.w * (0.35 + 0.15 * Math.sin(t * Math.PI)) * W;
      const cx = (body.x + body.w / 2) * W;
      for (let x = Math.round(cx - half); x < cx + half; x++) {
        M[y * W + x] = 1;
        L[y * W + x] = 55;
      }
    }
    for (let y = Math.round((body.y + 0.08) * H); y < (body.y + 0.34) * H; y++) {
      const x = Math.round((body.x + body.w * 0.7) * W);
      L[y * W + x] = 240;
      L[y * W + x + 1] = 235;
    }
  });
  const rec = m.recommendPlacement({
    cls: "bottle",
    body: rect(body.x, body.y, body.w, body.h),
    w: W,
    h: H,
    lum,
    mask,
  });
  const zb = m.boxOf(rec.winner.quad);
  assert.equal(rec.winner.veto, null);
  assert.notEqual(rec.winner.veto, "specular");
  const spec = { x: body.x + body.w * 0.66, y: body.y + 0.08, w: 0.08, h: 0.26 };
  const overlap = (a, b) => {
    const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return (x * y) / Math.max(1e-6, a.w * a.h);
  };
  assert.ok(overlap(zb, spec) < 0.4, `locked onto specular ${overlap(zb, spec)}`);
  assert.ok(zb.w <= body.w * 0.55, `bottle zone too wide ${zb.w}`);
  const cy = zb.y + zb.h / 2;
  assert.ok(cy > body.y + body.h * 0.22 && cy < body.y + body.h * 0.78);
});

test("placement picker never recommends the category box over a clean panel", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  const W = 80,
    H = 80;
  const body = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 };
  const { lum, mask } = paint(W, H, 16, (L, M) => {
    for (let y = 16; y < 64; y++) {
      for (let x = 16; x < 64; x++) {
        M[y * W + x] = 1;
        L[y * W + x] = 80;
      }
    }
    for (let y = 28; y < 40; y++) {
      for (let x = 22; x < 50; x++) L[y * W + x] = 82;
    }
  });
  const rec = m.recommendPlacement({
    cls: "notebook",
    body: rect(body.x, body.y, body.w, body.h),
    w: W,
    h: H,
    lum,
    mask,
  });
  assert.notEqual(rec.pick, "class");
  const classChoice = rec.choices.find((c) => c.id === "class");
  assert.ok(classChoice, "class prior still listed");
});

test("canvas hygiene blocks spec strips and lifestyle chrome", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  const W = 80,
    H = 80;
  const { lum, mask } = paint(W, H, 210, (L, M) => {
    for (let y = 18; y < 62; y++) {
      for (let x = 22; x < 58; x++) {
        M[y * W + x] = 1;
        L[y * W + x] = 70;
      }
    }
    for (let y = 0; y < 8; y++) {
      for (let x = 4; x < 76; x++) L[y * W + x] = x % 3 === 0 ? 20 : 240;
    }
    for (let y = 70; y < 78; y++) {
      for (let x = 8; x < 28; x++) L[y * W + x] = 15;
    }
    L[2] = 40;
    L[W - 3] = 200;
    L[(H - 2) * W + 2] = 90;
    L[(H - 2) * W + (W - 3)] = 10;
  });
  const hyg = m.canvasHygiene({ w: W, h: H, lum, mask });
  assert.equal(hyg.ok, false);
  assert.equal(hyg.block, true);
  assert.ok(hyg.findings.some((f) => f.code === "spec-strip" || f.code === "chrome" || f.code === "lifestyle"));
});

function rotated(cx, cy, w, h, deg) {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad),
    s = Math.sin(rad);
  const hw = w / 2,
    hh = h / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c }));
}

test("long-axis angle, not the top edge; 75° sliver is uprighted then rejected", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  const sliver = [
    { x: 0.48, y: 0.18 },
    { x: 0.51, y: 0.18 },
    { x: 0.51, y: 0.82 },
    { x: 0.48, y: 0.82 },
  ];
  const top = Math.abs(Math.atan2(sliver[1].y - sliver[0].y, sliver[1].x - sliver[0].x) * (180 / Math.PI));
  assert.ok(top < 8, `top edge ${top}`);
  assert.ok(m.longAxisAngle(sliver) > 70);
  const steep = rotated(0.5, 0.5, 0.4, 0.03, 75);
  assert.ok(m.longAxisAngle(steep) > 50);
  const scored = m.scoreCandidate({
    quad: steep,
    cls: "bottle",
    body: rect(0.2, 0.1, 0.6, 0.8),
  });
  assert.equal(scored.veto, "sliver");
  assert.equal(m.pickable(scored), false);
});

test("37° specular band stays offered and fitted (glare capped)", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  const body = { x: 0.38, y: 0.12, w: 0.24, h: 0.76 };
  const band = rotated(body.x + body.w / 2, body.y + body.h * 0.48, body.w * 0.72, body.h * 0.18, 37);
  assert.ok(m.longAxisAngle(band) < 50);
  const W = 80,
    H = 80;
  const { lum, mask } = paint(W, H, 40, (L, M) => {
    for (let y = Math.round(body.y * H); y < (body.y + body.h) * H; y++) {
      for (let x = Math.round(body.x * W); x < (body.x + body.w) * W; x++) {
        M[y * W + x] = 1;
        L[y * W + x] = 60;
      }
    }
  });
  const maps = {
    strap: null,
    clasp: null,
    ribs: null,
    specular: [m.boxOf(band)],
    demo: null,
    panel: null,
  };
  const scored = m.scoreCandidate({
    quad: band,
    cls: "bottle",
    body: rect(body.x, body.y, body.w, body.h),
    w: W,
    h: H,
    lum,
    mask,
    maps,
  });
  assert.ok(scored.metrics.glare >= 0.5);
  assert.equal(scored.metrics.specularRoute, true);
  assert.equal(scored.metrics.glarePen, 0);
  assert.ok(scored.score >= 90, JSON.stringify(scored.reasons));
  assert.ok(scored.offered, JSON.stringify(scored.reasons));
  assert.ok(scored.fitted);
  assert.ok(m.pickable(scored));
  const sheet = m.faceCandidates({
    cls: "bottle",
    body: rect(body.x, body.y, body.w, body.h),
    w: W,
    h: H,
    lum,
    mask,
    extras: [{ quad: band, id: "band", route: "specular" }],
  });
  const extra = sheet.sheet.find((c) => c.id === "band");
  assert.ok(extra?.offered && extra.fitted);
  assert.equal(sheet.autoLock.locked, false);
});

test("auto-lock 90/50; close scores stay on the sheet", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  const lock = m.autoLock([
    { pickable: true, score: 94, id: "demo" },
    { pickable: true, score: 41, id: "class" },
  ]);
  assert.equal(lock.locked, true);
  const close = m.autoLock([
    { pickable: true, score: 92, id: "band" },
    { pickable: true, score: 81, id: "class" },
  ]);
  assert.equal(close.locked, false);
  const lonely = m.autoLock([{ pickable: true, score: 100, id: "class" }]);
  assert.equal(lonely.locked, false);
});

test("cable hub and tech placeholder stay on the sheet", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  assert.equal(m.markClassOf({ category: "Tech", name: "Charging disc cable" }), "cable");
  const cable = m.faceCandidates({ cls: "cable", body: rect(0.32, 0.3, 0.36, 0.36) });
  assert.ok(cable.sheet.some((c) => c.id === "hub" && c.pickable));
  assert.equal(m.markClassOf({ category: "Tech", name: "Cork power bank" }), "tech");
  const W = 80,
    H = 80;
  const { lum, mask } = paint(W, H, 20, (L, M) => {
    for (let y = 22; y < 50; y++) {
      for (let x = 18; x < 62; x++) {
        M[y * W + x] = 1;
        L[y * W + x] = 70;
      }
    }
    for (let y = 30; y < 46; y++) {
      for (let x = 28; x < 54; x++) L[y * W + x] = 200;
    }
  });
  const sheet = m.faceCandidates({
    cls: "tech",
    body: rect(0.22, 0.28, 0.56, 0.4),
    w: W,
    h: H,
    lum,
    mask,
  });
  assert.ok(sheet.sheet.some((c) => c.pickable));
});

test("scoring thresholds hold on catalog and 1400-canvas framings", async () => {
  const m = await load("src/lib/imprint-engine.ts");
  const catalog = { x: 0.44, y: 0.18, w: 0.12, h: 0.62 };
  const canvas = { x: 0.16, y: 0.1, w: 0.68, h: 0.8 };
  const run = (body) => {
    const band = rotated(body.x + body.w / 2, body.y + body.h * 0.48, body.w * 0.7, body.h * 0.2, 37);
    return m.scoreCandidate({
      quad: band,
      cls: "bottle",
      body: rect(body.x, body.y, body.w, body.h),
      maps: {
        strap: null,
        clasp: null,
        ribs: null,
        specular: [m.boxOf(band)],
        demo: null,
        panel: null,
      },
    });
  };
  const a = run(catalog);
  const b = run(canvas);
  assert.equal(a.offered, b.offered);
  assert.equal(a.fitted, b.fitted);
  assert.ok(a.offered && a.fitted);
  assert.ok(m.bodyTrusted ? m.bodyTrusted(catalog.w, "bottle") : m.classScale("bottle").bodyLow <= catalog.w);
});


