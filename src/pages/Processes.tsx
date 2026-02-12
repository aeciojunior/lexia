import { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
import { Search, Plus, Archive, Edit, Eye, ChevronLeft, ChevronRight, Scale, UserCheck, ListTodo, CheckCircle2, Circle, Clock, FileText, Download, Upload, Link2, X, CalendarClock, AlertTriangle } from "lucide-react";
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

interface ProcessForm {
  number: string; title: string; client_name: string; type: string; status: string; risk_level: string; court: string; judge: string; notes: string; description: string; tags: string; responsible_id: string;
}
const emptyForm: ProcessForm = { number: "", title: "", client_name: "", type: "civil", status: "active", risk_level: "low", court: "", judge: "", notes: "", description: "", tags: "", responsible_id: "none" };

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
        <DialogContent className="max-w-3xl bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">{editingId ? "Editar Processo" : "Novo Processo"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            setFormTouched(true);
            if (!form.number.trim() || !form.client_name.trim() || !form.title.trim()) {
              toast.error("Preencha todos os campos obrigatórios.");
              return;
            }
            saveMutation.mutate(form);
          }} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Número <span className="text-destructive">*</span></label>
                <Input className={`bg-muted border-border rounded-xl ${formTouched && !form.number.trim() ? "border-destructive ring-1 ring-destructive/30" : ""}`} value={form.number} onChange={(e) => { const digits = e.target.value.replace(/\D/g, "").slice(0, 20); let masked = ""; for (let i = 0; i < digits.length; i++) { if (i === 7) masked += "-"; if (i === 9) masked += "."; if (i === 13) masked += "."; if (i === 14) masked += "."; if (i === 16) masked += "."; masked += digits[i]; } setForm({ ...form, number: masked }); }} placeholder="0000000-00.0000.0.00.0000" maxLength={25} />
                {formTouched && !form.number.trim() && <p className="text-[10px] text-destructive mt-1">Campo obrigatório</p>}
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
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-overline text-muted-foreground block mb-1.5">Descrição</label><Textarea className="bg-muted border-border rounded-xl" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Descrição do processo..." /></div>
              <div><label className="text-overline text-muted-foreground block mb-1.5">Observações</label><Textarea className="bg-muted border-border rounded-xl" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><label className="text-overline text-muted-foreground block mb-1.5">Tipo</label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(typeMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-overline text-muted-foreground block mb-1.5">Status</label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-overline text-muted-foreground block mb-1.5">Risco</label><Select value={form.risk_level} onValueChange={(v) => setForm({ ...form, risk_level: v })}><SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Baixo</SelectItem><SelectItem value="medium">Médio</SelectItem><SelectItem value="high">Alto</SelectItem><SelectItem value="critical">Crítico</SelectItem></SelectContent></Select></div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Responsável</label>
                <Select value={form.responsible_id} onValueChange={(v) => setForm({ ...form, responsible_id: v })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
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
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="text-overline text-muted-foreground block mb-1.5">Vara/Tribunal</label><Input className="bg-muted border-border rounded-xl" value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} /></div>
              <div><label className="text-overline text-muted-foreground block mb-1.5">Juiz</label><Input className="bg-muted border-border rounded-xl" value={form.judge} onChange={(e) => setForm({ ...form, judge: e.target.value })} /></div>
              <div><label className="text-overline text-muted-foreground block mb-1.5">Tags (separadas por vírgula)</label><Input className="bg-muted border-border rounded-xl" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="cível, urgente..." /></div>
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
  { value: "petition", label: "Petição" },
  { value: "contract", label: "Contrato" },
  { value: "evidence", label: "Prova" },
  { value: "correspondence", label: "Correspondência" },
  { value: "court_order", label: "Decisão Judicial" },
  { value: "other", label: "Outro" },
];

const LinkedDocsSection = ({ docs, loading, processId }: { docs: any[]; loading: boolean; processId: string }) => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docSearch, setDocSearch] = useState("");
  const [docCategory, setDocCategory] = useState("__all__");
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [uploading, setUploading] = useState(false);

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

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const orgPath = activeOrgId || user.id;
      const path = `${orgPath}/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("documents").insert({
        user_id: user.id,
        organization_id: activeOrgId,
        file_name: file.name,
        file_url: path,
        file_size: file.size,
        file_type: file.type,
        category: "other",
        process_id: processId,
      } as any);
      if (dbErr) throw dbErr;

      queryClient.invalidateQueries({ queryKey: ["process-linked-docs", processId] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Documento enviado e vinculado!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setUploading(false);
    }
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
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Vincular documento existente" onClick={() => setShowLinkDialog(true)}>
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Enviar novo documento"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-caption text-muted-foreground text-center py-4">Carregando documentos...</p>
      ) : docs.length === 0 && !uploading ? (
        <div className="text-center py-4">
          <p className="text-caption text-muted-foreground mb-2">Nenhum documento vinculado.</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowLinkDialog(true)}>
              <Link2 className="h-3 w-3 mr-1" /> Vincular existente
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" /> Enviar novo
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
          {uploading && <p className="text-caption text-primary text-center py-2 animate-pulse">Enviando documento...</p>}
          {filtered.length === 0 ? (
            <p className="text-caption text-muted-foreground text-center py-3">Nenhum documento encontrado com os filtros aplicados.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {filtered.map((doc: any) => {
                const sizeKB = doc.file_size ? (doc.file_size / 1024).toFixed(0) : null;
                const sizeLabel = sizeKB ? (Number(sizeKB) > 1024 ? `${(Number(sizeKB) / 1024).toFixed(1)} MB` : `${sizeKB} KB`) : null;
                return (
                  <div key={doc.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 text-caption truncate text-foreground">{doc.file_name}</span>
                    {doc.file_type && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0 uppercase">{doc.file_type.split("/").pop()}</Badge>
                    )}
                    {sizeLabel && <span className="text-[10px] text-muted-foreground shrink-0">{sizeLabel}</span>}
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(doc.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-primary">
                        <Download className="h-3 w-3" />
                      </Button>
                    </a>
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
        .select("id, file_name, file_type, file_size, file_url, created_at, category")
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
        {process.court && <div><span className="text-overline text-muted-foreground block mb-0.5">Vara/Tribunal</span>{process.court}</div>}
        {process.judge && <div><span className="text-overline text-muted-foreground block mb-0.5">Juiz</span>{process.judge}</div>}
      </div>
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
    </div>
  );
};

export default Processes;
