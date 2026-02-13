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
import { Loader2, Brain, RefreshCcw, Edit, History, AlertTriangle, ShieldAlert, Clock, Zap, Target, Scale, Briefcase, Gavel, Building2, Heart, ShoppingCart, Leaf, FileText, Users } from "lucide-react";
import { toast } from "sonner";

const RISK_CONFIG: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  baixo: { label: "Baixo", color: "text-green-500 bg-green-500/10 border-green-500/30", icon: ShieldAlert },
  medio: { label: "Médio", color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30", icon: ShieldAlert },
  alto: { label: "Alto", color: "text-orange-500 bg-orange-500/10 border-orange-500/30", icon: AlertTriangle },
  critico: { label: "Crítico", color: "text-destructive bg-destructive/10 border-destructive/30", icon: AlertTriangle },
};

const URGENCY_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  nenhuma: { label: "Sem urgência", color: "text-muted-foreground bg-muted border-border", icon: Clock },
  moderada: { label: "Moderada", color: "text-blue-500 bg-blue-500/10 border-blue-500/30", icon: Clock },
  alta: { label: "Alta", color: "text-orange-500 bg-orange-500/10 border-orange-500/30", icon: Zap },
  imediata: { label: "Imediata", color: "text-destructive bg-destructive/10 border-destructive/30", icon: Zap },
};

const TYPE_OPTIONS = [
  { value: "cobranca", label: "Cobrança", icon: FileText },
  { value: "indenizacao", label: "Indenização", icon: Scale },
  { value: "trabalhista", label: "Trabalhista", icon: Briefcase },
  { value: "penal", label: "Penal", icon: Gavel },
  { value: "familia", label: "Família", icon: Heart },
  { value: "tributario", label: "Tributário", icon: Building2 },
  { value: "administrativo", label: "Administrativo", icon: Building2 },
  { value: "contratual", label: "Contratual", icon: FileText },
  { value: "consumidor", label: "Consumidor", icon: ShoppingCart },
  { value: "ambiental", label: "Ambiental", icon: Leaf },
  { value: "outro", label: "Outro", icon: Target },
];

const AREA_OPTIONS = [
  { value: "civel", label: "Cível" },
  { value: "trabalhista", label: "Trabalhista" },
  { value: "penal", label: "Penal" },
  { value: "tributaria", label: "Tributária" },
  { value: "empresarial", label: "Empresarial" },
  { value: "familia", label: "Família" },
  { value: "consumidor", label: "Consumidor" },
  { value: "administrativo", label: "Administrativo" },
  { value: "ambiental", label: "Ambiental" },
  { value: "outro", label: "Outro" },
];

const ProcessClassification = ({ processId, organizationId }: { processId: string; organizationId: string }) => {
  const { user } = useAuth();
  const { hasPermission, isIntern, isClient } = usePermissions();
  const queryClient = useQueryClient();
  const [showManual, setShowManual] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [manualType, setManualType] = useState("");
  const [manualArea, setManualArea] = useState("");
  const [manualRisk, setManualRisk] = useState("");
  const [manualUrgency, setManualUrgency] = useState("");
  const [manualReason, setManualReason] = useState("");

  const canEdit = !isIntern && !isClient;

  const { data: classification, isLoading } = useQuery({
    queryKey: ["process-classification", processId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_classifications" as any)
        .select("*")
        .eq("process_id", processId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!processId,
  });

  const { data: historyLogs = [] } = useQuery({
    queryKey: ["process-classification-history", processId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_classification_logs" as any)
        .select("*")
        .eq("process_id", processId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: showHistory,
  });

  const classifyMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("classify-process", {
        body: { process_id: processId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-classification", processId] });
      toast.success("Classificação atualizada pela IA!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao classificar processo."),
  });

  const manualMutation = useMutation({
    mutationFn: async () => {
      if (!user || !manualType || !manualArea || !manualRisk || !manualUrgency) {
        throw new Error("Preencha todos os campos.");
      }

      const payload = {
        process_id: processId,
        organization_id: organizationId,
        process_type: manualType,
        legal_area: manualArea,
        risk_level: manualRisk,
        urgency: manualUrgency,
        confidence: 1.0,
        justification: `Classificação manual: ${manualReason || "Sem motivo informado."}`,
        origin: "manual",
        classified_by: user.id,
        manual_reason: manualReason || null,
      };

      if (classification?.id) {
        const { error } = await supabase
          .from("process_classifications" as any)
          .update(payload)
          .eq("id", classification.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("process_classifications" as any)
          .insert(payload);
        if (error) throw error;
      }

      // Log
      await supabase.from("process_classification_logs" as any).insert({
        process_id: processId,
        organization_id: organizationId,
        process_type: manualType,
        legal_area: manualArea,
        risk_level: manualRisk,
        urgency: manualUrgency,
        confidence: 1.0,
        justification: `Classificação manual: ${manualReason || "Sem motivo informado."}`,
        origin: "manual",
        user_id: user.id,
        manual_reason: manualReason || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-classification", processId] });
      setShowManual(false);
      toast.success("Classificação atualizada manualmente!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openManualDialog = () => {
    setManualType(classification?.process_type || "");
    setManualArea(classification?.legal_area || "");
    setManualRisk(classification?.risk_level || "medio");
    setManualUrgency(classification?.urgency || "nenhuma");
    setManualReason("");
    setShowManual(true);
  };

  const typeInfo = TYPE_OPTIONS.find((t) => t.value === classification?.process_type);
  const riskInfo = RISK_CONFIG[classification?.risk_level] || RISK_CONFIG.medio;
  const urgencyInfo = URGENCY_CONFIG[classification?.urgency] || URGENCY_CONFIG.nenhuma;
  const areaInfo = AREA_OPTIONS.find((a) => a.value === classification?.legal_area);

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-overline text-muted-foreground">Classificação por IA</span>
        </div>
        <div className="flex items-center gap-1.5">
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Reclassificar por IA"
                onClick={() => classifyMutation.mutate()}
                disabled={classifyMutation.isPending}
              >
                {classifyMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="h-3.5 w-3.5" />
                )}
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
        <p className="text-caption text-muted-foreground text-center py-4">Carregando classificação...</p>
      ) : !classification ? (
        <div className="text-center py-4">
          <p className="text-caption text-muted-foreground mb-2">Processo ainda não classificado.</p>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1.5"
              onClick={() => classifyMutation.mutate()}
              disabled={classifyMutation.isPending}
            >
              {classifyMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Brain className="h-3 w-3" />
              )}
              Classificar com IA
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Classification cards */}
          <div className="grid grid-cols-2 gap-2">
            {/* Type */}
            <div className="rounded-lg border border-border bg-muted/30 p-2.5">
              <span className="text-[10px] text-muted-foreground block mb-1">Tipo</span>
              <div className="flex items-center gap-1.5">
                {typeInfo && <typeInfo.icon className="h-3.5 w-3.5 text-primary" />}
                <span className="text-caption font-medium">{typeInfo?.label || classification.process_type}</span>
              </div>
            </div>

            {/* Area */}
            <div className="rounded-lg border border-border bg-muted/30 p-2.5">
              <span className="text-[10px] text-muted-foreground block mb-1">Área Jurídica</span>
              <span className="text-caption font-medium">{areaInfo?.label || classification.legal_area}</span>
            </div>

            {/* Risk */}
            <div className={`rounded-lg border p-2.5 ${riskInfo.color}`}>
              <span className="text-[10px] opacity-70 block mb-1">Risco</span>
              <div className="flex items-center gap-1.5">
                <riskInfo.icon className="h-3.5 w-3.5" />
                <span className="text-caption font-medium">{riskInfo.label}</span>
              </div>
            </div>

            {/* Urgency */}
            <div className={`rounded-lg border p-2.5 ${urgencyInfo.color}`}>
              <span className="text-[10px] opacity-70 block mb-1">Urgência</span>
              <div className="flex items-center gap-1.5">
                <urgencyInfo.icon className="h-3.5 w-3.5" />
                <span className="text-caption font-medium">{urgencyInfo.label}</span>
              </div>
            </div>
          </div>

          {/* Confidence */}
          {classification.confidence != null && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.round(classification.confidence * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {Math.round(classification.confidence * 100)}% confiança
              </span>
            </div>
          )}

          {classification.confidence != null && classification.confidence < 0.6 && (
            <div className="flex items-center gap-1.5 text-warning text-[10px] bg-warning/10 rounded-lg px-2.5 py-1.5">
              <AlertTriangle className="h-3 w-3" />
              Classificação com baixa confiança. Recomenda-se revisão manual.
            </div>
          )}

          {/* Justification */}
          {classification.justification && (
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <span className="text-[10px] text-muted-foreground block mb-1.5">Justificativas da IA</span>
              <p className="text-caption text-foreground whitespace-pre-line leading-relaxed">{classification.justification}</p>
            </div>
          )}

          {/* Origin badge */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[9px] h-4">
              {classification.origin === "manual" ? "Classificação manual" : "Classificação automática"}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {new Date(classification.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      )}

      {/* Manual classification dialog */}
      <Dialog open={showManual} onOpenChange={setShowManual}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-display-sm">Ajustar Classificação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Tipo *</label>
                <Select value={manualType} onValueChange={setManualType}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Área *</label>
                <Select value={manualArea} onValueChange={setManualArea}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {AREA_OPTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Risco *</label>
                <Select value={manualRisk} onValueChange={setManualRisk}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RISK_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Urgência *</label>
                <Select value={manualUrgency} onValueChange={setManualUrgency}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1">Motivo da alteração</label>
              <Textarea
                className="bg-muted border-border rounded-xl text-xs"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                rows={2}
                placeholder="Explique o motivo da reclassificação..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowManual(false)}>Cancelar</Button>
              <Button
                size="sm"
                onClick={() => manualMutation.mutate()}
                disabled={!manualType || !manualArea || !manualRisk || !manualUrgency || manualMutation.isPending}
              >
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
            <DialogTitle className="text-display-sm">Histórico de Classificações</DialogTitle>
          </DialogHeader>
          {historyLogs.length === 0 ? (
            <p className="text-caption text-muted-foreground text-center py-6">Nenhum registro de classificação encontrado.</p>
          ) : (
            <div className="space-y-3">
              {historyLogs.map((log: any, i: number) => {
                const risk = RISK_CONFIG[log.risk_level] || RISK_CONFIG.medio;
                const urgency = URGENCY_CONFIG[log.urgency] || URGENCY_CONFIG.nenhuma;
                const type = TYPE_OPTIONS.find((t) => t.value === log.process_type);
                const area = AREA_OPTIONS.find((a) => a.value === log.legal_area);
                return (
                  <div key={log.id} className="relative pl-6">
                    {/* Timeline dot */}
                    <div className={`absolute left-0 top-2 h-3 w-3 rounded-full border-2 ${i === 0 ? "bg-primary border-primary" : "bg-muted border-border"}`} />
                    {i < historyLogs.length - 1 && (
                      <div className="absolute left-[5px] top-5 w-0.5 h-full bg-border" />
                    )}
                    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] h-4">
                            {log.origin === "manual" ? "Manual" : "IA"}
                          </Badge>
                          {log.confidence != null && (
                            <span className="text-[10px] text-muted-foreground">{Math.round(log.confidence * 100)}%</span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                        <div><span className="text-muted-foreground">Tipo:</span> {type?.label || log.process_type}</div>
                        <div><span className="text-muted-foreground">Área:</span> {area?.label || log.legal_area}</div>
                        <div><span className="text-muted-foreground">Risco:</span> <span className={risk.color.split(" ")[0]}>{risk.label}</span></div>
                        <div><span className="text-muted-foreground">Urg.:</span> <span className={urgency.color.split(" ")[0]}>{urgency.label}</span></div>
                      </div>
                      {log.justification && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{log.justification}</p>
                      )}
                    </div>
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

export default ProcessClassification;
