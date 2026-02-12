import { useState, useMemo } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, Plus, Play, Square, Pencil, Trash2, Timer, DollarSign, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

const Timesheet = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission, isAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [form, setForm] = useState({
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
    start_time: "",
    end_time: "",
    duration_minutes: "",
    hourly_rate: "",
    process_id: "none",
    client_id: "none",
    billable: true,
  });
  const [periodFilter, setPeriodFilter] = useState<"week" | "month" | "all">("week");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["time-entries", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries" as any)
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ["processes-timesheet", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processes")
        .select("id, title, number")
        .eq("organization_id", activeOrgId!)
        .eq("archived", false)
        .order("title");
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-timesheet", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("organization_id", activeOrgId!)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const filteredEntries = useMemo(() => {
    const now = new Date();
    return entries.filter((e: any) => {
      const d = new Date(e.date);
      if (periodFilter === "week") {
        return d >= startOfWeek(now, { locale: ptBR }) && d <= endOfWeek(now, { locale: ptBR });
      }
      if (periodFilter === "month") {
        return d >= startOfMonth(now) && d <= endOfMonth(now);
      }
      return true;
    });
  }, [entries, periodFilter]);

  const stats = useMemo(() => {
    const totalMinutes = filteredEntries.reduce((s: number, e: any) => s + (e.duration_minutes || 0), 0);
    const billableMinutes = filteredEntries.filter((e: any) => e.billable).reduce((s: number, e: any) => s + (e.duration_minutes || 0), 0);
    const totalValue = filteredEntries
      .filter((e: any) => e.billable)
      .reduce((s: number, e: any) => s + ((e.duration_minutes || 0) / 60) * ((e.hourly_rate_cents || 0) / 100), 0);
    return { totalMinutes, billableMinutes, totalValue, entries: filteredEntries.length };
  }, [filteredEntries]);

  const hoursByDay = useMemo(() => {
    const map = new Map<string, number>();
    filteredEntries.forEach((e: any) => {
      const day = format(new Date(e.date), "EEE dd", { locale: ptBR });
      map.set(day, (map.get(day) || 0) + (e.duration_minutes || 0) / 60);
    });
    return Array.from(map.entries()).map(([name, horas]) => ({ name, horas: parseFloat(horas.toFixed(1)) }));
  }, [filteredEntries]);

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${m > 0 ? ` ${m}min` : ""}`;
  };

  const resetForm = () => {
    setForm({
      description: "", date: format(new Date(), "yyyy-MM-dd"),
      start_time: "", end_time: "", duration_minutes: "",
      hourly_rate: "", process_id: "none", client_id: "none", billable: true,
    });
    setEditingId(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const durationMins = form.duration_minutes ? parseInt(form.duration_minutes) : 0;
      const rateCents = form.hourly_rate ? Math.round(parseFloat(form.hourly_rate.replace(",", ".")) * 100) : 0;
      const payload: any = {
        organization_id: activeOrgId,
        user_id: user!.id,
        description: form.description,
        date: form.date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        duration_minutes: durationMins,
        hourly_rate_cents: rateCents,
        process_id: form.process_id === "none" ? null : form.process_id,
        client_id: form.client_id === "none" ? null : form.client_id,
        billable: form.billable,
        status: "draft",
      };

      if (editingId) {
        const { error } = await supabase.from("time_entries" as any).update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("time_entries" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editingId ? "Registro atualizado!" : "Hora registrada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_entries" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Registro excluído!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (entry: any) => {
    setForm({
      description: entry.description || "",
      date: entry.date,
      start_time: entry.start_time || "",
      end_time: entry.end_time || "",
      duration_minutes: String(entry.duration_minutes || 0),
      hourly_rate: entry.hourly_rate_cents ? (entry.hourly_rate_cents / 100).toFixed(2).replace(".", ",") : "",
      process_id: entry.process_id || "none",
      client_id: entry.client_id || "none",
      billable: entry.billable,
    });
    setEditingId(entry.id);
    setDialogOpen(true);
  };

  const toggleTimer = () => {
    if (timerRunning && timerStart) {
      const elapsed = Math.round((Date.now() - timerStart.getTime()) / 60000);
      setForm(f => ({
        ...f,
        duration_minutes: String(elapsed),
        start_time: format(timerStart, "HH:mm"),
        end_time: format(new Date(), "HH:mm"),
      }));
      setTimerRunning(false);
      setTimerStart(null);
      setDialogOpen(true);
    } else {
      setTimerStart(new Date());
      setTimerRunning(true);
      toast.info("Cronômetro iniciado!");
    }
  };

  return (
    <div className="container mx-auto max-w-6xl py-6 px-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-display font-bold flex items-center gap-3">
            <Clock className="h-7 w-7 text-primary" /> Controle de Horas
          </h1>
          <p className="text-body-sm text-muted-foreground mt-1">Registre e gerencie horas trabalhadas por processo e cliente</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={timerRunning ? "destructive" : "outline"}
            onClick={toggleTimer}
            className="gap-2"
          >
            {timerRunning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {timerRunning ? "Parar" : "Cronômetro"}
          </Button>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Registrar Horas
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Horas", value: formatDuration(stats.totalMinutes), icon: Timer, color: "text-primary" },
          { label: "Horas Faturáveis", value: formatDuration(stats.billableMinutes), icon: DollarSign, color: "text-success" },
          { label: "Valor Estimado", value: `R$ ${stats.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-warning" },
          { label: "Registros", value: String(stats.entries), icon: Calendar, color: "text-secondary" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <LexCard hover={false}>
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 bg-muted/50 ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-overline text-muted-foreground">{s.label}</p>
                  <p className="text-display-sm font-bold">{s.value}</p>
                </div>
              </div>
            </LexCard>
          </motion.div>
        ))}
      </div>

      {/* Chart + Filter */}
      <div className="flex items-center gap-3 justify-end">
        <Select value={periodFilter} onValueChange={(v: any) => setPeriodFilter(v)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hoursByDay.length > 0 && (
        <LexCard hover={false}>
          <LexCardHeader>
            <LexCardTitle className="flex items-center gap-2"><Timer className="h-4 w-4 text-primary" /> Horas por Dia</LexCardTitle>
          </LexCardHeader>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hoursByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(228, 12%, 18%)" />
                <XAxis dataKey="name" tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} tickFormatter={(v) => `${v}h`} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "hsl(228, 16%, 12%)", border: "1px solid hsl(228, 12%, 18%)", borderRadius: 8, color: "hsl(210, 20%, 95%)" }}
                  formatter={(value: number) => [`${value}h`, "Horas"]}
                />
                <Bar dataKey="horas" fill="hsl(192, 95%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </LexCard>
      )}

      {/* Entries Table */}
      <LexCard hover={false}>
        <LexCardHeader>
          <LexCardTitle>Registros de Horas</LexCardTitle>
        </LexCardHeader>
        {filteredEntries.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-body-sm text-muted-foreground">Nenhum registro encontrado no período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="pb-3 font-medium">Data</th>
                  <th className="pb-3 font-medium">Descrição</th>
                  <th className="pb-3 font-medium">Processo</th>
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Duração</th>
                  <th className="pb-3 font-medium">Valor/h</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((e: any) => {
                  const proc = processes.find(p => p.id === e.process_id);
                  const client = clients.find(c => c.id === e.client_id);
                  const hourlyRate = (e.hourly_rate_cents || 0) / 100;
                  const totalValue = (e.duration_minutes / 60) * hourlyRate;
                  return (
                    <tr key={e.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3">{format(new Date(e.date), "dd/MM/yyyy")}</td>
                      <td className="py-3 max-w-[200px] truncate">{e.description || "—"}</td>
                      <td className="py-3 text-muted-foreground">{proc ? `${proc.number}` : "—"}</td>
                      <td className="py-3 text-muted-foreground">{client?.full_name || "—"}</td>
                      <td className="py-3 font-mono">{formatDuration(e.duration_minutes)}</td>
                      <td className="py-3 font-mono text-muted-foreground">
                        {hourlyRate > 0 ? `R$ ${hourlyRate.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-3 font-mono text-primary">
                        {e.billable && hourlyRate > 0 ? `R$ ${totalValue.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-3">
                        <LexBadge variant={e.billable ? "success" : "outline"}>
                          {e.billable ? "Faturável" : "Interno"}
                        </LexBadge>
                      </td>
                      <td className="py-3 flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </LexCard>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); setDialogOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Registro" : "Registrar Horas"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-body-sm font-medium mb-1 block">Descrição</label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="O que você trabalhou..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-sm font-medium mb-1 block">Data</label>
                <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-body-sm font-medium mb-1 block">Duração (min)</label>
                <Input type="number" value={form.duration_minutes} onChange={(e) => setForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="60" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-sm font-medium mb-1 block">Início</label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div>
                <label className="text-body-sm font-medium mb-1 block">Fim</label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-sm font-medium mb-1 block">Processo</label>
                <Select value={form.process_id} onValueChange={(v) => setForm(f => ({ ...f, process_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {processes.map(p => <SelectItem key={p.id} value={p.id}>{p.number} — {p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-body-sm font-medium mb-1 block">Cliente</label>
                <Select value={form.client_id} onValueChange={(v) => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-sm font-medium mb-1 block">Valor/hora (R$)</label>
                <Input value={form.hourly_rate} onChange={(e) => setForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="150,00" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.billable} onChange={(e) => setForm(f => ({ ...f, billable: e.target.checked }))} className="rounded" />
                  <span className="text-body-sm">Hora faturável</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {editingId ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Timesheet;
