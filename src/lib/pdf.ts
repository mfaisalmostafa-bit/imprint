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

export type ProofPage = {
  sku: string;
  skuName: string;
  method: MethodId;
  qty?: number;
  notes?: string;
  markSize: string;
  original: HTMLCanvasElement;
  branded: HTMLCanvasElement;
  qc: string[];
  settings: string;
};

type PdfFace = string;

function header(pdf: jsPDF, face: PdfFace, W: number, client: string, jobKind: string, jobRef: string) {
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
  pdf.text(client, 12, 38);
  pdf.setFont(face, "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(80, 86, 96);
  pdf.text(`${jobKind.toUpperCase()}  ${jobRef || "—"}`, 12, 45);
}

function footer(pdf: jsPDF, face: PdfFace, W: number, H: number) {
  chevron(pdf, H - 16, W);
  pdf.setFont(face, "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(nr, ng, nb);
  pdf.text(TPX_WEB, W / 2, H - 10, { align: "center" });
  pdf.setFont(face, "normal");
  pdf.setFontSize(7);
  pdf.text(TPX_CONTACT, W / 2, H - 5, { align: "center" });
}

function drawProductPage(
  pdf: jsPDF,
  face: PdfFace,
  W: number,
  H: number,
  client: string,
  jobKind: string,
  jobRef: string,
  page: ProofPage,
) {
  header(pdf, face, W, client, jobKind, jobRef);
  pdf.setTextColor(nr, ng, nb);
  pdf.setFont(face, "bold");
  pdf.setFontSize(11);
  const qty = page.qty ? `  ·  qty ${page.qty}` : "";
  pdf.text(`${page.sku}  ${page.skuName}${qty}`, 12, 54);
  pdf.setFont(face, "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(or, og, ob);
  pdf.text(METHODS[page.method].label, 12, 60);
  pdf.setTextColor(80, 86, 96);
  pdf.text(page.markSize, 12, 66);

  const toUrl = (c: HTMLCanvasElement) => c.toDataURL("image/jpeg", 0.92);
  const fit = (c: HTMLCanvasElement, boxW: number, boxH: number) => {
    const r = Math.min(boxW / c.width, boxH / c.height);
    return { w: c.width * r, h: c.height * r };
  };
  const left = fit(page.original, 128, 96);
  const right = fit(page.branded, 128, 96);
  pdf.addImage(toUrl(page.original), "JPEG", 12, 70, left.w, left.h);
  pdf.addImage(toUrl(page.branded), "JPEG", 12 + 136, 70, right.w, right.h);
  pdf.setFontSize(8);
  pdf.setTextColor(nr, ng, nb);
  pdf.text("Before — catalogue photo", 12, 70 + left.h + 5);
  pdf.text("After — branded proof", 12 + 136, 70 + right.h + 5);

  pdf.setFontSize(8);
  pdf.setTextColor(80, 86, 96);
  const notes = page.qc.length ? page.qc : ["No QC flags. Print-safe."];
  notes.slice(0, 3).forEach((n, i) => {
    pdf.text(`·  ${n}`, 12, 176 + i * 4.5);
  });
  if (page.notes) {
    pdf.text(page.notes, 12, H - 22);
  } else {
    pdf.setFontSize(7);
    pdf.text(page.settings, 12, H - 22);
  }
  footer(pdf, face, W, H);
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
  markSize?: string;
}) {
  await downloadOrderPdf({
    client: opts.client,
    jobKind: opts.jobKind,
    jobRef: opts.jobRef,
    pages: [
      {
        sku: opts.sku,
        skuName: opts.skuName,
        method: opts.method,
        markSize: opts.markSize ?? opts.settings,
        original: opts.original,
        branded: opts.branded,
        qc: opts.qc,
        settings: opts.settings,
      },
    ],
  });
}

export async function downloadOrderPdf(opts: {
  client: string;
  jobKind: string;
  jobRef: string;
  pages: ProofPage[];
}) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const H = 210;
  const mont = await ensureMontserrat(pdf);
  const face = mont ? "Montserrat" : "helvetica";

  pdf.setFillColor(nr, ng, nb);
  pdf.rect(0, 0, W, H, "F");
  pdf.setTextColor(or, og, ob);
  pdf.setFont(face, "bold");
  pdf.setFontSize(28);
  pdf.text("TePee-X", W / 2, 78, { align: "center" });
  pdf.setTextColor(244, 241, 234);
  pdf.setFont(face, "normal");
  pdf.setFontSize(16);
  pdf.text("Product mockups", W / 2, 94, { align: "center" });
  pdf.setFont(face, "bold");
  pdf.setFontSize(14);
  pdf.text(opts.client, W / 2, 114, { align: "center" });
  pdf.setFont(face, "normal");
  pdf.setFontSize(11);
  pdf.text(`${opts.jobKind.toUpperCase()}  ${opts.jobRef || "—"}  ·  ${opts.pages.length} lines`, W / 2, 126, {
    align: "center",
  });
  pdf.setTextColor(or, og, ob);
  pdf.setFontSize(9);
  pdf.text(TPX_CONTACT, W / 2, H - 28, { align: "center" });

  for (const page of opts.pages) {
    pdf.addPage("a4", "landscape");
    drawProductPage(pdf, face, W, H, opts.client, opts.jobKind, opts.jobRef, page);
  }

  const name =
    opts.pages.length > 1
      ? `TPX-${opts.jobRef || "order"}-proof.pdf`
      : `TPX-${opts.pages[0]?.sku ?? "sku"}-${opts.jobRef || "proof"}.pdf`;
  pdf.save(name);
}
