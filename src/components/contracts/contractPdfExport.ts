import jsPDF from "jspdf";
import { format } from "date-fns";

interface ExportOptions {
  title: string;
  contractTitle: string;
  analysisType: string;
  content: string;
  orgName?: string;
}

const ANALYSIS_LABELS: Record<string, string> = {
  full_analysis: "Análise Completa",
  clause_analysis: "Análise de Cláusulas",
  renegotiation: "Análise de Renegociação",
  benchmarking: "Benchmarking Setorial",
  abusive_detection: "Detecção de Cláusulas Abusivas",
  draft_contract: "Minuta de Contrato",
};

/** Convert basic markdown to styled PDF lines */
function parseMarkdownLines(text: string): { text: string; style: "h1" | "h2" | "h3" | "bold" | "body" | "bullet" | "separator" }[] {
  const lines = text.split("\n");
  const result: ReturnType<typeof parseMarkdownLines> = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) {
      result.push({ text: "", style: "separator" });
    } else if (line.startsWith("### ")) {
      result.push({ text: line.replace(/^###\s+/, "").replace(/\*\*/g, ""), style: "h3" });
    } else if (line.startsWith("## ")) {
      result.push({ text: line.replace(/^##\s+/, "").replace(/\*\*/g, ""), style: "h2" });
    } else if (line.startsWith("# ")) {
      result.push({ text: line.replace(/^#\s+/, "").replace(/\*\*/g, ""), style: "h1" });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      result.push({ text: line.replace(/^[-*]\s+/, "").replace(/\*\*/g, ""), style: "bullet" });
    } else if (line.startsWith("**") && line.endsWith("**")) {
      result.push({ text: line.replace(/\*\*/g, ""), style: "bold" });
    } else {
      result.push({ text: line.replace(/\*\*/g, ""), style: "body" });
    }
  }
  return result;
}

export function exportContractPDF({ title, contractTitle, analysisType, content, orgName }: ExportOptions) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
  const label = ANALYSIS_LABELS[analysisType] || analysisType;

  let y = 20;

  const addPage = () => {
    doc.addPage();
    y = 20;
    addFooter();
  };

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - 25) addPage();
  };

  const addFooter = () => {
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`LexIA • ${label} • Gerado em ${now}`, marginLeft, pageHeight - 10);
    doc.text(`Página ${pageCount}`, pageWidth - marginRight, pageHeight - 10, { align: "right" });
  };

  // ─── Header ───
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("LexIA", marginLeft, 16);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(label.toUpperCase(), marginLeft, 24);

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 220);
  doc.text(contractTitle, marginLeft, 32);
  doc.text(now, pageWidth - marginRight, 32, { align: "right" });

  y = 50;

  // ─── Metadata box ───
  doc.setDrawColor(220, 220, 230);
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(marginLeft, y, contentWidth, 18, 2, 2, "FD");

  doc.setTextColor(60, 60, 80);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CONTRATO", marginLeft + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(contractTitle, marginLeft + 30, y + 6);

  doc.setFont("helvetica", "bold");
  doc.text("TIPO DE ANÁLISE", marginLeft + 4, y + 13);
  doc.setFont("helvetica", "normal");
  doc.text(label, marginLeft + 40, y + 13);

  if (orgName) {
    doc.setFont("helvetica", "bold");
    doc.text("ORGANIZAÇÃO", pageWidth / 2, y + 6);
    doc.setFont("helvetica", "normal");
    doc.text(orgName, pageWidth / 2 + 30, y + 6);
  }

  y += 26;

  // ─── Content ───
  const parsed = parseMarkdownLines(content);

  for (const line of parsed) {
    switch (line.style) {
      case "separator":
        y += 3;
        break;

      case "h1":
        checkPage(14);
        y += 4;
        doc.setFillColor(15, 23, 42);
        doc.rect(marginLeft, y - 1, contentWidth, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(line.text, marginLeft + 3, y + 5);
        y += 12;
        break;

      case "h2":
        checkPage(12);
        y += 3;
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(line.text, marginLeft, y);
        y += 2;
        doc.setDrawColor(59, 130, 246); // blue-500
        doc.setLineWidth(0.5);
        doc.line(marginLeft, y, marginLeft + contentWidth * 0.4, y);
        y += 5;
        break;

      case "h3":
        checkPage(10);
        y += 2;
        doc.setTextColor(30, 58, 138); // blue-900
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(line.text, marginLeft, y);
        y += 6;
        break;

      case "bold": {
        checkPage(8);
        doc.setTextColor(30, 30, 50);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        const boldLines = doc.splitTextToSize(line.text, contentWidth);
        doc.text(boldLines, marginLeft, y);
        y += boldLines.length * 5;
        break;
      }

      case "bullet": {
        checkPage(8);
        doc.setTextColor(50, 50, 70);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setFillColor(59, 130, 246);
        doc.circle(marginLeft + 2, y - 1.2, 0.8, "F");
        const bulletLines = doc.splitTextToSize(line.text, contentWidth - 8);
        doc.text(bulletLines, marginLeft + 6, y);
        y += bulletLines.length * 4.5;
        break;
      }

      case "body":
      default: {
        checkPage(8);
        doc.setTextColor(50, 50, 70);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const bodyLines = doc.splitTextToSize(line.text, contentWidth);
        doc.text(bodyLines, marginLeft, y);
        y += bodyLines.length * 4.5;
        break;
      }
    }
  }

  // ─── Disclaimer footer ───
  checkPage(20);
  y += 8;
  doc.setDrawColor(220, 170, 50);
  doc.setFillColor(255, 251, 235); // amber-50
  doc.roundedRect(marginLeft, y, contentWidth, 14, 2, 2, "FD");
  doc.setTextColor(120, 80, 0);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("⚠ AVISO LEGAL", marginLeft + 4, y + 5);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Este documento foi gerado por inteligência artificial (LexIA) e constitui rascunho para revisão humana. Não substitui parecer jurídico.",
    marginLeft + 4, y + 10
  );

  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`LexIA • ${label} • Gerado em ${now}`, marginLeft, pageHeight - 10);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginRight, pageHeight - 10, { align: "right" });
  }

  const filename = `LexIA_${label.replace(/\s+/g, "_")}_${contractTitle.replace(/\s+/g, "_").slice(0, 30)}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(filename);
}
