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
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, CalendarDays, MapPin, Video, Gavel, Search } from "lucide-react";

const HEARING_TYPES = [
  { value: "initial", label: "Inicial" },
  { value: "instruction", label: "Instrução" },
  { value: "conciliation", label: "Conciliação" },
  { value: "judgment", label: "Julgamento" },
  { value: "other", label: "Outro" },
];

const HEARING_STATUSES = [
  { value: "scheduled", label: "Agendada", color: "bg-blue-500/20 text-blue-400" },
  { value: "completed", label: "Realizada", color: "bg-green-500/20 text-green-400" },
  { value: "postponed", label: "Adiada", color: "bg-yellow-500/20 text-yellow-400" },
  { value: "canceled", label: "Cancelada", color: "bg-red-500/20 text-red-400" },
];

const Hearings = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const [form, setForm] = useState({
    process_id: "", hearing_date: "", hearing_time: "", location: "",
    hearing_type: "initial", responsible_id: "", status: "scheduled",
    video_link: "", notes: "",
  });

  const resetForm = () => {
    setForm({ process_id: "", hearing_date: "", hearing_time: "", location: "", hearing_type: "initial", responsible_id: "", status: "scheduled", video_link: "", notes: "" });
    setEditId(null);
  };

  // Fetch processes
  const { data: processes = [] } = useQuery({
    queryKey: ["processes-list", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("processes").select("id, title, number, client_name").eq("organization_id", activeOrgId!).eq("archived", false).order("title");
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  // Fetch org members
  const { data: members = [] } = useQuery({
    queryKey: ["org-members-list", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_organizations" as any).select("user_id, role").eq("organization_id", activeOrgId!);
      if (error) throw error;
      const userIds = (data as any[]).map((m: any) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      return (data as any[]).map((m: any) => ({
        ...m,
        full_name: profiles?.find((p) => p.user_id === m.user_id)?.full_name || m.user_id.slice(0, 8),
      }));
    },
    enabled: !!activeOrgId,
  });

  // Fetch hearings
  const { data: hearings = [], isLoading } = useQuery({
    queryKey: ["hearings", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("hearings" as any).select("*, processes(title, number, client_name)").eq("organization_id", activeOrgId!).order("hearing_date", { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const hearingDatetime = `${values.hearing_date}T${values.hearing_time || "00:00"}:00`;
      const payload = {
        process_id: values.process_id, organization_id: activeOrgId, user_id: user!.id,
        hearing_date: hearingDatetime, location: values.location, hearing_type: values.hearing_type,
        responsible_id: values.responsible_id || null, status: values.status,
        video_link: values.video_link || null, notes: values.notes || null,
      };
      if (editId) {
        const { error } = await supabase.from("hearings" as any).update(payload).eq("id", editId);
        if (error) throw error;
        await supabase.from("audit_logs").insert({ action: "hearing_updated", user_id: user!.id, organization_id: activeOrgId, resource_type: "hearing", resource_id: editId } as any);
      } else {
        const { data, error } = await supabase.from("hearings" as any).insert(payload).select("id").single();
        if (error) throw error;
        await supabase.from("audit_logs").insert({ action: "hearing_created", user_id: user!.id, organization_id: activeOrgId, resource_type: "hearing", resource_id: (data as any).id } as any);
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["hearings"] }); toast.success(editId ? "Audiência atualizada!" : "Audiência criada!"); setOpen(false); resetForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete/Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hearings" as any).update({ status: "canceled" }).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "hearing_canceled", user_id: user!.id, organization_id: activeOrgId, resource_type: "hearing", resource_id: id } as any);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["hearings"] }); toast.success("Audiência cancelada."); },
  });

  const openEdit = (h: any) => {
    const d = new Date(h.hearing_date);
    setForm({ process_id: h.process_id, hearing_date: format(d, "yyyy-MM-dd"), hearing_time: format(d, "HH:mm"), location: h.location, hearing_type: h.hearing_type, responsible_id: h.responsible_id || "", status: h.status, video_link: h.video_link || "", notes: h.notes || "" });
    setEditId(h.id);
    setOpen(true);
  };

  // Filtered hearings
  const filtered = useMemo(() => {
    return hearings.filter((h: any) => {
      if (filterStatus !== "all" && h.status !== filterStatus) return false;
      if (filterType !== "all" && h.hearing_type !== filterType) return false;
      if (search) {
        const s = search.toLowerCase();
        const pTitle = h.processes?.title?.toLowerCase() || "";
        const pNumber = h.processes?.number?.toLowerCase() || "";
        const loc = h.location?.toLowerCase() || "";
        if (!pTitle.includes(s) && !pNumber.includes(s) && !loc.includes(s)) return false;
      }
      return true;
    });
  }, [hearings, filterStatus, filterType, search]);

  const canManage = hasPermission("MANAGE_HEARINGS");

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Gavel className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-primary mb-0.5">Gestão</p>
            <h1 className="text-2xl font-bold text-foreground">Audiências</h1>
          </div>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Nova Audiência</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar Audiência" : "Nova Audiência"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Processo *</Label>
                    <Select value={form.process_id} onValueChange={(v) => setForm({ ...form, process_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar processo" /></SelectTrigger>
                      <SelectContent>
                        {processes.map((p) => <SelectItem key={p.id} value={p.id}>{p.number} — {p.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Data *</Label><Input type="date" value={form.hearing_date} onChange={(e) => setForm({ ...form, hearing_date: e.target.value })} required /></div>
                  <div><Label>Hora *</Label><Input type="time" value={form.hearing_time} onChange={(e) => setForm({ ...form, hearing_time: e.target.value })} required /></div>
                  <div><Label>Local *</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Fórum, sala, ou link virtual" required /></div>
                  <div>
                    <Label>Responsável</Label>
                    <Select value={form.responsible_id} onValueChange={(v) => setForm({ ...form, responsible_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>{members.map((m: any) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={form.hearing_type} onValueChange={(v) => setForm({ ...form, hearing_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{HEARING_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{HEARING_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2"><Label>Link de Videoconferência</Label><Input value={form.video_link} onChange={(e) => setForm({ ...form, video_link: e.target.value })} placeholder="https://..." /></div>
                  <div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
                </div>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending || !form.process_id || !form.hearing_date || !form.location}>
                  {saveMutation.isPending ? "Salvando..." : editId ? "Atualizar" : "Criar Audiência"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <LexCard hover={false}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por processo ou local..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {HEARING_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {HEARING_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </LexCard>

      {/* Hearings list */}
      <div className="grid gap-3">
        {isLoading ? (
          <LexCard hover={false}>
            <p className="text-muted-foreground text-center py-6">Carregando audiências...</p>
          </LexCard>
        ) : filtered.length === 0 ? (
          <LexCard hover={false}>
            <div className="text-center py-10 space-y-2">
              <Gavel className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground">Nenhuma audiência encontrada.</p>
              {canManage && <p className="text-xs text-muted-foreground">Clique em "Nova Audiência" para agendar.</p>}
            </div>
          </LexCard>
        ) : (
          filtered.map((h: any) => {
            const statusInfo = HEARING_STATUSES.find((s) => s.value === h.status);
            const typeInfo = HEARING_TYPES.find((t) => t.value === h.hearing_type);
            const d = new Date(h.hearing_date);
            const responsible = members.find((m: any) => m.user_id === h.responsible_id);

            return (
              <LexCard key={h.id} className="hover:border-primary/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Gavel className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold text-foreground truncate">{h.processes?.title || "Processo"}</span>
                      <Badge variant="outline" className="text-xs shrink-0">{h.processes?.number}</Badge>
                      <Badge className={`text-xs shrink-0 ${statusInfo?.color || ""}`}>{statusInfo?.label || h.status}</Badge>
                      <Badge variant="secondary" className="text-xs shrink-0">{typeInfo?.label || h.hearing_type}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 shrink-0" />{format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" />{h.location}</span>
                      {h.video_link && (
                        <a href={h.video_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <Video className="h-3.5 w-3.5" /> Link virtual
                        </a>
                      )}
                      {responsible && <span className="text-xs">Resp: {responsible.full_name}</span>}
                    </div>
                    {h.notes && <p className="text-xs text-muted-foreground/70 line-clamp-2">{h.notes}</p>}
                  </div>
                  {canManage && h.status !== "canceled" && (
                    <div className="flex gap-2 shrink-0 self-end sm:self-center">
                      <Button size="sm" variant="outline" onClick={() => openEdit(h)}>Editar</Button>
                      <Button size="sm" variant="destructive" onClick={() => cancelMutation.mutate(h.id)}>Cancelar</Button>
                    </div>
                  )}
                </div>
              </LexCard>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Hearings;
