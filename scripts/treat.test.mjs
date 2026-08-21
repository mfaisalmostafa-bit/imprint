import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import * as esbuild from "esbuild";

const outfile = join(mkdtempSync(join(tmpdir(), "treat-")), "core.mjs");
await esbuild.build({
  entryPoints: ["src/lib/treat.ts"],
  bundle: true,
  format: "esm",
  outfile,
  platform: "neutral",
});
const {
  SPOT_NAVY,
  SPOT_ORANGE,
  SPOT_SWATCHES,
  keySolidBackground,
  recolorSolid,
  knockoutDarkNeutral,
  houseTreatPrint,
  isMulticolor,
  isNeutral,
} = await import(pathToFileURL(outfile).href);

function rgba(w, h, fill) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fill(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { data, width: w, height: h };
}

test("SPOT_SWATCHES navy/orange are the locked house pair, not the old fake pair", () => {
  assert.deepEqual(SPOT_NAVY, [4, 38, 63]);
  assert.deepEqual(SPOT_ORANGE, [209, 129, 46]);
  assert.deepEqual(SPOT_SWATCHES[0].rgb, [4, 38, 63]);
  assert.deepEqual(SPOT_SWATCHES[1].rgb, [209, 129, 46]);
  assert.notDeepEqual(SPOT_SWATCHES[0].rgb, [11, 31, 58]);
  assert.notDeepEqual(SPOT_SWATCHES[1].rgb, [232, 93, 4]);
});

test("colour-distance keying pulls a navy mark off a black board", () => {
  const img = rgba(40, 40, (x, y) => {
    if (x > 12 && x < 28 && y > 12 && y < 28) return [4, 38, 63, 255];
    return [8, 8, 10, 255];
  });
  assert.equal(keySolidBackground(img), true);
  const mid = (20 * 40 + 20) * 4;
  const corner = 0;
  assert.ok(img.data[mid + 3] > 200, "mark stays opaque");
  assert.ok(img.data[corner + 3] < 40, "black board goes transparent");
});

test("one-colour recolour keeps anti-aliased alpha, including light pixels", () => {
  const img = rgba(8, 8, (x) => [240, 240, 240, x < 4 ? 255 : 80]);
  recolorSolid(img, [4, 38, 63]);
  assert.equal(img.data[0], 4);
  assert.equal(img.data[1], 38);
  assert.equal(img.data[2], 63);
  assert.equal(img.data[3], 255);
  const edge = (0 * 8 + 5) * 4;
  assert.equal(img.data[edge], 4);
  assert.equal(img.data[edge + 3], 80);
});

test("multi-colour knockout keeps the red accent and whitens the dark wordmark", () => {
  const img = rgba(20, 20, (x, y) => {
    if (y > 4 && y < 10) return [18, 18, 20, 255];
    if (x > 12 && y > 12) return [200, 24, 36, 255];
    return [0, 0, 0, 0];
  });
  assert.equal(isMulticolor(img), true);
  assert.equal(isNeutral(img), false);
  knockoutDarkNeutral(img);
  const dark = (7 * 20 + 5) * 4;
  const red = (15 * 20 + 15) * 4;
  assert.equal(img.data[dark], 255);
  assert.equal(img.data[red], 200);
  assert.equal(img.data[red + 1], 24);
});

test("house rule: dark body + mono mark -> white; sublimation keeps red", () => {
  const mkRed = () =>
    rgba(16, 16, (x, y) => (x > 4 && y > 4 ? [180, 20, 30, 255] : [0, 0, 0, 0]));
  const redOnDark = mkRed();
  houseTreatPrint(redOnDark, { substrateLum: 40, method: "sublimation" });
  const i = (8 * 16 + 8) * 4;
  assert.equal(redOnDark.data[i], 180);

  const blackWord = rgba(16, 16, (x, y) => (x > 4 && y > 4 ? [22, 22, 24, 255] : [0, 0, 0, 0]));
  houseTreatPrint(blackWord, { substrateLum: 40, method: "uv_print" });
  assert.equal(blackWord.data[i], 255);
});
