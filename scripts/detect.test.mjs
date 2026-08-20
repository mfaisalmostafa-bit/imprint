import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import * as esbuild from "esbuild";

const outfile = join(mkdtempSync(join(tmpdir(), "detect-")), "core.mjs");
await esbuild.build({
  entryPoints: ["src/lib/detect-core.ts"],
  bundle: true,
  format: "esm",
  outfile,
  platform: "neutral",
});
const { detectFromRgb } = await import(pathToFileURL(outfile).href);

function buffers(w, h, fill) {
  const r = new Float32Array(w * h);
  const g = new Float32Array(w * h);
  const b = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [cr, cg, cb] = fill(x, y);
      const i = y * w + x;
      r[i] = cr;
      g[i] = cg;
      b[i] = cb;
    }
  }
  return { w, h, r, g, b };
}

const W = 120;
const H = 120;
const paper = () => [248, 248, 246];

test("empty sweep is refused", () => {
  const d = detectFromRgb(buffers(W, H, () => paper()));
  assert.equal(d.accepted, false);
  assert.ok(d.confidence < 0.25);
});

test("synthetic taper keeps 0.20 top / 0.50 bottom", () => {
  const trap = buffers(W, H, (x, y) => {
    const yn = y / (H - 1);
    if (yn < 0.18 || yn > 0.86) return paper();
    const t = (yn - 0.18) / (0.86 - 0.18);
    const half = (0.2 + (0.5 - 0.2) * t) / 2;
    const xn = x / (W - 1);
    if (Math.abs(xn - 0.5) <= half) return [42, 44, 48];
    return paper();
  });
  const d = detectFromRgb(trap);
  assert.equal(d.accepted, true);
  assert.ok(Math.abs(d.topWidth - 0.2) < 0.07, `topWidth=${d.topWidth}`);
  assert.ok(Math.abs(d.botWidth - 0.5) < 0.08, `botWidth=${d.botWidth}`);
});

test("wide off-centre body is not centre-clipped", () => {
  const wide = buffers(W, H, (x, y) => {
    const xn = x / (W - 1);
    const yn = y / (H - 1);
    if (yn > 0.2 && yn < 0.8 && xn > 0.04 && xn < 0.62) return [30, 32, 36];
    return paper();
  });
  const d = detectFromRgb(wide);
  assert.equal(d.accepted, true);
  assert.ok(d.quad[0].x < 0.14, `tlx=${d.quad[0].x}`);
  assert.ok(d.quad[1].x > 0.48, `trx=${d.quad[1].x}`);
});

test("baked-in logo hole does not punch the plane", () => {
  const logoed = buffers(W, H, (x, y) => {
    const xn = x / (W - 1);
    const yn = y / (H - 1);
    if (yn > 0.22 && yn < 0.78 && xn > 0.28 && xn < 0.72) {
      if (Math.abs(xn - 0.5) < 0.08 && Math.abs(yn - 0.5) < 0.08) return paper();
      return [36, 38, 42];
    }
    return paper();
  });
  const d = detectFromRgb(logoed);
  assert.equal(d.accepted, true);
  assert.ok(d.quad[2].y - d.quad[0].y > 0.35);
});
