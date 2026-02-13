import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { LexCard } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Scale, FileText, CalendarDays, Users, Gavel, Clock, TrendingUp, AlertTriangle, CheckCircle, Target } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"];

const Metrics = () => {
  const { activeOrgId } = useOrganization();
  const { isAdmin } = usePermissions();
  const [period, setPeriod] = useState("6m");

  const startDate = period === "1m" ? subMonths(new Date(), 1) : period === "3m" ? subMonths(new Date(), 3) : period === "6m" ? subMonths(new Date(), 6) : subMonths(new Date(), 12);

  // Fetch all data in parallel
  const { data: processes = [] } = useQuery({
    queryKey: ["metrics-processes", activeOrgId],
    queryFn: async () => { const { data } = await supabase.from("processes").select("id, status, type, created_at, updated_at").eq("archived", false); return data || []; },
    enabled: !!activeOrgId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["metrics-tasks", activeOrgId],
    queryFn: async () => { const { data } = await supabase.from("quick_tasks").select("id, done, status, priority, assigned_to, due_date, created_at, updated_at"); return data || []; },
    enabled: !!activeOrgId,
  });

  const { data: deadlines = [] } = useQuery({
    queryKey: ["metrics-deadlines", activeOrgId],
    queryFn: async () => { const { data } = await supabase.from("deadlines").select("id, status, due_date, priority, created_at"); return data || []; },
    enabled: !!activeOrgId,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["metrics-documents", activeOrgId],
    queryFn: async () => { const { data } = await supabase.from("documents").select("id, created_at, process_id, category"); return data || []; },
    enabled: !!activeOrgId,
  });

  const { data: hearings = [] } = useQuery({
    queryKey: ["metrics-hearings", activeOrgId],
    queryFn: async () => { const { data } = await supabase.from("hearings").select("id, status, hearing_date, hearing_type"); return data || []; },
    enabled: !!activeOrgId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["metrics-teams", activeOrgId],
    queryFn: async () => { const { data } = await (supabase.from("teams" as any) as any).select("id, name"); return (data as any[]) || []; },
    enabled: !!activeOrgId,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["metrics-team-members", activeOrgId],
    queryFn: async () => { const { data } = await (supabase.from("team_members" as any) as any).select("id, team_id, user_id"); return (data as any[]) || []; },
    enabled: !!activeOrgId,
  });

  // Computed metrics
  const activeProcesses = processes.filter(p => p.status === "active").length;
  const processByStatus = Object.entries(processes.reduce((acc: any, p: any) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {})).map(([name, value]) => ({ name: name === "active" ? "Ativo" : name === "pending" ? "Pendente" : name === "closed" ? "Encerrado" : name, value }));
  const processByType = Object.entries(processes.reduce((acc: any, p: any) => { const label = p.type === "civil" ? "Cível" : p.type === "criminal" ? "Criminal" : p.type === "labor" ? "Trabalhista" : p.type === "tax" ? "Tributário" : p.type; acc[label] = (acc[label] || 0) + 1; return acc; }, {})).map(([name, value]) => ({ name, value }));

  const completedTasks = tasks.filter(t => t.done).length;
  const pendingTasks = tasks.filter(t => !t.done).length;
  const overdueTasks = tasks.filter(t => !t.done && t.due_date && new Date(t.due_date) < new Date()).length;

  const pendingDeadlines = deadlines.filter(d => d.status === "pending").length;
  const overdueDeadlines = deadlines.filter(d => d.status === "pending" && new Date(d.due_date) < new Date()).length;
  const completedDeadlines = deadlines.filter(d => d.status === "completed").length;
  const complianceRate = deadlines.length > 0 ? Math.round((completedDeadlines / deadlines.length) * 100) : 0;

  const futureHearings = hearings.filter(h => new Date(h.hearing_date) > new Date()).length;
  const pastHearings = hearings.filter(h => new Date(h.hearing_date) <= new Date()).length;

  // Monthly trend data
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i);
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const label = format(month, "MMM", { locale: ptBR });
    return {
      name: label,
      processos: processes.filter(p => new Date(p.created_at) >= start && new Date(p.created_at) <= end).length,
      tarefas: tasks.filter(t => new Date(t.created_at) >= start && new Date(t.created_at) <= end).length,
      documentos: documents.filter(d => new Date(d.created_at) >= start && new Date(d.created_at) <= end).length,
    };
  });

  // Task productivity by assignee
  const tasksByUser = Object.entries(tasks.filter(t => t.assigned_to && t.done).reduce((acc: any, t: any) => { acc[t.assigned_to] = (acc[t.assigned_to] || 0) + 1; return acc; }, {}))
    .map(([user_id, count]) => ({ user_id, count: count as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const KPICard = ({ icon: Icon, label, value, sub, color = "primary" }: any) => (
    <LexCard>
      <div className="p-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${color}/10`}>
          <Icon className={`h-5 w-5 text-${color}`} />
        </div>
        <div>
          <p className="text-overline text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </LexCard>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-overline text-primary mb-0.5">Análise</p>
              <h1 className="text-display-lg">Produtividade & Métricas</h1>
            </div>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">1 mês</SelectItem>
              <SelectItem value="3m">3 meses</SelectItem>
              <SelectItem value="6m">6 meses</SelectItem>
              <SelectItem value="12m">12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPICard icon={Scale} label="Processos Ativos" value={activeProcesses} />
        <KPICard icon={CheckCircle} label="Tarefas Concluídas" value={completedTasks} sub={`${pendingTasks} pendentes`} />
        <KPICard icon={AlertTriangle} label="Tarefas Atrasadas" value={overdueTasks} color="destructive" />
        <KPICard icon={CalendarDays} label="Prazos Pendentes" value={pendingDeadlines} sub={`${overdueDeadlines} vencidos`} />
        <KPICard icon={Target} label="Taxa Cumprimento" value={`${complianceRate}%`} />
        <KPICard icon={Gavel} label="Audiências Futuras" value={futureHearings} sub={`${pastHearings} realizadas`} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="processes">Processos</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
          <TabsTrigger value="teams">Times</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Trend chart */}
          <LexCard>
            <div className="p-5">
              <h3 className="font-semibold mb-4">Evolução Mensal</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Line type="monotone" dataKey="processos" stroke="hsl(var(--primary))" strokeWidth={2} name="Processos" />
                  <Line type="monotone" dataKey="tarefas" stroke="hsl(var(--secondary))" strokeWidth={2} name="Tarefas" />
                  <Line type="monotone" dataKey="documentos" stroke="#f59e0b" strokeWidth={2} name="Documentos" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </LexCard>

          {/* Documents stats */}
          <div className="grid md:grid-cols-2 gap-4">
            <LexCard>
              <div className="p-5">
                <h3 className="font-semibold mb-4">Documentos por Período</h3>
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{documents.length}</p>
                    <p className="text-sm text-muted-foreground">documentos totais</p>
                  </div>
                </div>
              </div>
            </LexCard>
            <LexCard>
              <div className="p-5">
                <h3 className="font-semibold mb-4">Audiências</h3>
                <div className="flex items-center gap-3">
                  <Gavel className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{hearings.length}</p>
                    <p className="text-sm text-muted-foreground">{futureHearings} futuras / {pastHearings} realizadas</p>
                  </div>
                </div>
              </div>
            </LexCard>
          </div>
        </TabsContent>

        <TabsContent value="processes" className="space-y-6 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <LexCard>
              <div className="p-5">
                <h3 className="font-semibold mb-4">Processos por Status</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={processByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {processByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </LexCard>
            <LexCard>
              <div className="p-5">
                <h3 className="font-semibold mb-4">Processos por Área</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={processByType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Processos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </LexCard>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6 mt-4">
          <div className="grid md:grid-cols-3 gap-4">
            <KPICard icon={CheckCircle} label="Concluídas" value={completedTasks} />
            <KPICard icon={Clock} label="Pendentes" value={pendingTasks} />
            <KPICard icon={AlertTriangle} label="Atrasadas" value={overdueTasks} color="destructive" />
          </div>
          {tasksByUser.length > 0 && (
            <LexCard>
              <div className="p-5">
                <h3 className="font-semibold mb-4">Produtividade por Usuário (Tarefas Concluídas)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={tasksByUser} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis dataKey="user_id" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} width={80} tickFormatter={v => v.slice(0, 8)} />
                    <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} name="Concluídas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </LexCard>
          )}
        </TabsContent>

        <TabsContent value="teams" className="space-y-6 mt-4">
          {teams.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum time cadastrado. Crie times em Times & Departamentos.</p>
          ) : (
            <div className="grid gap-4">
              {teams.map((t: any) => {
                const members = teamMembers.filter((m: any) => m.team_id === t.id);
                const memberUserIds = members.map((m: any) => m.user_id);
                const memberTasks = tasks.filter((task: any) => memberUserIds.includes(task.assigned_to));
                const memberDone = memberTasks.filter((task: any) => task.done).length;
                const memberPending = memberTasks.filter((task: any) => !task.done).length;
                return (
                  <LexCard key={t.id}>
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{t.name}</h3>
                        <LexBadge variant="outline">{members.length} membros</LexBadge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div><p className="text-2xl font-bold">{memberTasks.length}</p><p className="text-xs text-muted-foreground">Tarefas Totais</p></div>
                        <div><p className="text-2xl font-bold text-success">{memberDone}</p><p className="text-xs text-muted-foreground">Concluídas</p></div>
                        <div><p className="text-2xl font-bold text-warning">{memberPending}</p><p className="text-xs text-muted-foreground">Pendentes</p></div>
                      </div>
                    </div>
                  </LexCard>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Metrics;
