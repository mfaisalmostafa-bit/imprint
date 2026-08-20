import { jsPDF } from "jspdf";
import { METHODS, type MethodId } from "./methods";

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
  pdf.setFillColor(11, 31, 58);
  pdf.rect(0, 0, W, 28, "F");
  pdf.setFillColor(232, 93, 4);
  pdf.rect(0, 28, W, 1.4, "F");
  pdf.setTextColor(244, 241, 234);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("TePee-X", 12, 13);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("TPX  ·  Command Center proof", 12, 21);
  pdf.setFontSize(9);
  pdf.text("Cairo  ·  Promotional products", W - 12, 13, { align: "right" });
  pdf.text(new Date().toISOString().slice(0, 10), W - 12, 21, { align: "right" });

  pdf.setTextColor(11, 31, 58);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(opts.client, 12, 38);
  pdf.setFont("helvetica", "normal");
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
  const left = fit(opts.original, 128, 112);
  const right = fit(opts.branded, 128, 112);
  pdf.addImage(toUrl(opts.original), "JPEG", 12, 52, left.w, left.h);
  pdf.addImage(toUrl(opts.branded), "JPEG", 12 + 136, 52, right.w, right.h);
  pdf.setFontSize(8);
  pdf.setTextColor(11, 31, 58);
  pdf.text("SKU photo", 12, 52 + left.h + 5);
  pdf.text("Branded proof", 12 + 136, 52 + right.h + 5);

  pdf.setFontSize(8);
  pdf.setTextColor(80, 86, 96);
  const notes = opts.qc.length ? opts.qc : ["No QC flags. Print-safe."];
  notes.slice(0, 4).forEach((n, i) => {
    pdf.text(`·  ${n}`, 12, 178 + i * 4.5);
  });
  pdf.setFontSize(7);
  pdf.text(opts.settings, 12, H - 10);
  pdf.setTextColor(232, 93, 4);
  pdf.text("Not a colour-contract print. Confirm decoration method with production.", W - 12, H - 10, {
    align: "right",
  });
  pdf.save(`TPX-${opts.sku}-${opts.jobRef || "proof"}.pdf`);
}
