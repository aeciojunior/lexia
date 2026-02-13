import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Sparkles, RefreshCcw, Edit, History, Copy, Check,
  AlertTriangle, Brain, FileSearch, CalendarClock, FileText, Clock,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

const STYLE_OPTIONS = [
  { value: "executivo", label: "Executivo" },
  { value: "juridico_formal", label: "Jurídico Formal" },
  { value: "bullets", label: "Bullet Points" },
  { value: "narrativo", label: "Narrativo" },
  { value: "tecnico", label: "Técnico" },
];

const DETAIL_OPTIONS = [
  { value: "curto", label: "Curto" },
  { value: "medio", label: "Médio" },
  { value: "completo", label: "Completo" },
];

const FOCUS_OPTIONS = [
  { value: "riscos", label: "Riscos" },
  { value: "prazos", label: "Prazos" },
  { value: "decisoes", label: "Decisões" },
  { value: "documentos", label: "Documentos" },
  { value: "fatos", label: "Fatos" },
  { value: "pedidos", label: "Pedidos" },
];

const ProcessSummary360 = ({ processId, organizationId }: { processId: string; organizationId: string }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showConfig, setShowConfig] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editText, setEditText] = useState("");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Config state
  const [style, setStyle] = useState("executivo");
  const [detailLevel, setDetailLevel] = useState("medio");
  const [focus, setFocus] = useState<string[]>([]);

  // Fetch latest summary
  const { data: summary, isLoading } = useQuery({
    queryKey: ["process-summary", processId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_summaries" as any)
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

  // Fetch history
  const { data: historyItems = [] } = useQuery({
    queryKey: ["process-summary-history", processId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_summaries" as any)
        .select("id, summary_type, origin, confidence, created_at, config")
        .eq("process_id", processId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: showHistory,
  });

  // Generate summary mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-summary", {
        body: {
          process_id: processId,
          summary_type: "processo",
          style,
          detail_level: detailLevel,
          focus,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-summary", processId] });
      queryClient.invalidateQueries({ queryKey: ["process-summary-history", processId] });
      setShowConfig(false);
      toast.success("Resumo gerado com sucesso!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao gerar resumo."),
  });

  // Edit summary mutation
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!summary?.id || !editText.trim()) throw new Error("Texto inválido.");
      const { error } = await supabase
        .from("process_summaries" as any)
        .update({
          summary_text: editText.trim(),
          origin: "manual",
        })
        .eq("id", summary.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-summary", processId] });
      setShowEditDialog(false);
      toast.success("Resumo atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleFocus = (val: string) => {
    setFocus((prev) => prev.includes(val) ? prev.filter((f) => f !== val) : [...prev, val]);
  };

  const handleCopy = () => {
    if (summary?.summary_text) {
      navigator.clipboard.writeText(summary.summary_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openEdit = () => {
    setEditText(summary?.summary_text || "");
    setShowEditDialog(true);
  };

  const config = summary?.config as any;
  const excerpts = Array.isArray(summary?.relevant_excerpts) ? summary.relevant_excerpts : [];
  const highlights = Array.isArray((summary as any)?.highlights) ? (summary as any).highlights : [];

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <button
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          onClick={() => setExpanded(!expanded)}
        >
          <Sparkles className="h-4 w-4 text-secondary" />
          <span className="text-overline text-muted-foreground">Resumo 360 (IA)</span>
          {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </button>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost" size="icon" className="h-6 w-6"
            title="Gerar/Configurar resumo"
            onClick={() => setShowConfig(true)}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
          {summary && (
            <>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Editar" onClick={openEdit}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Copiar" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Histórico" onClick={() => setShowHistory(true)}>
            <History className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <>
          {isLoading ? (
            <p className="text-caption text-muted-foreground text-center py-4">Carregando resumo...</p>
          ) : !summary ? (
            <div className="text-center py-4">
              <p className="text-caption text-muted-foreground mb-2">Nenhum resumo gerado para este processo.</p>
              <Button
                variant="outline" size="sm" className="text-xs h-7 gap-1.5"
                onClick={() => setShowConfig(true)}
              >
                <Sparkles className="h-3 w-3" /> Gerar resumo com IA
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary text */}
              <div className="rounded-lg bg-muted/30 border border-border p-3">
                <p className="text-caption text-foreground whitespace-pre-line leading-relaxed">
                  {summary.summary_text}
                </p>
              </div>

              {/* Highlights */}
              {highlights.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {highlights.map((h: string, i: number) => (
                    <div key={i} className="flex items-center gap-1 text-[10px] bg-warning/10 text-warning rounded-md px-2 py-1">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {h}
                    </div>
                  ))}
                </div>
              )}

              {/* Confidence + meta */}
              <div className="flex items-center gap-3">
                {summary.confidence != null && (
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary rounded-full transition-all"
                        style={{ width: `${Math.round(summary.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(summary.confidence * 100)}%
                    </span>
                  </div>
                )}
                <Badge variant="outline" className="text-[9px] h-4">
                  {summary.origin === "manual" ? "Editado" : "IA"}
                </Badge>
                {config?.style && (
                  <Badge variant="outline" className="text-[9px] h-4">
                    {STYLE_OPTIONS.find((s) => s.value === config.style)?.label || config.style}
                  </Badge>
                )}
              </div>

              {/* Relevant excerpts */}
              {excerpts.length > 0 && (
                <details className="group">
                  <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    Trechos usados ({excerpts.length})
                  </summary>
                  <div className="mt-1.5 space-y-1">
                    {excerpts.map((ex: string, i: number) => (
                      <div key={i} className="text-[10px] text-muted-foreground pl-3 border-l-2 border-border">
                        {ex}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Timestamp */}
              <span className="text-[10px] text-muted-foreground block">
                Gerado em {new Date(summary.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
        </>
      )}

      {/* Config Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-display-sm">Configurar Resumo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Estilo</label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STYLE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Detalhamento</label>
                <Select value={detailLevel} onValueChange={setDetailLevel}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DETAIL_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Foco (opcional)</label>
              <div className="flex flex-wrap gap-1.5">
                {FOCUS_OPTIONS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => toggleFocus(f.value)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                      focus.includes(f.value)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Context indicators */}
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <span className="text-[10px] text-muted-foreground block mb-2">Dados disponíveis para o resumo:</span>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Brain className="h-3 w-3 text-primary" /> Classificação (RF-034)
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <FileSearch className="h-3 w-3 text-primary" /> Decisões (RF-040)
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CalendarClock className="h-3 w-3 text-primary" /> Prazos (RF-041)
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <FileText className="h-3 w-3 text-primary" /> Documentos (RF-042)
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3 text-primary" /> Linha do tempo
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowConfig(false)}>Cancelar</Button>
              <Button
                size="sm"
                variant="ai"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="gap-1.5"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {generateMutation.isPending ? "Gerando..." : "Gerar Resumo"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-display-sm">Editar Resumo</DialogTitle>
          </DialogHeader>
          <Textarea
            className="bg-muted border-border rounded-xl text-xs min-h-[200px]"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={() => editMutation.mutate()}
              disabled={!editText.trim() || editMutation.isPending}
            >
              {editMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-display-sm">Histórico de Resumos</DialogTitle>
          </DialogHeader>
          {historyItems.length === 0 ? (
            <p className="text-caption text-muted-foreground text-center py-6">Nenhum resumo anterior.</p>
          ) : (
            <div className="space-y-2">
              {historyItems.map((item: any) => {
                const cfg = item.config as any;
                return (
                  <div key={item.id} className="rounded-lg bg-muted/30 border border-border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] h-4">
                          {item.origin === "manual" ? "Manual" : "IA"}
                        </Badge>
                        {cfg?.style && (
                          <Badge variant="outline" className="text-[9px] h-4">
                            {STYLE_OPTIONS.find((s) => s.value === cfg.style)?.label || cfg.style}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {item.confidence != null && (
                      <span className="text-[10px] text-muted-foreground">
                        Confiança: {Math.round(item.confidence * 100)}%
                      </span>
                    )}
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

export default ProcessSummary360;
