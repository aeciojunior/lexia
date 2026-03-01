import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import DiffView from "@/components/drafts/DiffView";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, ArrowLeftRight, AlertTriangle, CheckCircle, Info, Trash2,
  Clock, Upload, FileText, Download, Shield, DollarSign, Languages,
  Eye, BarChart3, Scale, BookOpen, Lightbulb, Target, ChevronDown,
  Briefcase, GraduationCap, ClipboardCheck
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import { extractTextFromFile, getSupportedFormats, getFormatFromFile, imageFileToBase64, renderPdfPagesToImages } from "@/lib/file-extract";
import jsPDF from "jspdf";

// --- Types ---

interface ContextualImpact {
  descricao_alteracao: string;
  interpretacao_juridica: string;
  categoria: string;
  impacto: string;
  fundamentos_afetados?: string[];
  jurisprudencia_relacionada?: string[];
  provas_impactadas?: string[];
  riscos_introduzidos?: string[];
  riscos_removidos?: string[];
  sugestoes_mitigacao?: string[];
  recomendacao: string;
  explicacao_simples: string;
  explicacao_tecnica: string;
  exemplo_pratico?: string;
}

interface ContextualScenario {
  nome: string;
  descricao: string;
  impacto_juridico: string;
  impacto_probatorio?: string;
  impacto_financeiro?: string;
  riscos: string[];
  vantagens?: string[];
  desvantagens?: string[];
  recomendacao: string;
}

interface ContextualLegalAnalysis {
  impactos: ContextualImpact[];
  analise_por_tribunal?: {
    tribunal: string;
    entendimento_predominante: string;
    riscos_especificos: string[];
    recomendacoes_adaptadas: string[];
  };
  cenarios: ContextualScenario[];
  resumo_impacto_geral?: string;
}

interface AiAnalysis {
  resumo?: string;
  similaridade_percentual?: number;
  alteracoes_criticas?: { trecho: string; tipo: string; descricao: string; risco: string }[];
  alteracoes_semanticas?: { original: string; modificado: string; impacto: string }[];
  alteracoes_juridicas?: { aspecto: string; antes: string; depois: string; impacto_juridico: string; risco: string }[];
  similaridades?: { trecho: string; tipo: string }[];
  sugestoes_harmonizacao?: string[];
  risco_geral?: string;
  qualidade_ocr?: string;
  analise_financeira?: {
    diferencas_valores?: { campo: string; valor_a: string; valor_b: string; diferenca: string; impacto: string }[];
    indices_alterados?: { indice_original: string; indice_novo: string; impacto: string }[];
    impacto_financeiro?: string;
    erros_calculo?: string[];
  };
  analise_multilingue?: {
    idioma_a?: string;
    idioma_b?: string;
    omissoes?: { trecho_original: string; idioma: string; impacto: string }[];
    adicoes_nao_autorizadas?: { trecho: string; idioma: string; impacto: string }[];
    inconsistencias_terminologicas?: { termo_a: string; termo_b: string; sugestao: string }[];
  };
  indicios_fraude?: { tipo: string; descricao: string; pagina?: string; probabilidade: string; recomendacao: string }[];
  analise_juridica_contextualizada?: ContextualLegalAnalysis;
}

interface ComparisonRecord {
  id: string;
  comparison_type: string;
  text_a_label: string;
  text_b_label: string;
  text_a: string;
  text_b: string;
  ai_analysis: AiAnalysis;
  risk_level: string | null;
  created_at: string;
  file_a_format?: string;
  file_b_format?: string;
  similarity_percent?: number;
}

// --- Constants ---

const RISK_COLORS: Record<string, string> = {
  alto: "bg-destructive text-destructive-foreground",
  médio: "bg-accent text-accent-foreground",
  medio: "bg-accent text-accent-foreground",
  baixo: "bg-secondary text-secondary-foreground",
};

const RISK_ICONS: Record<string, typeof AlertTriangle> = {
  alto: AlertTriangle,
  médio: Info,
  medio: Info,
  baixo: CheckCircle,
};

const FRAUD_PROB_COLORS: Record<string, string> = {
  alta: "bg-destructive text-destructive-foreground",
  media: "bg-accent text-accent-foreground",
  baixa: "bg-secondary text-secondary-foreground",
};

const TYPE_LABELS: Record<string, string> = {
  general: "Geral",
  contract: "Contrato",
  legal_piece: "Peça Jurídica",
  financial: "Financeiro",
  multilingual: "Multilíngue",
  fraud_detection: "Detecção de Fraude",
  contextual_legal: "Análise Jurídica Contextualizada",
};

const CATEGORY_LABELS: Record<string, string> = {
  fatos: "Fatos",
  fundamentos: "Fundamentos Jurídicos",
  pedidos: "Pedidos",
  provas: "Provas",
  jurisprudencia: "Jurisprudência",
  contratual: "Contratual",
  processual: "Processual",
};

const CATEGORY_ICONS: Record<string, typeof Scale> = {
  fatos: BookOpen,
  fundamentos: Scale,
  pedidos: Target,
  provas: FileText,
  jurisprudencia: BookOpen,
  contratual: FileText,
  processual: AlertTriangle,
};

const RECOMMENDATION_COLORS: Record<string, string> = {
  manter: "bg-secondary text-secondary-foreground",
  revisar: "bg-accent text-accent-foreground",
  reverter: "bg-destructive text-destructive-foreground",
};

// --- Component ---

export default function TextComparison() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const location = useLocation();
  const navState = location.state as { textA?: string; textB?: string; labelA?: string; labelB?: string; comparisonType?: string; sourceDocA?: any; sourceDocB?: any } | null;

  const [textA, setTextA] = useState(navState?.textA || "");
  const [textB, setTextB] = useState(navState?.textB || "");
  const [labelA, setLabelA] = useState(navState?.labelA || "Texto A");
  const [labelB, setLabelB] = useState(navState?.labelB || "Texto B");
  const [comparisonType, setComparisonType] = useState(navState?.comparisonType || "general");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ analysis: AiAnalysis } | null>(null);
  const [activeTab, setActiveTab] = useState("diff");
  const [simpleMode, setSimpleMode] = useState(true);

  // File extraction state
  const [extractingA, setExtractingA] = useState(false);
  const [extractingB, setExtractingB] = useState(false);
  const [fileInfoA, setFileInfoA] = useState<string | null>(null);
  const [fileInfoB, setFileInfoB] = useState<string | null>(null);
  const [formatA, setFormatA] = useState<string | null>(null);
  const [formatB, setFormatB] = useState<string | null>(null);
  const [fileSizeA, setFileSizeA] = useState<number | null>(null);
  const [fileSizeB, setFileSizeB] = useState<number | null>(null);

  // History
  const [history, setHistory] = useState<ComparisonRecord[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Auto-load documents from process integration
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (navState?.sourceDocA && navState?.sourceDocB && !autoLoadedRef.current) {
      autoLoadedRef.current = true;
      const loadDocText = async (doc: any, side: "A" | "B") => {
        const setExtracting = side === "A" ? setExtractingA : setExtractingB;
        const setText = side === "A" ? setTextA : setTextB;
        const setFileInfo = side === "A" ? setFileInfoA : setFileInfoB;
        const setFormat = side === "A" ? setFormatA : setFormatB;
        const setFileSize = side === "A" ? setFileSizeA : setFileSizeB;

        setExtracting(true);
        try {
          const { data: signedData, error: signedErr } = await supabase.storage
            .from("documents")
            .createSignedUrl(doc.file_url, 120);
          if (signedErr || !signedData?.signedUrl) throw new Error("Erro ao obter URL do documento");

          const response = await fetch(signedData.signedUrl);
          const blob = await response.blob();
          const file = new File([blob], doc.file_name, { type: doc.file_type || "application/octet-stream" });

          const fileFormat = getFormatFromFile(file);
          setFormat(fileFormat);
          setFileSize(file.size);

          const extractResult = await extractTextFromFile(file);

          if (extractResult.needsOcr) {
            setFileInfo(`${fileFormat} • Executando OCR...`);
            let images: string[];
            if (fileFormat === "JPG" || fileFormat === "PNG") {
              const dataUrl = await imageFileToBase64(file);
              images = [dataUrl];
            } else {
              images = await renderPdfPagesToImages(file, 10);
            }
            const { data: ocrData, error: ocrErr } = await supabase.functions.invoke("extract-pdf-text", {
              body: { images, organizationId: activeOrgId },
            });
            if (ocrErr) throw ocrErr;
            const ocrText = ocrData?.text || "";
            setText(ocrText);
            setFileInfo(`${fileFormat} • OCR • ${ocrText.length.toLocaleString()} caracteres`);
          } else {
            setText(extractResult.text);
            setFileInfo(`${fileFormat} • ${extractResult.text.length.toLocaleString()} caracteres`);
          }
        } catch (e: any) {
          console.error(`Error loading doc ${side}:`, e);
          setFileInfo("Erro ao carregar documento");
          toast({ title: `Erro ao carregar ${doc.file_name}`, description: e.message, variant: "destructive" });
        } finally {
          setExtracting(false);
        }
      };
      loadDocText(navState.sourceDocA, "A");
      loadDocText(navState.sourceDocB, "B");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileUpload = async (side: "A" | "B", file: File) => {
    const setText = side === "A" ? setTextA : setTextB;
    const setExtracting = side === "A" ? setExtractingA : setExtractingB;
    const setFileInfo = side === "A" ? setFileInfoA : setFileInfoB;
    const setLabel = side === "A" ? setLabelA : setLabelB;
    const setFormat = side === "A" ? setFormatA : setFormatB;
    const setFileSize = side === "A" ? setFileSizeA : setFileSizeB;

    setExtracting(true);
    setFileInfo(null);

    try {
      const fileFormat = getFormatFromFile(file);
      setFormat(fileFormat);
      setFileSize(file.size);
      setLabel(file.name);

      const result = await extractTextFromFile(file);

      if (result.needsOcr) {
        toast({ title: "Arquivo requer OCR", description: "Executando OCR com IA..." });
        setFileInfo(`${fileFormat} • Executando OCR...`);

        let images: string[];
        if (fileFormat === "JPG" || fileFormat === "PNG") {
          const dataUrl = await imageFileToBase64(file);
          images = [dataUrl];
        } else {
          images = await renderPdfPagesToImages(file, 10);
        }

        const { data, error } = await supabase.functions.invoke("extract-pdf-text", {
          body: { images, organizationId: activeOrgId },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const ocrText = data.text || "";
        setText(ocrText);
        setFileInfo(`${fileFormat} • ${data.pages || images.length} páginas OCR • ${ocrText.length.toLocaleString()} caracteres`);
        toast({ title: `OCR concluído para ${file.name}` });
      } else {
        setText(result.text);
        const pageInfo = result.pageCount ? `${result.pageCount} páginas • ` : "";
        setFileInfo(`${fileFormat} • ${pageInfo}${result.text.length.toLocaleString()} caracteres`);
        toast({ title: `Texto extraído de ${file.name}` });
      }
    } catch (e: any) {
      console.error("File extraction error:", e);
      toast({ title: "Erro ao extrair texto", description: e.message, variant: "destructive" });
      setFileInfo("Erro na extração");
    } finally {
      setExtracting(false);
    }
  };

  const handleFileInput = (side: "A" | "B") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande (máx 20MB)", variant: "destructive" });
      return;
    }
    handleFileUpload(side, file);
    e.target.value = "";
  };

  const handleCompare = async () => {
    if (!textA.trim() || !textB.trim()) {
      toast({ title: "Preencha ambos os textos", variant: "destructive" });
      return;
    }
    if (!activeOrgId) {
      toast({ title: "Selecione uma organização", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("compare-texts", {
        body: {
          textA,
          textB,
          comparisonType,
          labelA,
          labelB,
          organizationId: activeOrgId,
          fileAFormat: formatA,
          fileBFormat: formatB,
          fileASize: fileSizeA,
          fileBSize: fileSizeB,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({ analysis: data.analysis });
      setActiveTab(data.analysis?.analise_juridica_contextualizada ? "legal_impact" : "analysis");
      toast({ title: "Comparação concluída!" });
      if (historyLoaded) loadHistory();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro na comparação", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!activeOrgId) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("text_comparisons")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setHistory((data as any[]) || []);
      setHistoryLoaded(true);
    } catch (e: any) {
      toast({ title: "Erro ao carregar histórico", description: e.message, variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadFromHistory = (record: ComparisonRecord) => {
    setTextA(record.text_a);
    setTextB(record.text_b);
    setLabelA(record.text_a_label);
    setLabelB(record.text_b_label);
    setComparisonType(record.comparison_type);
    setResult({ analysis: record.ai_analysis });
    setActiveTab(record.ai_analysis?.analise_juridica_contextualizada ? "legal_impact" : "analysis");
  };

  const deleteComparison = async (id: string) => {
    const { error } = await supabase.from("text_comparisons").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      setHistory((prev) => prev.filter((h) => h.id !== id));
    }
  };

  type ReportType = "executivo" | "tecnico" | "auditoria";

  const REPORT_TYPE_LABELS: Record<ReportType, string> = {
    executivo: "Executivo (Cliente)",
    tecnico: "Técnico (Advogado)",
    auditoria: "Auditoria (Compliance)",
  };

  const logAuditEvent = async (action: string, metadata: Record<string, any>) => {
    try {
      await supabase.from("audit_logs").insert({
        action,
        user_id: user?.id || null,
        organization_id: activeOrgId || null,
        resource_type: "comparison_report",
        metadata: {
          ...metadata,
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
      } as any);
    } catch {}
  };

  const addPdfSection = (doc: jsPDF, title: string, y: number, margin: number): number => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text(title, margin, y);
    return y + 7;
  };

  const addPdfText = (doc: jsPDF, text: string, y: number, margin: number, maxWidth: number, fontSize = 9): number => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    if (y + lines.length * 4 > 280) { doc.addPage(); y = 20; }
    doc.text(lines, margin, y);
    return y + lines.length * 4 + 2;
  };

  const addPdfBullet = (doc: jsPDF, text: string, y: number, margin: number, maxWidth: number): number => {
    return addPdfText(doc, `• ${text}`, y, margin, maxWidth);
  };

  const exportPdfReport = async (reportType: ReportType = "tecnico") => {
    if (!analysis) return;
    const doc = new jsPDF();
    const margin = 15;
    const maxWidth = 180;
    let y = 20;
    const now = new Date();
    const isExec = reportType === "executivo";
    const isTech = reportType === "tecnico";
    const isAudit = reportType === "auditoria";

    // ═══════ Cover Page ═══════
    doc.setFontSize(22);
    doc.text("Relatório de Comparação", margin, y);
    y += 10;
    doc.setFontSize(14);
    doc.text(REPORT_TYPE_LABELS[reportType], margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.text(`Tipo de análise: ${TYPE_LABELS[comparisonType] || comparisonType}`, margin, y); y += 5;
    doc.text(`Documentos: ${labelA} × ${labelB}`, margin, y); y += 5;
    doc.text(`Data: ${format(now, "dd/MM/yyyy HH:mm", { locale: ptBR })}`, margin, y); y += 5;
    if (formatA || formatB) {
      doc.text(`Formatos: ${formatA || "texto"} / ${formatB || "texto"}`, margin, y); y += 5;
    }
    if (isAudit && user?.email) {
      doc.text(`Gerado por: ${user.email}`, margin, y); y += 5;
      doc.text(`ID do usuário: ${user.id}`, margin, y); y += 5;
    }
    y += 5;

    // ═══════ 1. Resumo Executivo ═══════
    y = addPdfSection(doc, "1. Resumo Executivo", y, margin);

    if (analysis.similaridade_percentual !== undefined) {
      y = addPdfText(doc, `Similaridade: ${analysis.similaridade_percentual}%`, y, margin, maxWidth, 11);
    }
    if (analysis.risco_geral) {
      y = addPdfText(doc, `Nível de risco geral: ${analysis.risco_geral.toUpperCase()}`, y, margin, maxWidth, 11);
    }

    const totalDiffs = (analysis.alteracoes_criticas?.length || 0) + (analysis.alteracoes_semanticas?.length || 0) + (analysis.alteracoes_juridicas?.length || 0);
    y = addPdfText(doc, `Total de diferenças identificadas: ${totalDiffs}`, y, margin, maxWidth, 10);
    y = addPdfText(doc, `Alterações críticas: ${analysis.alteracoes_criticas?.length || 0}`, y, margin, maxWidth, 10);

    if (analysis.resumo) {
      y += 2;
      if (isExec) {
        y = addPdfText(doc, "O que mudou:", y, margin, maxWidth, 10);
      }
      y = addPdfText(doc, analysis.resumo, y, margin, maxWidth);
    }
    y += 3;

    // ═══════ 2. Destaques das Diferenças ═══════
    if (analysis.alteracoes_criticas?.length) {
      const sectionTitle = isExec ? "2. Principais Diferenças" : "2. Destaques das Diferenças";
      y = addPdfSection(doc, sectionTitle, y, margin);

      for (const c of analysis.alteracoes_criticas) {
        if (y > 265) { doc.addPage(); y = 20; }
        if (isExec) {
          y = addPdfBullet(doc, `${c.descricao} (Risco: ${c.risco})`, y, margin, maxWidth);
        } else {
          y = addPdfText(doc, `[${c.risco.toUpperCase()}] ${c.tipo}: ${c.descricao}`, y, margin, maxWidth, 9);
          y = addPdfText(doc, `  Trecho: "${c.trecho}"`, y, margin, maxWidth, 8);
        }
      }
      y += 3;
    }

    // Semantic changes (tech + audit only)
    if (!isExec && analysis.alteracoes_semanticas?.length) {
      y = addPdfSection(doc, "2.1 Alterações Semânticas", y, margin);
      for (const s of analysis.alteracoes_semanticas) {
        if (y > 260) { doc.addPage(); y = 20; }
        y = addPdfText(doc, `Original: ${s.original}`, y, margin, maxWidth, 8);
        y = addPdfText(doc, `Modificado: ${s.modificado}`, y, margin, maxWidth, 8);
        y = addPdfText(doc, `Impacto: ${s.impacto}`, y, margin, maxWidth, 8);
        y += 2;
      }
      y += 2;
    }

    // ═══════ 3. Alterações Jurídicas ═══════
    if (analysis.alteracoes_juridicas?.length) {
      y = addPdfSection(doc, isExec ? "3. Riscos Identificados" : "3. Alterações Jurídicas", y, margin);
      for (const j of analysis.alteracoes_juridicas) {
        if (y > 255) { doc.addPage(); y = 20; }
        if (isExec) {
          y = addPdfBullet(doc, `${j.aspecto}: ${j.impacto_juridico} (Risco: ${j.risco})`, y, margin, maxWidth);
        } else {
          y = addPdfText(doc, `[${j.risco.toUpperCase()}] ${j.aspecto}`, y, margin, maxWidth, 10);
          y = addPdfText(doc, `  Antes: ${j.antes}`, y, margin, maxWidth, 9);
          y = addPdfText(doc, `  Depois: ${j.depois}`, y, margin, maxWidth, 9);
          y = addPdfText(doc, `  Impacto: ${j.impacto_juridico}`, y, margin, maxWidth, 9);
          y += 2;
        }
      }
      y += 3;
    }

    // ═══════ 4. Similaridades (tech + audit) ═══════
    if (!isExec && analysis.similaridades?.length) {
      y = addPdfSection(doc, "4. Similaridades e Equivalências", y, margin);
      for (const s of analysis.similaridades) {
        if (y > 270) { doc.addPage(); y = 20; }
        const tipoLabel = s.tipo === "identico" ? "Idêntico" : s.tipo === "equivalente" ? "Equivalente" : "Preservado";
        y = addPdfBullet(doc, `[${tipoLabel}] ${s.trecho}`, y, margin, maxWidth);
      }
      y += 3;
    }

    // ═══════ 5. Análise Jurídica Contextualizada ═══════
    const ctx = analysis.analise_juridica_contextualizada;
    if (ctx) {
      y = addPdfSection(doc, isExec ? "4. Impacto para o Cliente" : "5. Análise Jurídica Contextualizada", y, margin);

      if (ctx.resumo_impacto_geral) {
        y = addPdfText(doc, ctx.resumo_impacto_geral, y, margin, maxWidth);
        y += 2;
      }

      for (const imp of ctx.impactos || []) {
        if (y > 250) { doc.addPage(); y = 20; }
        const catLabel = CATEGORY_LABELS[imp.categoria] || imp.categoria;
        doc.setFontSize(10);
        doc.text(`[${imp.impacto.toUpperCase()}] ${catLabel} — ${imp.recomendacao}`, margin, y);
        y += 5;

        if (isExec) {
          y = addPdfText(doc, imp.explicacao_simples, y, margin, maxWidth);
        } else {
          y = addPdfText(doc, imp.descricao_alteracao, y, margin, maxWidth);
          y = addPdfText(doc, `Interpretação: ${imp.interpretacao_juridica}`, y, margin, maxWidth);
          y = addPdfText(doc, `Explicação técnica: ${imp.explicacao_tecnica}`, y, margin, maxWidth);
        }

        if (!isExec && imp.fundamentos_afetados?.length) {
          y = addPdfText(doc, `  Fundamentos: ${imp.fundamentos_afetados.join(", ")}`, y, margin, maxWidth, 8);
        }
        if (!isExec && imp.jurisprudencia_relacionada?.length) {
          y = addPdfText(doc, `  Jurisprudência: ${imp.jurisprudencia_relacionada.join(", ")}`, y, margin, maxWidth, 8);
        }
        if (imp.riscos_introduzidos?.length) {
          y = addPdfText(doc, `  Riscos: ${imp.riscos_introduzidos.join("; ")}`, y, margin, maxWidth, 8);
        }
        if (imp.sugestoes_mitigacao?.length) {
          y = addPdfText(doc, `  Mitigação: ${imp.sugestoes_mitigacao.join("; ")}`, y, margin, maxWidth, 8);
        }
        y += 3;
      }

      // Court analysis
      if (ctx.analise_por_tribunal) {
        if (y > 240) { doc.addPage(); y = 20; }
        const courtTitle = isExec ? "Análise do Tribunal" : "Análise por Tribunal";
        doc.setFontSize(11);
        doc.text(`${courtTitle}: ${ctx.analise_por_tribunal.tribunal}`, margin, y);
        y += 6;

        if (isExec) {
          y = addPdfText(doc, ctx.analise_por_tribunal.entendimento_predominante, y, margin, maxWidth);
        } else {
          y = addPdfText(doc, `Entendimento predominante: ${ctx.analise_por_tribunal.entendimento_predominante}`, y, margin, maxWidth);
          if (ctx.analise_por_tribunal.riscos_especificos?.length) {
            y = addPdfText(doc, `Riscos específicos:`, y, margin, maxWidth, 9);
            for (const r of ctx.analise_por_tribunal.riscos_especificos) {
              y = addPdfBullet(doc, r, y, margin + 5, maxWidth - 5);
            }
          }
          if (ctx.analise_por_tribunal.recomendacoes_adaptadas?.length) {
            y = addPdfText(doc, `Recomendações adaptadas:`, y, margin, maxWidth, 9);
            for (const r of ctx.analise_por_tribunal.recomendacoes_adaptadas) {
              y = addPdfBullet(doc, r, y, margin + 5, maxWidth - 5);
            }
          }
        }
        y += 3;
      }

      // Scenarios
      if (ctx.cenarios?.length) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.text("Simulação de Cenários", margin, y);
        y += 6;

        for (const sc of ctx.cenarios) {
          if (y > 255) { doc.addPage(); y = 20; }
          doc.setFontSize(10);
          doc.text(sc.nome, margin, y); y += 5;

          if (isExec) {
            y = addPdfText(doc, sc.descricao, y, margin, maxWidth);
            y = addPdfText(doc, `Recomendação: ${sc.recomendacao}`, y, margin, maxWidth);
          } else {
            y = addPdfText(doc, sc.descricao, y, margin, maxWidth);
            y = addPdfText(doc, `Impacto jurídico: ${sc.impacto_juridico}`, y, margin, maxWidth, 8);
            if (sc.impacto_probatorio) y = addPdfText(doc, `Impacto probatório: ${sc.impacto_probatorio}`, y, margin, maxWidth, 8);
            if (sc.impacto_financeiro) y = addPdfText(doc, `Impacto financeiro: ${sc.impacto_financeiro}`, y, margin, maxWidth, 8);
            if (sc.vantagens?.length) y = addPdfText(doc, `Vantagens: ${sc.vantagens.join("; ")}`, y, margin, maxWidth, 8);
            if (sc.desvantagens?.length) y = addPdfText(doc, `Desvantagens: ${sc.desvantagens.join("; ")}`, y, margin, maxWidth, 8);
            if (sc.riscos?.length) y = addPdfText(doc, `Riscos: ${sc.riscos.join("; ")}`, y, margin, maxWidth, 8);
            y = addPdfText(doc, `Recomendação: ${sc.recomendacao}`, y, margin, maxWidth, 8);
          }
          y += 3;
        }
      }
    }

    // ═══════ 6. Análise Financeira ═══════
    const fin = analysis.analise_financeira;
    if (fin) {
      y = addPdfSection(doc, isExec ? "5. Impacto Financeiro" : "6. Análise Financeira", y, margin);
      if (fin.impacto_financeiro) {
        y = addPdfText(doc, fin.impacto_financeiro, y, margin, maxWidth);
      }
      if (fin.diferencas_valores?.length) {
        for (const v of fin.diferencas_valores) {
          if (y > 265) { doc.addPage(); y = 20; }
          y = addPdfBullet(doc, `${v.campo}: ${v.valor_a} → ${v.valor_b} (${v.diferenca}) — ${v.impacto}`, y, margin, maxWidth);
        }
      }
      if (!isExec && fin.erros_calculo?.length) {
        y = addPdfText(doc, "Erros de cálculo detectados:", y, margin, maxWidth, 9);
        for (const err of fin.erros_calculo) {
          y = addPdfBullet(doc, err, y, margin + 5, maxWidth - 5);
        }
      }
      y += 3;
    }

    // ═══════ 7. Análise Multilíngue (tech + audit) ═══════
    const multi = analysis.analise_multilingue;
    if (!isExec && multi) {
      y = addPdfSection(doc, "7. Análise Multilíngue", y, margin);
      y = addPdfText(doc, `Idiomas: ${multi.idioma_a || "N/A"} / ${multi.idioma_b || "N/A"}`, y, margin, maxWidth, 10);
      if (multi.omissoes?.length) {
        y = addPdfText(doc, `Omissões na tradução (${multi.omissoes.length}):`, y, margin, maxWidth, 9);
        for (const o of multi.omissoes) {
          y = addPdfBullet(doc, `${o.trecho_original} [${o.idioma}] — ${o.impacto}`, y, margin + 5, maxWidth - 5);
        }
      }
      if (multi.inconsistencias_terminologicas?.length) {
        y = addPdfText(doc, `Inconsistências terminológicas:`, y, margin, maxWidth, 9);
        for (const t of multi.inconsistencias_terminologicas) {
          y = addPdfBullet(doc, `${t.termo_a} → ${t.termo_b}: ${t.sugestao}`, y, margin + 5, maxWidth - 5);
        }
      }
      y += 3;
    }

    // ═══════ 8. Indícios de Fraude ═══════
    if (analysis.indicios_fraude?.length) {
      y = addPdfSection(doc, isExec ? "6. Alertas de Fraude" : "8. Indícios de Fraude", y, margin);
      for (const f of analysis.indicios_fraude) {
        if (y > 260) { doc.addPage(); y = 20; }
        if (isExec) {
          y = addPdfBullet(doc, `${f.tipo} (${f.probabilidade}): ${f.recomendacao}`, y, margin, maxWidth);
        } else {
          y = addPdfText(doc, `[${f.probabilidade.toUpperCase()}] ${f.tipo}`, y, margin, maxWidth, 10);
          y = addPdfText(doc, f.descricao, y, margin, maxWidth);
          if (f.pagina) y = addPdfText(doc, `Página: ${f.pagina}`, y, margin, maxWidth, 8);
          y = addPdfText(doc, `Recomendação: ${f.recomendacao}`, y, margin, maxWidth, 8);
          y += 2;
        }
      }
      y += 3;
    }

    // ═══════ 9. Recomendações ═══════
    if (analysis.sugestoes_harmonizacao?.length) {
      const recTitle = isExec ? "Próximos Passos Recomendados" : "Recomendações e Sugestões de Harmonização";
      y = addPdfSection(doc, recTitle, y, margin);
      for (const s of analysis.sugestoes_harmonizacao) {
        if (y > 270) { doc.addPage(); y = 20; }
        y = addPdfBullet(doc, s, y, margin, maxWidth);
      }
      y += 3;
    }

    // ═══════ 10. Trilha de Auditoria (audit only) ═══════
    if (isAudit) {
      doc.addPage();
      y = 20;
      doc.setFontSize(14);
      doc.text("Trilha de Auditoria", margin, y);
      y += 8;

      const auditItems = [
        `Gerado em: ${format(now, "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}`,
        `Usuário: ${user?.email || "N/A"}`,
        `ID do Usuário: ${user?.id || "N/A"}`,
        `Organização: ${activeOrgId || "N/A"}`,
        `Tipo de comparação: ${TYPE_LABELS[comparisonType] || comparisonType}`,
        `Tipo de relatório: ${REPORT_TYPE_LABELS[reportType]}`,
        `Documento A: ${labelA} (${formatA || "texto"})`,
        `Documento B: ${labelB} (${formatB || "texto"})`,
        `Tamanho A: ${fileSizeA ? `${(fileSizeA / 1024).toFixed(1)} KB` : `${textA.length} caracteres`}`,
        `Tamanho B: ${fileSizeB ? `${(fileSizeB / 1024).toFixed(1)} KB` : `${textB.length} caracteres`}`,
        `Similaridade: ${analysis.similaridade_percentual ?? "N/A"}%`,
        `Risco geral: ${analysis.risco_geral || "N/A"}`,
        `Qualidade OCR: ${analysis.qualidade_ocr || "N/A"}`,
        `Alterações críticas: ${analysis.alteracoes_criticas?.length || 0}`,
        `Alterações semânticas: ${analysis.alteracoes_semanticas?.length || 0}`,
        `Alterações jurídicas: ${analysis.alteracoes_juridicas?.length || 0}`,
        `Impactos contextuais: ${ctx?.impactos?.length || 0}`,
        `Cenários simulados: ${ctx?.cenarios?.length || 0}`,
        `Indícios de fraude: ${analysis.indicios_fraude?.length || 0}`,
        `Sugestões geradas: ${analysis.sugestoes_harmonizacao?.length || 0}`,
      ];

      doc.setFontSize(9);
      for (const item of auditItems) {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(item, margin, y);
        y += 5;
      }

      y += 5;
      doc.setFontSize(8);
      doc.text("Este relatório é gerado automaticamente pelo LexIA. Trilha de auditoria imutável.", margin, y);
      y += 4;
      doc.text("Fontes: documentos fornecidos pelo usuário, análise de IA, dados internos do sistema.", margin, y);
    }

    // ═══════ Footer on last page ═══════
    if (!isAudit) {
      doc.setFontSize(7);
      doc.text(
        `Gerado pelo LexIA em ${format(now, "dd/MM/yyyy HH:mm")} — Relatório ${REPORT_TYPE_LABELS[reportType]}`,
        margin,
        285
      );
    }

    const filename = `comparacao-${reportType}-${format(now, "yyyy-MM-dd-HHmm")}.pdf`;
    doc.save(filename);

    // ═══════ Audit Logging ═══════
    const auditMeta = {
      report_type: reportType,
      comparison_type: comparisonType,
      label_a: labelA,
      label_b: labelB,
      format_a: formatA,
      format_b: formatB,
      risk_level: analysis.risco_geral,
      critical_changes: analysis.alteracoes_criticas?.length || 0,
      legal_changes: analysis.alteracoes_juridicas?.length || 0,
      has_fraud_indicators: (analysis.indicios_fraude?.length || 0) > 0,
      recommendations_count: analysis.sugestoes_harmonizacao?.length || 0,
    };

    await logAuditEvent("comparison_report_generated", auditMeta);

    const typeSpecificAction: Record<ReportType, string> = {
      executivo: "executive_report_generated",
      tecnico: "technical_report_generated",
      auditoria: "audit_trail_report_generated",
    };
    await logAuditEvent(typeSpecificAction[reportType], auditMeta);

    if (analysis.risco_geral === "alto") {
      await logAuditEvent("comparison_report_risk_detected", auditMeta);
    }
    if ((analysis.sugestoes_harmonizacao?.length || 0) > 0) {
      await logAuditEvent("comparison_report_recommendation_generated", auditMeta);
    }

    toast({ title: `Relatório ${REPORT_TYPE_LABELS[reportType]} exportado!` });
  };

  const analysis = result?.analysis;

  const hasFinancial = comparisonType === "financial" && analysis?.analise_financeira;
  const hasMultilingual = comparisonType === "multilingual" && analysis?.analise_multilingue;
  const hasFraud = comparisonType === "fraud_detection" && analysis?.indicios_fraude;
  const hasContextualLegal = !!analysis?.analise_juridica_contextualizada;

  const renderTextInputCard = (side: "A" | "B") => {
    const label = side === "A" ? labelA : labelB;
    const text = side === "A" ? textA : textB;
    const setText = side === "A" ? setTextA : setTextB;
    const extracting = side === "A" ? extractingA : extractingB;
    const fileInfo = side === "A" ? fileInfoA : fileInfoB;
    const fmt = side === "A" ? formatA : formatB;

    return (
      <Card className="border-border">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold text-foreground">{label}</CardTitle>
              {fmt && (
                <Badge variant="outline" className="text-xs">{fmt}</Badge>
              )}
            </div>
            <div className="relative">
              <input
                type="file"
                accept={getSupportedFormats()}
                onChange={handleFileInput(side)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={extracting}
              />
              <Button variant="outline" size="sm" disabled={extracting} className="gap-1.5 pointer-events-none">
                {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {extracting ? "Extraindo..." : "Upload Arquivo"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole texto aqui ou faça upload de um arquivo (PDF, DOCX, TXT, HTML, RTF, imagem)..."
            className="min-h-[220px] font-mono text-xs"
            disabled={extracting}
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-muted-foreground">{text.length.toLocaleString()} caracteres</p>
            {fileInfo && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> {fileInfo}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderContextualLegalTab = () => {
    const ctx = analysis?.analise_juridica_contextualizada;
    if (!ctx) return null;

    const groupedImpacts = (ctx.impactos || []).reduce<Record<string, ContextualImpact[]>>((acc, imp) => {
      const cat = imp.categoria || "geral";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(imp);
      return acc;
    }, {});

    return (
      <div className="space-y-4">
        {/* Summary */}
        {ctx.resumo_impacto_geral && (
          <Card className="border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Scale className="h-4 w-4" /> Resumo do Impacto Geral
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 prose prose-sm max-w-none text-foreground">
              <ReactMarkdown>{ctx.resumo_impacto_geral}</ReactMarkdown>
            </CardContent>
          </Card>
        )}

        {/* Explanation mode toggle */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-muted-foreground">Técnico</span>
          <Switch checked={simpleMode} onCheckedChange={setSimpleMode} />
          <span className="text-xs text-muted-foreground">Simples</span>
          <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        {/* Impacts grouped by category */}
        {Object.entries(groupedImpacts).map(([category, impacts]) => {
          const CatIcon = CATEGORY_ICONS[category] || Info;
          return (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CatIcon className="h-4 w-4" />
                {CATEGORY_LABELS[category] || category} ({impacts.length})
              </h3>
              {impacts.map((imp, i) => {
                const RiskIcon = RISK_ICONS[imp.impacto] || Info;
                return (
                  <Card key={i} className="border-border">
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <RiskIcon className="h-4 w-4 shrink-0" />
                          <Badge className={`text-xs ${RISK_COLORS[imp.impacto] || ""}`}>
                            {imp.impacto}
                          </Badge>
                          <Badge className={`text-xs ${RECOMMENDATION_COLORS[imp.recomendacao] || ""}`}>
                            {imp.recomendacao}
                          </Badge>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm font-medium text-foreground">{imp.descricao_alteracao}</p>

                      {/* Explanation (toggle) */}
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {simpleMode ? "Explicação simplificada" : "Explicação técnica"}
                        </p>
                        <p className="text-sm text-foreground">
                          {simpleMode ? imp.explicacao_simples : imp.explicacao_tecnica}
                        </p>
                      </div>

                      {/* Interpretation */}
                      <p className="text-xs text-muted-foreground">{imp.interpretacao_juridica}</p>

                      {/* Example */}
                      {imp.exemplo_pratico && (
                        <div className="p-2 rounded bg-primary/5 border border-primary/10">
                          <p className="text-xs text-muted-foreground">
                            <strong>Exemplo:</strong> {imp.exemplo_pratico}
                          </p>
                        </div>
                      )}

                      {/* Risks & suggestions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {imp.riscos_introduzidos && imp.riscos_introduzidos.length > 0 && (
                          <div className="text-xs">
                            <span className="font-medium text-destructive">Riscos introduzidos:</span>
                            <ul className="list-disc list-inside mt-1 text-foreground">
                              {imp.riscos_introduzidos.map((r, ri) => <li key={ri}>{r}</li>)}
                            </ul>
                          </div>
                        )}
                        {imp.sugestoes_mitigacao && imp.sugestoes_mitigacao.length > 0 && (
                          <div className="text-xs">
                            <span className="font-medium text-primary">Sugestões de mitigação:</span>
                            <ul className="list-disc list-inside mt-1 text-foreground">
                              {imp.sugestoes_mitigacao.map((s, si) => <li key={si}>{s}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Legal foundations & jurisprudence */}
                      {(imp.fundamentos_afetados?.length || imp.jurisprudencia_relacionada?.length) && (
                        <div className="flex flex-wrap gap-1">
                          {imp.fundamentos_afetados?.map((f, fi) => (
                            <Badge key={fi} variant="outline" className="text-xs">{f}</Badge>
                          ))}
                          {imp.jurisprudencia_relacionada?.map((j, ji) => (
                            <Badge key={ji} variant="outline" className="text-xs">{j}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}

        {/* Court analysis */}
        {ctx.analise_por_tribunal && (
          <Card className="border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Scale className="h-4 w-4" /> Análise por Tribunal: {ctx.analise_por_tribunal.tribunal}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Entendimento predominante</p>
                <p className="text-sm text-foreground">{ctx.analise_por_tribunal.entendimento_predominante}</p>
              </div>
              {ctx.analise_por_tribunal.riscos_especificos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-destructive mb-1">Riscos específicos do tribunal</p>
                  <ul className="list-disc list-inside text-xs text-foreground space-y-1">
                    {ctx.analise_por_tribunal.riscos_especificos.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {ctx.analise_por_tribunal.recomendacoes_adaptadas.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-primary mb-1">Recomendações adaptadas</p>
                  <ul className="list-disc list-inside text-xs text-foreground space-y-1">
                    {ctx.analise_por_tribunal.recomendacoes_adaptadas.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Scenarios */}
        {ctx.cenarios && ctx.cenarios.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="h-4 w-4" /> Simulação de Cenários ({ctx.cenarios.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ctx.cenarios.map((sc, i) => (
                <Card key={i} className="border-border">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">{sc.nome}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 space-y-2">
                    <p className="text-sm text-foreground">{sc.descricao}</p>
                    <div className="p-2 rounded bg-muted/50 border border-border text-xs space-y-1">
                      <p><strong>Impacto jurídico:</strong> {sc.impacto_juridico}</p>
                      {sc.impacto_probatorio && <p><strong>Impacto probatório:</strong> {sc.impacto_probatorio}</p>}
                      {sc.impacto_financeiro && <p><strong>Impacto financeiro:</strong> {sc.impacto_financeiro}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {sc.vantagens && sc.vantagens.length > 0 && (
                        <div>
                          <span className="font-medium text-primary">Vantagens:</span>
                          <ul className="list-disc list-inside mt-1">{sc.vantagens.map((v, vi) => <li key={vi}>{v}</li>)}</ul>
                        </div>
                      )}
                      {sc.desvantagens && sc.desvantagens.length > 0 && (
                        <div>
                          <span className="font-medium text-destructive">Desvantagens:</span>
                          <ul className="list-disc list-inside mt-1">{sc.desvantagens.map((d, di) => <li key={di}>{d}</li>)}</ul>
                        </div>
                      )}
                    </div>
                    {sc.riscos.length > 0 && (
                      <div className="text-xs">
                        <span className="font-medium text-muted-foreground">Riscos:</span>
                        <ul className="list-disc list-inside mt-1">{sc.riscos.map((r, ri) => <li key={ri}>{r}</li>)}</ul>
                      </div>
                    )}
                    <div className="p-2 rounded bg-accent/10 border border-accent/20">
                      <p className="text-xs"><strong>Recomendação:</strong> {sc.recomendacao}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comparação de Textos e Arquivos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Compare textos, PDFs, DOCX, imagens e outros formatos com análise literal, semântica, jurídica e financeira.
        </p>
      </div>

      {/* Config row */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tipo de comparação</label>
          <Select value={comparisonType} onValueChange={setComparisonType}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">Geral</SelectItem>
              <SelectItem value="contract">Contrato (cláusula a cláusula)</SelectItem>
              <SelectItem value="legal_piece">Peça Jurídica</SelectItem>
              <SelectItem value="financial">Financeiro (valores, cálculos)</SelectItem>
              <SelectItem value="multilingual">Multilíngue (tradução)</SelectItem>
              <SelectItem value="fraud_detection">Detecção de Fraude</SelectItem>
              <SelectItem value="contextual_legal">Análise Jurídica Contextualizada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[120px]">
          <label className="text-xs font-medium text-muted-foreground">Rótulo A</label>
          <Input value={labelA} onChange={(e) => setLabelA(e.target.value)} />
        </div>
        <div className="space-y-1 flex-1 min-w-[120px]">
          <label className="text-xs font-medium text-muted-foreground">Rótulo B</label>
          <Input value={labelB} onChange={(e) => setLabelB(e.target.value)} />
        </div>
      </div>

      {/* Input areas side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderTextInputCard("A")}
        {renderTextInputCard("B")}
      </div>

      {/* Compare button */}
      <div className="flex justify-center gap-3">
        <Button onClick={handleCompare} disabled={loading || extractingA || extractingB || !textA.trim() || !textB.trim()} size="lg" className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
          {loading ? "Analisando..." : "Comparar Textos"}
        </Button>
        {analysis && (
          <Button variant="outline" size="lg" onClick={exportPdfReport} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Relatório
          </Button>
        )}
      </div>

      {/* Similarity bar */}
      {analysis?.similaridade_percentual !== undefined && (
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Similaridade
              </span>
              <span className="text-sm font-bold text-primary">{analysis.similaridade_percentual}%</span>
            </div>
            <Progress value={analysis.similaridade_percentual} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {(analysis || textA || textB) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="diff">Diff Literal</TabsTrigger>
            <TabsTrigger value="analysis" disabled={!analysis}>Análise IA</TabsTrigger>
            {hasContextualLegal && <TabsTrigger value="legal_impact"><Scale className="h-3.5 w-3.5 mr-1" />Impacto Jurídico</TabsTrigger>}
            <TabsTrigger value="similarities" disabled={!analysis}>Similaridades</TabsTrigger>
            <TabsTrigger value="risks" disabled={!analysis}>Riscos</TabsTrigger>
            {hasFinancial && <TabsTrigger value="financial"><DollarSign className="h-3.5 w-3.5 mr-1" />Financeiro</TabsTrigger>}
            {hasMultilingual && <TabsTrigger value="multilingual"><Languages className="h-3.5 w-3.5 mr-1" />Multilíngue</TabsTrigger>}
            {hasFraud && <TabsTrigger value="fraud"><Shield className="h-3.5 w-3.5 mr-1" />Fraude</TabsTrigger>}
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="diff">
            {textA && textB ? (
              <Card className="border-border">
                <CardContent className="p-4">
                  <DiffView original={textA} revised={textB} />
                </CardContent>
              </Card>
            ) : (
              <p className="text-muted-foreground text-sm">Preencha ambos os textos para visualizar o diff.</p>
            )}
          </TabsContent>

          <TabsContent value="analysis">
            {analysis && (
              <div className="space-y-4">
                <Card className="border-border">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      Resumo Geral
                      {analysis.risco_geral && analysis.risco_geral !== "nenhum" && (
                        <Badge className={RISK_COLORS[analysis.risco_geral] || ""}>
                          Risco {analysis.risco_geral}
                        </Badge>
                      )}
                      {analysis.qualidade_ocr && analysis.qualidade_ocr !== "n/a" && (
                        <Badge variant="outline" className="text-xs">
                          <Eye className="h-3 w-3 mr-1" /> OCR: {analysis.qualidade_ocr}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown>{analysis.resumo || "Sem resumo disponível."}</ReactMarkdown>
                  </CardContent>
                </Card>

                {analysis.alteracoes_criticas && analysis.alteracoes_criticas.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Alterações Críticas ({analysis.alteracoes_criticas.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                      {analysis.alteracoes_criticas.map((c, i) => {
                        const RiskIcon = RISK_ICONS[c.risco] || Info;
                        return (
                          <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border space-y-1">
                            <div className="flex items-center gap-2">
                              <RiskIcon className="h-4 w-4 shrink-0" />
                              <Badge variant="outline" className="text-xs">{c.tipo}</Badge>
                              <Badge className={`text-xs ${RISK_COLORS[c.risco] || ""}`}>{c.risco}</Badge>
                            </div>
                            <p className="text-sm text-foreground">{c.descricao}</p>
                            <p className="text-xs text-muted-foreground font-mono">"{c.trecho}"</p>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {analysis.alteracoes_semanticas && analysis.alteracoes_semanticas.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Alterações Semânticas ({analysis.alteracoes_semanticas.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                      {analysis.alteracoes_semanticas.map((s, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="font-semibold text-destructive">Original:</span>
                              <p className="text-foreground mt-1">{s.original}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-primary">Modificado:</span>
                              <p className="text-foreground mt-1">{s.modificado}</p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">Impacto: {s.impacto}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {analysis.sugestoes_harmonizacao && analysis.sugestoes_harmonizacao.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Sugestões de Harmonização</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                        {analysis.sugestoes_harmonizacao.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Contextual Legal Impact tab */}
          <TabsContent value="legal_impact">
            {renderContextualLegalTab()}
          </TabsContent>

          {/* Similarities tab */}
          <TabsContent value="similarities">
            {analysis?.similaridades && analysis.similaridades.length > 0 ? (
              <div className="space-y-3">
                {analysis.similaridades.map((s, i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-3 flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <Badge variant="outline" className="text-xs mb-1">{s.tipo === "identico" ? "Idêntico" : s.tipo === "equivalente" ? "Equivalente" : "Preservado"}</Badge>
                        <p className="text-sm text-foreground">{s.trecho}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-border">
                <CardContent className="p-6 text-center">
                  <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma similaridade identificada.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Risks tab */}
          <TabsContent value="risks">
            {analysis?.alteracoes_juridicas && analysis.alteracoes_juridicas.length > 0 ? (
              <div className="space-y-3">
                {analysis.alteracoes_juridicas.map((j, i) => {
                  const RiskIcon = RISK_ICONS[j.risco] || Info;
                  return (
                    <Card key={i} className="border-border">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <RiskIcon className="h-4 w-4 shrink-0" />
                          <span className="font-semibold text-sm text-foreground">{j.aspecto}</span>
                          <Badge className={`ml-auto text-xs ${RISK_COLORS[j.risco] || ""}`}>{j.risco}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
                            <span className="font-medium text-destructive">Antes:</span>
                            <p className="text-foreground mt-1">{j.antes}</p>
                          </div>
                          <div className="p-2 rounded bg-primary/10 border border-primary/20">
                            <span className="font-medium text-primary">Depois:</span>
                            <p className="text-foreground mt-1">{j.depois}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{j.impacto_juridico}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-border">
                <CardContent className="p-6 text-center">
                  <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma alteração jurídica de risco identificada.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Financial tab */}
          {hasFinancial && (
            <TabsContent value="financial">
              <div className="space-y-4">
                {analysis.analise_financeira!.impacto_financeiro && (
                  <Card className="border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4" /> Impacto Financeiro
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 prose prose-sm max-w-none text-foreground">
                      <ReactMarkdown>{analysis.analise_financeira!.impacto_financeiro}</ReactMarkdown>
                    </CardContent>
                  </Card>
                )}

                {analysis.analise_financeira!.diferencas_valores && analysis.analise_financeira!.diferencas_valores.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Diferenças de Valores ({analysis.analise_financeira!.diferencas_valores.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-2 text-muted-foreground">Campo</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Valor A</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Valor B</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Diferença</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Impacto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysis.analise_financeira!.diferencas_valores.map((v, i) => (
                              <tr key={i} className="border-b border-border/50">
                                <td className="py-2 px-2 font-medium text-foreground">{v.campo}</td>
                                <td className="py-2 px-2 text-destructive">{v.valor_a}</td>
                                <td className="py-2 px-2 text-primary">{v.valor_b}</td>
                                <td className="py-2 px-2 text-foreground">{v.diferenca}</td>
                                <td className="py-2 px-2 text-muted-foreground">{v.impacto}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {analysis.analise_financeira!.indices_alterados && analysis.analise_financeira!.indices_alterados.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Índices Alterados</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-2">
                      {analysis.analise_financeira!.indices_alterados.map((idx, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-destructive">{idx.indice_original}</span>
                            <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                            <span className="text-primary">{idx.indice_novo}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{idx.impacto}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {analysis.analise_financeira!.erros_calculo && analysis.analise_financeira!.erros_calculo.length > 0 && (
                  <Card className="border-border border-destructive/30">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" /> Erros de Cálculo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                        {analysis.analise_financeira!.erros_calculo.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          )}

          {/* Multilingual tab */}
          {hasMultilingual && (
            <TabsContent value="multilingual">
              <div className="space-y-4">
                <Card className="border-border">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Languages className="h-4 w-4" /> Idiomas Detectados
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 flex gap-2">
                    <Badge variant="outline">{analysis.analise_multilingue!.idioma_a || "N/A"}</Badge>
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">{analysis.analise_multilingue!.idioma_b || "N/A"}</Badge>
                  </CardContent>
                </Card>

                {analysis.analise_multilingue!.omissoes && analysis.analise_multilingue!.omissoes.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Omissões na Tradução ({analysis.analise_multilingue!.omissoes.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-2">
                      {analysis.analise_multilingue!.omissoes.map((o, i) => (
                        <div key={i} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-1">
                          <p className="text-sm text-foreground">{o.trecho_original}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">{o.idioma}</Badge>
                            <span>{o.impacto}</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {analysis.analise_multilingue!.adicoes_nao_autorizadas && analysis.analise_multilingue!.adicoes_nao_autorizadas.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Adições Não Autorizadas ({analysis.analise_multilingue!.adicoes_nao_autorizadas.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-2">
                      {analysis.analise_multilingue!.adicoes_nao_autorizadas.map((a, i) => (
                        <div key={i} className="p-3 rounded-lg bg-accent/10 border border-accent/20 space-y-1">
                          <p className="text-sm text-foreground">{a.trecho}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">{a.idioma}</Badge>
                            <span>{a.impacto}</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {analysis.analise_multilingue!.inconsistencias_terminologicas && analysis.analise_multilingue!.inconsistencias_terminologicas.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Inconsistências Terminológicas</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-2">
                      {analysis.analise_multilingue!.inconsistencias_terminologicas.map((t, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-destructive">{t.termo_a}</span>
                            <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                            <span className="text-primary">{t.termo_b}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Sugestão: {t.sugestao}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          )}

          {/* Fraud detection tab */}
          {hasFraud && (
            <TabsContent value="fraud">
              <div className="space-y-3">
                {analysis.indicios_fraude!.map((f, i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 shrink-0 text-destructive" />
                        <span className="font-semibold text-sm text-foreground">{f.tipo}</span>
                        <Badge className={`ml-auto text-xs ${FRAUD_PROB_COLORS[f.probabilidade] || ""}`}>
                          {f.probabilidade}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">{f.descricao}</p>
                      {f.pagina && (
                        <p className="text-xs text-muted-foreground">Página: {f.pagina}</p>
                      )}
                      <div className="p-2 rounded bg-muted/50 border border-border">
                        <p className="text-xs text-muted-foreground">
                          <strong>Recomendação:</strong> {f.recomendacao}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Card className="border-border border-accent/30">
                  <CardContent className="p-4 text-xs text-muted-foreground">
                    <Info className="h-4 w-4 inline mr-1" />
                    Os resultados acima são indícios e suspeitas, não afirmações conclusivas.
                    Recomenda-se análise pericial complementar.
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          <TabsContent value="history">
            {!historyLoaded ? (
              <div className="text-center py-6">
                <Button variant="outline" onClick={loadHistory} disabled={loadingHistory}>
                  {loadingHistory ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                  Carregar histórico
                </Button>
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma comparação anterior encontrada.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <Card key={h.id} className="border-border">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <button onClick={() => loadFromHistory(h)} className="flex-1 text-left hover:opacity-80 transition-opacity">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{h.text_a_label} × {h.text_b_label}</span>
                          <Badge variant="outline" className="text-xs">{TYPE_LABELS[h.comparison_type] || h.comparison_type}</Badge>
                          {h.file_a_format && <Badge variant="outline" className="text-xs">{h.file_a_format}</Badge>}
                          {h.risk_level && (
                            <Badge className={`text-xs ${RISK_COLORS[h.risk_level] || ""}`}>{h.risk_level}</Badge>
                          )}
                          {h.similarity_percent !== undefined && h.similarity_percent !== null && (
                            <span className="text-xs text-muted-foreground">{h.similarity_percent}%</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(h.created_at), "dd MMM yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => deleteComparison(h.id)} className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
