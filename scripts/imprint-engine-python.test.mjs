import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("Python drop-in matches the class table and dual-framing lock", () => {
  const r = spawnSync("python3", ["python/test_imprint_engine.py"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
