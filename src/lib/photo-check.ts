/**
 * Product / artwork photo checker.
 * Ranked findings a salesperson can act on. If it cannot judge, it says so.
 * Never names a supplier. Never invents a verdict.
 */

export type Severity = "block" | "act" | "note";

export type Finding = {
  severity: Severity;
  code: string;
  title: string;
  action: string;
};

export type Unjudged = {
  code: string;
  why: string;
};

export type PhotoReport = {
  w: number;
  h: number;
  findings: Finding[];
  unjudged: Unjudged[];
};

export type PhotoBuf = {
  w: number;
  h: number;
  data: Uint8ClampedArray | Uint8Array;
  naturalW?: number;
  naturalH?: number;
};

export type ProductCheckOpts = {
  /** Width of the photo as it will sit on the proof, millimetres. Default 120 (A4 column). */
  usageWmm?: number;
};

export type ArtworkCheckOpts = {
  printWmm?: number;
  printHmm?: number;
  isSvg?: boolean;
};

const RANK: Record<Severity, number> = { block: 0, act: 1, note: 2 };

function lum(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function sat(r: number, g: number, b: number) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx < 1) return 0;
  return ((mx - mn) / mx) * 100;
}

function isSkin(r: number, g: number, b: number) {
  return r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 15;
}

function sample(buf: PhotoBuf, x: number, y: number) {
  const i = (y * buf.w + x) * 4;
  return [buf.data[i] ?? 0, buf.data[i + 1] ?? 0, buf.data[i + 2] ?? 0, buf.data[i + 3] ?? 255];
}

function cornerStats(buf: PhotoBuf) {
  const m = Math.max(4, Math.round(Math.min(buf.w, buf.h) * 0.07));
  const boxes: [number, number][] = [
    [0, 0],
    [buf.w - m, 0],
    [0, buf.h - m],
    [buf.w - m, buf.h - m],
  ];
  const means: [number, number, number][] = [];
  const stds: number[] = [];
  for (const [sx, sy] of boxes) {
    let rs = 0,
      gs = 0,
      bs = 0,
      n = 0;
    const lums: number[] = [];
    for (let y = sy; y < sy + m; y++) {
      for (let x = sx; x < sx + m; x++) {
        const [r, g, b] = sample(buf, x, y);
        rs += r;
        gs += g;
        bs += b;
        lums.push(lum(r, g, b));
        n++;
      }
    }
    const mean: [number, number, number] = [rs / n, gs / n, bs / n];
    means.push(mean);
    const ml = lum(mean[0], mean[1], mean[2]);
    const v = lums.reduce((s, v) => s + (v - ml) * (v - ml), 0) / n;
    stds.push(Math.sqrt(v));
  }
  let maxDist = 0;
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const a = means[i]!;
      const b = means[j]!;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (d > maxDist) maxDist = d;
    }
  }
  const bg: [number, number, number] = [
    (means[0]![0] + means[1]![0] + means[2]![0] + means[3]![0]) / 4,
    (means[0]![1] + means[1]![1] + means[2]![1] + means[3]![1]) / 4,
    (means[0]![2] + means[1]![2] + means[2]![2] + means[3]![2]) / 4,
  ];
  return { bg, maxDist, std: stds.reduce((a, b) => a + b, 0) / 4 };
}

type Blob = { n: number; minX: number; maxX: number; minY: number; maxY: number };

function blobsFromMask(mask: Uint8Array, w: number, h: number, minN: number): Blob[] {
  const seen = new Uint8Array(mask.length);
  const out: Blob[] = [];
  const qx = new Int32Array(mask.length);
  const qy = new Int32Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = y * w + x;
      if (!mask[s] || seen[s]) continue;
      let n = 0;
      let minX = x,
        maxX = x,
        minY = y,
        maxY = y;
      let qs = 0,
        qe = 0;
      qx[qe] = x;
      qy[qe] = y;
      qe++;
      seen[s] = 1;
      while (qs < qe) {
        const cx = qx[qs]!;
        const cy = qy[qs]!;
        qs++;
        n++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = ny * w + nx;
          if (!mask[k] || seen[k]) continue;
          seen[k] = 1;
          qx[qe] = nx;
          qy[qe] = ny;
          qe++;
        }
      }
      if (n >= minN) out.push({ n, minX, maxX, minY, maxY });
    }
  }
  out.sort((a, b) => b.n - a.n);
  return out;
}

function productMask(buf: PhotoBuf, bg: [number, number, number], thresh: number) {
  const mask = new Uint8Array(buf.w * buf.h);
  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    const r = buf.data[p] ?? 0;
    const g = buf.data[p + 1] ?? 0;
    const b = buf.data[p + 2] ?? 0;
    const d = Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
    mask[i] = d >= thresh ? 1 : 0;
  }
  return mask;
}

function edgeDensity(buf: PhotoBuf) {
  const w = buf.w;
  const h = buf.h;
  let edges = 0;
  let n = 0;
  const step = Math.max(1, Math.round(Math.min(w, h) / 80));
  for (let y = step; y < h - step; y += step) {
    for (let x = step; x < w - step; x += step) {
      const [r, g, b] = sample(buf, x, y);
      const [r2, g2, b2] = sample(buf, x + step, y);
      const [r3, g3, b3] = sample(buf, x, y + step);
      const gx = lum(r2, g2, b2) - lum(r, g, b);
      const gy = lum(r3, g3, b3) - lum(r, g, b);
      if (Math.hypot(gx, gy) > 28) edges++;
      n++;
    }
  }
  return n ? edges / n : 0;
}

function dividerScore(buf: PhotoBuf) {
  const w = buf.w;
  const h = buf.h;
  const cols = [Math.round(w / 3), Math.round((2 * w) / 3)];
  const rows = [Math.round(h / 3), Math.round((2 * h) / 3)];
  let best = 0;
  for (const x of cols) {
    let e = 0;
    for (let y = 1; y < h; y++) {
      const [r, g, b] = sample(buf, x, y);
      const [r2, g2, b2] = sample(buf, Math.max(0, x - 1), y);
      if (Math.abs(lum(r, g, b) - lum(r2, g2, b2)) > 32) e++;
    }
    best = Math.max(best, e / h);
  }
  for (const y of rows) {
    let e = 0;
    for (let x = 1; x < w; x++) {
      const [r, g, b] = sample(buf, x, y);
      const [r2, g2, b2] = sample(buf, x, Math.max(0, y - 1));
      if (Math.abs(lum(r, g, b) - lum(r2, g2, b2)) > 32) e++;
    }
    best = Math.max(best, e / w);
  }
  return best;
}

function meanSat(buf: PhotoBuf) {
  let s = 0;
  const n = buf.w * buf.h;
  const step = Math.max(1, Math.floor(n / 4000));
  let c = 0;
  for (let i = 0; i < n; i += step) {
    const p = i * 4;
    s += sat(buf.data[p] ?? 0, buf.data[p + 1] ?? 0, buf.data[p + 2] ?? 0);
    c++;
  }
  return c ? s / c : 0;
}

function skinShare(buf: PhotoBuf) {
  let hit = 0;
  const n = buf.w * buf.h;
  const step = Math.max(1, Math.floor(n / 4000));
  let c = 0;
  for (let i = 0; i < n; i += step) {
    const p = i * 4;
    if (isSkin(buf.data[p] ?? 0, buf.data[p + 1] ?? 0, buf.data[p + 2] ?? 0)) hit++;
    c++;
  }
  return c ? hit / c : 0;
}

function cornerMark(buf: PhotoBuf, mask: Uint8Array, bg: [number, number, number], main?: Blob) {
  const w = buf.w;
  const h = buf.h;
  const bw = Math.max(6, Math.round(w * 0.16));
  const bh = Math.max(6, Math.round(h * 0.16));
  const boxes: [number, number, number, number][] = [
    [0, 0, bw, bh],
    [w - bw, 0, w, bh],
    [0, h - bh, bw, h],
    [w - bw, h - bh, w, h],
  ];
  const total = w * h;
  const mx0 = main ? main.minX - 4 : -1;
  const mx1 = main ? main.maxX + 4 : -1;
  const my0 = main ? main.minY - 4 : -1;
  const my1 = main ? main.maxY + 4 : -1;
  for (const [x0, y0, x1, y1] of boxes) {
    let n = 0;
    let contrast = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (main && x >= mx0 && x <= mx1 && y >= my0 && y <= my1) continue;
        if (!mask[y * w + x]) continue;
        n++;
        const [r, g, b] = sample(buf, x, y);
        contrast += Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
      }
    }
    const frac = n / total;
    const meanC = n ? contrast / n : 0;
    if (frac > 0.002 && frac < 0.035 && meanC > 70) return { frac, meanC };
  }
  return null;
}

function pixelSize(buf: PhotoBuf) {
  return {
    w: buf.naturalW ?? buf.w,
    h: buf.naturalH ?? buf.h,
  };
}

function emptyReport(w: number, h: number): PhotoReport {
  return { w, h, findings: [], unjudged: [] };
}

function push(report: PhotoReport, f: Finding) {
  report.findings.push(f);
}

function skip(report: PhotoReport, code: string, why: string) {
  report.unjudged.push({ code, why });
}

/** Ranked, capped. A hundred notes is the same as no checker. */
export function rankFindings(report: PhotoReport, cap = 3): Finding[] {
  const sorted = [...report.findings].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  const hasSerious = sorted.some((f) => f.severity !== "note");
  const filtered = hasSerious ? sorted.filter((f) => f.severity !== "note") : sorted;
  return filtered.slice(0, cap);
}

export function checkProductPhoto(buf: PhotoBuf | null, opts: ProductCheckOpts = {}): PhotoReport {
  if (!buf || buf.w < 2 || buf.h < 2) {
    const r = emptyReport(buf?.w ?? 0, buf?.h ?? 0);
    push(r, {
      severity: "block",
      code: "missing",
      title: "No usable photo",
      action: "This SKU cannot go on a quotation until a catalogue shot is attached.",
    });
    return r;
  }
  const px = pixelSize(buf);
  const r = emptyReport(px.w, px.h);
  const long = Math.max(px.w, px.h);
  if (long < 200) {
    push(r, {
      severity: "block",
      code: "tiny",
      title: `Image is ${px.w} × ${px.h}`,
      action: "Too small to print. Request the original file.",
    });
  }

  const usage = opts.usageWmm ?? 120;
  const dpi = px.w / (usage / 25.4);
  if (dpi < 100) {
    push(r, {
      severity: "block",
      code: "dpi",
      title: `${Math.round(dpi)} dpi at ${usage} mm wide`,
      action: "Will pixelate on an A4 proof. Request a larger file.",
    });
  } else if (dpi < 150) {
    push(r, {
      severity: "act",
      code: "dpi",
      title: `${Math.round(dpi)} dpi at ${usage} mm`,
      action: "Soft on an A4 proof. 300 dpi is print-safe.",
    });
  }

  const { bg, maxDist, std } = cornerStats(buf);
  if (maxDist > 48 || std > 32) {
    push(r, {
      severity: "act",
      code: "background",
      title: "Busy background",
      action: "This shot will not composite. Use a clean sweep for quotes.",
    });
  } else if (maxDist > 28 || std > 18) {
    skip(r, "background", "Background is neither a clean sweep nor clearly busy.");
  }

  const thresh = Math.max(28, std * 4);
  const mask = productMask(buf, bg, thresh);
  const minN = Math.round(buf.w * buf.h * 0.012);
  const blobs = blobsFromMask(mask, buf.w, buf.h, minN);
  const coverage = blobs.reduce((s, b) => s + b.n, 0) / (buf.w * buf.h);

  if (blobs.length >= 3) {
    const sizes = blobs.slice(0, 4).map((b) => b.n);
    const similar = sizes[0]! < sizes[sizes.length - 1]! * 4;
    const ys = blobs.slice(0, 4).map((b) => (b.minY + b.maxY) / 2);
    const row = Math.max(...ys) - Math.min(...ys) < buf.h * 0.28;
    if (similar && row) {
      push(r, {
        severity: "act",
        code: "lineup",
        title: "Colour line-up",
        action: "A row of products cannot carry a logo. Pick a single front-facing shot.",
      });
    } else if (similar) {
      push(r, {
        severity: "act",
        code: "group",
        title: "Group shot",
        action: "Several products in one frame. Quotes need one SKU, one photo.",
      });
    } else {
      skip(r, "group", "More than one region, but sizes do not clearly read as a group shot.");
    }
  } else if (blobs.length === 2) {
    skip(r, "group", "Two regions — could be product plus shadow. Not judged as a group shot.");
  }

  if (coverage < 0.03 && blobs.length === 0) {
    push(r, {
      severity: "block",
      code: "empty",
      title: "No product in the frame",
      action: "The photo is a backdrop. Attach the catalogue shot.",
    });
  }

  const div = dividerScore(buf);
  if (div > 0.55) {
    push(r, {
      severity: "act",
      code: "collage",
      title: "Collage or text panel",
      action: "Split layouts and spec sheets cannot carry a logo.",
    });
  } else if (div > 0.32) {
    skip(r, "collage", "A divider is present but not strong enough to call a collage.");
  }

  const s = meanSat(buf);
  const edges = edgeDensity(buf);
  if (s < 14 && edges > 0.22) {
    push(r, {
      severity: "act",
      code: "diagram",
      title: "Spec diagram",
      action: "Line art cannot go on a quotation. Use the photograph.",
    });
  } else if (s < 22 && edges > 0.14) {
    skip(r, "diagram", "Low colour and some edges — not sure if this is a diagram.");
  }

  const skin = skinShare(buf);
  if (skin > 0.08 && blobs.length >= 1) {
    push(r, {
      severity: "act",
      code: "handheld",
      title: "Hand-held shot",
      action: "Hands in the frame look careless on a quote. Use a stand shot.",
    });
  } else if (skin > 0.03) {
    skip(r, "handheld", "Some skin-tone pixels, not enough to call a hand-held shot.");
  }

  const mark = cornerMark(buf, mask, bg, blobs[0]);
  if (mark && mark.meanC > 70 && mark.frac < 0.025) {
    push(r, {
      severity: "act",
      code: "foreign_mark",
      title: "Possible mark in the frame",
      action: "Check the corners for another brand or a watermark before this goes to a client.",
    });
  } else if (mark) {
    skip(r, "foreign_mark", "A small contrast patch sits in a corner. Not sure it is a mark.");
  }

  return r;
}

export function checkArtwork(buf: PhotoBuf | null, opts: ArtworkCheckOpts = {}): PhotoReport {
  if (opts.isSvg) {
    const r = emptyReport(0, 0);
    r.findings.push({
      severity: "note",
      code: "vector",
      title: "Vector artwork",
      action: "This will hold at any print size.",
    });
    return r;
  }
  if (!buf || buf.w < 2 || buf.h < 2) {
    const r = emptyReport(0, 0);
    push(r, {
      severity: "block",
      code: "missing",
      title: "No artwork",
      action: "Ask the client for a vector or a 1000 px+ PNG with a transparent ground.",
    });
    return r;
  }
  const px = pixelSize(buf);
  const r = emptyReport(px.w, px.h);
  const long = Math.max(px.w, px.h);
  if (long < 180) {
    push(r, {
      severity: "block",
      code: "tiny",
      title: `Logo is ${px.w} × ${px.h}`,
      action: "Unusable. Request a vector or 1000 px+ PNG.",
    });
  } else if (long < 400) {
    push(r, {
      severity: "act",
      code: "low_res",
      title: `Logo is ${px.w} × ${px.h}`,
      action: "Will soften on the print area.",
    });
  }

  if (opts.printWmm && opts.printWmm > 0) {
    const dpi = px.w / (opts.printWmm / 25.4);
    if (dpi < 100) {
      push(r, {
        severity: "block",
        code: "dpi",
        title: `${Math.round(dpi)} dpi at ${opts.printWmm} mm`,
        action: "Too coarse for the printed size.",
      });
    } else if (dpi < 150) {
      push(r, {
        severity: "act",
        code: "dpi",
        title: `${Math.round(dpi)} dpi at ${opts.printWmm} mm`,
        action: "Borderline. Prefer vector.",
      });
    }
  } else {
    skip(r, "dpi", "Printed size unknown, so logo dpi is not judged.");
  }

  let transparent = 0;
  let opaque = 0;
  let whiteBorder = 0;
  let borderN = 0;
  const m = Math.max(2, Math.round(Math.min(buf.w, buf.h) * 0.04));
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      const a = buf.data[(y * buf.w + x) * 4 + 3] ?? 255;
      if (a < 250) transparent++;
      else opaque++;
      const edge = x < m || y < m || x >= buf.w - m || y >= buf.h - m;
      if (edge) {
        borderN++;
        const [cr, cg, cb] = sample(buf, x, y);
        if (a > 250 && lum(cr, cg, cb) > 240) whiteBorder++;
      }
    }
  }
  if (transparent < 8 && whiteBorder / Math.max(1, borderN) > 0.72) {
    push(r, {
      severity: "act",
      code: "white_box",
      title: "White box, not a transparent ground",
      action: "The white will print. Key it or request a PNG with real alpha.",
    });
  } else if (transparent < 8 && opaque > 0) {
    skip(r, "white_box", "Opaque file, but the border is not clearly a white box.");
  }
  return r;
}

export async function loadPhotoBuf(src: string): Promise<PhotoBuf | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        const max = 360;
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        c.width = Math.max(2, Math.round(img.naturalWidth * scale));
        c.height = Math.max(2, Math.round(img.naturalHeight * scale));
        const ctx = c.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const id = ctx.getImageData(0, 0, c.width, c.height);
        resolve({
          w: id.width,
          h: id.height,
          data: id.data,
          naturalW: img.naturalWidth,
          naturalH: img.naturalHeight,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
