/** AI Maker — machine files for the laser / UV printers.

Fiber = Adobe Illustrator 8 EPS. CO2 = AI 10 PDF.
Printing = UV printing · sublimation, colour PDF.
*/

export type MakerMachine = "fiber" | "co2" | "print";

export type MachineDef = {
  id: MakerMachine;
  label: string;
  hint: string;
  format: "eps" | "pdf";
  aiVersion: 8 | 10;
  color: boolean;
  substrates: string;
};

export const MACHINES: Record<MakerMachine, MachineDef> = {
  fiber: {
    id: "fiber",
    label: "Fiber laser — metal",
    hint: "AI 8 EPS",
    format: "eps",
    aiVersion: 8,
    color: false,
    substrates: "metal",
  },
  co2: {
    id: "co2",
    label: "CO2 laser — wood · acrylic · leather",
    hint: "AI 10 PDF",
    format: "pdf",
    aiVersion: 10,
    color: false,
    substrates: "wood · acrylic · leather",
  },
  print: {
    id: "print",
    label: "Printing — UV · sublimation",
    hint: "colour PDF",
    format: "pdf",
    aiVersion: 10,
    color: true,
    substrates: "UV printing · sublimation",
  },
};

export const MACHINE_ORDER: MakerMachine[] = ["fiber", "co2", "print"];

export const DEFAULT_WIDTH_MM = 100;
export const MIN_WIDTH_MM = 8;
export const MAX_WIDTH_MM = 400;
export const MM_TO_PT = 72 / 25.4;

export type FineTune = {
  invert: boolean;
  threshold: number;
  padMm: number;
};

export const DEFAULT_TUNE: FineTune = { invert: false, threshold: 0.52, padMm: 0 };

const BANNED = /pad.?print|screen.?print|emboss|deboss|foil/i;

export function machineOf(id: string): MachineDef {
  if (id === "fiber" || id === "co2" || id === "print") return MACHINES[id];
  return MACHINES.fiber;
}

export function clampWidthMm(n: number) {
  if (!Number.isFinite(n)) return DEFAULT_WIDTH_MM;
  return Math.max(MIN_WIDTH_MM, Math.min(MAX_WIDTH_MM, Math.round(n)));
}

export function slug(name: string) {
  const s = name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return s || "artwork";
}

export function machineFileName(machine: MakerMachine, widthMm: number, artName: string) {
  const m = machineOf(machine);
  return `${slug(artName)}_${clampWidthMm(widthMm)}mm_${m.id}.${m.format}`;
}

export function mmSize(widthMm: number, artW: number, artH: number) {
  const w = clampWidthMm(widthMm);
  const aspect = Math.max(0.08, artH / Math.max(1, artW));
  return { widthMm: w, heightMm: Math.max(4, Math.round(w * aspect * 10) / 10) };
}

export function assertPairing(machine: MakerMachine) {
  const m = machineOf(machine);
  if (machine === "fiber" && (m.format !== "eps" || m.aiVersion !== 8)) {
    throw new Error("Fiber must emit AI 8 EPS");
  }
  if (machine === "co2" && (m.format !== "pdf" || m.aiVersion !== 10)) {
    throw new Error("CO2 must emit AI 10 PDF");
  }
  if (machine === "print" && (!m.color || m.format !== "pdf")) {
    throw new Error("Printing must emit a colour PDF");
  }
  if (BANNED.test(m.label) || BANNED.test(m.substrates)) {
    throw new Error("Banned print vocabulary on the machine picker");
  }
  return true;
}

export function keyBackground(
  rgba: Uint8ClampedArray | number[],
  w: number,
  h: number,
  threshold = 36,
) {
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0] as const;
  };
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  const mean = [0, 0, 0];
  for (const c of corners) {
    mean[0] += c[0];
    mean[1] += c[1];
    mean[2] += c[2];
  }
  mean[0] /= 4;
  mean[1] /= 4;
  mean[2] /= 4;
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const dr = (rgba[i] ?? 0) - mean[0];
    const dg = (rgba[i + 1] ?? 0) - mean[1];
    const db = (rgba[i + 2] ?? 0) - mean[2];
    const dist = Math.hypot(dr, dg, db);
    out[i] = rgba[i] ?? 0;
    out[i + 1] = rgba[i + 1] ?? 0;
    out[i + 2] = rgba[i + 2] ?? 0;
    out[i + 3] = dist < threshold ? 0 : (rgba[i + 3] ?? 255);
  }
  return out;
}

export function rgbaToMask(
  rgba: Uint8ClampedArray | number[],
  w: number,
  h: number,
  tune: FineTune = DEFAULT_TUNE,
) {
  const mask = new Uint8Array(w * h);
  const t = Math.round(tune.threshold * 255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = rgba[i + 3] ?? 255;
      if (a < 16) {
        mask[y * w + x] = 0;
        continue;
      }
      const lum = ((rgba[i] ?? 0) * 299 + (rgba[i + 1] ?? 0) * 587 + (rgba[i + 2] ?? 0) * 114) / 1000;
      const on = lum < t;
      mask[y * w + x] = (tune.invert ? !on : on) ? 1 : 0;
    }
  }
  return mask;
}

function bboxOf(mask: Uint8Array | number[], w: number, h: number) {
  let x0 = w,
    y0 = h,
    x1 = 0,
    y1 = 0,
    n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (!n) return { x: 0, y: 0, w, h, n: 0 };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n };
}

function runsOf(mask: Uint8Array | number[], w: number, h: number, box: { x: number; y: number; w: number; h: number }) {
  const runs: { x: number; y: number; w: number; h: number }[] = [];
  for (let y = box.y; y < box.y + box.h; y++) {
    let x = box.x;
    while (x < box.x + box.w) {
      while (x < box.x + box.w && !mask[y * w + x]) x++;
      const x0 = x;
      while (x < box.x + box.w && mask[y * w + x]) x++;
      if (x > x0) runs.push({ x: x0, y, w: x - x0, h: 1 });
    }
  }
  return runs;
}

export function maskToEps(opts: {
  mask: Uint8Array | number[];
  w: number;
  h: number;
  widthMm: number;
  onColour?: boolean;
  name?: string;
}) {
  const box = bboxOf(opts.mask, opts.w, opts.h);
  const artW = Math.max(1, box.w);
  const artH = Math.max(1, box.h);
  const size = mmSize(opts.widthMm, artW, artH);
  const ptW = size.widthMm * MM_TO_PT;
  const ptH = size.heightMm * MM_TO_PT;
  const sx = ptW / artW;
  const sy = ptH / artH;
  const runs = box.n ? runsOf(opts.mask, opts.w, opts.h, box) : [];
  const fill = opts.onColour ? "0.165 0.149 0.247 setrgbcolor" : "0 0 0 setrgbcolor";
  const title = (opts.name || "artwork").replace(/[()\\]/g, "");
  const lines: string[] = [
    "%!PS-Adobe-3.0 EPSF-3.0",
    "%%Creator: Adobe Illustrator(TM) 8.0",
    `%%Title: (${title})`,
    `%%BoundingBox: 0 0 ${Math.ceil(ptW)} ${Math.ceil(ptH)}`,
    `%%HiResBoundingBox: 0 0 ${ptW.toFixed(3)} ${ptH.toFixed(3)}`,
    "%%DocumentProcessColors: Black",
    "%%EndComments",
    "%%BeginProlog",
    "%%EndProlog",
    "%%BeginSetup",
    "%%EndSetup",
    "gsave",
    fill,
  ];
  if (opts.onColour) {
    lines.push("0.961 0.910 0.863 setrgbcolor", `0 0 ${ptW.toFixed(3)} ${ptH.toFixed(3)} rectfill`, fill);
  }
  for (const r of runs) {
    const x = (r.x - box.x) * sx;
    const y = ptH - (r.y - box.y + r.h) * sy;
    lines.push(`${x.toFixed(3)} ${y.toFixed(3)} ${ (r.w * sx).toFixed(3) } ${ (r.h * sy).toFixed(3) } rectfill`);
  }
  lines.push("grestore", "%%EOF", "");
  return { eps: lines.join("\n"), widthMm: size.widthMm, heightMm: size.heightMm, ptW, ptH };
}

function pdfEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function maskToPdf(opts: {
  mask: Uint8Array | number[];
  w: number;
  h: number;
  widthMm: number;
  color?: boolean;
  onColour?: boolean;
  name?: string;
  aiVersion?: 8 | 10;
}) {
  const eps = maskToEps(opts);
  const W = eps.ptW;
  const H = eps.ptH;
  const box = bboxOf(opts.mask, opts.w, opts.h);
  const sx = W / Math.max(1, box.w);
  const sy = H / Math.max(1, box.h);
  const runs = box.n ? runsOf(opts.mask, opts.w, opts.h, box) : [];
  const ops: string[] = ["q"];
  if (opts.onColour) ops.push("0.961 0.910 0.863 rg", `0 0 ${W.toFixed(2)} ${H.toFixed(2)} re f`);
  if (opts.color) ops.push("0.82 0.506 0.18 rg");
  else ops.push("0 0 0 rg");
  for (const r of runs) {
    const x = (r.x - box.x) * sx;
    const y = H - (r.y - box.y + r.h) * sy;
    ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${(r.w * sx).toFixed(2)} ${(r.h * sy).toFixed(2)} re f`);
  }
  ops.push("Q");
  const stream = ops.join("\n");
  const objects: string[] = [];
  const add = (s: string) => {
    objects.push(s);
    return objects.length;
  };
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  add(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Contents 4 0 R /Resources << >> >>`,
  );
  add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let body = `%PDF-1.4\n%AI-${opts.aiVersion ?? 10}\n`;
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${pdfEscape(opts.name || "artwork")}) /Creator (Adobe Illustrator ${opts.aiVersion ?? 10}.0) >> >>\nstartxref\n${xref}\n%%EOF\n`;
  return { pdf: body, widthMm: eps.widthMm, heightMm: eps.heightMm };
}

export type MachineFile = {
  filename: string;
  mime: string;
  body: string;
  format: "eps" | "pdf";
  aiVersion: 8 | 10;
  widthMm: number;
  heightMm: number;
};

export function buildMachineFile(opts: {
  machine: MakerMachine;
  mask: Uint8Array | number[];
  w: number;
  h: number;
  widthMm: number;
  onColour?: boolean;
  name?: string;
}): MachineFile {
  const m = machineOf(opts.machine);
  assertPairing(m.id);
  const name = opts.name || "artwork";
  const filename = machineFileName(m.id, opts.widthMm, name);
  if (m.format === "eps") {
    const eps = maskToEps({ ...opts, name });
    return {
      filename,
      mime: "application/postscript",
      body: eps.eps,
      format: "eps",
      aiVersion: 8,
      widthMm: eps.widthMm,
      heightMm: eps.heightMm,
    };
  }
  const pdf = maskToPdf({ ...opts, name, color: m.color, aiVersion: m.aiVersion });
  return {
    filename,
    mime: "application/pdf",
    body: pdf.pdf,
    format: "pdf",
    aiVersion: m.aiVersion,
    widthMm: pdf.widthMm,
    heightMm: pdf.heightMm,
  };
}

export function downloadTextFile(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
