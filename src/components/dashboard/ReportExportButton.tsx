import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileText, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReportSection {
  id: string;
  label: string;
  enabled: boolean;
}

interface KpiData {
  label: string;
  value: string | number;
}

interface ReportExportButtonProps {
  kpis: KpiData[];
  processStatusData: { name: string; value: number }[];
  movementsChartData: { month: string; movimentações: number }[];
  deadlineStatusData: { name: string; value: number }[];
  revenueChartData: { month: string; faturado: number; recebido: number }[];
  overdueCount: number;
  totalProcesses: number;
  totalDeadlines: number;
  financialSummary?: { total: number; pending: number; paid: number; count: number };
  cashFlowData?: { name: string; entradas: number; saldo: number }[];
  chartRefs: {
    processStatus?: React.RefObject<HTMLDivElement>;
    movements?: React.RefObject<HTMLDivElement>;
    deadlines?: React.RefObject<HTMLDivElement>;
    revenue?: React.RefObject<HTMLDivElement>;
    processMonth?: React.RefObject<HTMLDivElement>;
  };
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export const ReportExportButton = ({
  kpis,
  processStatusData,
  movementsChartData,
  deadlineStatusData,
  revenueChartData,
  overdueCount,
  totalProcesses,
  totalDeadlines,
  financialSummary,
  cashFlowData,
  chartRefs,
}: ReportExportButtonProps) => {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState<ReportSection[]>([
    { id: "executive", label: "Resumo Executivo + KPIs", enabled: true },
    { id: "charts", label: "Gráficos do Dashboard", enabled: true },
    { id: "tables", label: "Tabela detalhada de dados", enabled: true },
    { id: "cashflow", label: "Fluxo de caixa projetado", enabled: true },
  ]);

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const captureChart = async (ref: React.RefObject<HTMLDivElement> | undefined): Promise<string | null> => {
    if (!ref?.current) return null;
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: "#1a1a2e",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  };

  const generatePDF = useCallback(async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;
      let y = margin;

      const addPageIfNeeded = (neededSpace: number) => {
        if (y + neededSpace > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const drawSectionTitle = (title: string) => {
        addPageIfNeeded(15);
        doc.setFontSize(14);
        doc.setTextColor(100, 180, 255);
        doc.text(title, margin, y);
        y += 2;
        doc.setDrawColor(100, 180, 255);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageW - margin, y);
        y += 8;
      };

      // Header
      doc.setFillColor(20, 20, 40);
      doc.rect(0, 0, pageW, 35, "F");
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.text("Relatório Analítico", margin, 18);
      doc.setFontSize(10);
      doc.setTextColor(180, 180, 200);
      doc.text(`Gerado em ${format(new Date(), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}`, margin, 28);
      y = 45;

      // Executive summary
      if (sections.find(s => s.id === "executive")?.enabled) {
        drawSectionTitle("Resumo Executivo");

        doc.setFontSize(10);
        doc.setTextColor(60, 60, 80);

        // KPIs grid
        const colW = (pageW - margin * 2) / 2;
        kpis.forEach((kpi, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = margin + col * colW;
          const ky = y + row * 18;

          doc.setFillColor(240, 240, 250);
          doc.roundedRect(x, ky, colW - 4, 15, 2, 2, "F");
          doc.setFontSize(9);
          doc.setTextColor(120, 120, 140);
          doc.text(kpi.label, x + 4, ky + 6);
          doc.setFontSize(14);
          doc.setTextColor(30, 30, 60);
          doc.text(String(kpi.value), x + 4, ky + 13);
        });
        y += Math.ceil(kpis.length / 2) * 18 + 8;

        // Performance metrics
        addPageIfNeeded(30);
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 80);
        const metrics = [
          `Total de processos: ${totalProcesses}`,
          `Prazos vencidos: ${overdueCount}`,
          `Total de prazos: ${totalDeadlines}`,
        ];
        if (financialSummary) {
          metrics.push(
            `Faturamento total: ${formatCurrency(financialSummary.total)}`,
            `Recebido: ${formatCurrency(financialSummary.paid)}`,
            `Pendente: ${formatCurrency(financialSummary.pending)}`,
            `Ticket médio: ${formatCurrency(financialSummary.count > 0 ? financialSummary.total / financialSummary.count : 0)}`,
          );
        }
        metrics.forEach(m => {
          doc.text(`• ${m}`, margin + 2, y);
          y += 6;
        });
        y += 5;
      }

      // Charts
      if (sections.find(s => s.id === "charts")?.enabled) {
        drawSectionTitle("Gráficos Analíticos");

        const chartEntries = [
          { ref: chartRefs.processStatus, label: "Processos por Status" },
          { ref: chartRefs.movements, label: "Movimentações por Mês" },
          { ref: chartRefs.deadlines, label: "Prazos por Status" },
          { ref: chartRefs.processMonth, label: "Processos por Mês" },
          { ref: chartRefs.revenue, label: "Faturamento Mensal" },
        ];

        for (const chart of chartEntries) {
          const img = await captureChart(chart.ref);
          if (img) {
            addPageIfNeeded(75);
            doc.setFontSize(10);
            doc.setTextColor(80, 80, 100);
            doc.text(chart.label, margin, y);
            y += 4;
            const imgW = pageW - margin * 2;
            const imgH = 60;
            doc.addImage(img, "PNG", margin, y, imgW, imgH);
            y += imgH + 8;
          }
        }
      }

      // Data tables
      if (sections.find(s => s.id === "tables")?.enabled) {
        drawSectionTitle("Dados Detalhados");

        // Process by status table
        if (processStatusData.length > 0) {
          doc.setFontSize(10);
          doc.setTextColor(80, 80, 100);
          doc.text("Processos por Status", margin, y);
          y += 6;

          doc.setFillColor(230, 230, 245);
          doc.rect(margin, y, pageW - margin * 2, 7, "F");
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 80);
          doc.text("Status", margin + 3, y + 5);
          doc.text("Quantidade", margin + 80, y + 5);
          y += 8;

          processStatusData.forEach(row => {
            addPageIfNeeded(7);
            doc.setTextColor(40, 40, 60);
            doc.text(row.name, margin + 3, y + 4);
            doc.text(String(row.value), margin + 80, y + 4);
            doc.setDrawColor(230, 230, 245);
            doc.line(margin, y + 6, pageW - margin, y + 6);
            y += 7;
          });
          y += 6;
        }

        // Movements table
        if (movementsChartData.length > 0) {
          addPageIfNeeded(20);
          doc.setFontSize(10);
          doc.setTextColor(80, 80, 100);
          doc.text("Movimentações por Mês", margin, y);
          y += 6;

          doc.setFillColor(230, 230, 245);
          doc.rect(margin, y, pageW - margin * 2, 7, "F");
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 80);
          doc.text("Mês", margin + 3, y + 5);
          doc.text("Movimentações", margin + 80, y + 5);
          y += 8;

          movementsChartData.forEach(row => {
            addPageIfNeeded(7);
            doc.setTextColor(40, 40, 60);
            doc.text(row.month, margin + 3, y + 4);
            doc.text(String(row.movimentações), margin + 80, y + 4);
            doc.setDrawColor(230, 230, 245);
            doc.line(margin, y + 6, pageW - margin, y + 6);
            y += 7;
          });
          y += 6;
        }

        // Deadlines table
        if (deadlineStatusData.length > 0) {
          addPageIfNeeded(20);
          doc.setFontSize(10);
          doc.setTextColor(80, 80, 100);
          doc.text("Prazos por Status", margin, y);
          y += 6;

          doc.setFillColor(230, 230, 245);
          doc.rect(margin, y, pageW - margin * 2, 7, "F");
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 80);
          doc.text("Status", margin + 3, y + 5);
          doc.text("Quantidade", margin + 80, y + 5);
          y += 8;

          deadlineStatusData.forEach(row => {
            addPageIfNeeded(7);
            doc.setTextColor(40, 40, 60);
            doc.text(row.name, margin + 3, y + 4);
            doc.text(String(row.value), margin + 80, y + 4);
            doc.setDrawColor(230, 230, 245);
            doc.line(margin, y + 6, pageW - margin, y + 6);
            y += 7;
          });
          y += 6;
        }
      }

      // Cash flow
      if (sections.find(s => s.id === "cashflow")?.enabled && cashFlowData && cashFlowData.length > 0) {
        drawSectionTitle("Fluxo de Caixa Projetado");

        doc.setFillColor(230, 230, 245);
        doc.rect(margin, y, pageW - margin * 2, 7, "F");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 80);
        doc.text("Mês", margin + 3, y + 5);
        doc.text("Entradas (R$)", margin + 55, y + 5);
        doc.text("Saldo Acum. (R$)", margin + 110, y + 5);
        y += 8;

        cashFlowData.forEach(row => {
          addPageIfNeeded(7);
          doc.setTextColor(40, 40, 60);
          doc.text(row.name, margin + 3, y + 4);
          doc.text(row.entradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), margin + 55, y + 4);
          doc.text(row.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), margin + 110, y + 4);
          doc.setDrawColor(230, 230, 245);
          doc.line(margin, y + 6, pageW - margin, y + 6);
          y += 7;
        });

        // Revenue chart
        if (revenueChartData.length > 0) {
          addPageIfNeeded(20);
          y += 4;
          doc.setFontSize(10);
          doc.setTextColor(80, 80, 100);
          doc.text("Faturamento vs Recebido (mensal)", margin, y);
          y += 6;

          doc.setFillColor(230, 230, 245);
          doc.rect(margin, y, pageW - margin * 2, 7, "F");
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 80);
          doc.text("Mês", margin + 3, y + 5);
          doc.text("Faturado (R$)", margin + 55, y + 5);
          doc.text("Recebido (R$)", margin + 110, y + 5);
          y += 8;

          revenueChartData.forEach(row => {
            addPageIfNeeded(7);
            doc.setTextColor(40, 40, 60);
            doc.text(row.month, margin + 3, y + 4);
            doc.text(row.faturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), margin + 55, y + 4);
            doc.text(row.recebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), margin + 110, y + 4);
            doc.setDrawColor(230, 230, 245);
            doc.line(margin, y + 6, pageW - margin, y + 6);
            y += 7;
          });
        }
      }

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(160, 160, 180);
        doc.text(`LexIA • Relatório Analítico • Página ${i} de ${totalPages}`, pageW / 2, pageH - 8, { align: "center" });
      }

      doc.save(`relatorio-analitico-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setGenerating(false);
      setOpen(false);
    }
  }, [sections, kpis, processStatusData, movementsChartData, deadlineStatusData, revenueChartData, overdueCount, totalProcesses, totalDeadlines, financialSummary, cashFlowData, chartRefs]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <FileText className="h-4 w-4" />
        Exportar PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Exportar Relatório PDF
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Selecione as seções do relatório:</p>
            {sections.map(section => (
              <div key={section.id} className="flex items-center space-x-3">
                <Checkbox
                  id={section.id}
                  checked={section.enabled}
                  onCheckedChange={() => toggleSection(section.id)}
                />
                <label htmlFor={section.id} className="text-sm font-medium cursor-pointer">
                  {section.label}
                </label>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={generatePDF} disabled={generating || !sections.some(s => s.enabled)}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Gerar PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
