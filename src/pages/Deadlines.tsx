import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarDays, Plus, Clock, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Trash2, Edit, Bell,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const priorityMap: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
const statusMap: Record<string, string> = { pending: "Pendente", completed: "Concluído", overdue: "Vencido" };

const priorityColor: Record<string, string> = {
  low: "default", medium: "warning", high: "destructive", urgent: "destructive",
};

interface DeadlineForm {
  title: string; description: string; due_date: string; due_time: string; priority: string; process_id: string;
}
const emptyForm: DeadlineForm = { title: "", description: "", due_date: "", due_time: "", priority: "medium", process_id: "none" };

const Deadlines = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DeadlineForm>(emptyForm);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data: deadlines = [], isLoading } = useQuery({
    queryKey: ["deadlines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deadlines")
        .select("*, processes(title, number)")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: processes = [] } = useQuery({
    queryKey: ["processes-for-deadlines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("processes").select("id, title, number").eq("archived", false).order("title");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: DeadlineForm) => {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        due_date: formData.due_date,
        due_time: formData.due_time || null,
        priority: formData.priority,
        process_id: formData.process_id === "none" ? null : formData.process_id,
        user_id: user!.id,
        organization_id: activeOrgId,
      } as any;
      if (editingId) {
        const { error } = await supabase.from("deadlines").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deadlines").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      setDialogOpen(false); setEditingId(null); setForm(emptyForm);
      toast.success(editingId ? "Prazo atualizado!" : "Prazo criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "completed" ? "pending" : "completed";
      const { error } = await supabase.from("deadlines").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deadlines"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deadlines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      toast.success("Prazo excluído!");
    },
  });

  const openEdit = (d: any) => {
    setEditingId(d.id);
    setForm({ title: d.title, description: d.description || "", due_date: d.due_date, due_time: d.due_time || "", priority: d.priority, process_id: d.process_id || "none" });
    setDialogOpen(true);
  };

  const openNewForDay = (day: Date) => {
    setEditingId(null);
    setForm({ ...emptyForm, due_date: format(day, "yyyy-MM-dd") });
    setDialogOpen(true);
  };

  // Calendar data
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start to Monday
  const startDow = monthStart.getDay();
  const padStart = startDow === 0 ? 6 : startDow - 1;

  const deadlinesByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    deadlines.forEach((d: any) => {
      const key = d.due_date;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [deadlines]);

  // Upcoming deadlines (next 7 days, pending)
  const today = startOfDay(new Date());
  const upcoming = deadlines.filter((d: any) => {
    const due = new Date(d.due_date);
    return d.status !== "completed" && due >= today;
  }).slice(0, 8);

  const overdue = deadlines.filter((d: any) => {
    const due = new Date(d.due_date);
    return d.status !== "completed" && isBefore(due, today);
  });

  // Day detail deadlines
  const dayDeadlines = selectedDay ? (deadlinesByDate[format(selectedDay, "yyyy-MM-dd")] || []) : [];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-overline text-primary mb-1">Controle</p>
          <h1 className="text-display-lg">Prazos</h1>
          <p className="text-body-sm text-muted-foreground mt-1">Gerencie prazos processuais e receba alertas</p>
        </div>
        <Button variant="hero" onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo Prazo
        </Button>
      </motion.div>

      {/* Alerts */}
      {overdue.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-body-sm font-semibold text-destructive">
                {overdue.length} prazo{overdue.length > 1 ? "s" : ""} vencido{overdue.length > 1 ? "s" : ""}!
              </p>
              <p className="text-caption text-muted-foreground mt-0.5">
                {overdue.map((d: any) => d.title).join(", ")}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Calendário</LexCardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-body-sm font-semibold min-w-[140px] text-center capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </LexCardHeader>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                <div key={d} className="text-center text-overline text-muted-foreground py-2">{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: padStart }).map((_, i) => <div key={`pad-${i}`} className="h-16" />)}
              {calendarDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayD = deadlinesByDate[key] || [];
                const hasOverdue = dayD.some((d: any) => d.status !== "completed" && isBefore(day, today));
                const hasUrgent = dayD.some((d: any) => d.priority === "urgent" || d.priority === "high");
                const isSelected = selectedDay && isSameDay(day, selectedDay);

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(day)}
                    onDoubleClick={() => openNewForDay(day)}
                    className={`h-16 rounded-lg border text-left p-1.5 transition-all text-caption hover:border-primary/40 ${
                      isToday(day) ? "border-primary/50 bg-primary/5" : "border-border/30"
                    } ${isSelected ? "ring-2 ring-primary/50 bg-primary/10" : ""}`}
                  >
                    <span className={`font-semibold ${isToday(day) ? "text-primary" : ""}`}>{format(day, "d")}</span>
                    {dayD.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap">
                        {dayD.slice(0, 3).map((d: any) => (
                          <span
                            key={d.id}
                            className={`h-1.5 w-1.5 rounded-full ${
                              d.status === "completed" ? "bg-success" : hasOverdue ? "bg-destructive" : hasUrgent ? "bg-warning" : "bg-primary"
                            }`}
                          />
                        ))}
                        {dayD.length > 3 && <span className="text-[9px] text-muted-foreground">+{dayD.length - 3}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Day detail */}
            {selectedDay && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-body-sm font-semibold capitalize">{format(selectedDay, "dd 'de' MMMM", { locale: ptBR })}</p>
                  <Button variant="ghost" size="sm" onClick={() => openNewForDay(selectedDay)}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
                </div>
                {dayDeadlines.length === 0 ? (
                  <p className="text-caption text-muted-foreground">Nenhum prazo neste dia.</p>
                ) : (
                  <div className="space-y-2">
                    {dayDeadlines.map((d: any) => (
                      <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
                        <button onClick={() => toggleComplete.mutate({ id: d.id, status: d.status })}>
                          <CheckCircle className={`h-4.5 w-4.5 ${d.status === "completed" ? "text-success" : "text-muted-foreground/40"} transition-colors hover:text-success`} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-body-sm font-medium ${d.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{d.title}</p>
                          {d.processes && <p className="text-caption text-muted-foreground">{d.processes.number}</p>}
                        </div>
                        <LexBadge variant={priorityColor[d.priority] as any}>{priorityMap[d.priority]}</LexBadge>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => deleteMutation.mutate(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </LexCard>
        </motion.div>

        {/* Upcoming sidebar */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <LexCard hover={false} className="h-full">
            <LexCardHeader>
              <LexCardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-warning" /> Próximos</LexCardTitle>
            </LexCardHeader>
            {upcoming.length === 0 ? (
              <div className="py-8 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-caption text-muted-foreground">Nenhum prazo pendente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((d: any) => {
                  const due = new Date(d.due_date);
                  const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={d.id} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-body-sm font-medium">{d.title}</p>
                        <LexBadge variant={priorityColor[d.priority] as any} className="shrink-0">{priorityMap[d.priority]}</LexBadge>
                      </div>
                      {d.processes && <p className="text-caption text-muted-foreground mt-0.5">{d.processes.number}</p>}
                      <p className={`text-caption mt-1 ${daysUntil <= 2 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        {daysUntil === 0 ? "Hoje" : daysUntil === 1 ? "Amanhã" : `Em ${daysUntil} dias`} • {format(due, "dd/MM")}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </LexCard>
        </motion.div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">{editingId ? "Editar Prazo" : "Novo Prazo"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Título</label>
              <Input className="bg-muted border-border rounded-xl" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Data</label>
                <Input type="date" className="bg-muted border-border rounded-xl" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Hora (opcional)</label>
                <Input type="time" className="bg-muted border-border rounded-xl" value={form.due_time} onChange={(e) => setForm({ ...form, due_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Prioridade</label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Processo</label>
                <Select value={form.process_id} onValueChange={(v) => setForm({ ...form, process_id: v })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {processes.map((p) => <SelectItem key={p.id} value={p.id}>{p.number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Descrição</label>
              <Textarea className="bg-muted border-border rounded-xl" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Deadlines;
