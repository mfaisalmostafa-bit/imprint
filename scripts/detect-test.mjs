import { detectFromRgb } from "../src/lib/detect-core.ts";

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

let failed = 0;
function check(name, cond, extra = "") {
  if (cond) console.log("ok ", name);
  else {
    failed++;
    console.log("FAIL", name, extra);
  }
}

const W = 120;
const H = 120;
const paper = () => [248, 248, 246];

// 1. Empty sweep — must REFUSE
{
  const blank = buffers(W, H, () => paper());
  const d = detectFromRgb(blank);
  check("empty refuses", d.accepted === false, JSON.stringify({ c: d.confidence, cov: d.coverage }));
  check("empty confidence low", d.confidence < 0.25);
}

// 2. Synthetic taper: top width 0.20, bottom width 0.50
{
  const topW = 0.2;
  const botW = 0.5;
  const y0 = 0.18;
  const y1 = 0.86;
  const trap = buffers(W, H, (x, y) => {
    const yn = y / (H - 1);
    if (yn < y0 || yn > y1) return paper();
    const t = (yn - y0) / (y1 - y0);
    const half = (topW + (botW - topW) * t) / 2;
    const xn = x / (W - 1);
    if (Math.abs(xn - 0.5) <= half) return [42, 44, 48];
    return paper();
  });
  const d = detectFromRgb(trap);
  check("taper accepted", d.accepted, JSON.stringify(d));
  check(
    "taper top ~0.20",
    Math.abs(d.topWidth - 0.2) < 0.07,
    `topWidth=${d.topWidth.toFixed(3)}`,
  );
  check(
    "taper bot ~0.50",
    Math.abs(d.botWidth - 0.5) < 0.08,
    `botWidth=${d.botWidth.toFixed(3)}`,
  );
}

// 3. Off-centre wide body — must not clip to the image centre
{
  const wide = buffers(W, H, (x, y) => {
    const xn = x / (W - 1);
    const yn = y / (H - 1);
    if (yn > 0.2 && yn < 0.8 && xn > 0.04 && xn < 0.62) return [30, 32, 36];
    return paper();
  });
  const d = detectFromRgb(wide);
  check("wide accepted", d.accepted);
  check("wide left not centre-clipped", d.quad[0].x < 0.14, `tlx=${d.quad[0].x.toFixed(3)}`);
  check("wide right reaches product", d.quad[1].x > 0.48, `trx=${d.quad[1].x.toFixed(3)}`);
}

// 4. Existing logo hole in the product — plane must still cover the body
{
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
  check("logoed accepted", d.accepted);
  check("logoed still a plane", d.quad[2].y - d.quad[0].y > 0.35, `h=${(d.quad[2].y - d.quad[0].y).toFixed(3)}`);
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall passed");
