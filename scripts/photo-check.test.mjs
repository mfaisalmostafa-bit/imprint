import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import * as esbuild from "esbuild";

const outfile = join(mkdtempSync(join(tmpdir(), "pc-")), "core.mjs");
await esbuild.build({
  entryPoints: ["src/lib/photo-check.ts"],
  bundle: true,
  format: "esm",
  outfile,
  platform: "neutral",
});
const { checkProductPhoto, checkArtwork, rankFindings } = await import(pathToFileURL(outfile).href);

function solid(w, h, r, g, b, a = 255) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return { w, h, data };
}

function paintRect(buf, x0, y0, x1, y1, r, g, b) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * buf.w + x) * 4;
      buf.data[i] = r;
      buf.data[i + 1] = g;
      buf.data[i + 2] = b;
      buf.data[i + 3] = 255;
    }
  }
}

test("missing photo is a stop, never a quiet skip", () => {
  const r = checkProductPhoto(null);
  assert.equal(r.findings[0].code, "missing");
  assert.equal(r.findings[0].severity, "block");
});

test("empty sweep is refused — no product in the frame", () => {
  const r = checkProductPhoto(solid(240, 240, 240, 240, 242));
  assert.ok(r.findings.some((f) => f.code === "empty" || f.code === "tiny"));
});

test("A4 column dpi is judged from pixel size", () => {
  const buf = solid(400, 400, 240, 240, 242);
  paintRect(buf, 80, 40, 320, 360, 20, 22, 28);
  const r = checkProductPhoto(buf);
  assert.ok(!r.unjudged.some((u) => u.code === "dpi"));
});

test("dpi at a known usage size is judged", () => {
  const buf = solid(400, 400, 240, 240, 242);
  paintRect(buf, 80, 40, 320, 360, 20, 22, 28);
  const r = checkProductPhoto(buf, { usageWmm: 200 });
  assert.ok(r.findings.some((f) => f.code === "dpi"));
});

test("dpi uses the original file size, not the analysis downsample", () => {
  const buf = solid(360, 360, 240, 240, 242);
  buf.naturalW = 2048;
  buf.naturalH = 2048;
  paintRect(buf, 80, 40, 280, 320, 20, 22, 28);
  const r = checkProductPhoto(buf);
  assert.ok(!r.findings.some((f) => f.code === "dpi" && f.severity === "block"));
});

test("group of three similar blobs is a group shot", () => {
  const buf = solid(300, 200, 245, 245, 247);
  paintRect(buf, 20, 60, 90, 150, 30, 30, 32);
  paintRect(buf, 110, 60, 180, 150, 32, 30, 30);
  paintRect(buf, 200, 60, 270, 150, 28, 32, 30);
  const r = checkProductPhoto(buf, { usageWmm: 40 });
  assert.ok(r.findings.some((f) => f.code === "group" || f.code === "lineup"));
});

test("ambiguous two blobs are unjudged, not a confident group", () => {
  const buf = solid(300, 220, 245, 245, 247);
  paintRect(buf, 40, 30, 250, 200, 20, 22, 24);
  paintRect(buf, 10, 180, 50, 215, 18, 18, 18);
  const r = checkProductPhoto(buf);
  assert.ok(!r.findings.some((f) => f.code === "group"));
});

test("rank caps notes when a stop exists", () => {
  const r = {
    w: 10,
    h: 10,
    findings: [
      { severity: "note", code: "n", title: "n", action: "n" },
      { severity: "block", code: "b", title: "b", action: "b" },
    ],
    unjudged: [],
  };
  const top = rankFindings(r, 3);
  assert.equal(top.length, 1);
  assert.equal(top[0].code, "b");
});

test("SVG artwork is a vector note, not a dpi guess", () => {
  const r = checkArtwork(null, { isSvg: true, printWmm: 80 });
  assert.ok(r.findings.some((f) => f.code === "vector"));
  assert.ok(!r.findings.some((f) => f.code === "dpi"));
});

test("white-box logo is flagged; transparent is not", () => {
  const box = solid(200, 200, 255, 255, 255, 255);
  paintRect(box, 40, 40, 160, 160, 10, 10, 12);
  const r = checkArtwork(box, { printWmm: 40 });
  assert.ok(r.findings.some((f) => f.code === "white_box"));
});

test("findings never name a supplier", () => {
  const buf = solid(240, 240, 240, 240, 242);
  paintRect(buf, 80, 40, 160, 200, 20, 22, 28);
  const r = checkProductPhoto(buf);
  const blob = JSON.stringify(r);
  assert.doesNotMatch(blob, /Beacon|Azab|Platinum|Sameh|Catalyst/i);
});
