import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Loader2, FileSearch, RefreshCcw, Edit, History, AlertTriangle,
  CheckCircle2, XCircle, MinusCircle, Gavel, Clock, Scale, BookOpen,
  FileText, Plus, Trash2, CalendarClock,
} from "lucide-react";
import { toast } from "sonner";

const DECISION_TYPES: Record<string, string> = {
  sentenca: "Sentença",
  decisao_interlocutoria: "Decisão Interlocutória",
  despacho: "Despacho",
  acordao: "Acórdão",
  liminar: "Liminar",
};

const RESULT_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  procedente: { label: "Procedente", color: "text-green-500 bg-green-500/10 border-green-500/30", icon: CheckCircle2 },
  improcedente: { label: "Improcedente", color: "text-destructive bg-destructive/10 border-destructive/30", icon: XCircle },
  parcialmente_procedente: { label: "Parcialmente Procedente", color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30", icon: MinusCircle },
  deferido: { label: "Deferido", color: "text-green-500 bg-green-500/10 border-green-500/30", icon: CheckCircle2 },
  indeferido: { label: "Indeferido", color: "text-destructive bg-destructive/10 border-destructive/30", icon: XCircle },
  provimento: { label: "Provimento", color: "text-green-500 bg-green-500/10 border-green-500/30", icon: CheckCircle2 },
  negado: { label: "Negado", color: "text-destructive bg-destructive/10 border-destructive/30", icon: XCircle },
  determinacao: { label: "Determinação", color: "text-blue-500 bg-blue-500/10 border-blue-500/30", icon: Gavel },
};

const FUNDAMENTAL_ICONS: Record<string, typeof BookOpen> = {
  artigo_de_lei: Scale,
  jurisprudencia: Gavel,
  doutrina: BookOpen,
  fato_relevante: FileText,
  argumento_juridico: BookOpen,
};

const DEADLINE_TYPE_LABELS: Record<string, string> = {
  manifestacao: "Manifestação",
  recurso: "Recurso",
  pagamento: "Pagamento",
  cumprimento: "Cumprimento",
  outro: "Outro",
};

const DecisionExtraction = ({ processId, organizationId }: { processId: string; organizationId: string }) => {
  const { user } = useAuth();
  const { isIntern, isClient } = usePermissions();
  const queryClient = useQueryClient();
  const [showExtractDialog, setShowExtractDialog] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [decisionText, setDecisionText] = useState("");

  // Manual form state
  const [manualType, setManualType] = useState("sentenca");
  const [manualResult, setManualResult] = useState("");
  const [manualDispositivo, setManualDispositivo] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualFundamentals, setManualFundamentals] = useState<{ text: string; type: string }[]>([]);
  const [manualDeadlines, setManualDeadlines] = useState<{ type: string; days: number; description: string }[]>([]);

  const canEdit = !isIntern && !isClient;

  const { data: extraction, isLoading } = useQuery({
    queryKey: ["decision-extraction", processId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decision_extractions" as any)
        .select("*")
        .eq("process_id", processId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!processId,
  });

  const { data: historyLogs = [] } = useQuery({
    queryKey: ["decision-extraction-history", processId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decision_extraction_logs" as any)
        .select("*")
        .eq("process_id", processId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: showHistory,
  });

  // RF-041: Query linked deadlines
  const { data: linkedDeadlines = [] } = useQuery({
    queryKey: ["linked-deadlines", extraction?.id],
    queryFn: async () => {
      if (!extraction?.id) return [];
      const { data, error } = await (supabase
        .from("deadlines") as any)
        .select("id, title, due_date, priority, status")
        .eq("extraction_id", extraction.id)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!extraction?.id,
  });

  // RF-041: Mutation to create deadlines from extracted data
  const createDeadlinesMutation = useMutation({
    mutationFn: async () => {
      if (!user || !extraction || deadlines.length === 0) throw new Error("Sem prazos para criar.");
      const results = [];
      for (const dl of deadlines) {
        if (!dl.days || dl.days <= 0) continue;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dl.days);
        const dueDateStr = dueDate.toISOString().split("T")[0];
        let priority = "low";
        if (dl.days <= 3) priority = "critical";
        else if (dl.days <= 7) priority = "high";
        else if (dl.days <= 15) priority = "medium";
        const typeLabel = DEADLINE_TYPE_LABELS[dl.type] || dl.type || "Prazo";
        const { error } = await supabase.from("deadlines").insert({
          process_id: processId,
          organization_id: organizationId,
          user_id: user.id,
          title: `${typeLabel} — ${dl.days} dias`,
          description: dl.description || `Prazo extraído da decisão (confiança ${Math.round((extraction.confidence || 0) * 100)}%).`,
          due_date: dueDateStr,
          priority,
          status: "pending",
          extraction_id: extraction.id,
        } as any);
        if (error) throw error;
        results.push(dl);
      }
      return results;
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["linked-deadlines", extraction?.id] });
      toast.success(`${r.length} prazo(s) criado(s) com sucesso!`);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar prazos."),
  });

  const extractMutation = useMutation({
    mutationFn: async () => {
      if (!decisionText.trim()) throw new Error("Cole o texto da decisão.");
      const { data, error } = await supabase.functions.invoke("extract-decision", {
        body: { process_id: processId, decision_text: decisionText },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-extraction", processId] });
      setShowExtractDialog(false);
      setDecisionText("");
      toast.success("Decisão analisada com sucesso!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao analisar decisão."),
  });

  const manualMutation = useMutation({
    mutationFn: async () => {
      if (!user || !manualResult) throw new Error("Preencha o resultado.");

      const payload = {
        process_id: processId,
        organization_id: organizationId,
        decision_type: manualType,
        result: manualResult,
        fundamentals: manualFundamentals.length > 0 ? manualFundamentals : [],
        deadlines_extracted: manualDeadlines.length > 0 ? manualDeadlines : [],
        dispositivo: manualDispositivo || null,
        confidence: 1.0,
        justification: `Extração manual: ${manualReason || "Sem motivo informado."}`,
        origin: "manual",
        extracted_by: user.id,
        manual_reason: manualReason || null,
      };

      if (extraction?.id) {
        const { error } = await supabase
          .from("decision_extractions" as any)
          .update(payload)
          .eq("id", extraction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("decision_extractions" as any)
          .insert(payload);
        if (error) throw error;
      }

      await supabase.from("decision_extraction_logs" as any).insert({
        process_id: processId,
        organization_id: organizationId,
        decision_type: manualType,
        result: manualResult,
        fundamentals: manualFundamentals,
        deadlines_extracted: manualDeadlines,
        dispositivo: manualDispositivo || null,
        confidence: 1.0,
        origin: "manual",
        user_id: user.id,
        manual_reason: manualReason || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-extraction", processId] });
      setShowManual(false);
      toast.success("Extração atualizada manualmente!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openManualDialog = () => {
    setManualType(extraction?.decision_type || "sentenca");
    setManualResult(extraction?.result || "");
    setManualDispositivo(extraction?.dispositivo || "");
    setManualReason("");
    setManualFundamentals(
      Array.isArray(extraction?.fundamentals) ? extraction.fundamentals : []
    );
    setManualDeadlines(
      Array.isArray(extraction?.deadlines_extracted) ? extraction.deadlines_extracted : []
    );
    setShowManual(true);
  };

  const resultInfo = RESULT_CONFIG[extraction?.result] || null;
  const fundamentals = Array.isArray(extraction?.fundamentals) ? extraction.fundamentals : [];
  const deadlines = Array.isArray(extraction?.deadlines_extracted) ? extraction.deadlines_extracted : [];

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-primary" />
          <span className="text-overline text-muted-foreground">Leitura de Decisão (IA)</span>
        </div>
        <div className="flex items-center gap-1.5">
          {canEdit && (
            <>
              <Button
                variant="ghost" size="icon" className="h-6 w-6"
                title="Analisar nova decisão"
                onClick={() => setShowExtractDialog(true)}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Ajustar manualmente" onClick={openManualDialog}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Histórico" onClick={() => setShowHistory(true)}>
            <History className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-caption text-muted-foreground text-center py-4">Carregando extração...</p>
      ) : !extraction ? (
        <div className="text-center py-4">
          <p className="text-caption text-muted-foreground mb-2">Nenhuma decisão analisada.</p>
          {canEdit && (
            <Button
              variant="outline" size="sm" className="text-xs h-7 gap-1.5"
              onClick={() => setShowExtractDialog(true)}
            >
              <FileSearch className="h-3 w-3" /> Analisar decisão
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Result + Type */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-lg border p-2.5 ${resultInfo?.color || "bg-muted/30 border-border"}`}>
              <span className="text-[10px] opacity-70 block mb-1">Resultado</span>
              <div className="flex items-center gap-1.5">
                {resultInfo && <resultInfo.icon className="h-3.5 w-3.5" />}
                <span className="text-caption font-medium">{resultInfo?.label || extraction.result}</span>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-2.5">
              <span className="text-[10px] text-muted-foreground block mb-1">Tipo</span>
              <div className="flex items-center gap-1.5">
                <Gavel className="h-3.5 w-3.5 text-primary" />
                <span className="text-caption font-medium">{DECISION_TYPES[extraction.decision_type] || extraction.decision_type}</span>
              </div>
            </div>
          </div>

          {/* Confidence */}
          {extraction.confidence != null && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.round(extraction.confidence * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {Math.round(extraction.confidence * 100)}% confiança
              </span>
            </div>
          )}

          {extraction.confidence != null && extraction.confidence < 0.6 && (
            <div className="flex items-center gap-1.5 text-warning text-[10px] bg-warning/10 rounded-lg px-2.5 py-1.5">
              <AlertTriangle className="h-3 w-3" />
              Extração com baixa confiança. Recomenda-se revisão manual.
            </div>
          )}

          {/* Fundamentals */}
          {fundamentals.length > 0 && (
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <span className="text-[10px] text-muted-foreground block mb-1.5">Fundamentos ({fundamentals.length})</span>
              <div className="space-y-1.5">
                {fundamentals.map((f: any, i: number) => {
                  const Icon = FUNDAMENTAL_ICONS[f.type] || BookOpen;
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <Icon className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      <span className="text-caption text-foreground">{f.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Deadlines */}
          {deadlines.length > 0 && (
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-muted-foreground">Prazos ({deadlines.length})</span>
                {canEdit && (
                  <Button
                    variant="ghost" size="sm" className="h-5 text-[9px] px-1.5 gap-1"
                    onClick={() => createDeadlinesMutation.mutate()}
                    disabled={createDeadlinesMutation.isPending}
                  >
                    {createDeadlinesMutation.isPending ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <CalendarClock className="h-2.5 w-2.5" />
                    )}
                    Criar prazos
                  </Button>
                )}
              </div>
              <div className="space-y-1.5">
                {deadlines.map((d: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-warning shrink-0" />
                    <span className="text-caption font-medium">{DEADLINE_TYPE_LABELS[d.type] || d.type}</span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">{d.days} dias</Badge>
                    {d.description && <span className="text-[10px] text-muted-foreground truncate">{d.description}</span>}
                  </div>
                ))}
              </div>
              {linkedDeadlines.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <span className="text-[9px] text-muted-foreground block mb-1">Prazos criados ({linkedDeadlines.length})</span>
                  {linkedDeadlines.map((ld: any) => (
                    <div key={ld.id} className="flex items-center gap-2 text-[10px]">
                      <CheckCircle2 className="h-2.5 w-2.5 text-primary shrink-0" />
                      <span className="text-foreground">{ld.title}</span>
                      <span className="text-muted-foreground">— {new Date(ld.due_date).toLocaleDateString("pt-BR")}</span>
                      <Badge variant="outline" className="text-[8px] h-3.5 px-1">{ld.priority === "critical" ? "Crítica" : ld.priority === "high" ? "Alta" : ld.priority === "medium" ? "Média" : "Baixa"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dispositivo */}
          {extraction.dispositivo && (
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <span className="text-[10px] text-muted-foreground block mb-1.5">Dispositivo</span>
              <p className="text-caption text-foreground italic leading-relaxed">"{extraction.dispositivo}"</p>
            </div>
          )}

          {/* Justification */}
          {extraction.justification && (
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <span className="text-[10px] text-muted-foreground block mb-1.5">Justificativas da IA</span>
              <p className="text-caption text-foreground whitespace-pre-line leading-relaxed">{extraction.justification}</p>
            </div>
          )}

          {/* Origin badge */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[9px] h-4">
              {extraction.origin === "manual" ? "Extração manual" : "Extração automática"}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {new Date(extraction.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      )}

      {/* Extract dialog */}
      <Dialog open={showExtractDialog} onOpenChange={setShowExtractDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-display-sm">Analisar Decisão com IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-overline text-muted-foreground block mb-1">Texto da decisão *</label>
              <Textarea
                className="bg-muted border-border rounded-xl text-xs min-h-[200px]"
                value={decisionText}
                onChange={(e) => setDecisionText(e.target.value)}
                placeholder="Cole aqui o texto completo da decisão judicial (sentença, despacho, acórdão, liminar...)&#10;&#10;Ex: 'Ante o exposto, julgo procedente o pedido inicial...'"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {decisionText.length > 0 ? `${decisionText.length} caracteres` : "A IA irá identificar resultado, fundamentos, prazos e dispositivo."}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowExtractDialog(false)}>Cancelar</Button>
              <Button
                size="sm" onClick={() => extractMutation.mutate()}
                disabled={!decisionText.trim() || extractMutation.isPending}
              >
                {extractMutation.isPending ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Analisando...</>
                ) : (
                  <><FileSearch className="h-3 w-3 mr-1" /> Analisar</>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual dialog */}
      <Dialog open={showManual} onOpenChange={setShowManual}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-display-sm">Ajustar Extração</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Tipo *</label>
                <Select value={manualType} onValueChange={setManualType}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DECISION_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Resultado *</label>
                <Select value={manualResult} onValueChange={setManualResult}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESULT_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-overline text-muted-foreground block mb-1">Dispositivo</label>
              <Textarea
                className="bg-muted border-border rounded-xl text-xs"
                value={manualDispositivo}
                onChange={(e) => setManualDispositivo(e.target.value)}
                rows={2}
                placeholder="Texto do dispositivo..."
              />
            </div>

            {/* Fundamentals list */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-overline text-muted-foreground">Fundamentos</label>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setManualFundamentals([...manualFundamentals, { text: "", type: "argumento_juridico" }])}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {manualFundamentals.map((f, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <Select value={f.type} onValueChange={(v) => {
                    const copy = [...manualFundamentals];
                    copy[i] = { ...copy[i], type: v };
                    setManualFundamentals(copy);
                  }}>
                    <SelectTrigger className="h-7 text-[10px] w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="artigo_de_lei" className="text-xs">Artigo de lei</SelectItem>
                      <SelectItem value="jurisprudencia" className="text-xs">Jurisprudência</SelectItem>
                      <SelectItem value="doutrina" className="text-xs">Doutrina</SelectItem>
                      <SelectItem value="fato_relevante" className="text-xs">Fato relevante</SelectItem>
                      <SelectItem value="argumento_juridico" className="text-xs">Argumento</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={f.text}
                    onChange={(e) => {
                      const copy = [...manualFundamentals];
                      copy[i] = { ...copy[i], text: e.target.value };
                      setManualFundamentals(copy);
                    }}
                    className="h-7 text-xs flex-1"
                    placeholder="Texto do fundamento..."
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setManualFundamentals(manualFundamentals.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Deadlines list */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-overline text-muted-foreground">Prazos</label>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setManualDeadlines([...manualDeadlines, { type: "manifestacao", days: 5, description: "" }])}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {manualDeadlines.map((d, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <Select value={d.type} onValueChange={(v) => {
                    const copy = [...manualDeadlines];
                    copy[i] = { ...copy[i], type: v };
                    setManualDeadlines(copy);
                  }}>
                    <SelectTrigger className="h-7 text-[10px] w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DEADLINE_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={d.days}
                    onChange={(e) => {
                      const copy = [...manualDeadlines];
                      copy[i] = { ...copy[i], days: parseInt(e.target.value) || 0 };
                      setManualDeadlines(copy);
                    }}
                    className="h-7 text-xs w-16"
                    placeholder="Dias"
                  />
                  <Input
                    value={d.description}
                    onChange={(e) => {
                      const copy = [...manualDeadlines];
                      copy[i] = { ...copy[i], description: e.target.value };
                      setManualDeadlines(copy);
                    }}
                    className="h-7 text-xs flex-1"
                    placeholder="Descrição..."
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setManualDeadlines(manualDeadlines.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div>
              <label className="text-overline text-muted-foreground block mb-1">Motivo da alteração</label>
              <Textarea
                className="bg-muted border-border rounded-xl text-xs"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                rows={2}
                placeholder="Explique o motivo da alteração..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowManual(false)}>Cancelar</Button>
              <Button size="sm" onClick={() => manualMutation.mutate()} disabled={!manualResult || manualMutation.isPending}>
                {manualMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-display-sm">Histórico de Extrações</DialogTitle>
          </DialogHeader>
          {historyLogs.length === 0 ? (
            <p className="text-caption text-muted-foreground text-center py-8">Nenhum registro de extração.</p>
          ) : (
            <div className="space-y-3">
              {historyLogs.map((log: any) => {
                const rInfo = RESULT_CONFIG[log.result] || null;
                return (
                  <div key={log.id} className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {rInfo && <rInfo.icon className={`h-3.5 w-3.5 ${rInfo.color.split(" ")[0]}`} />}
                        <span className="text-caption font-medium">{rInfo?.label || log.result}</span>
                        <Badge variant="outline" className="text-[9px] h-4">{DECISION_TYPES[log.decision_type] || log.decision_type}</Badge>
                      </div>
                      <Badge variant={log.origin === "manual" ? "secondary" : "outline"} className="text-[9px] h-4">
                        {log.origin === "manual" ? "Manual" : "IA"}
                      </Badge>
                    </div>
                    {log.confidence != null && (
                      <span className="text-[10px] text-muted-foreground">{Math.round(log.confidence * 100)}% confiança</span>
                    )}
                    {log.manual_reason && (
                      <p className="text-[10px] text-muted-foreground italic">{log.manual_reason}</p>
                    )}
                    <span className="text-[10px] text-muted-foreground block">
                      {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DecisionExtraction;
