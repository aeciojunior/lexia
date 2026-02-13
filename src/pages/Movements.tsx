import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LexCard } from "@/components/lexia/LexCard";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Search, FileText, ArrowUpDown, Edit, Trash2, GitCommitHorizontal } from "lucide-react";

const MOVEMENT_TYPES = [
  { value: "despacho", label: "Despacho" },
  { value: "decisao", label: "Decisão" },
  { value: "sentenca", label: "Sentença" },
  { value: "peticao", label: "Petição Protocolada" },
  { value: "observacao", label: "Observação Interna" },
  { value: "other", label: "Outro" },
];

const ORIGIN_TYPES = [
  { value: "manual", label: "Manual" },
  { value: "tribunal", label: "Tribunal" },
  { value: "ia", label: "IA" },
  { value: "agent", label: "Agente" },
];

const Movements = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission, isIntern, isClient } = usePermissions();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterProcess, setFilterProcess] = useState("all");

  const [form, setForm] = useState({
    process_id: "", title: "", description: "", movement_type: "despacho", origin: "manual", movement_date: format(new Date(), "yyyy-MM-dd"),
  });

  const resetForm = () => {
    setForm({ process_id: "", title: "", description: "", movement_type: "despacho", origin: "manual", movement_date: format(new Date(), "yyyy-MM-dd") });
    setEditId(null);
  };

  const { data: processes = [] } = useQuery({
    queryKey: ["processes-list", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("processes").select("id, title, number").eq("organization_id", activeOrgId!).eq("archived", false).order("title");
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["movements", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_movements" as any)
        .select("*, processes(title, number)")
        .eq("organization_id", activeOrgId!)
        .order("movement_date", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        process_id: values.process_id,
        organization_id: activeOrgId,
        user_id: user!.id,
        title: values.title,
        description: values.description || null,
        movement_type: values.movement_type,
        origin: values.origin,
        movement_date: values.movement_date + "T00:00:00Z",
      };
      if (editId) {
        const { error } = await supabase.from("process_movements" as any).update(payload).eq("id", editId);
        if (error) throw error;
        await supabase.from("audit_logs").insert({ action: "movement_updated", user_id: user!.id, organization_id: activeOrgId, resource_type: "movement", resource_id: editId } as any);
      } else {
        const { data, error } = await supabase.from("process_movements" as any).insert(payload).select("id").single();
        if (error) throw error;
        await supabase.from("audit_logs").insert({ action: "movement_created", user_id: user!.id, organization_id: activeOrgId, resource_type: "movement", resource_id: (data as any).id } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      toast.success(editId ? "Movimentação atualizada!" : "Movimentação registrada!");
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("process_movements" as any).delete().eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "movement_deleted", user_id: user!.id, organization_id: activeOrgId, resource_type: "movement", resource_id: id } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      toast.success("Movimentação excluída.");
    },
  });

  const openEdit = (m: any) => {
    setForm({
      process_id: m.process_id,
      title: m.title,
      description: m.description || "",
      movement_type: m.movement_type,
      origin: m.origin,
      movement_date: format(new Date(m.movement_date), "yyyy-MM-dd"),
    });
    setEditId(m.id);
    setOpen(true);
  };

  const filtered = useMemo(() => {
    return movements.filter((m: any) => {
      if (filterType !== "all" && m.movement_type !== filterType) return false;
      if (filterProcess !== "all" && m.process_id !== filterProcess) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!m.title?.toLowerCase().includes(s) && !m.description?.toLowerCase().includes(s) && !m.processes?.number?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [movements, filterType, filterProcess, search]);

  const canCreate = hasPermission("MANAGE_PROCESSES") || (!isClient && !isIntern);
  const canEdit = hasPermission("MANAGE_PROCESSES") && !isClient;
  const canDelete = hasPermission("MANAGE_PROCESSES") && !isIntern && !isClient;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <GitCommitHorizontal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-primary mb-0.5">Gestão</p>
            <h1 className="text-2xl font-bold text-foreground">Movimentações Processuais</h1>
          </div>
        </div>
        {canCreate && (
          <Button className="gap-2" onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Nova Movimentação
          </Button>
        )}
      </div>

      {/* Filters */}
      <LexCard hover={false}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por título, descrição ou nº do processo..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {MOVEMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterProcess} onValueChange={setFilterProcess}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Processo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os processos</SelectItem>
                {processes.map((p) => <SelectItem key={p.id} value={p.id}>{p.number}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </LexCard>

      {/* Timeline */}
      <div className="space-y-3">
        {isLoading ? (
          <LexCard hover={false}>
            <p className="text-muted-foreground text-center py-6">Carregando movimentações...</p>
          </LexCard>
        ) : filtered.length === 0 ? (
          <LexCard hover={false}>
            <div className="text-center py-10 space-y-2">
              <GitCommitHorizontal className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground">Nenhuma movimentação encontrada.</p>
              {canCreate && <p className="text-xs text-muted-foreground">Clique em "Nova Movimentação" para registrar.</p>}
            </div>
          </LexCard>
        ) : (
          filtered.map((m: any) => {
            const typeInfo = MOVEMENT_TYPES.find((t) => t.value === m.movement_type);
            const originInfo = ORIGIN_TYPES.find((o) => o.value === m.origin);
            return (
              <LexCard key={m.id} className="hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center pt-1">
                    <GitCommitHorizontal className="h-5 w-5 text-primary" />
                    <div className="w-px flex-1 bg-border mt-1" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{m.title}</span>
                      <Badge variant="outline" className="text-xs">{typeInfo?.label || m.movement_type}</Badge>
                      <Badge variant="secondary" className="text-xs">{originInfo?.label || m.origin}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{format(new Date(m.movement_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {m.processes?.number || "—"} — {m.processes?.title || ""}
                      </span>
                    </div>
                    {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {canEdit && <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Edit className="h-4 w-4" /></Button>}
                    {canDelete && <Button size="sm" variant="ghost" className="hover:text-destructive" onClick={() => deleteMutation.mutate(m.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
              </LexCard>
            );
          })
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Movimentação" : "Nova Movimentação"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div>
              <Label>Processo *</Label>
              <Select value={form.process_id} onValueChange={(v) => setForm({ ...form, process_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar processo" /></SelectTrigger>
                <SelectContent>
                  {processes.map((p) => <SelectItem key={p.id} value={p.id}>{p.number} — {p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.movement_type} onValueChange={(v) => setForm({ ...form, movement_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Origem</Label>
                <Select value={form.origin} onValueChange={(v) => setForm({ ...form, origin: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORIGIN_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <Button type="submit" className="w-full" disabled={saveMutation.isPending || !form.process_id || !form.title}>
              {saveMutation.isPending ? "Salvando..." : editId ? "Atualizar" : "Registrar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Movements;
