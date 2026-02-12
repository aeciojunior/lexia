import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Zap, Plus, Trash2, Pencil, Play, Pause, ArrowRight,
  FileText, CalendarDays, DollarSign, Gavel, Scale, Bell, Mail, GitCommitHorizontal,
  ChevronDown, ChevronUp, Clock, AlertTriangle, Settings2, History, CheckCircle2, XCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

// ─── Workflow Types ──────────────────────────────────────────────

interface TriggerConfig {
  event: string;
  params: Record<string, string>;
}

interface ConditionConfig {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than";
  value: string;
}

interface ActionConfig {
  type: string;
  params: Record<string, string>;
}

interface WorkflowConfig {
  trigger: TriggerConfig;
  conditions: ConditionConfig[];
  actions: ActionConfig[];
}

// ─── Constants ───────────────────────────────────────────────────

const TRIGGER_EVENTS = [
  { value: "process_created", label: "Processo criado", icon: Scale, category: "Processos" },
  { value: "process_status_changed", label: "Status do processo alterado", icon: Scale, category: "Processos" },
  { value: "deadline_approaching", label: "Prazo próximo do vencimento", icon: CalendarDays, category: "Prazos" },
  { value: "deadline_overdue", label: "Prazo vencido", icon: AlertTriangle, category: "Prazos" },
  { value: "invoice_created", label: "Fatura criada", icon: DollarSign, category: "Financeiro" },
  { value: "invoice_overdue", label: "Fatura vencida", icon: DollarSign, category: "Financeiro" },
  { value: "hearing_scheduled", label: "Audiência agendada", icon: Gavel, category: "Audiências" },
  { value: "movement_created", label: "Movimentação registrada", icon: GitCommitHorizontal, category: "Processos" },
];

const ACTION_TYPES = [
  { value: "send_email", label: "Enviar e-mail", icon: Mail },
  { value: "send_notification", label: "Enviar notificação in-app", icon: Bell },
  { value: "create_deadline", label: "Criar prazo", icon: CalendarDays },
  { value: "update_status", label: "Atualizar status", icon: Settings2 },
];

const CONDITION_OPERATORS = [
  { value: "equals", label: "Igual a" },
  { value: "not_equals", label: "Diferente de" },
  { value: "contains", label: "Contém" },
  { value: "greater_than", label: "Maior que" },
  { value: "less_than", label: "Menor que" },
];

const TRIGGER_FIELDS: Record<string, { value: string; label: string }[]> = {
  process_created: [
    { value: "type", label: "Tipo" },
    { value: "status", label: "Status" },
    { value: "risk_level", label: "Nível de risco" },
  ],
  process_status_changed: [
    { value: "new_status", label: "Novo status" },
    { value: "old_status", label: "Status anterior" },
    { value: "type", label: "Tipo" },
  ],
  deadline_approaching: [
    { value: "days_before", label: "Dias antes" },
    { value: "priority", label: "Prioridade" },
  ],
  deadline_overdue: [
    { value: "priority", label: "Prioridade" },
    { value: "days_overdue", label: "Dias vencido" },
  ],
  invoice_created: [
    { value: "amount_min", label: "Valor mínimo (R$)" },
    { value: "status", label: "Status" },
  ],
  invoice_overdue: [
    { value: "days_overdue", label: "Dias vencido" },
  ],
  hearing_scheduled: [
    { value: "hearing_type", label: "Tipo de audiência" },
  ],
  movement_created: [
    { value: "movement_type", label: "Tipo de movimentação" },
    { value: "origin", label: "Origem" },
  ],
};

const emptyWorkflow: WorkflowConfig = {
  trigger: { event: "process_created", params: {} },
  conditions: [],
  actions: [{ type: "send_notification", params: { title: "", message: "" } }],
};

// ─── Templates ──────────────────────────────────────────────────

interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  icon: typeof Zap;
  category: string;
  workflow: WorkflowConfig;
}

const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "deadline_reminder_3d",
    name: "Lembrete 3 dias antes do prazo",
    description: "Envia notificação quando um prazo está a 3 dias do vencimento",
    icon: CalendarDays,
    category: "Prazos",
    workflow: {
      trigger: { event: "deadline_approaching", params: { days_before: "3" } },
      conditions: [],
      actions: [{ type: "send_notification", params: { title: "⏰ Prazo em 3 dias: {{titulo}}", message: "O prazo \"{{titulo}}\" do processo {{processo}} ({{numero}}) vence em 3 dias." } }],
    },
  },
  {
    id: "deadline_overdue_alert",
    name: "Alerta de prazo vencido",
    description: "Notifica e envia e-mail quando um prazo vence sem ser concluído",
    icon: AlertTriangle,
    category: "Prazos",
    workflow: {
      trigger: { event: "deadline_overdue", params: {} },
      conditions: [],
      actions: [
        { type: "send_notification", params: { title: "🔴 Prazo vencido: {{titulo}}", message: "O prazo \"{{titulo}}\" está vencido! Tome providências imediatas." } },
        { type: "send_email", params: { title: "Prazo vencido: {{titulo}}", message: "O prazo \"{{titulo}}\" do processo {{processo}} ({{numero}}) está vencido. Por favor, verifique e tome as providências necessárias.", to: "" } },
      ],
    },
  },
  {
    id: "hearing_client_notify",
    name: "Notificar cliente ao agendar audiência",
    description: "Envia e-mail ao cliente quando uma nova audiência é agendada",
    icon: Gavel,
    category: "Audiências",
    workflow: {
      trigger: { event: "hearing_scheduled", params: {} },
      conditions: [],
      actions: [
        { type: "send_notification", params: { title: "📅 Audiência agendada", message: "Nova audiência agendada para o processo {{processo}} ({{numero}}) — Cliente: {{cliente}}" } },
        { type: "send_email", params: { title: "Audiência agendada — {{processo}}", message: "Prezado(a) {{cliente}}, informamos que uma audiência foi agendada para o processo {{numero}}. Entraremos em contato com mais detalhes.", to: "" } },
      ],
    },
  },
  {
    id: "invoice_overdue_reminder",
    name: "Lembrete de fatura vencida",
    description: "Envia notificação diária para faturas que passaram do vencimento",
    icon: DollarSign,
    category: "Financeiro",
    workflow: {
      trigger: { event: "invoice_overdue", params: {} },
      conditions: [],
      actions: [{ type: "send_notification", params: { title: "💰 Fatura vencida", message: "Há uma fatura vencida do cliente {{cliente}}. Verifique o status do pagamento." } }],
    },
  },
  {
    id: "new_process_deadline",
    name: "Criar prazo ao registrar processo",
    description: "Cria automaticamente um prazo de 30 dias ao cadastrar novo processo",
    icon: Scale,
    category: "Processos",
    workflow: {
      trigger: { event: "process_created", params: {} },
      conditions: [],
      actions: [{ type: "create_deadline", params: { title: "Prazo inicial — {{processo}}", days_offset: "30", priority: "medium" } }],
    },
  },
  {
    id: "movement_notify",
    name: "Notificar nova movimentação",
    description: "Envia alerta quando uma nova movimentação processual é registrada",
    icon: GitCommitHorizontal,
    category: "Processos",
    workflow: {
      trigger: { event: "movement_created", params: {} },
      conditions: [],
      actions: [{ type: "send_notification", params: { title: "📋 Nova movimentação: {{processo}}", message: "Uma nova movimentação foi registrada no processo {{numero}} ({{cliente}})." } }],
    },
  },
];

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.35 },
});

// ─── Component ───────────────────────────────────────────────────

const Automations = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const canManage = hasPermission("MANAGE_AUTOMATIONS");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDesc, setWorkflowDesc] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowConfig>(emptyWorkflow);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const [activeTab, setActiveTab] = useState("workflows");

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ["automations", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["automation_logs", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_logs")
        .select("*, automations(name)")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId && activeTab === "history",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: workflowName,
        description: workflowDesc || null,
        organization_id: activeOrgId!,
        user_id: user!.id,
        type: "workflow",
        status: "active",
        config: workflow as any,
      };
      if (editingId) {
        const { error } = await supabase.from("automations").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("automations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success(editingId ? "Automação atualizada" : "Automação criada");
      closeEditor();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "active" ? "inactive" : "active";
      const { error } = await supabase.from("automations").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Status atualizado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Automação excluída");
      setDeleteTarget(null);
    },
  });

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setWorkflowName("");
    setWorkflowDesc("");
    setWorkflow(emptyWorkflow);
  };

  const useTemplate = (template: AutomationTemplate) => {
    setEditingId(null);
    setWorkflowName(template.name);
    setWorkflowDesc(template.description);
    setWorkflow(JSON.parse(JSON.stringify(template.workflow)));
    setEditorOpen(true);
    setShowTemplates(false);
  };

  const activateTemplate = async (template: AutomationTemplate) => {
    if (!user || !activeOrgId) return;
    try {
      const { error } = await supabase.from("automations").insert({
        name: template.name,
        description: template.description,
        organization_id: activeOrgId,
        user_id: user.id,
        type: "workflow",
        status: "active",
        config: template.workflow as any,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success(`Template "${template.name}" ativado!`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openEdit = (auto: any) => {
    setEditingId(auto.id);
    setWorkflowName(auto.name);
    setWorkflowDesc(auto.description || "");
    setWorkflow(auto.config || emptyWorkflow);
    setEditorOpen(true);
  };

  const addCondition = () => {
    setWorkflow(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: "", operator: "equals", value: "" }],
    }));
  };

  const removeCondition = (index: number) => {
    setWorkflow(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const updateCondition = (index: number, updates: Partial<ConditionConfig>) => {
    setWorkflow(prev => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => i === index ? { ...c, ...updates } : c),
    }));
  };

  const addAction = () => {
    setWorkflow(prev => ({
      ...prev,
      actions: [...prev.actions, { type: "send_notification", params: { title: "", message: "" } }],
    }));
  };

  const removeAction = (index: number) => {
    if (workflow.actions.length <= 1) return;
    setWorkflow(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  const updateAction = (index: number, updates: Partial<ActionConfig>) => {
    setWorkflow(prev => ({
      ...prev,
      actions: prev.actions.map((a, i) => i === index ? { ...a, ...updates } : a),
    }));
  };

  const triggerLabel = (event: string) => TRIGGER_EVENTS.find(t => t.value === event)?.label || event;
  const actionLabel = (type: string) => ACTION_TYPES.find(a => a.value === type)?.label || type;
  const TriggerIcon = (event: string) => TRIGGER_EVENTS.find(t => t.value === event)?.icon || Zap;

  const conditionFields = useMemo(() => {
    return TRIGGER_FIELDS[workflow.trigger.event] || [];
  }, [workflow.trigger.event]);

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <motion.div {...anim(0)} className="flex items-center justify-between">
        <div>
          <p className="text-overline text-primary mb-1">Automações</p>
          <h1 className="text-display-lg">Workflows</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            Configure automações com triggers, condições e ações
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTemplates(!showTemplates)} className="gap-2">
              <FileText className="h-4 w-4" /> Templates
            </Button>
            <Button onClick={() => { closeEditor(); setEditorOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Automação
            </Button>
          </div>
        )}
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="workflows" className="gap-2">
            <Zap className="h-4 w-4" /> Workflows
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4 mt-4">

      {/* Templates section */}
      {showTemplates && canManage && (
        <motion.div {...anim(0.05)}>
          <LexCard hover={false}>
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">Templates Prontos</h2>
              <p className="text-xs text-muted-foreground mt-1">Ative com um clique ou personalize antes de criar</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {AUTOMATION_TEMPLATES.map((tpl) => {
                const TplIcon = tpl.icon;
                return (
                  <div key={tpl.id} className="rounded-lg border border-border p-4 hover:border-primary/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <TplIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold truncate">{tpl.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
                        <Badge variant="outline" className="text-[10px] mt-2">{tpl.category}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => useTemplate(tpl)}>
                        <Pencil className="h-3 w-3 mr-1" /> Personalizar
                      </Button>
                      <Button size="sm" className="flex-1 text-xs h-8" onClick={() => activateTemplate(tpl)}>
                        <Play className="h-3 w-3 mr-1" /> Ativar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </LexCard>
        </motion.div>
      )}

      {/* Automations list */}
      {automations.length === 0 && !isLoading ? (
        <motion.div {...anim(0.1)}>
          <LexCard hover={false} className="py-16 text-center">
            <Zap className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">Nenhuma automação configurada</p>
            <p className="text-sm text-muted-foreground mb-6">Crie workflows para automatizar tarefas repetitivas</p>
            {canManage && (
              <Button onClick={() => setEditorOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Criar primeira automação
              </Button>
            )}
          </LexCard>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {automations.map((auto: any, i: number) => {
            const config = auto.config as WorkflowConfig | null;
            const Icon = TriggerIcon(config?.trigger?.event || "");
            const isExpanded = expandedId === auto.id;

            return (
              <motion.div key={auto.id} {...anim(0.05 + i * 0.03)}>
                <LexCard hover={false} className="overflow-hidden">
                  <div className="flex items-center gap-4 p-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${auto.status === "active" ? "bg-primary/10 border-primary/20" : "bg-muted border-border"}`}>
                      <Icon className={`h-5 w-5 ${auto.status === "active" ? "text-primary" : "text-muted-foreground"}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{auto.name}</h3>
                        <LexBadge variant={auto.status === "active" ? "success" : "default"}>
                          {auto.status === "active" ? "Ativo" : "Inativo"}
                        </LexBadge>
                      </div>
                      {auto.description && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{auto.description}</p>
                      )}
                      {config?.trigger && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs gap-1">
                            <Zap className="h-3 w-3" /> {triggerLabel(config.trigger.event)}
                          </Badge>
                          {config.conditions?.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {config.conditions.length} condição(ões)
                            </Badge>
                          )}
                          {config.actions?.map((a, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs gap-1">
                              <ArrowRight className="h-3 w-3" /> {actionLabel(a.type)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {auto.run_count > 0 && (
                        <span className="text-xs text-muted-foreground">{auto.run_count}x</span>
                      )}
                      {canManage && (
                        <>
                          <Switch
                            checked={auto.status === "active"}
                            onCheckedChange={() => toggleStatusMutation.mutate({ id: auto.id, status: auto.status })}
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(auto)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget({ id: auto.id, name: auto.name })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(isExpanded ? null : auto.id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded visual workflow */}
                  {isExpanded && config && (
                    <div className="border-t border-border p-4 bg-muted/20">
                      <div className="flex items-start gap-3">
                        {/* Trigger */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">Trigger</p>
                          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                            <p className="text-sm font-medium">{triggerLabel(config.trigger.event)}</p>
                            {Object.entries(config.trigger.params || {}).map(([k, v]) => (
                              <p key={k} className="text-xs text-muted-foreground mt-1">{k}: {v}</p>
                            ))}
                          </div>
                        </div>

                        <ArrowRight className="h-5 w-5 text-muted-foreground mt-8 shrink-0" />

                        {/* Conditions */}
                        {config.conditions?.length > 0 && (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-warning mb-2 uppercase tracking-wider">Condições</p>
                              <div className="space-y-2">
                                {config.conditions.map((c, idx) => (
                                  <div key={idx} className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                                    <p className="text-sm">{c.field} {c.operator} {c.value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <ArrowRight className="h-5 w-5 text-muted-foreground mt-8 shrink-0" />
                          </>
                        )}

                        {/* Actions */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-success mb-2 uppercase tracking-wider">Ações</p>
                          <div className="space-y-2">
                            {config.actions?.map((a, idx) => (
                              <div key={idx} className="rounded-lg border border-success/30 bg-success/5 p-3">
                                <p className="text-sm font-medium">{actionLabel(a.type)}</p>
                                {Object.entries(a.params || {}).filter(([, v]) => v).map(([k, v]) => (
                                  <p key={k} className="text-xs text-muted-foreground mt-1">{k}: {v}</p>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Criado em {format(new Date(auto.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        {auto.last_run_at && (
                          <span className="flex items-center gap-1">
                            <Play className="h-3 w-3" />
                            Última exec: {format(new Date(auto.last_run_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </LexCard>
              </motion.div>
            );
          })}
        </div>
      )}

        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <LexCard hover={false}>
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">Histórico de Execuções</h2>
              <p className="text-xs text-muted-foreground mt-1">Últimas 100 execuções das automações</p>
            </div>
            {logsLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center">
                <History className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Automação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Encontrados</TableHead>
                      <TableHead className="text-center">Processados</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log: any) => {
                      const duration = log.finished_at && log.started_at
                        ? Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                        : null;
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium text-sm">
                            {log.automations?.name || "—"}
                          </TableCell>
                          <TableCell>
                            {log.status === "success" ? (
                              <Badge variant="outline" className="gap-1 text-xs border-green-500/30 text-green-600">
                                <CheckCircle2 className="h-3 w-3" /> Sucesso
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <XCircle className="h-3 w-3" /> Erro
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-sm">{log.items_matched}</TableCell>
                          <TableCell className="text-center text-sm">{log.items_processed}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.started_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {duration !== null ? `${duration}s` : "—"}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px]">
                            {log.error_message ? (
                              <span className="text-destructive truncate block">{log.error_message}</span>
                            ) : log.items_processed > 0 ? (
                              <span className="text-muted-foreground">
                                {(log.details as any[])?.length || 0} ação(ões)
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">Sem itens</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </LexCard>
        </TabsContent>
      </Tabs>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={(v) => !v && closeEditor()}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {editingId ? "Editar Automação" : "Nova Automação"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic info */}
            <div className="space-y-3">
              <Input
                placeholder="Nome da automação"
                value={workflowName}
                onChange={e => setWorkflowName(e.target.value)}
              />
              <Textarea
                placeholder="Descrição (opcional)"
                value={workflowDesc}
                onChange={e => setWorkflowDesc(e.target.value)}
                rows={2}
              />
            </div>

            {/* Trigger */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Zap className="h-3 w-3 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Trigger (Quando)</h3>
              </div>
              <Select
                value={workflow.trigger.event}
                onValueChange={event => setWorkflow(prev => ({
                  ...prev,
                  trigger: { event, params: {} },
                  conditions: [],
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENTS.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <t.icon className="h-4 w-4" /> {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Trigger params */}
              {workflow.trigger.event === "deadline_approaching" && (
                <Input
                  type="number"
                  placeholder="Dias antes do vencimento (ex: 3)"
                  value={workflow.trigger.params.days_before || ""}
                  onChange={e => setWorkflow(prev => ({
                    ...prev,
                    trigger: { ...prev.trigger, params: { ...prev.trigger.params, days_before: e.target.value } },
                  }))}
                />
              )}
            </div>

            {/* Conditions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-warning/20 flex items-center justify-center">
                    <Settings2 className="h-3 w-3 text-warning" />
                  </div>
                  <h3 className="text-sm font-semibold text-warning uppercase tracking-wider">Condições (Se)</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={addCondition} className="text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>

              {workflow.conditions.length === 0 && (
                <p className="text-xs text-muted-foreground italic pl-8">Sem condições — executa para todos os eventos</p>
              )}

              {workflow.conditions.map((cond, idx) => (
                <div key={idx} className="flex items-center gap-2 pl-8">
                  <Select value={cond.field} onValueChange={v => updateCondition(idx, { field: v })}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Campo" /></SelectTrigger>
                    <SelectContent>
                      {conditionFields.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={cond.operator} onValueChange={v => updateCondition(idx, { operator: v as any })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPERATORS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Valor"
                    value={cond.value}
                    onChange={e => updateCondition(idx, { value: e.target.value })}
                    className="flex-1"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeCondition(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-success/20 flex items-center justify-center">
                    <ArrowRight className="h-3 w-3 text-success" />
                  </div>
                  <h3 className="text-sm font-semibold text-success uppercase tracking-wider">Ações (Então)</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={addAction} className="text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>

              {workflow.actions.map((action, idx) => (
                <div key={idx} className="pl-8 space-y-2 border-l-2 border-success/20 ml-3">
                  <div className="flex items-center gap-2">
                    <Select value={action.type} onValueChange={v => updateAction(idx, { type: v, params: {} })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map(a => (
                          <SelectItem key={a.value} value={a.value}>
                            <span className="flex items-center gap-2">
                              <a.icon className="h-4 w-4" /> {a.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {workflow.actions.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeAction(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Action params */}
                  {(action.type === "send_email" || action.type === "send_notification") && (
                    <div className="space-y-2">
                      <Input
                        placeholder="Título"
                        value={action.params.title || ""}
                        onChange={e => updateAction(idx, { params: { ...action.params, title: e.target.value } })}
                      />
                      <Textarea
                        placeholder="Mensagem (use {{processo}}, {{cliente}}, {{data}} para variáveis)"
                        value={action.params.message || ""}
                        onChange={e => updateAction(idx, { params: { ...action.params, message: e.target.value } })}
                        rows={2}
                      />
                      {action.type === "send_email" && (
                        <Input
                          placeholder="E-mail destinatário (vazio = responsável)"
                          value={action.params.to || ""}
                          onChange={e => updateAction(idx, { params: { ...action.params, to: e.target.value } })}
                        />
                      )}
                    </div>
                  )}

                  {action.type === "create_deadline" && (
                    <div className="space-y-2">
                      <Input
                        placeholder="Título do prazo"
                        value={action.params.title || ""}
                        onChange={e => updateAction(idx, { params: { ...action.params, title: e.target.value } })}
                      />
                      <Input
                        type="number"
                        placeholder="Dias a partir do evento"
                        value={action.params.days_offset || ""}
                        onChange={e => updateAction(idx, { params: { ...action.params, days_offset: e.target.value } })}
                      />
                      <Select
                        value={action.params.priority || "medium"}
                        onValueChange={v => updateAction(idx, { params: { ...action.params, priority: v } })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {action.type === "update_status" && (
                    <Input
                      placeholder="Novo status"
                      value={action.params.new_status || ""}
                      onChange={e => updateAction(idx, { params: { ...action.params, new_status: e.target.value } })}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!workflowName.trim() || createMutation.isPending}
            >
              {editingId ? "Salvar" : "Criar"} Automação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Automations;
