import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ProcessMovements from "@/components/process/ProcessMovements";
import ProcessChat from "@/components/process/ProcessChat";
import ProcessTimeline from "@/components/process/ProcessTimeline";
import ProcessClassification from "@/components/process/ProcessClassification";
import DecisionExtraction from "@/components/process/DecisionExtraction";
import ProcessSummary360 from "@/components/process/ProcessSummary360";
import ProcessPredictionsPanel from "@/components/process/ProcessPredictionsPanel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { RiskIndicator } from "@/components/lexia/LegalComponents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Archive, Edit, Eye, ChevronLeft, ChevronRight, Scale, UserCheck, ListTodo, CheckCircle2, Circle, Clock, FileText, Download, Upload, Link2, X, CalendarClock, AlertTriangle, RefreshCcw, Loader2, Building2, ArrowLeftRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { motion } from "framer-motion";

const useCountUp = (end: number, duration = 800) => {
  const [value, setValue] = useState(0);
  const prevEnd = useRef(0);
  useEffect(() => {
    if (end === prevEnd.current) return;
    const start = prevEnd.current;
    prevEnd.current = end;
    if (end === 0) { setValue(0); return; }
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [end, duration]);
  return value;
};

const AnimatedNumber = ({ value }: { value: number }) => {
  const display = useCountUp(value);
  return <>{display}</>;
};

const PAGE_SIZE = 10;
const statusMap: Record<string, string> = { active: "Ativo", pending: "Pendente", closed: "Encerrado", suspended: "Suspenso" };
const typeMap: Record<string, string> = { civil: "Cível", criminal: "Criminal", labor: "Trabalhista", tax: "Tributário", admin: "Administrativo" };
const classeOptions = ["Cível", "Trabalhista", "Penal", "Família", "Tributário", "Administrativo", "Consumidor", "Ambiental"];
const faseOptions = ["Inicial", "Citação", "Instrução", "Sentença", "Recurso", "Execução", "Arquivado"];
const foroOptions = ["Foro Central", "Foro Regional I", "Foro Regional II", "Foro Regional III", "Foro Regional IV", "Foro Distrital"];
const varasByForo: Record<string, string[]> = {
  "Foro Central": ["1ª Vara Cível", "2ª Vara Cível", "3ª Vara Cível", "1ª Vara Criminal", "2ª Vara Criminal", "Vara de Família", "Vara do Trabalho"],
  "Foro Regional I": ["1ª Vara Cível", "2ª Vara Cível", "Vara Criminal"],
  "Foro Regional II": ["1ª Vara Cível", "Vara Criminal", "Vara de Família"],
  "Foro Regional III": ["1ª Vara Cível", "Vara Criminal"],
  "Foro Regional IV": ["Vara Cível", "Vara Criminal"],
  "Foro Distrital": ["Vara Única"],
};
const assuntoOptions = ["Cobrança", "Indenização", "Contrato", "Trabalhista", "Divórcio", "Inventário", "Execução Fiscal", "Usucapião", "Despejo", "Alimentos", "Guarda", "Outro"];

interface ProcessForm {
  number: string; title: string; client_name: string; type: string; status: string; risk_level: string; court: string; judge: string; notes: string; description: string; tags: string; responsible_id: string;
  foro: string; vara: string; classe: string; assunto: string[]; fase: string; valor_causa: string; partes_autores: string; partes_reus: string;
}
const emptyForm: ProcessForm = { number: "", title: "", client_name: "", type: "civil", status: "active", risk_level: "low", court: "", judge: "", notes: "", description: "", tags: "", responsible_id: "none", foro: "", vara: "", classe: "", assunto: [], fase: "", valor_causa: "", partes_autores: "", partes_reus: "" };

const Processes = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProcessForm>(emptyForm);
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [dashboardFilter, setDashboardFilter] = useState<string | null>(null);
  const [formTouched, setFormTouched] = useState(false);

  // Fetch org members for responsible selector
  const { data: orgMembers = [] } = useQuery({
    queryKey: ["org-members-for-processes", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_organizations" as any)
        .select("user_id, role, profiles:user_id(full_name)")
        .eq("organization_id", activeOrgId!)
        .eq("status", "active");
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  // Fetch clients for linking
  const { data: orgClients = [] } = useQuery({
    queryKey: ["org-clients-for-processes", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, document_number")
        .eq("organization_id", activeOrgId!)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return (data || []) as { id: string; full_name: string; document_number: string | null }[];
    },
    enabled: !!activeOrgId,
  });

  const getMemberName = (userId: string) => {
    const member = orgMembers.find((m: any) => m.user_id === userId);
    return (member?.profiles as any)?.full_name || "Membro";
  };

  const { data, isLoading } = useQuery({
    queryKey: ["processes", search, statusFilter, page, dashboardFilter],
    queryFn: async () => {
      let q = supabase.from("processes").select("*", { count: "exact" }).eq("archived", false).order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (search) q = q.or(`title.ilike.%${search}%,number.ilike.%${search}%,client_name.ilike.%${search}%`);

      // Apply dashboard filter by process IDs
      if (dashboardFilter && stats) {
        const filterIds = stats.filterIds?.[dashboardFilter] || [];
        if (filterIds.length === 0) {
          return { items: [], count: 0 };
        }
        q = q.in("id", filterIds);
      }

      q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { items: data || [], count: count || 0 };
    },
  });

  // Global stats for mini-dashboard
  const { data: stats } = useQuery({
    queryKey: ["processes-stats", activeOrgId],
    queryFn: async () => {
      const [procs, tasks, deadlines, docs] = await Promise.all([
        supabase.from("processes").select("id", { count: "exact" }).eq("archived", false),
        supabase.from("quick_tasks").select("id, status, process_id").not("process_id", "is", null),
        supabase.from("deadlines").select("id, status, due_date, process_id").not("process_id", "is", null),
        supabase.from("documents").select("id, process_id").not("process_id", "is", null),
      ]);
      const now = new Date();
      const allTasks = tasks.data || [];
      const allDeadlines = deadlines.data || [];
      const allDocs = docs.data || [];
      const pendingTaskItems = allTasks.filter((t: any) => t.status !== "done");
      const overdueDeadlineItems = allDeadlines.filter((d: any) => d.status !== "completed" && new Date(d.due_date + "T23:59:59") < now);

      // Collect unique process IDs per filter
      const filterIds: Record<string, string[]> = {
        pendingTasks: [...new Set(pendingTaskItems.map((t: any) => t.process_id as string))],
        overdueDeadlines: [...new Set(overdueDeadlineItems.map((d: any) => d.process_id as string))],
        totalDocs: [...new Set(allDocs.map((d: any) => d.process_id as string))],
      };

      return {
        totalProcesses: procs.count || 0,
        pendingTasks: pendingTaskItems.length,
        overdueDeadlines: overdueDeadlineItems.length,
        totalDocs: allDocs.length,
        filterIds,
      };
    },
    enabled: !!activeOrgId,
  });

  const processIds = data?.items.map((p) => p.id) || [];

  // Fetch counts for tasks, docs, deadlines per process
  const { data: countsMap = {} } = useQuery({
    queryKey: ["process-counts", processIds],
    queryFn: async () => {
      if (!processIds.length) return {};
      const [tasks, docs, deadlines] = await Promise.all([
        supabase.from("quick_tasks").select("process_id, status").in("process_id", processIds),
        supabase.from("documents").select("process_id").in("process_id", processIds),
        supabase.from("deadlines").select("process_id, status, due_date").in("process_id", processIds),
      ]);
      const counts: Record<string, { tasks: number; tasksDone: number; docs: number; deadlines: number; deadlinesOverdue: number; deadlinesDone: number }> = {};
      const now = new Date();
      for (const id of processIds) {
        const pTasks = (tasks.data || []).filter((r: any) => r.process_id === id);
        const pDeadlines = (deadlines.data || []).filter((r: any) => r.process_id === id);
        counts[id] = {
          tasks: pTasks.length,
          tasksDone: pTasks.filter((t: any) => t.status === "done").length,
          docs: (docs.data || []).filter((r: any) => r.process_id === id).length,
          deadlines: pDeadlines.length,
          deadlinesDone: pDeadlines.filter((d: any) => d.status === "completed").length,
          deadlinesOverdue: pDeadlines.filter((d: any) => d.status !== "completed" && new Date(d.due_date + "T23:59:59") < now).length,
        };
      }
      return counts;
    },
    enabled: processIds.length > 0,
  });

  const logAudit = async (action: string, resourceId: string, metadata: Record<string, any> = {}) => {
    if (!user) return;
    await supabase.from("audit_logs").insert({
      action,
      user_id: user.id,
      organization_id: activeOrgId,
      resource_type: "process",
      resource_id: resourceId,
      metadata,
    } as any);
  };

  const saveMutation = useMutation({
    mutationFn: async (formData: ProcessForm) => {
      const tagsArray = formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      const autores = formData.partes_autores ? formData.partes_autores.split(",").map(s => s.trim()).filter(Boolean) : [];
      const reus = formData.partes_reus ? formData.partes_reus.split(",").map(s => s.trim()).filter(Boolean) : [];
      const valorNum = formData.valor_causa ? parseFloat(formData.valor_causa.replace(/[^\d,.-]/g, "").replace(",", ".")) : null;
      const payload = {
        number: formData.number,
        title: formData.title,
        client_name: formData.client_name,
        type: formData.type,
        status: formData.status,
        risk_level: formData.risk_level,
        court: formData.court,
        judge: formData.judge,
        notes: formData.notes,
        description: formData.description,
        tags: tagsArray,
        responsible_id: formData.responsible_id === "none" ? null : formData.responsible_id,
        foro: formData.foro || null,
        vara: formData.vara || null,
        classe: formData.classe || null,
        assunto: formData.assunto.length > 0 ? formData.assunto : null,
        fase: formData.fase || null,
        valor_causa: valorNum,
        partes: { autores, reus },
      };

      if (editingId) {
        const { error } = await supabase.from("processes").update(payload as any).eq("id", editingId);
        if (error) throw error;
        await logAudit("process_updated", editingId, { fields_changed: Object.keys(payload) });
      } else {
        const { data: inserted, error } = await supabase.from("processes").insert({ ...payload, user_id: user!.id, organization_id: activeOrgId } as any).select("id").single();
        if (error) throw error;
        await logAudit("process_created", inserted.id, { title: formData.title, number: formData.number });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      queryClient.invalidateQueries({ queryKey: ["processes-summary"] });
      queryClient.invalidateQueries({ queryKey: ["processes-stats"] });
      setDialogOpen(false); setEditingId(null); setForm(emptyForm); setFormTouched(false);
      toast.success(editingId ? "Processo atualizado!" : "Processo criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("processes").update({ archived: true }).eq("id", id);
      if (error) throw error;
      await logAudit("process_archived", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      queryClient.invalidateQueries({ queryKey: ["processes-stats"] });
      toast.success("Processo arquivado!");
    },
  });

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      number: p.number, title: p.title, client_name: p.client_name, type: p.type, status: p.status,
      risk_level: p.risk_level || "low", court: p.court || "", judge: p.judge || "", notes: p.notes || "",
      description: p.description || "", tags: (p.tags || []).join(", "),
      responsible_id: p.responsible_id || "none",
      foro: p.foro || "", vara: p.vara || "", classe: p.classe || "",
      assunto: p.assunto || [], fase: p.fase || "",
      valor_causa: p.valor_causa ? String(p.valor_causa) : "",
      partes_autores: (p.partes?.autores || []).join(", "),
      partes_reus: (p.partes?.reus || []).join(", "),
    });
    setFormTouched(false);
    setDialogOpen(true);
  };

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  return (
    <TooltipProvider>
    <div className="p-6 lg:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-overline text-primary mb-1">Gestão</p>
          <h1 className="text-display-lg">Processos</h1>
          <p className="text-body-sm text-muted-foreground mt-1">Gerencie todos os seus processos judiciais</p>
        </div>
        <Button variant="hero" onClick={() => { setEditingId(null); setForm(emptyForm); setFormTouched(false); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo Processo
        </Button>
      </motion.div>

      {/* Mini Dashboard */}
      {stats && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Processos ativos", value: stats.totalProcesses, icon: Scale, color: "text-primary", filterKey: null },
            { label: "Tarefas pendentes", value: stats.pendingTasks, icon: ListTodo, color: stats.pendingTasks > 0 ? "text-warning" : "text-muted-foreground", filterKey: "pendingTasks" },
            { label: "Prazos vencidos", value: stats.overdueDeadlines, icon: AlertTriangle, color: stats.overdueDeadlines > 0 ? "text-destructive" : "text-muted-foreground", filterKey: "overdueDeadlines" },
            { label: "Documentos vinculados", value: stats.totalDocs, icon: FileText, color: "text-muted-foreground", filterKey: "totalDocs" },
          ].map((card) => {
            const isActive = dashboardFilter === card.filterKey;
            return (
              <button
                key={card.label}
                onClick={() => { setDashboardFilter(isActive ? null : card.filterKey); setPage(0); }}
                className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${isActive ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/30 hover:bg-muted/40"} ${card.filterKey === null ? "cursor-default" : "cursor-pointer"}`}
                disabled={card.filterKey === null}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${card.color}`}>
                  <card.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-display-sm leading-none"><AnimatedNumber value={card.value} /></p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{card.label}{isActive ? " ✕" : ""}</p>
                </div>
              </button>
            );
          })}
        </motion.div>
      )}

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10 h-11 rounded-xl bg-muted border-border" placeholder="Buscar por título, número ou cliente..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40 h-11 rounded-xl bg-muted border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Active dashboard filter indicator */}
      {dashboardFilter && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1 rounded-lg text-xs">
            {dashboardFilter === "pendingTasks" && "Tarefas pendentes"}
            {dashboardFilter === "overdueDeadlines" && "Prazos vencidos"}
            {dashboardFilter === "totalDocs" && "Com documentos"}
            <button onClick={() => { setDashboardFilter(null); setPage(0); }} className="ml-1 hover:text-destructive transition-colors">
              <X className="h-3 w-3" />
            </button>
          </Badge>
          <span className="text-xs text-muted-foreground">Filtro do dashboard ativo</span>
        </motion.div>
      )}

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <LexCard hover={false}>
          {isLoading ? (
            <div className="py-16 text-center">
              <div className="flex gap-1.5 justify-center mb-3">
                <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
                <span className="h-2.5 w-2.5 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
                <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" style={{ animationDelay: "400ms" }} />
              </div>
              <p className="text-body-sm text-muted-foreground">Carregando processos...</p>
            </div>
          ) : !data?.items.length ? (
            <div className="py-16 text-center">
              <Scale className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-body-sm text-muted-foreground mb-3">Nenhum processo encontrado.</p>
              <Button variant="outline" size="sm" onClick={() => { setEditingId(null); setForm(emptyForm); setFormTouched(false); setDialogOpen(true); }}>
                Criar primeiro processo
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Número", "Título", "Cliente", "Tipo", "Status", "Risco", "Vínculos", "Ações"].map((h) => (
                      <th key={h} className="text-left py-3 text-overline text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors group"
                    >
                      <td className="py-3.5 font-mono text-caption text-primary">{p.number}</td>
                      <td className="py-3.5 font-medium">{p.title}</td>
                      <td className="py-3.5 text-muted-foreground">{p.client_name}</td>
                      <td className="py-3.5"><LexBadge variant="outline">{typeMap[p.type] || p.type}</LexBadge></td>
                      <td className="py-3.5">
                        <LexBadge variant={p.status === "active" ? "success" : p.status === "closed" ? "default" : "warning"}>
                          {statusMap[p.status] || p.status}
                        </LexBadge>
                      </td>
                      <td className="py-3.5"><RiskIndicator level={p.risk_level as any || "low"} /></td>
                      <td className="py-3.5">
                        {(() => {
                          const c = (countsMap as Record<string, { tasks: number; tasksDone: number; docs: number; deadlines: number; deadlinesOverdue: number; deadlinesDone: number }>)[p.id];
                          if (!c) return <span className="text-muted-foreground/40">—</span>;
                          return (
                            <div className="flex items-center gap-2">
                              {c.tasks > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground cursor-default">
                                      <ListTodo className="h-3 w-3" />{c.tasks}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {c.tasksDone}/{c.tasks} concluída{c.tasks !== 1 ? "s" : ""}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {c.deadlines > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={`inline-flex items-center gap-1 text-[10px] cursor-default ${c.deadlinesOverdue > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                      <CalendarClock className="h-3 w-3" />{c.deadlines}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {c.deadlinesDone}/{c.deadlines} concluído{c.deadlines !== 1 ? "s" : ""}
                                    {c.deadlinesOverdue > 0 && ` · ${c.deadlinesOverdue} vencido${c.deadlinesOverdue !== 1 ? "s" : ""}`}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {c.docs > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground cursor-default">
                                      <FileText className="h-3 w-3" />{c.docs}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {c.docs} documento{c.docs !== 1 ? "s" : ""}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {c.tasks === 0 && c.deadlines === 0 && c.docs === 0 && (
                                <span className="text-[10px] text-muted-foreground/40">—</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3.5">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-normal">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setSelectedProcess(p); setViewDialog(true); }}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-destructive" onClick={() => archiveMutation.mutate(p.id)}><Archive className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
              <p className="text-caption text-muted-foreground">{data?.count} processos • Página {page + 1}/{totalPages}</p>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </LexCard>
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">{editingId ? "Editar Processo" : "Novo Processo"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            setFormTouched(true);
            const cnjDigits = form.number.replace(/\D/g, "");
            if (!form.number.trim() || !form.client_name.trim() || !form.title.trim() || cnjDigits.length !== 20 || !form.foro || !form.vara || !form.classe || !form.fase || !form.partes_autores.trim() || (form.responsible_id === "none")) {
              toast.error(cnjDigits.length !== 20 && form.number.trim() ? "Número CNJ deve ter 20 dígitos." : "Preencha todos os campos obrigatórios.");
              return;
            }
            if (form.valor_causa && isNaN(parseFloat(form.valor_causa.replace(/[^\d,.-]/g, "").replace(",", ".")))) {
              toast.error("Valor da causa inválido. Insira apenas números.");
              return;
            }
            saveMutation.mutate(form);
          }} className="space-y-4">
            {/* Row 1: Número, Cliente, Título */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Número CNJ <span className="text-destructive">*</span></label>
                <Input className={`bg-muted border-border rounded-xl ${formTouched && (!form.number.trim() || form.number.replace(/\D/g, "").length !== 20) ? "border-destructive ring-1 ring-destructive/30" : ""}`} value={form.number} onChange={(e) => { const digits = e.target.value.replace(/\D/g, "").slice(0, 20); let masked = ""; for (let i = 0; i < digits.length; i++) { if (i === 7) masked += "-"; if (i === 9) masked += "."; if (i === 13) masked += "."; if (i === 14) masked += "."; if (i === 16) masked += "."; masked += digits[i]; } setForm({ ...form, number: masked }); }} placeholder="0000000-00.0000.0.00.0000" maxLength={25} />
                {formTouched && !form.number.trim() && <p className="text-[10px] text-destructive mt-1">Campo obrigatório</p>}
                {formTouched && form.number.trim() && form.number.replace(/\D/g, "").length !== 20 && <p className="text-[10px] text-destructive mt-1">CNJ incompleto ({form.number.replace(/\D/g, "").length}/20)</p>}
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Cliente <span className="text-destructive">*</span></label>
                <Input className={`bg-muted border-border rounded-xl ${formTouched && !form.client_name.trim() ? "border-destructive ring-1 ring-destructive/30" : ""}`} value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
                {formTouched && !form.client_name.trim() && <p className="text-[10px] text-destructive mt-1">Campo obrigatório</p>}
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Título <span className="text-destructive">*</span></label>
                <Input className={`bg-muted border-border rounded-xl ${formTouched && !form.title.trim() ? "border-destructive ring-1 ring-destructive/30" : ""}`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                {formTouched && !form.title.trim() && <p className="text-[10px] text-destructive mt-1">Campo obrigatório</p>}
              </div>
            </div>

            {/* Row 2: Partes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Autor(es) <span className="text-destructive">*</span> <span className="text-[10px] text-muted-foreground font-normal">(separar por vírgula)</span></label>
                <Input className={`bg-muted border-border rounded-xl ${formTouched && !form.partes_autores.trim() ? "border-destructive ring-1 ring-destructive/30" : ""}`} value={form.partes_autores} onChange={(e) => setForm({ ...form, partes_autores: e.target.value })} placeholder="Nome do autor 1, Nome do autor 2..." />
                {formTouched && !form.partes_autores.trim() && <p className="text-[10px] text-destructive mt-1">Informe ao menos um autor</p>}
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Réu(s) <span className="text-[10px] text-muted-foreground font-normal">(separar por vírgula)</span></label>
                <Input className="bg-muted border-border rounded-xl" value={form.partes_reus} onChange={(e) => setForm({ ...form, partes_reus: e.target.value })} placeholder="Nome do réu 1, Nome do réu 2..." />
              </div>
            </div>

            {/* Row 3: Foro, Vara, Classe, Fase */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Foro <span className="text-destructive">*</span></label>
                <Select value={form.foro} onValueChange={(v) => setForm({ ...form, foro: v, vara: "" })}>
                  <SelectTrigger className={`bg-muted border-border rounded-xl ${formTouched && !form.foro ? "border-destructive ring-1 ring-destructive/30" : ""}`}><SelectValue placeholder="Selecionar foro" /></SelectTrigger>
                  <SelectContent>{foroOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
                {formTouched && !form.foro && <p className="text-[10px] text-destructive mt-1">Campo obrigatório</p>}
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Vara <span className="text-destructive">*</span></label>
                <Select value={form.vara} onValueChange={(v) => setForm({ ...form, vara: v })} disabled={!form.foro}>
                  <SelectTrigger className={`bg-muted border-border rounded-xl ${formTouched && !form.vara ? "border-destructive ring-1 ring-destructive/30" : ""}`}><SelectValue placeholder={form.foro ? "Selecionar vara" : "Selecione o foro primeiro"} /></SelectTrigger>
                  <SelectContent>{(varasByForo[form.foro] || []).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
                {formTouched && !form.vara && <p className="text-[10px] text-destructive mt-1">Campo obrigatório</p>}
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Classe <span className="text-destructive">*</span></label>
                <Select value={form.classe} onValueChange={(v) => setForm({ ...form, classe: v })}>
                  <SelectTrigger className={`bg-muted border-border rounded-xl ${formTouched && !form.classe ? "border-destructive ring-1 ring-destructive/30" : ""}`}><SelectValue placeholder="Selecionar classe" /></SelectTrigger>
                  <SelectContent>{classeOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                {formTouched && !form.classe && <p className="text-[10px] text-destructive mt-1">Campo obrigatório</p>}
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Fase <span className="text-destructive">*</span></label>
                <Select value={form.fase} onValueChange={(v) => setForm({ ...form, fase: v })}>
                  <SelectTrigger className={`bg-muted border-border rounded-xl ${formTouched && !form.fase ? "border-destructive ring-1 ring-destructive/30" : ""}`}><SelectValue placeholder="Selecionar fase" /></SelectTrigger>
                  <SelectContent>{faseOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
                {formTouched && !form.fase && <p className="text-[10px] text-destructive mt-1">Campo obrigatório</p>}
              </div>
            </div>

            {/* Row 4: Assunto, Valor, Responsável, Risco */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Assunto</label>
                <Select value={form.assunto[0] || ""} onValueChange={(v) => setForm({ ...form, assunto: v ? [v] : [] })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue placeholder="Selecionar assunto" /></SelectTrigger>
                  <SelectContent>{assuntoOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Valor da Causa (R$)</label>
                <Input className="bg-muted border-border rounded-xl" value={form.valor_causa} onChange={(e) => setForm({ ...form, valor_causa: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="0,00" />
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Responsável <span className="text-destructive">*</span></label>
                <Select value={form.responsible_id} onValueChange={(v) => setForm({ ...form, responsible_id: v })}>
                  <SelectTrigger className={`bg-muted border-border rounded-xl ${formTouched && form.responsible_id === "none" ? "border-destructive ring-1 ring-destructive/30" : ""}`}><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {orgMembers.map((m: any) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                          {(m.profiles as any)?.full_name || "Membro"} <span className="text-muted-foreground text-xs">({m.role})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formTouched && form.responsible_id === "none" && <p className="text-[10px] text-destructive mt-1">Campo obrigatório</p>}
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Risco</label>
                <Select value={form.risk_level} onValueChange={(v) => setForm({ ...form, risk_level: v })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="low">Baixo</SelectItem><SelectItem value="medium">Médio</SelectItem><SelectItem value="high">Alto</SelectItem><SelectItem value="critical">Crítico</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 5: Tipo, Status, Juiz, Tags */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Tipo</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(typeMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(statusMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-overline text-muted-foreground block mb-1.5">Juiz</label><Input className="bg-muted border-border rounded-xl" value={form.judge} onChange={(e) => setForm({ ...form, judge: e.target.value })} /></div>
              <div><label className="text-overline text-muted-foreground block mb-1.5">Tags <span className="text-[10px] text-muted-foreground font-normal">(vírgula)</span></label><Input className="bg-muted border-border rounded-xl" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="cível, urgente..." /></div>
            </div>

            {/* Row 6: Descrição, Observações */}
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-overline text-muted-foreground block mb-1.5">Descrição</label><Textarea className="bg-muted border-border rounded-xl" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Descrição do processo..." /></div>
              <div><label className="text-overline text-muted-foreground block mb-1.5">Observações</label><Textarea className="bg-muted border-border rounded-xl" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            </div>

            {/* Row 7: Vincular Cliente */}
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Vincular Cliente</label>
              <Select value={(form as any).client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v } as any)}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {orgClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}{c.document_number ? ` (${c.document_number})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader><DialogTitle className="text-display-sm">Detalhes do Processo</DialogTitle></DialogHeader>
          {selectedProcess && (
            <ProcessDetailsContent process={selectedProcess} getMemberName={getMemberName} activeOrgId={activeOrgId} />
          )}
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};

/* ─── Linked Documents with Filters ─── */
const CATEGORY_OPTIONS = [
  { value: "__all__", label: "Todas categorias" },
  { value: "petition", label: "Petição Inicial" },
  { value: "contestation", label: "Contestação" },
  { value: "contract", label: "Contrato" },
  { value: "evidence", label: "Provas" },
  { value: "court_order", label: "Decisão Judicial" },
  { value: "hearing_doc", label: "Audiência (ata/termo)" },
  { value: "recurso", label: "Recurso" },
  { value: "correspondence", label: "Correspondência" },
  { value: "power_of_attorney", label: "Procuração" },
  { value: "internal", label: "Documento Interno" },
  { value: "report", label: "Relatório" },
  { value: "other", label: "Outro" },
];

const LinkedDocsSection = ({ docs, loading, processId }: { docs: any[]; loading: boolean; processId: string }) => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docSearch, setDocSearch] = useState("");
  const [docCategory, setDocCategory] = useState("__all__");
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);

  const toggleCompareDoc = (docId: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(docId)) return prev.filter((id) => id !== docId);
      if (prev.length >= 2) return [prev[1], docId];
      return [...prev, docId];
    });
  };

  const launchComparison = async () => {
    if (compareSelection.length !== 2) return;
    const docA = docs.find((d: any) => d.id === compareSelection[0]);
    const docB = docs.find((d: any) => d.id === compareSelection[1]);
    if (!docA || !docB) return;

    navigate("/text-comparison", {
      state: {
        labelA: docA.file_name,
        labelB: docB.file_name,
        comparisonType: "contextual_legal",
        sourceDocA: docA,
        sourceDocB: docB,
      },
    });
  };

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadEventId, setUploadEventId] = useState("none");
  const [uploadName, setUploadName] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadCategory("other");
    setUploadEventId("none");
    setUploadName("");
    setUploadNotes("");
  };

  // Fetch events for linking
  const { data: processEvents = [] } = useQuery({
    queryKey: ["process-events-for-docs", processId],
    queryFn: async () => {
      const { data } = await supabase
        .from("process_events" as any)
        .select("id, title, event_type, event_date")
        .eq("process_id", processId)
        .order("event_date", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: showUploadDialog,
  });

  // Fetch unlinked docs for the link dialog
  const { data: unlinkedDocs = [] } = useQuery({
    queryKey: ["unlinked-docs-for-process", activeOrgId, linkSearch],
    queryFn: async () => {
      let q = supabase
        .from("documents")
        .select("id, file_name, file_type, file_size, created_at, category")
        .is("process_id", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (linkSearch) q = q.ilike("file_name", `%${linkSearch}%`);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: showLinkDialog,
  });

  const linkMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("documents").update({ process_id: processId } as any).eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-linked-docs", processId] });
      queryClient.invalidateQueries({ queryKey: ["unlinked-docs-for-process"] });
      toast.success("Documento vinculado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("documents").update({ process_id: null } as any).eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-linked-docs", processId] });
      toast.success("Documento desvinculado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleUpload = async () => {
    if (!uploadFile || !user) return;
    setUploading(true);
    try {
      const ext = uploadFile.name.split(".").pop();
      const orgPath = activeOrgId || user.id;
      const path = `${orgPath}/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, uploadFile);
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("documents").insert({
        user_id: user.id,
        organization_id: activeOrgId,
        file_name: uploadName.trim() || uploadFile.name,
        file_url: path,
        file_size: uploadFile.size,
        file_type: uploadFile.type,
        category: uploadCategory,
        process_id: processId,
        event_id: uploadEventId === "none" ? null : uploadEventId,
        notes: uploadNotes.trim() || null,
        origin: "manual",
      } as any);
      if (dbErr) throw dbErr;

      queryClient.invalidateQueries({ queryKey: ["process-linked-docs", processId] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setShowUploadDialog(false);
      resetUploadForm();
      toast.success("Documento anexado com sucesso!");
    } catch (err: any) {
      toast.error("Não foi possível anexar o documento: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async (doc: any) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 60);
    if (error) { toast.error("Erro ao gerar link de download"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const filtered = useMemo(() => {
    return docs.filter((doc: any) => {
      const matchSearch = !docSearch || doc.file_name.toLowerCase().includes(docSearch.toLowerCase());
      const matchCat = docCategory === "__all__" || doc.category === docCategory;
      return matchSearch && matchCat;
    });
  }, [docs, docSearch, docCategory]);

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-overline text-muted-foreground">Documentos vinculados</span>
        </div>
        <div className="flex items-center gap-1.5">
          {docs.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {filtered.length}/{docs.length}
            </span>
          )}
          {compareSelection.length === 2 && (
            <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={launchComparison}>
              <ArrowLeftRight className="h-3 w-3" /> Comparar
            </Button>
          )}
          {compareSelection.length > 0 && compareSelection.length < 2 && (
            <span className="text-[10px] text-muted-foreground">Selecione mais 1</span>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Vincular documento existente" onClick={() => setShowLinkDialog(true)}>
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Anexar novo documento"
            onClick={() => { resetUploadForm(); setShowUploadDialog(true); }}
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-caption text-muted-foreground text-center py-4">Carregando documentos...</p>
      ) : docs.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-caption text-muted-foreground mb-2">Nenhum documento vinculado.</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowLinkDialog(true)}>
              <Link2 className="h-3 w-3 mr-1" /> Vincular existente
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { resetUploadForm(); setShowUploadDialog(true); }}>
              <Upload className="h-3 w-3 mr-1" /> Anexar novo
            </Button>
          </div>
        </div>
      ) : (
        <>
          {docs.length > 3 && (
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Buscar documento..." value={docSearch} onChange={(e) => setDocSearch(e.target.value)} className="h-7 text-xs pl-7" />
              </div>
              <Select value={docCategory} onValueChange={setDocCategory}>
                <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {filtered.length === 0 ? (
            <p className="text-caption text-muted-foreground text-center py-3">Nenhum documento encontrado com os filtros aplicados.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {filtered.map((doc: any) => {
                const sizeKB = doc.file_size ? (doc.file_size / 1024).toFixed(0) : null;
                const sizeLabel = sizeKB ? (Number(sizeKB) > 1024 ? `${(Number(sizeKB) / 1024).toFixed(1)} MB` : `${sizeKB} KB`) : null;
                return (
                  <div key={doc.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={compareSelection.includes(doc.id)}
                      onCheckedChange={() => toggleCompareDoc(doc.id)}
                      className="h-3.5 w-3.5 shrink-0"
                      title="Selecionar para comparação"
                    />
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 text-caption truncate text-foreground">{doc.file_name}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                      {CATEGORY_OPTIONS.find((c) => c.value === doc.category)?.label || doc.category}
                    </Badge>
                    {doc.event_id && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0 text-info">Evento</Badge>
                    )}
                    {sizeLabel && <span className="text-[10px] text-muted-foreground shrink-0">{sizeLabel}</span>}
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(doc.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-primary shrink-0" onClick={() => downloadFile(doc)}>
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0"
                      title="Desvincular"
                      onClick={() => unlinkMutation.mutate(doc.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Upload dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => { if (!open) resetUploadForm(); setShowUploadDialog(open); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Anexar Documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadFile ? (
                <div>
                  <FileText className="h-7 w-7 text-primary mx-auto mb-1.5" />
                  <p className="text-caption font-medium truncate">{uploadFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">{(uploadFile.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <Upload className="h-7 w-7 text-muted-foreground/40 mx-auto mb-1.5" />
                  <p className="text-caption text-muted-foreground">Clique para selecionar</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">PDF, DOCX, JPG, PNG até 20MB</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setUploadFile(f);
                if (f && !uploadName) setUploadName(f.name.replace(/\.[^.]+$/, ""));
                e.target.value = "";
              }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Categoria *</label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger className="bg-muted border-border rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.filter((c) => c.value !== "__all__").map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Vincular a Evento</label>
                <Select value={uploadEventId} onValueChange={setUploadEventId}>
                  <SelectTrigger className="bg-muted border-border rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">Nenhum</SelectItem>
                    {processEvents.map((ev: any) => (
                      <SelectItem key={ev.id} value={ev.id} className="text-xs">
                        {ev.title} ({new Date(ev.event_date).toLocaleDateString("pt-BR")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-overline text-muted-foreground block mb-1">Nome do documento</label>
              <Input className="bg-muted border-border rounded-xl h-9 text-xs" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Nome do arquivo" />
            </div>

            <div>
              <label className="text-overline text-muted-foreground block mb-1">Descrição (opcional)</label>
              <Textarea className="bg-muted border-border rounded-xl text-xs" value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} rows={2} placeholder="Observações sobre o documento..." />
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowUploadDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleUpload} disabled={!uploadFile || uploading}>
                {uploading ? "Enviando..." : "Anexar"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link existing doc dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Vincular Documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar documentos não vinculados..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            {unlinkedDocs.length === 0 ? (
              <p className="text-caption text-muted-foreground text-center py-6">Nenhum documento sem vínculo encontrado.</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {unlinkedDocs.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => linkMutation.mutate(doc.id)}
                  >
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 text-caption truncate">{doc.file_name}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                      {CATEGORY_OPTIONS.find((c) => c.value === doc.category)?.label || doc.category}
                    </Badge>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ─── Linked Deadlines ─── */
const DEADLINE_STATUS_MAP: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "warning" },
  completed: { label: "Concluído", variant: "success" },
  overdue: { label: "Vencido", variant: "destructive" },
};

const LinkedDeadlinesSection = ({ deadlines, loading, processId }: { deadlines: any[]; loading: boolean; processId: string }) => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDescription, setNewDescription] = useState("");

  const { data: unlinkedDeadlines = [] } = useQuery({
    queryKey: ["unlinked-deadlines-for-process", activeOrgId, linkSearch],
    queryFn: async () => {
      let q = supabase
        .from("deadlines")
        .select("id, title, due_date, priority, status")
        .is("process_id", null)
        .order("due_date", { ascending: true })
        .limit(20);
      if (linkSearch) q = q.ilike("title", `%${linkSearch}%`);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: showLinkDialog,
  });

  const linkMutation = useMutation({
    mutationFn: async (deadlineId: string) => {
      const { error } = await supabase.from("deadlines").update({ process_id: processId } as any).eq("id", deadlineId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-linked-deadlines", processId] });
      queryClient.invalidateQueries({ queryKey: ["unlinked-deadlines-for-process"] });
      toast.success("Prazo vinculado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (deadlineId: string) => {
      const { error } = await supabase.from("deadlines").update({ process_id: null } as any).eq("id", deadlineId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-linked-deadlines", processId] });
      toast.success("Prazo desvinculado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user || !newTitle.trim() || !newDueDate) throw new Error("Preencha título e data.");
      const { error } = await supabase.from("deadlines").insert({
        user_id: user.id,
        organization_id: activeOrgId,
        title: newTitle.trim(),
        due_date: newDueDate,
        priority: newPriority,
        description: newDescription || null,
        process_id: processId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-linked-deadlines", processId] });
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      setShowCreateDialog(false);
      setNewTitle("");
      setNewDueDate("");
      setNewPriority("medium");
      setNewDescription("");
      toast.success("Prazo criado e vinculado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isOverdue = (dueDate: string, status: string) => {
    if (status === "completed") return false;
    return new Date(dueDate + "T23:59:59") < new Date();
  };

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <span className="text-overline text-muted-foreground">Prazos vinculados</span>
        </div>
        <div className="flex items-center gap-1.5">
          {deadlines.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {deadlines.length} prazo{deadlines.length !== 1 ? "s" : ""}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Vincular prazo existente" onClick={() => setShowLinkDialog(true)}>
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Criar novo prazo" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-caption text-muted-foreground text-center py-4">Carregando prazos...</p>
      ) : deadlines.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-caption text-muted-foreground mb-2">Nenhum prazo vinculado.</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowLinkDialog(true)}>
              <Link2 className="h-3 w-3 mr-1" /> Vincular existente
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-3 w-3 mr-1" /> Criar novo
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {deadlines.map((dl: any) => {
            const overdue = isOverdue(dl.due_date, dl.status);
            const statusInfo = DEADLINE_STATUS_MAP[overdue ? "overdue" : dl.status] || DEADLINE_STATUS_MAP.pending;
            return (
              <div key={dl.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                {overdue ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                ) : dl.status === "completed" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
                )}
                <span className={`flex-1 text-caption truncate ${dl.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {dl.title}
                </span>
                <div className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[dl.priority] || PRIORITY_DOT.medium}`} title={dl.priority} />
                <span className={`text-[10px] shrink-0 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {new Date(dl.due_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </span>
                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${overdue ? "border-destructive text-destructive" : ""}`}>
                  {statusInfo.label}
                </Badge>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0" title="Desvincular" onClick={() => unlinkMutation.mutate(dl.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Link existing deadline dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Vincular Prazo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar prazos não vinculados..." value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            {unlinkedDeadlines.length === 0 ? (
              <p className="text-caption text-muted-foreground text-center py-6">Nenhum prazo sem vínculo encontrado.</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {unlinkedDeadlines.map((dl: any) => (
                  <div key={dl.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => linkMutation.mutate(dl.id)}>
                    <CalendarClock className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 text-caption truncate">{dl.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(dl.due_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create new deadline dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Novo Prazo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-overline text-muted-foreground block mb-1">Título *</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Audiência inicial" className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1">Data de vencimento *</label>
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1">Prioridade</label>
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1">Descrição</label>
              <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Descrição opcional..." className="h-9 text-sm" />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newTitle.trim() || !newDueDate || createMutation.isPending}>
                {createMutation.isPending ? "Criando..." : "Criar Prazo"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ─── Court Sync Section ─── */
const courtSystemLabels: Record<string, string> = { pje: "PJe", esaj: "e-SAJ", projudi: "PROJUDI", eproc: "e-Proc", tucujuris: "Tucujuris" };
const importStatusLabels: Record<string, { label: string; className: string }> = {
  sucesso: { label: "Sucesso", className: "text-accent" },
  falha: { label: "Falha", className: "text-destructive" },
  sem_novidades: { label: "Sem novidades", className: "text-muted-foreground" },
  pending: { label: "Pendente", className: "text-warning" },
};

const CourtSyncSection = ({ processId, processNumber }: { processId: string; processNumber: string }) => {
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  // Check existing integration
  const { data: integration } = useQuery({
    queryKey: ["court-integration-for-process", processId],
    queryFn: async () => {
      const { data } = await supabase
        .from("court_integrations")
        .select("id, court_system, status, last_sync_at, sync_config")
        .eq("process_id", processId)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    enabled: !!processId,
  });

  // Fetch import logs
  const { data: importLogs = [] } = useQuery({
    queryKey: ["import-logs-for-process", processId],
    queryFn: async () => {
      const { data } = await supabase
        .from("import_logs" as any)
        .select("*")
        .eq("process_id", processId)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data as any[]) || [];
    },
    enabled: !!processId,
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("court-sync", {
        body: { process_id: processId, source: "manual" },
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["court-integration-for-process", processId] });
      queryClient.invalidateQueries({ queryKey: ["import-logs-for-process", processId] });
      queryClient.invalidateQueries({ queryKey: ["process-movements", processId] });

      if (data?.movements_created > 0) {
        toast.success(`Processo atualizado com sucesso! ${data.movements_created} movimentação(ões) importada(s).`);
      } else if (data?.movements_found === 0) {
        toast.info("Consulta realizada. Nenhuma novidade encontrada.");
      } else {
        toast.info("Consulta realizada. Nenhuma movimentação nova.");
      }
    } catch (err: any) {
      toast.error("Não foi possível consultar o tribunal: " + (err.message || "Tente novamente mais tarde."));
    } finally {
      setSyncing(false);
    }
  };

  // Check if number looks valid for sync (at least some digits)
  const hasValidNumber = processNumber && processNumber.replace(/\D/g, "").length >= 10;

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-overline text-muted-foreground">Importação do Tribunal</span>
        </div>
        {integration && (
          <LexBadge variant="outline">{courtSystemLabels[integration.court_system] || integration.court_system}</LexBadge>
        )}
      </div>

      {!hasValidNumber ? (
        <p className="text-caption text-muted-foreground text-center py-4">
          Número do processo inválido ou ausente para consulta automática.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg gap-1.5"
              disabled={syncing}
              onClick={handleSync}
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              {syncing ? "Consultando tribunal..." : "Atualizar do tribunal"}
            </Button>
            {integration?.last_sync_at && (
              <span className="text-[10px] text-muted-foreground">
                Última consulta: {new Date(integration.last_sync_at).toLocaleString("pt-BR")}
              </span>
            )}
          </div>

          {/* Import logs */}
          {importLogs.length > 0 && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {importLogs.map((log: any) => {
                const st = importStatusLabels[log.status] || importStatusLabels.pending;
                return (
                  <div key={log.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30">
                    <span className={`text-caption font-medium ${st.className}`}>{st.label}</span>
                    <span className="flex-1 text-caption text-muted-foreground truncate">{log.message}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Process Details with Linked Tasks ─── */
const TASK_STATUS_ICON: Record<string, React.ReactNode> = {
  todo: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
  in_progress: <Clock className="h-3.5 w-3.5 text-warning" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-accent" />,
};
const TASK_STATUS_LABEL: Record<string, string> = { todo: "A fazer", in_progress: "Em progresso", done: "Concluído" };
const PRIORITY_DOT: Record<string, string> = { urgent: "bg-destructive", high: "bg-warning", medium: "bg-muted-foreground", low: "bg-muted-foreground/40" };

const ProcessDetailsContent = ({ process, getMemberName, activeOrgId }: { process: any; getMemberName: (id: string) => string; activeOrgId: string | null }) => {
  const { data: linkedTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["process-linked-tasks", process.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_tasks")
        .select("id, title, status, priority, due_date, assigned_to, done")
        .eq("process_id", process.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!process.id,
  });

  const { data: linkedDocs = [], isLoading: docsLoading } = useQuery({
    queryKey: ["process-linked-docs", process.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, file_type, file_size, file_url, created_at, category, event_id, origin, notes")
        .eq("process_id", process.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!process.id,
  });

  const { data: linkedDeadlines = [], isLoading: deadlinesLoading } = useQuery({
    queryKey: ["process-linked-deadlines", process.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deadlines")
        .select("id, title, due_date, priority, status, description")
        .eq("process_id", process.id)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!process.id,
  });

  const doneCount = linkedTasks.filter((t: any) => t.status === "done").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-body-sm">
        <div><span className="text-overline text-muted-foreground block mb-0.5">Número</span><span className="font-mono text-primary">{process.number}</span></div>
        <div><span className="text-overline text-muted-foreground block mb-0.5">Cliente</span>{process.client_name}</div>
        <div><span className="text-overline text-muted-foreground block mb-0.5">Título</span>{process.title}</div>
        <div><span className="text-overline text-muted-foreground block mb-0.5">Tipo</span>{typeMap[process.type] || process.type}</div>
        <div><span className="text-overline text-muted-foreground block mb-0.5">Status</span><LexBadge variant={process.status === "active" ? "success" : "warning"}>{statusMap[process.status]}</LexBadge></div>
        <div><span className="text-overline text-muted-foreground block mb-0.5">Risco</span><RiskIndicator level={process.risk_level || "low"} /></div>
        {process.responsible_id && (
          <div><span className="text-overline text-muted-foreground block mb-0.5">Responsável</span>
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5"><AvatarFallback className="text-[10px]">{getMemberName(process.responsible_id).charAt(0)}</AvatarFallback></Avatar>
              <span>{getMemberName(process.responsible_id)}</span>
            </div>
          </div>
        )}
        {process.foro && <div><span className="text-overline text-muted-foreground block mb-0.5">Foro</span>{process.foro}</div>}
        {process.vara && <div><span className="text-overline text-muted-foreground block mb-0.5">Vara</span>{process.vara}</div>}
        {process.classe && <div><span className="text-overline text-muted-foreground block mb-0.5">Classe</span>{process.classe}</div>}
        {process.fase && <div><span className="text-overline text-muted-foreground block mb-0.5">Fase</span><LexBadge variant="outline">{process.fase}</LexBadge></div>}
        {process.valor_causa != null && <div><span className="text-overline text-muted-foreground block mb-0.5">Valor da Causa</span>R$ {Number(process.valor_causa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>}
        {process.court && <div><span className="text-overline text-muted-foreground block mb-0.5">Vara/Tribunal</span>{process.court}</div>}
        {process.judge && <div><span className="text-overline text-muted-foreground block mb-0.5">Juiz</span>{process.judge}</div>}
      </div>
      {/* Partes */}
      {process.partes && ((process.partes as any).autores?.length > 0 || (process.partes as any).reus?.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {(process.partes as any).autores?.length > 0 && (
            <div><span className="text-overline text-muted-foreground block mb-1">Autor(es)</span>
              <div className="flex flex-wrap gap-1.5">{(process.partes as any).autores.map((a: string) => <LexBadge key={a} variant="default">{a}</LexBadge>)}</div>
            </div>
          )}
          {(process.partes as any).reus?.length > 0 && (
            <div><span className="text-overline text-muted-foreground block mb-1">Réu(s)</span>
              <div className="flex flex-wrap gap-1.5">{(process.partes as any).reus.map((r: string) => <LexBadge key={r} variant="outline">{r}</LexBadge>)}</div>
            </div>
          )}
        </div>
      )}
      {/* Assuntos */}
      {process.assunto?.length > 0 && (
        <div><span className="text-overline text-muted-foreground block mb-1">Assunto(s)</span>
          <div className="flex flex-wrap gap-1.5">{process.assunto.map((a: string) => <LexBadge key={a} variant="outline">{a}</LexBadge>)}</div>
        </div>
      )}
      {process.description && <div><span className="text-overline text-muted-foreground block mb-1">Descrição</span><p className="text-body-sm rounded-xl bg-muted p-3">{process.description}</p></div>}
      {process.tags?.length > 0 && (
        <div><span className="text-overline text-muted-foreground block mb-1">Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {process.tags.map((tag: string) => <LexBadge key={tag} variant="outline">{tag}</LexBadge>)}
          </div>
        </div>
      )}
      {process.notes && <div><span className="text-overline text-muted-foreground block mb-1">Observações</span><p className="text-body-sm rounded-xl bg-muted p-3">{process.notes}</p></div>}

      {/* Linked Tasks */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            <span className="text-overline text-muted-foreground">Tarefas vinculadas</span>
          </div>
          {linkedTasks.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {doneCount}/{linkedTasks.length} concluídas
            </span>
          )}
        </div>
        {tasksLoading ? (
          <p className="text-caption text-muted-foreground text-center py-4">Carregando tarefas...</p>
        ) : linkedTasks.length === 0 ? (
          <p className="text-caption text-muted-foreground text-center py-4">Nenhuma tarefa vinculada a este processo.</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {linkedTasks.map((task: any) => (
              <div key={task.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                {TASK_STATUS_ICON[task.status] || TASK_STATUS_ICON.todo}
                <span className={`flex-1 text-caption truncate ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {task.title}
                </span>
                <div className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium}`} title={task.priority} />
                {task.due_date && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(task.due_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                )}
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                  {TASK_STATUS_LABEL[task.status] || task.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Deadlines */}
      <LinkedDeadlinesSection deadlines={linkedDeadlines} loading={deadlinesLoading} processId={process.id} />

      {/* Linked Documents */}
      <LinkedDocsSection docs={linkedDocs} loading={docsLoading} processId={process.id} />

      {/* Resumo 360 (RF-043) */}
      <ProcessSummary360 processId={process.id} organizationId={activeOrgId || ""} />

      {/* AI Classification */}
      <ProcessClassification processId={process.id} organizationId={activeOrgId || ""} />

      {/* Decision Extraction */}
      <DecisionExtraction processId={process.id} organizationId={activeOrgId || ""} />

      {/* Court Sync */}
      <CourtSyncSection processId={process.id} processNumber={process.number} />

      {/* Previsão Processual (RF-070/071/072) */}
      <ProcessPredictionsPanel processId={process.id} organizationId={activeOrgId || ""} />

      {/* Linha do Tempo */}
      <ProcessTimeline processId={process.id} />

      {/* Movimentações */}
      <ProcessMovements processId={process.id} />

      {/* Chat */}
      <ProcessChat processId={process.id} />

      {/* Chat */}
      <ProcessChat processId={process.id} />
    </div>
  );
};

export default Processes;
