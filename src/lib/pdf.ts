import { jsPDF } from "jspdf";
import { METHODS, type MethodId } from "./methods";
import {
  TPX_CONTACT,
  TPX_NAVY_RGB,
  TPX_ORANGE_RGB,
  TPX_WEB,
} from "./brand";

const [nr, ng, nb] = TPX_NAVY_RGB;
const [or, og, ob] = TPX_ORANGE_RGB;

async function toB64(url: string) {
  const buf = await fetch(url).then((r) => {
    if (!r.ok) throw new Error(url);
    return r.arrayBuffer();
  });
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

let fontB64: Promise<{ regular: string; bold: string }> | null = null;

function loadFontB64() {
  if (!fontB64) {
    fontB64 = Promise.all([
      toB64("/fonts/Montserrat-Regular.ttf"),
      toB64("/fonts/Montserrat-Bold.ttf"),
    ]).then(([regular, bold]) => ({ regular, bold }));
  }
  return fontB64;
}

async function ensureMontserrat(pdf: jsPDF) {
  try {
    const f = await loadFontB64();
    pdf.addFileToVFS("Montserrat-Regular.ttf", f.regular);
    pdf.addFileToVFS("Montserrat-Bold.ttf", f.bold);
    pdf.addFont("Montserrat-Regular.ttf", "Montserrat", "normal");
    pdf.addFont("Montserrat-Bold.ttf", "Montserrat", "bold");
    return true;
  } catch {
    return false;
  }
}

function chevron(pdf: jsPDF, y: number, W: number) {
  pdf.setDrawColor(or, og, ob);
  pdf.setLineWidth(0.7);
  let x = 12;
  let up = true;
  const amp = 1.8;
  const step = 6;
  pdf.setLineCap("round");
  while (x < W - 12) {
    const x2 = Math.min(W - 12, x + step);
    pdf.line(x, y + (up ? -amp : amp), x2, y + (up ? amp : -amp));
    x = x2;
    up = !up;
  }
}

export async function downloadProofPdf(opts: {
  client: string;
  jobKind: string;
  jobRef: string;
  sku: string;
  skuName: string;
  method: MethodId;
  original: HTMLCanvasElement;
  branded: HTMLCanvasElement;
  qc: string[];
  settings: string;
}) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const H = 210;
  const mont = await ensureMontserrat(pdf);
  const face = mont ? "Montserrat" : "helvetica";

  pdf.setFillColor(nr, ng, nb);
  pdf.rect(0, 0, W, 28, "F");
  pdf.setFillColor(or, og, ob);
  pdf.rect(0, 28, W, 1.6, "F");
  pdf.setTextColor(244, 241, 234);
  pdf.setFont(face, "bold");
  pdf.setFontSize(16);
  pdf.text("TePee-X", 12, 13);
  pdf.setFont(face, "normal");
  pdf.setFontSize(9);
  pdf.text("TPX  ·  Command Center proof", 12, 21);
  pdf.setFontSize(9);
  pdf.text(TPX_WEB, W - 12, 13, { align: "right" });
  pdf.text(new Date().toISOString().slice(0, 10), W - 12, 21, { align: "right" });

  pdf.setTextColor(nr, ng, nb);
  pdf.setFont(face, "bold");
  pdf.setFontSize(11);
  pdf.text(opts.client, 12, 38);
  pdf.setFont(face, "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(80, 86, 96);
  pdf.text(
    `${opts.jobKind.toUpperCase()}  ${opts.jobRef || "—"}   ·   ${opts.sku}  ${opts.skuName}   ·   ${METHODS[opts.method].label}`,
    12,
    45,
  );

  const toUrl = (c: HTMLCanvasElement) => c.toDataURL("image/jpeg", 0.92);
  const fit = (c: HTMLCanvasElement, boxW: number, boxH: number) => {
    const r = Math.min(boxW / c.width, boxH / c.height);
    return { w: c.width * r, h: c.height * r };
  };
  const left = fit(opts.original, 128, 108);
  const right = fit(opts.branded, 128, 108);
  pdf.addImage(toUrl(opts.original), "JPEG", 12, 52, left.w, left.h);
  pdf.addImage(toUrl(opts.branded), "JPEG", 12 + 136, 52, right.w, right.h);
  pdf.setFontSize(8);
  pdf.setTextColor(nr, ng, nb);
  pdf.text("SKU photo", 12, 52 + left.h + 5);
  pdf.text("Branded proof", 12 + 136, 52 + right.h + 5);

  pdf.setFontSize(8);
  pdf.setTextColor(80, 86, 96);
  const notes = opts.qc.length ? opts.qc : ["No QC flags. Print-safe."];
  notes.slice(0, 3).forEach((n, i) => {
    pdf.text(`·  ${n}`, 12, 170 + i * 4.5);
  });
  pdf.setFontSize(7);
  pdf.text(opts.settings, 12, H - 22);

  chevron(pdf, H - 16, W);
  pdf.setFont(face, "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(nr, ng, nb);
  pdf.text(TPX_WEB, W / 2, H - 10, { align: "center" });
  pdf.setFont(face, "normal");
  pdf.setFontSize(7);
  pdf.text(TPX_CONTACT, W / 2, H - 5, { align: "center" });

  pdf.save(`TPX-${opts.sku}-${opts.jobRef || "proof"}.pdf`);
}
