import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { usePlanLimits, PLAN_LABELS } from "@/hooks/usePlanLimits";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { RiskIndicator } from "@/components/lexia/LegalComponents";
import {
  Scale, AlertTriangle, MessageSquare, ArrowRight,
  Sparkles, CalendarDays, FileText, Users, DollarSign, Clock, Activity, CheckCircle, Bell,
  Download, GitCommitHorizontal,
} from "lucide-react";
import { ReportExportButton } from "@/components/dashboard/ReportExportButton";
import QuickTasksWidget from "@/components/dashboard/QuickTasksWidget";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, differenceInDays, isPast, isToday, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScrollArea } from "@/components/ui/scroll-area";

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4 },
});

const downloadCsv = (data: Record<string, any>[], filename: string) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [headers.join(","), ...data.map(row => headers.map(h => `"${row[h] ?? ""}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const Dashboard = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission, isClient, isAdmin, isOwner } = usePermissions();
  const { plan, limits, isPro } = usePlanLimits();
  const navigate = useNavigate();
  const canViewAudit = isAdmin || isOwner;
  const [chartPeriod, setChartPeriod] = useState<number>(6);

  // Chart refs for PDF export
  const chartRefProcessStatus = useRef<HTMLDivElement>(null);
  const chartRefMovements = useRef<HTMLDivElement>(null);
  const chartRefDeadlines = useRef<HTMLDivElement>(null);
  const chartRefRevenue = useRef<HTMLDivElement>(null);
  const chartRefProcessMonth = useRef<HTMLDivElement>(null);

  // === Processes ===
  const { data: allProcesses = [] } = useQuery({
    queryKey: ["dash-processes", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("processes").select("id, status, risk_level, archived, title, number, client_name, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  // === Movements ===
  const { data: movements = [] } = useQuery({
    queryKey: ["dash-movements", activeOrgId, chartPeriod],
    queryFn: async () => {
      const since = subMonths(new Date(), chartPeriod - 1).toISOString();
      const { data, error } = await supabase.from("process_movements").select("id, movement_date, movement_type, origin").gte("movement_date", since);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  // === All deadlines for analytics ===
  const { data: allDeadlines = [] } = useQuery({
    queryKey: ["dash-all-deadlines", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("deadlines").select("id, title, due_date, status, priority").order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  // === Deadlines ===
  const { data: deadlines = [] } = useQuery({
    queryKey: ["dash-deadlines", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("deadlines").select("id, title, due_date, status, priority").neq("status", "done").order("due_date", { ascending: true }).limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  // === Documents count ===
  const { data: docCount = 0 } = useQuery({
    queryKey: ["dash-doc-count", activeOrgId],
    queryFn: async () => {
      const { count, error } = await supabase.from("documents").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
    enabled: !!activeOrgId,
  });

  // === Members count ===
  const { data: memberCount = 0 } = useQuery({
    queryKey: ["dash-member-count", activeOrgId],
    queryFn: async () => {
      const { count, error } = await supabase.from("user_organizations").select("id", { count: "exact", head: true }).eq("organization_id", activeOrgId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!activeOrgId,
  });

  // === Financial summary (if allowed) ===
  const canViewFinancial = hasPermission("VIEW_FINANCIAL");
  const { data: financialSummary } = useQuery({
    queryKey: ["dash-financial", activeOrgId],
    queryFn: async () => {
      const { data: invoices, error } = await supabase.from("invoices").select("amount_cents, status");
      if (error) throw error;
      const total = invoices?.reduce((sum, i) => sum + (i.amount_cents || 0), 0) || 0;
      const pending = invoices?.filter(i => i.status === "pending" || i.status === "draft").reduce((sum, i) => sum + (i.amount_cents || 0), 0) || 0;
      const paid = invoices?.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.amount_cents || 0), 0) || 0;
      return { total, pending, paid, count: invoices?.length || 0 };
    },
    enabled: !!activeOrgId && canViewFinancial,
  });

  // === Invoices with dates for chart ===
  const { data: invoicesForChart = [] } = useQuery({
    queryKey: ["dash-invoices-chart", activeOrgId, chartPeriod],
    queryFn: async () => {
      const since = subMonths(new Date(), chartPeriod - 1).toISOString();
      const { data, error } = await supabase.from("invoices").select("amount_cents, status, created_at").gte("created_at", since);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId && canViewFinancial,
  });

  // === Audit logs ===
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["dash-audit-logs", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("id, action, created_at, metadata, resource_type").order("created_at", { ascending: false }).limit(8);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId && canViewAudit,
  });

  // === Recent notifications ===
  const { data: recentNotifications = [] } = useQuery({
    queryKey: ["dash-notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("id, title, message, type, read, created_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(6);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Quick tasks handled by QuickTasksWidget component

  // Process stats
  const activeProcesses = allProcesses.filter(p => !p.archived);
  const active = activeProcesses.filter(p => p.status === "active").length;
  const highRisk = activeProcesses.filter(p => p.risk_level === "high" || p.risk_level === "critical").length;
  const closed = allProcesses.filter(p => p.status === "closed").length;
  const recentProcesses = activeProcesses.slice(0, 5);

  // Deadline stats
  const overdueCount = deadlines.filter(d => isPast(new Date(d.due_date)) && !isToday(new Date(d.due_date))).length;
  const todayCount = deadlines.filter(d => isToday(new Date(d.due_date))).length;

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  // === Chart data: dynamic period ===
  const chartMonths = Array.from({ length: chartPeriod }, (_, i) => {
    const d = subMonths(new Date(), chartPeriod - 1 - i);
    return { date: startOfMonth(d), label: format(d, "MMM", { locale: ptBR }) };
  });

  const processChartData = chartMonths.map(m => ({
    month: m.label,
    novos: allProcesses.filter(p => {
      const c = new Date(p.created_at);
      return c.getMonth() === m.date.getMonth() && c.getFullYear() === m.date.getFullYear();
    }).length,
  }));

  const revenueChartData = chartMonths.map(m => ({
    month: m.label,
    faturado: invoicesForChart.filter(i => {
      const c = new Date(i.created_at);
      return c.getMonth() === m.date.getMonth() && c.getFullYear() === m.date.getFullYear();
    }).reduce((s, i) => s + (i.amount_cents || 0), 0) / 100,
    recebido: invoicesForChart.filter(i => {
      const c = new Date(i.created_at);
      return c.getMonth() === m.date.getMonth() && c.getFullYear() === m.date.getFullYear() && i.status === "paid";
    }).reduce((s, i) => s + (i.amount_cents || 0), 0) / 100,
  }));

  // === Processes by status (Pie chart) ===
  const processStatusLabels: Record<string, string> = { active: "Ativos", closed: "Encerrados", pending: "Pendentes", suspended: "Suspensos" };
  const processStatusColors: Record<string, string> = { active: "hsl(192 95% 55%)", closed: "hsl(220 10% 55%)", pending: "hsl(38 92% 60%)", suspended: "hsl(0 84% 60%)" };
  const processStatusData = Object.entries(
    activeProcesses.reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({
    name: processStatusLabels[status] || status,
    value: count,
    color: processStatusColors[status] || "hsl(270 80% 62%)",
  }));

  // === Movements by month ===
  const movementsChartData = chartMonths.map(m => ({
    month: m.label,
    movimentações: movements.filter(mv => {
      const d = new Date(mv.movement_date);
      return d.getMonth() === m.date.getMonth() && d.getFullYear() === m.date.getFullYear();
    }).length,
  }));

  // === Overdue deadlines stats ===
  const overdueDeadlines = allDeadlines.filter(d => d.status !== "done" && isPast(new Date(d.due_date)) && !isToday(new Date(d.due_date)));
  const upcomingDeadlines = allDeadlines.filter(d => d.status !== "done" && !isPast(new Date(d.due_date)));
  const doneDeadlines = allDeadlines.filter(d => d.status === "done");
  const deadlineStatusData = [
    { name: "Vencidos", value: overdueDeadlines.length, color: "hsl(0 84% 60%)" },
    { name: "Pendentes", value: upcomingDeadlines.length, color: "hsl(38 92% 60%)" },
    { name: "Concluídos", value: doneDeadlines.length, color: "hsl(155 75% 48%)" },
  ].filter(d => d.value > 0);

  const auditActionLabels: Record<string, string> = {
    change_active_organization: "Trocou organização",
    invite_sent: "Convite enviado",
    invite_accepted: "Convite aceito",
    member_removed: "Membro removido",
    role_updated: "Papel alterado",
    role_changed: "Papel alterado",
    user_disabled: "Usuário desativado",
    user_enabled: "Usuário reativado",
    process_created: "Processo criado",
    process_updated: "Processo atualizado",
    process_archived: "Processo arquivado",
    process_deleted: "Processo excluído",
    document_uploaded: "Documento enviado",
    document_updated: "Documento atualizado",
    document_deleted: "Documento excluído",
    document_downloaded: "Documento baixado",
    task_created: "Tarefa criada",
    task_updated: "Tarefa atualizada",
    task_completed: "Tarefa concluída",
    task_deleted: "Tarefa excluída",
    login: "Login",
    logout: "Logout",
    organization_updated: "Organização atualizada",
    organization_deleted: "Organização excluída",
    profile_updated: "Perfil atualizado",
    preferences_updated: "Preferências atualizadas",
    user_registered: "Usuário registrado",
  };

  const kpis = [
    { label: "Processos Ativos", value: active, icon: Scale, gradient: "from-primary/20 to-primary/5", text: "text-primary", border: "border-primary/20" },
    { label: "Alto Risco", value: highRisk, icon: AlertTriangle, gradient: "from-destructive/20 to-destructive/5", text: "text-destructive", border: "border-destructive/20" },
    { label: "Documentos", value: docCount, icon: FileText, gradient: "from-info/20 to-info/5", text: "text-info", border: "border-info/20" },
    { label: "Membros", value: memberCount, icon: Users, gradient: "from-secondary/20 to-secondary/5", text: "text-secondary", border: "border-secondary/20" },
  ];

  const statusMap: Record<string, string> = { active: "Ativo", pending: "Pendente", closed: "Encerrado", suspended: "Suspenso" };
  const priorityColors: Record<string, string> = { high: "text-destructive", medium: "text-warning", low: "text-muted-foreground", urgent: "text-destructive" };

  if (isClient) {
    navigate("/portal");
    return null;
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <motion.div {...anim(0)}>
        <p className="text-overline text-primary mb-1">Dashboard</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-lg">
              Olá, {user?.user_metadata?.full_name?.split(" ")[0] || "Advogado"}{" "}
              <span className="inline-block animate-float">👋</span>
            </h1>
            <p className="text-body-sm text-muted-foreground mt-1">
              Visão geral da organização • Plano{" "}
              <span className="text-primary font-semibold">{PLAN_LABELS[plan]}</span>
            </p>
          </div>
          <ReportExportButton
            kpis={kpis.map(k => ({ label: k.label, value: k.value }))}
            processStatusData={processStatusData}
            movementsChartData={movementsChartData}
            deadlineStatusData={deadlineStatusData}
            revenueChartData={revenueChartData}
            overdueCount={overdueCount}
            totalProcesses={allProcesses.length}
            totalDeadlines={allDeadlines.length}
            financialSummary={canViewFinancial ? financialSummary : undefined}
            cashFlowData={[]}
            chartRefs={{
              processStatus: chartRefProcessStatus,
              movements: chartRefMovements,
              deadlines: chartRefDeadlines,
              revenue: chartRefRevenue,
              processMonth: chartRefProcessMonth,
            }}
          />
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} {...anim(0.1 + i * 0.08)}>
            <div className={`rounded-xl border ${kpi.border} bg-gradient-to-br ${kpi.gradient} p-5 transition-all duration-normal hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02] cursor-default group`}>
              <div className="flex items-center justify-between mb-3">
                <kpi.icon className={`h-5 w-5 ${kpi.text} transition-transform duration-normal group-hover:scale-110`} />
                <span className="text-overline text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-display-lg ${kpi.text}`}>{kpi.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Plan usage bar */}
      {limits.maxProcesses !== Infinity && (
        <motion.div {...anim(0.4)}>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card/50 p-4">
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-caption mb-1.5">
                <span className="text-muted-foreground">Processos utilizados</span>
                <span className="font-semibold">{activeProcesses.length} / {limits.maxProcesses}</span>
              </div>
              <Progress value={(activeProcesses.length / limits.maxProcesses) * 100} className="h-2" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-caption mb-1.5">
                <span className="text-muted-foreground">Documentos utilizados</span>
                <span className="font-semibold">{docCount} / {limits.maxDocuments}</span>
              </div>
              <Progress value={(docCount / limits.maxDocuments) * 100} className="h-2" />
            </div>
            {!isPro && (
              <Button variant="outline" size="sm" onClick={() => navigate("/settings")} className="shrink-0">
                Upgrade
              </Button>
            )}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent processes */}
        <motion.div className="lg:col-span-2" {...anim(0.45)}>
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle>Processos Recentes</LexCardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/processes")} className="text-primary">
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </LexCardHeader>
            {recentProcesses.length === 0 ? (
              <div className="py-12 text-center">
                <Scale className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-body-sm text-muted-foreground">Nenhum processo cadastrado ainda.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/processes")}>
                  Criar primeiro processo
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Número", "Título", "Cliente", "Status", "Risco"].map(h => (
                        <th key={h} className="text-left py-2.5 text-overline text-muted-foreground font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentProcesses.map((p, i) => (
                      <motion.tr
                        key={p.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.06, duration: 0.35 }}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate("/processes")}
                      >
                        <td className="py-3.5 font-mono text-caption text-primary">{p.number}</td>
                        <td className="py-3.5 font-medium">{p.title}</td>
                        <td className="py-3.5 text-muted-foreground">{p.client_name}</td>
                        <td className="py-3.5">
                          <LexBadge variant={p.status === "active" ? "success" : p.status === "closed" ? "default" : "warning"}>
                            {statusMap[p.status] || p.status}
                          </LexBadge>
                        </td>
                        <td className="py-3.5"><RiskIndicator level={p.risk_level as any || "low"} /></td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </LexCard>
        </motion.div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Upcoming deadlines */}
          <motion.div {...anim(0.5)}>
            <LexCard hover={false}>
              <LexCardHeader>
                <LexCardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-warning" /> Prazos
                </LexCardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/deadlines")} className="text-primary">
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </LexCardHeader>

              {overdueCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 mb-3">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-caption text-destructive font-medium">
                    {overdueCount} prazo{overdueCount > 1 ? "s" : ""} vencido{overdueCount > 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {deadlines.length === 0 ? (
                <p className="text-caption text-muted-foreground text-center py-6">Sem prazos pendentes 🎉</p>
              ) : (
                <div className="space-y-2">
                  {deadlines.map(d => {
                    const due = new Date(d.due_date);
                    const overdue = isPast(due) && !isToday(due);
                    const today = isToday(due);
                    const daysLeft = differenceInDays(due, new Date());
                    return (
                      <div
                        key={d.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors cursor-pointer hover:bg-muted/30 ${overdue ? "bg-destructive/5" : ""}`}
                        onClick={() => navigate("/deadlines")}
                      >
                        <Clock className={`h-3.5 w-3.5 shrink-0 ${overdue ? "text-destructive" : today ? "text-warning" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-caption font-medium truncate">{d.title}</p>
                          <p className={`text-[10px] ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                            {overdue ? `Vencido há ${Math.abs(daysLeft)} dia(s)` : today ? "Vence hoje" : `${daysLeft} dia(s) restante(s)`}
                          </p>
                        </div>
                        <span className={`text-[10px] font-semibold ${priorityColors[d.priority] || "text-muted-foreground"}`}>
                          {d.priority === "high" || d.priority === "urgent" ? "!" : ""}
                          {format(due, "dd MMM", { locale: ptBR })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </LexCard>
          </motion.div>

          {/* Financial widget */}
          {canViewFinancial && financialSummary && (
            <motion.div {...anim(0.55)}>
              <LexCard hover={false}>
                <LexCardHeader>
                  <LexCardTitle className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-accent" /> Financeiro
                  </LexCardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/financial")} className="text-primary">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </LexCardHeader>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-caption text-muted-foreground">Recebido</span>
                    <span className="text-body-sm font-semibold text-success">{formatCurrency(financialSummary.paid)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-caption text-muted-foreground">Pendente</span>
                    <span className="text-body-sm font-semibold text-warning">{formatCurrency(financialSummary.pending)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between items-center">
                    <span className="text-caption text-muted-foreground">Total ({financialSummary.count} faturas)</span>
                    <span className="text-body-sm font-bold">{formatCurrency(financialSummary.total)}</span>
                  </div>
                </div>
              </LexCard>
            </motion.div>
          )}

          {/* AI Chat widget */}
          <motion.div {...anim(0.6)}>
            <LexCard variant="ai" hover={false} className="flex flex-col overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-3xl" />
              <LexCardHeader className="relative z-10">
                <LexCardTitle className="gradient-text">LexIA Chat</LexCardTitle>
                <LexBadge variant="ai">
                  <span className="h-1.5 w-1.5 rounded-full bg-success mr-1.5 inline-block animate-pulse-glow" />
                  Online
                </LexBadge>
              </LexCardHeader>
              <div className="flex-1 flex flex-col items-center justify-center py-6 text-center relative z-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/20 mb-4">
                  <Sparkles className="h-6 w-6 text-secondary animate-float" />
                </div>
                <p className="text-caption text-muted-foreground mb-4 max-w-[200px]">
                  Assistente jurídico com IA avançada
                </p>
                <Button variant="ai" size="sm" onClick={() => navigate("/chat")}>
                  <MessageSquare className="h-4 w-4" /> Iniciar conversa
                </Button>
              </div>
            </LexCard>
          </motion.div>
        </div>
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processes per month */}
        <motion.div {...anim(0.65)}>
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" /> Processos por mês
              </LexCardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Exportar CSV" onClick={() => downloadCsv(processChartData, "processos-por-mes")}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <ToggleGroup type="single" value={String(chartPeriod)} onValueChange={v => v && setChartPeriod(Number(v))} size="sm">
                  {[3, 6, 12].map(n => (
                    <ToggleGroupItem key={n} value={String(n)} className="text-xs px-2.5 h-7">{n}m</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </LexCardHeader>
            <div className="h-52 -mx-2" ref={chartRefProcessMonth}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 12% 18%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(220 10% 55%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(220 10% 55%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(228 16% 12%)", border: "1px solid hsl(228 12% 18%)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(210 20% 95%)" }}
                  />
                  <Bar dataKey="novos" name="Novos processos" fill="hsl(192 95% 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </LexCard>
        </motion.div>

        {/* Revenue per month */}
        {canViewFinancial && (
          <motion.div {...anim(0.7)}>
            <LexCard hover={false}>
              <LexCardHeader>
                <LexCardTitle className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-accent" /> Faturamento mensal
                </LexCardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Exportar CSV" onClick={() => downloadCsv(revenueChartData, "faturamento-mensal")}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <ToggleGroup type="single" value={String(chartPeriod)} onValueChange={v => v && setChartPeriod(Number(v))} size="sm">
                    {[3, 6, 12].map(n => (
                      <ToggleGroupItem key={n} value={String(n)} className="text-xs px-2.5 h-7">{n}m</ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </LexCardHeader>
              <div className="h-52 -mx-2" ref={chartRefRevenue}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradFaturado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(270 80% 62%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(270 80% 62%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradRecebido" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(155 75% 48%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(155 75% 48%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 12% 18%)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(220 10% 55%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(220 10% 55%)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(228 16% 12%)", border: "1px solid hsl(228 12% 18%)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "hsl(210 20% 95%)" }}
                      formatter={(v: number) => formatCurrency(v * 100)}
                    />
                    <Area type="monotone" dataKey="faturado" name="Faturado" stroke="hsl(270 80% 62%)" fill="url(#gradFaturado)" strokeWidth={2} />
                    <Area type="monotone" dataKey="recebido" name="Recebido" stroke="hsl(155 75% 48%)" fill="url(#gradRecebido)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </LexCard>
          </motion.div>
        )}
      </div>

      {/* Analytics row: Process by status + Movements + Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Processes by status pie */}
        <motion.div {...anim(0.72)}>
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" /> Processos por Status
              </LexCardTitle>
            </LexCardHeader>
            {processStatusData.length === 0 ? (
              <div className="py-8 text-center">
                <Scale className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-caption text-muted-foreground">Sem dados</p>
              </div>
            ) : (
              <div className="h-52" ref={chartRefProcessStatus}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={processStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {processStatusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(228 16% 12%)", border: "1px solid hsl(228 12% 18%)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={28}
                      formatter={(value) => <span className="text-[11px] text-muted-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </LexCard>
        </motion.div>

        {/* Movements by month */}
        <motion.div {...anim(0.74)}>
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle className="flex items-center gap-2">
                <GitCommitHorizontal className="h-4 w-4 text-secondary" /> Movimentações / Mês
              </LexCardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Exportar CSV" onClick={() => downloadCsv(movementsChartData, "movimentacoes-por-mes")}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </LexCardHeader>
            <div className="h-52 -mx-2" ref={chartRefMovements}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={movementsChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 12% 18%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(220 10% 55%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(220 10% 55%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(228 16% 12%)", border: "1px solid hsl(228 12% 18%)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(210 20% 95%)" }}
                  />
                  <Bar dataKey="movimentações" name="Movimentações" fill="hsl(270 80% 62%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </LexCard>
        </motion.div>

        {/* Deadlines status pie */}
        <motion.div {...anim(0.76)}>
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-warning" /> Prazos por Status
              </LexCardTitle>
            </LexCardHeader>
            {deadlineStatusData.length === 0 ? (
              <div className="py-8 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-caption text-muted-foreground">Sem prazos registrados</p>
              </div>
            ) : (
              <>
                <div className="h-44" ref={chartRefDeadlines}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={deadlineStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {deadlineStatusData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(228 16% 12%)", border: "1px solid hsl(228 12% 18%)", borderRadius: 8, fontSize: 12 }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={28}
                        formatter={(value) => <span className="text-[11px] text-muted-foreground">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {overdueDeadlines.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 mt-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-caption text-destructive font-medium">
                      {overdueDeadlines.length} prazo{overdueDeadlines.length > 1 ? "s" : ""} vencido{overdueDeadlines.length > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </>
            )}
          </LexCard>
        </motion.div>
      </div>

      {/* Recent notifications widget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div {...anim(0.73)}>
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Notificações Recentes
              </LexCardTitle>
            </LexCardHeader>
            {recentNotifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-caption text-muted-foreground">Nenhuma notificação recente</p>
              </div>
            ) : (
              <ScrollArea className="max-h-56">
                <div className="space-y-1">
                  {recentNotifications.map((n: any) => {
                    const icon = n.type?.includes("deadline") ? CalendarDays : FileText;
                    const Icon = icon;
                    const timeAgo = (() => {
                      const diffMs = Date.now() - new Date(n.created_at).getTime();
                      const mins = Math.floor(diffMs / 60000);
                      if (mins < 1) return "agora";
                      if (mins < 60) return `${mins}min`;
                      const hrs = Math.floor(mins / 60);
                      if (hrs < 24) return `${hrs}h`;
                      return `${Math.floor(hrs / 24)}d`;
                    })();
                    return (
                      <div key={n.id} className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${!n.read ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted border border-border">
                          <Icon className={`h-3.5 w-3.5 ${n.type?.includes("deadline") ? "text-warning" : "text-primary"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-caption font-medium truncate ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{n.message}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
                        {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </LexCard>
        </motion.div>

        {/* Audit logs widget */}
        {canViewAudit && auditLogs.length > 0 && (
          <motion.div {...anim(0.75)}>
            <LexCard hover={false}>
              <LexCardHeader>
                <LexCardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-secondary" /> Atividades Recentes
                </LexCardTitle>
              </LexCardHeader>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg text-caption hover:bg-muted/30 transition-colors">
                    <CheckCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{auditActionLabels[log.action] || log.action}</span>
                      {log.metadata?.email && <span className="text-muted-foreground"> — {log.metadata.email}</span>}
                      {log.resource_type && <span className="text-muted-foreground"> ({log.resource_type})</span>}
                    </div>
                    <span className="text-muted-foreground shrink-0">
                      {format(new Date(log.created_at), "dd MMM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            </LexCard>
          </motion.div>
        )}
      </div>

      {/* Quick tasks to-do widget */}
      <motion.div {...anim(0.8)}>
        <QuickTasksWidget />
      </motion.div>
    </div>
  );
};

export default Dashboard;
