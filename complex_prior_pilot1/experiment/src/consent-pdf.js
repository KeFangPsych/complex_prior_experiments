/**
 * consent-pdf.js — writes the informed-consent form to a PDF and saves it.
 * The PDF library is loaded only when the button is clicked. Saving works with
 * the safeguards on (it is a download, not a copy).
 */
import { CONSENT, fillStudyValues } from "./config.js";

export async function saveConsentPdf() {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 58, width = doc.internal.pageSize.getWidth() - 2 * margin, bottom = doc.internal.pageSize.getHeight() - margin;
  let y = margin + 8;
  // writes wrapped text, starting a new page when the current one is full
  const write = (text, { size = 10.5, bold = false, gap = 0 } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lineHeight = size * 1.38;
    doc.splitTextToSize(text, width).forEach((line) => {
      if (y + lineHeight > bottom) { doc.addPage(); y = margin + 8; }
      doc.text(line, margin, y);
      y += lineHeight;
    });
    y += gap;
  };
  write(CONSENT.title, { size: 18, bold: true, gap: 10 });
  CONSENT.sections.forEach((s) => {
    write(`${s.label}:`, { bold: true });
    write(fillStudyValues(s.text), { gap: 8 });
  });
  doc.save(CONSENT.pdf_filename);
}
