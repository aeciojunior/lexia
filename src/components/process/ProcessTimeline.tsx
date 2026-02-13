import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Plus, Gavel, Scale, Bell, Calendar, FileText, ArrowUpDown,
  ChevronDown, ChevronUp, Trash2, Edit, Milestone, AlertTriangle, ArrowUpRight
} from "lucide-react";

const EVENT_TYPES = [
  { value: "distribuicao", label: "Distribuição", icon: Scale, color: "text-muted-foreground", bg: "bg-muted", border: "border-muted-foreground/30" },
  { value: "citacao", label: "Citação", icon: Bell, color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
  { value: "audiencia", label: "Audiência", icon: Calendar, color: "text-info", bg: "bg-info/10", border: "border-info/30" },
  { value: "decisao", label: "Decisão", icon: Gavel, color: "text-secondary", bg: "bg-secondary/10", border: "border-secondary/30" },
  { value: "recurso", label: "Recurso", icon: ArrowUpRight, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
  { value: "outro", label: "Outro", icon: Milestone, color: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
] as const;

const eventTypeMap = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t]));

// Detail field configs per event type
const DETAIL_FIELDS: Record<string, { key: string; label: string; type: "text" | "select"; options?: string[] }[]> = {
  distribuicao: [
    { key: "foro", label: "Foro", type: "text" },
    { key: "vara", label: "Vara", type: "text" },
    { key: "classe", label: "Classe", type: "text" },
  ],
  citacao: [
    { key: "parte_citada", label: "Parte Citada", type: "text" },
    { key: "tipo_citacao", label: "Tipo de Citação", type: "select", options: ["Postal", "Oficial de Justiça", "Eletrônica", "Edital"] },
    { key: "resultado", label: "Resultado", type: "select", options: ["Cumprida", "Negativa", "Pendente"] },
  ],
  audiencia: [
    { key: "tipo_audiencia", label: "Tipo de Audiência", type: "select", options: ["Conciliação", "Instrução", "Julgamento", "Inicial", "Outra"] },
    { key: "status", label: "Status", type: "select", options: ["Agendada", "Realizada", "Redesignada", "Cancelada"] },
    { key: "resultado", label: "Resultado", type: "text" },
  ],
  decisao: [
    { key: "tipo_decisao", label: "Tipo de Decisão", type: "select", options: ["Despacho", "Decisão Interlocutória", "Sentença", "Acórdão"] },
    { key: "resumo", label: "Resumo", type: "text" },
  ],
  recurso: [
    { key: "tipo_recurso", label: "Tipo de Recurso", type: "select", options: ["Agravo de Instrumento", "Apelação", "Embargos de Declaração", "Recurso Especial", "Recurso Extraordinário", "Outro"] },
    { key: "orgao_julgador", label: "Órgão Julgador", type: "text" },
    { key: "resultado", label: "Resultado", type: "text" },
  ],
};

interface ProcessTimelineProps {
  processId: string;
}

const ProcessTimeline = ({ processId }: ProcessTimelineProps) => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState("all");
  const [ascending, setAscending] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [eventType, setEventType] = useState("outro");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});

  const resetForm = () => {
    setEventType("outro");
    setEventDate("");
    setEventTime("");
    setTitle("");
    setDescription("");
    setDetails({});
    setEditingId(null);
  };

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["process-events", processId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_events" as any)
        .select("*")
        .eq("process_id", processId)
        .order("event_date", { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!processId,
  });

  const filtered = useMemo(() => {
    let list = filter === "all" ? events : events.filter((e: any) => e.event_type === filter);
    if (!ascending) list = [...list].reverse();
    return list;
  }, [events, filter, ascending]);

  // Group by year-month
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const ev of filtered) {
      const d = new Date(ev.event_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    }
    return groups;
  }, [filtered]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !eventDate) throw new Error("Preencha título e data.");
      const dateStr = eventTime ? `${eventDate}T${eventTime}:00` : `${eventDate}T00:00:00`;
      const payload = {
        process_id: processId,
        organization_id: activeOrgId,
        event_type: eventType,
        event_date: dateStr,
        title: title.trim(),
        description: description.trim() || null,
        origin: "manual",
        details,
        created_by: user?.id,
      };
      if (editingId) {
        const { error } = await supabase.from("process_events" as any).update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("process_events" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-events", processId] });
      setDialogOpen(false);
      resetForm();
      toast.success(editingId ? "Evento atualizado com sucesso." : "Evento cadastrado com sucesso.");
    },
    onError: (e: any) => toast.error(e.message || "Não foi possível salvar o evento."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("process_events" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-events", processId] });
      toast.success("Evento excluído com sucesso.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (ev: any) => {
    setEditingId(ev.id);
    setEventType(ev.event_type);
    const d = new Date(ev.event_date);
    setEventDate(d.toISOString().split("T")[0]);
    const h = d.getHours();
    const m = d.getMinutes();
    setEventTime(h || m ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` : "");
    setTitle(ev.title);
    setDescription(ev.description || "");
    setDetails(ev.details || {});
    setDialogOpen(true);
  };

  const isCritical = (type: string) => ["decisao", "audiencia", "recurso"].includes(type);

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  return (
    <div className="border-t border-border pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Milestone className="h-4 w-4 text-primary" />
          <span className="text-overline text-muted-foreground">Linha do Tempo</span>
        </div>
        <div className="flex items-center gap-1.5">
          {events.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {events.length} evento{events.length !== 1 ? "s" : ""}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Ordenar" onClick={() => setAscending(!ascending)}>
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Novo evento" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          className="h-6 text-[10px] px-2 rounded-full"
          onClick={() => setFilter("all")}
        >
          Todos
        </Button>
        {EVENT_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.value}
              variant={filter === t.value ? "default" : "outline"}
              size="sm"
              className="h-6 text-[10px] px-2 rounded-full gap-1"
              onClick={() => setFilter(t.value)}
            >
              <Icon className="h-3 w-3" />
              {t.label}
            </Button>
          );
        })}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <p className="text-caption text-muted-foreground text-center py-4">Carregando linha do tempo...</p>
      ) : events.length === 0 ? (
        <div className="text-center py-6">
          <Milestone className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-caption text-muted-foreground mb-2">Nenhum evento registrado.</p>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar evento
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-caption text-muted-foreground text-center py-4">Nenhum evento encontrado com o filtro selecionado.</p>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="relative pl-6 space-y-1">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

            {Object.entries(grouped).map(([monthKey, monthEvents]) => (
              <div key={monthKey}>
                {/* Month label */}
                <div className="relative flex items-center gap-2 mb-2 mt-3 first:mt-0">
                  <div className="absolute left-[-13px] h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                  <span className="text-overline text-primary font-bold">{formatMonthLabel(monthKey)}</span>
                </div>

                {monthEvents.map((ev: any, i: number) => {
                  const typeConfig = eventTypeMap[ev.event_type] || eventTypeMap.outro;
                  const Icon = typeConfig.icon;
                  const critical = isCritical(ev.event_type);
                  const expanded = expandedId === ev.id;
                  const evDate = new Date(ev.event_date);
                  const hasDetails = ev.details && Object.keys(ev.details).filter((k: string) => ev.details[k]).length > 0;

                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="relative mb-2"
                    >
                      {/* Node dot */}
                      <div className={`absolute left-[-17px] top-2.5 h-3 w-3 rounded-full border-2 ${critical ? `${typeConfig.bg} ${typeConfig.border}` : "bg-muted border-border"}`} />

                      {/* Card */}
                      <div
                        className={`rounded-lg border p-2.5 cursor-pointer transition-all hover:bg-muted/30 ${critical ? `${typeConfig.border} ${typeConfig.bg}` : "border-border bg-card/50"}`}
                        onClick={() => setExpandedId(expanded ? null : ev.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-md ${typeConfig.bg}`}>
                            <Icon className={`h-3.5 w-3.5 ${typeConfig.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-caption font-semibold text-foreground truncate">{ev.title}</span>
                              {critical && <AlertTriangle className="h-3 w-3 text-warning shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                {evDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                                {evDate.getHours() || evDate.getMinutes() ? ` às ${evDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                              </span>
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${typeConfig.color}`}>
                                {typeConfig.label}
                              </Badge>
                              {ev.origin === "importacao" && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-primary">Importado</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                          </div>
                        </div>

                        {/* Expanded details */}
                        {expanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mt-2.5 pt-2.5 border-t border-border/50 space-y-2"
                          >
                            {ev.description && (
                              <p className="text-caption text-muted-foreground">{ev.description}</p>
                            )}
                            {hasDetails && (
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                {Object.entries(ev.details as Record<string, string>).filter(([, v]) => v).map(([k, v]) => (
                                  <div key={k}>
                                    <span className="text-[10px] text-muted-foreground uppercase">{k.replace(/_/g, " ")}</span>
                                    <p className="text-caption text-foreground">{v}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 pt-1">
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={(e) => { e.stopPropagation(); openEdit(ev); }}>
                                <Edit className="h-3 w-3" /> Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] gap-1 px-2 text-destructive hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); if (confirm("Excluir este evento?")) deleteMutation.mutate(ev.id); }}
                              >
                                <Trash2 className="h-3 w-3" /> Excluir
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-display-sm">{editingId ? "Editar Evento" : "Novo Evento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Type */}
            <div>
              <label className="text-overline text-muted-foreground block mb-1">Tipo de Evento *</label>
              <Select value={eventType} onValueChange={(v) => { setEventType(v); setDetails({}); }}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <t.icon className={`h-3.5 w-3.5 ${t.color}`} />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Data *</label>
                <Input type="date" className="bg-muted border-border rounded-xl" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Hora</label>
                <Input type="time" className="bg-muted border-border rounded-xl" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-overline text-muted-foreground block mb-1">Título *</label>
              <Input className="bg-muted border-border rounded-xl" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Audiência de conciliação" />
            </div>

            {/* Description */}
            <div>
              <label className="text-overline text-muted-foreground block mb-1">Descrição</label>
              <Textarea className="bg-muted border-border rounded-xl" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Descrição opcional..." />
            </div>

            {/* Type-specific fields */}
            {DETAIL_FIELDS[eventType] && (
              <div className="border-t border-border pt-3 space-y-3">
                <span className="text-overline text-muted-foreground">Campos específicos</span>
                {DETAIL_FIELDS[eventType].map((field) => (
                  <div key={field.key}>
                    <label className="text-overline text-muted-foreground block mb-1">{field.label}</label>
                    {field.type === "select" ? (
                      <Select value={details[field.key] || ""} onValueChange={(v) => setDetails({ ...details, [field.key]: v })}>
                        <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>
                          {field.options!.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input className="bg-muted border-border rounded-xl" value={details[field.key] || ""} onChange={(e) => setDetails({ ...details, [field.key]: e.target.value })} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!title.trim() || !eventDate || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProcessTimeline;
