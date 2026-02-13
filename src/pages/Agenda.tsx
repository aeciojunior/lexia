import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LexCard } from "@/components/lexia/LexCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Calendar, ChevronLeft, ChevronRight, MapPin, Clock, Video, Users, Search } from "lucide-react";
import { motion } from "framer-motion";

const EVENT_TYPES = [
  { value: "hearing", label: "Audiência" },
  { value: "meeting", label: "Reunião Interna" },
  { value: "client_meeting", label: "Reunião com Cliente" },
  { value: "deadline", label: "Prazo" },
  { value: "admin", label: "Administrativo" },
  { value: "automation", label: "Automação" },
  { value: "other", label: "Outro" },
];

const EVENT_STATUSES = [
  { value: "scheduled", label: "Agendado", color: "bg-blue-500/20 text-blue-400" },
  { value: "confirmed", label: "Confirmado", color: "bg-green-500/20 text-green-400" },
  { value: "canceled", label: "Cancelado", color: "bg-red-500/20 text-red-400" },
  { value: "completed", label: "Concluído", color: "bg-muted text-muted-foreground" },
];

const PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const Agenda = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [view, setView] = useState<"calendar" | "list">("calendar");

  const [form, setForm] = useState({
    title: "", description: "", event_type: "meeting", start_date: "", start_time: "",
    end_date: "", end_time: "", all_day: false, location: "", video_link: "",
    priority: "medium", status: "scheduled", process_id: "", client_id: "",
  });

  const resetForm = () => {
    setForm({ title: "", description: "", event_type: "meeting", start_date: "", start_time: "", end_date: "", end_time: "", all_day: false, location: "", video_link: "", priority: "medium", status: "scheduled", process_id: "", client_id: "" });
    setEditId(null);
  };

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["agenda-events", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_events" as any)
        .select("*, processes(title, number), clients(full_name)")
        .eq("organization_id", activeOrgId!)
        .order("start_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ["processes-select", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("processes").select("id, title, number").eq("organization_id", activeOrgId!).eq("archived", false).order("title");
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-select", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name").eq("organization_id", activeOrgId!).eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const startAt = values.all_day ? `${values.start_date}T00:00:00` : `${values.start_date}T${values.start_time || "00:00"}:00`;
      const endAt = values.end_date ? (values.all_day ? `${values.end_date}T23:59:59` : `${values.end_date}T${values.end_time || "23:59"}:00`) : null;

      const payload: any = {
        organization_id: activeOrgId, user_id: user!.id, title: values.title,
        description: values.description || null, event_type: values.event_type,
        start_at: startAt, end_at: endAt, all_day: values.all_day,
        location: values.location || null, video_link: values.video_link || null,
        priority: values.priority, status: values.status,
        process_id: values.process_id || null, client_id: values.client_id || null,
      };

      if (editId) {
        const { error } = await supabase.from("agenda_events" as any).update(payload).eq("id", editId);
        if (error) throw error;
        await supabase.from("audit_logs").insert({ action: "event_updated", user_id: user!.id, organization_id: activeOrgId, resource_type: "agenda_event", resource_id: editId } as any);
      } else {
        const { data, error } = await supabase.from("agenda_events" as any).insert(payload).select("id").single();
        if (error) throw error;
        await supabase.from("audit_logs").insert({ action: "event_created", user_id: user!.id, organization_id: activeOrgId, resource_type: "agenda_event", resource_id: (data as any).id } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-events"] });
      toast.success(editId ? "Evento atualizado!" : "Evento criado!");
      setOpen(false); resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_events" as any).update({ status: "canceled" }).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "event_canceled", user_id: user!.id, organization_id: activeOrgId, resource_type: "agenda_event", resource_id: id } as any);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agenda-events"] }); toast.success("Evento cancelado."); },
  });

  const openEdit = (e: any) => {
    const s = new Date(e.start_at);
    const end = e.end_at ? new Date(e.end_at) : null;
    setForm({
      title: e.title, description: e.description || "", event_type: e.event_type,
      start_date: format(s, "yyyy-MM-dd"), start_time: format(s, "HH:mm"),
      end_date: end ? format(end, "yyyy-MM-dd") : "", end_time: end ? format(end, "HH:mm") : "",
      all_day: e.all_day, location: e.location || "", video_link: e.video_link || "",
      priority: e.priority, status: e.status, process_id: e.process_id || "", client_id: e.client_id || "",
    });
    setEditId(e.id); setOpen(true);
  };

  const filtered = useMemo(() => {
    return events.filter((e: any) => {
      if (filterType !== "all" && e.event_type !== filterType) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!e.title?.toLowerCase().includes(s) && !e.location?.toLowerCase().includes(s)) return false;
      }
      if (selectedDate && !isSameDay(new Date(e.start_at), selectedDate)) return false;
      return true;
    });
  }, [events, filterType, search, selectedDate]);

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = monthStart.getDay();
  const paddingDays = Array.from({ length: startDow }, (_, i) => i);

  const getEventsForDay = (day: Date) => events.filter((e: any) => isSameDay(new Date(e.start_at), day));

  const canManage = hasPermission("MANAGE_AGENDA");

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-primary mb-0.5">Organização</p>
              <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={view === "calendar" ? "default" : "outline"} size="sm" onClick={() => { setView("calendar"); setSelectedDate(null); }}>Calendário</Button>
            <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>Lista</Button>
            {canManage && (
              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Evento</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editId ? "Editar Evento" : "Novo Evento"}</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
                    <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Tipo</Label>
                        <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Prioridade</Label>
                        <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Data Início *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required /></div>
                      <div><Label>Hora Início</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Data Término</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                      <div><Label>Hora Término</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                    </div>
                    <div><Label>Local</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Escritório, Fórum..." /></div>
                    <div><Label>Link Virtual</Label><Input value={form.video_link} onChange={(e) => setForm({ ...form, video_link: e.target.value })} placeholder="https://..." /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Processo</Label>
                        <Select value={form.process_id} onValueChange={(v) => setForm({ ...form, process_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                          <SelectContent>{processes.map((p) => <SelectItem key={p.id} value={p.id}>{p.number} — {p.title}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Cliente</Label>
                        <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                          <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                    <Button type="submit" className="w-full" disabled={saveMutation.isPending || !form.title || !form.start_date}>
                      {saveMutation.isPending ? "Salvando..." : editId ? "Atualizar" : "Criar Evento"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </motion.div>

      {view === "calendar" ? (
        <>
          {/* Calendar View */}
          <LexCard hover={false}>
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <h3 className="font-semibold text-lg capitalize">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</h3>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-7 gap-px">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
              {paddingDays.map((i) => <div key={`pad-${i}`} className="h-20" />)}
              {days.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(isSelected ? null : day)}
                    className={`h-20 p-1 border border-border/50 rounded-lg cursor-pointer transition-colors hover:bg-accent/30 ${isToday ? "bg-primary/5 border-primary/30" : ""} ${isSelected ? "bg-primary/10 border-primary/50 ring-1 ring-primary/30" : ""}`}
                  >
                    <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</span>
                    <div className="space-y-0.5 mt-0.5">
                      {dayEvents.slice(0, 2).map((e: any) => (
                        <div key={e.id} className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary truncate">{e.title}</div>
                      ))}
                      {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 2}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </LexCard>

          {/* Selected day events */}
          {selectedDate && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">
                Eventos em {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
              </h3>
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento neste dia.</p>
              ) : (
                filtered.map((e: any) => <EventCard key={e.id} event={e} canManage={canManage} onEdit={openEdit} onCancel={(id) => cancelMutation.mutate(id)} />)
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* List View */}
          <LexCard hover={false}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar eventos..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </LexCard>
          <div className="grid gap-3">
            {isLoading ? (
              <LexCard hover={false}><p className="text-center text-muted-foreground py-6">Carregando...</p></LexCard>
            ) : filtered.length === 0 ? (
              <LexCard hover={false}>
                <div className="text-center py-10 space-y-2">
                  <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-muted-foreground">Nenhum evento encontrado.</p>
                </div>
              </LexCard>
            ) : (
              filtered.map((e: any) => <EventCard key={e.id} event={e} canManage={canManage} onEdit={openEdit} onCancel={(id) => cancelMutation.mutate(id)} />)
            )}
          </div>
        </>
      )}
    </div>
  );
};

const EventCard = ({ event: e, canManage, onEdit, onCancel }: { event: any; canManage: boolean; onEdit: (e: any) => void; onCancel: (id: string) => void }) => {
  const statusInfo = EVENT_STATUSES.find((s) => s.value === e.status);
  const typeInfo = EVENT_TYPES.find((t) => t.value === e.event_type);
  const d = new Date(e.start_at);

  return (
    <LexCard className="hover:border-primary/30 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground truncate">{e.title}</span>
            <Badge className={`text-xs shrink-0 ${statusInfo?.color || ""}`}>{statusInfo?.label || e.status}</Badge>
            <Badge variant="secondary" className="text-xs shrink-0">{typeInfo?.label || e.event_type}</Badge>
            {e.priority === "high" || e.priority === "urgent" ? <Badge variant="destructive" className="text-xs">{e.priority === "urgent" ? "Urgente" : "Alta"}</Badge> : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 shrink-0" />{format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            {e.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" />{e.location}</span>}
            {e.video_link && (
              <a href={e.video_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                <Video className="h-3.5 w-3.5" /> Link virtual
              </a>
            )}
            {e.processes && <span className="text-xs">Proc: {(e.processes as any).number}</span>}
            {e.clients && <span className="text-xs flex items-center gap-1"><Users className="h-3 w-3" />{(e.clients as any).full_name}</span>}
          </div>
          {e.description && <p className="text-xs text-muted-foreground/70 line-clamp-2">{e.description}</p>}
        </div>
        {canManage && e.status !== "canceled" && (
          <div className="flex gap-2 shrink-0 self-end sm:self-center">
            <Button size="sm" variant="outline" onClick={() => onEdit(e)}>Editar</Button>
            <Button size="sm" variant="destructive" onClick={() => onCancel(e.id)}>Cancelar</Button>
          </div>
        )}
      </div>
    </LexCard>
  );
};

export default Agenda;
