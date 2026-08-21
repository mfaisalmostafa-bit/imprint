import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import * as esbuild from "esbuild";

const outfile = join(mkdtempSync(join(tmpdir(), "mm-")), "core.mjs");
await esbuild.build({
  entryPoints: ["src/lib/mark-size.ts"],
  bundle: true,
  format: "esm",
  outfile,
  platform: "neutral",
});
const { markSizeMm, formatMarkSize, logoDpi } = await import(pathToFileURL(outfile).href);

test("mark size follows the print zone and scale", () => {
  const mm = markSizeMm({ printWmm: 80, printHmm: 50, scale: 0.5, logoAspect: 2 });
  assert.equal(mm.w, 40);
  assert.equal(mm.h, 20);
  assert.match(formatMarkSize(40, 20, "Front face"), /Logo 40 × 20 mm on the front face/);
});

test("dpi drops when the mark is large", () => {
  const fine = logoDpi(1200, 20);
  const coarse = logoDpi(400, 200);
  assert.ok(fine > 150);
  assert.ok(coarse < 100);
});
