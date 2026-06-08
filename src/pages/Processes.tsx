import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ProcessDetailsDialog } from "@/components/process/ProcessDetailsDialog";
import { ProcessFormDialog, emptyProcessForm, type ProcessForm } from "@/components/process/ProcessFormDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import {
  statusMap,
  typeMap,
} from "@/lib/processConstants";
import { LexPageHeader } from "@/components/lexia/LexPageHeader";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { RiskIndicator } from "@/components/lexia/LegalComponents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Archive, Edit, Eye, ChevronLeft, ChevronRight, Scale, ListTodo, AlertTriangle, FileText, Columns3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    let frameId: number;
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (end - start) * eased));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [end, duration]);
  return value;
};

const AnimatedNumber = ({ value }: { value: number }) => {
  const display = useCountUp(value);
  return <>{display}</>;
};

const PAGE_SIZE = 10;

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
  const [form, setForm] = useState<ProcessForm>(emptyProcessForm);
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
      setDialogOpen(false); setEditingId(null); setForm(emptyProcessForm); setFormTouched(false);
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
    <div className="space-y-6">
      <LexPageHeader
        overline="Gestão"
        title="Processos"
        description="Gerencie todos os seus processos judiciais"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/processes/kanban"><Columns3 className="h-4 w-4" /> Kanban</Link>
            </Button>
            <Button variant="hero" onClick={() => { setEditingId(null); setForm(emptyProcessForm); setFormTouched(false); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo Processo
            </Button>
          </>
        }
      />

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
              <Button variant="outline" size="sm" onClick={() => { setEditingId(null); setForm(emptyProcessForm); setFormTouched(false); setDialogOpen(true); }}>
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

      <ProcessFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        form={form}
        setForm={setForm}
        formTouched={formTouched}
        setFormTouched={setFormTouched}
        orgMembers={orgMembers}
        orgClients={orgClients}
        isPending={saveMutation.isPending}
        onSubmit={(data) => saveMutation.mutate(data)}
      />

      <ProcessDetailsDialog
        open={viewDialog}
        onOpenChange={setViewDialog}
        process={selectedProcess}
        getMemberName={getMemberName}
        activeOrgId={activeOrgId}
      />
    </div>
    </TooltipProvider>
  );
};
export default Processes;
