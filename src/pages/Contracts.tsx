import { useState } from "react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollText, Plus, Search, Pencil, Trash2, Users, Scale, Calendar, DollarSign, Tag, FileText, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RoleGuard } from "@/components/RoleGuard";

const statusLabels: Record<string, string> = { active: "Ativo", suspended: "Suspenso", closed: "Encerrado", draft: "Rascunho" };
const statusVariants: Record<string, string> = { active: "success", suspended: "warning", closed: "secondary", draft: "default" };
const typeLabels: Record<string, string> = { service: "Honorários", contingency: "Êxito", fixed: "Prestação de Serviço", hourly: "Por Hora", other: "Outro" };
const periodicityLabels: Record<string, string> = { once: "Único", monthly: "Mensal", quarterly: "Trimestral", yearly: "Anual", on_demand: "Por Demanda" };
const paymentMethodLabels: Record<string, string> = { pix: "PIX", boleto: "Boleto", credit_card: "Cartão", transfer: "Transferência", other: "Outro" };

const emptyForm = {
  title: "", contract_type: "service", client_id: "", process_id: "", amount_cents: 0,
  currency: "BRL", periodicity: "monthly", start_date: "", end_date: "", status: "active",
  description: "", terms: "", clauses: "", payment_method: "other", responsible_id: "",
  tags: [] as string[], notes: "",
};

const Contracts = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewContract, setViewContract] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [tagInput, setTagInput] = useState("");

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name").eq("status", "active");
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ["processes-list", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("processes").select("id, title, number").eq("archived", false);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: orgMembers = [] } = useQuery({
    queryKey: ["org-members", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_organizations")
        .select("user_id, role")
        .eq("organization_id", activeOrgId!)
        .neq("role", "client");
      if (!data) return [];
      const userIds = data.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      return data.map(d => ({
        ...d,
        full_name: profiles?.find(p => p.user_id === d.user_id)?.full_name || d.user_id.slice(0, 8),
      }));
    },
    enabled: !!activeOrgId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Título obrigatório");
      const payload = {
        ...form,
        organization_id: activeOrgId!,
        user_id: user!.id,
        client_id: form.client_id || null,
        process_id: form.process_id || null,
        responsible_id: form.responsible_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      if (editId) {
        const { error } = await supabase.from("contracts").update(payload as any).eq("id", editId);
        if (error) throw error;
        await supabase.from("audit_logs").insert({
          action: "contract_updated", user_id: user!.id, resource_type: "contract",
          resource_id: editId, organization_id: activeOrgId,
        } as any);
      } else {
        const { data, error } = await supabase.from("contracts").insert(payload as any).select("id").single();
        if (error) throw error;
        await supabase.from("audit_logs").insert({
          action: "contract_created", user_id: user!.id, resource_type: "contract",
          resource_id: data.id, organization_id: activeOrgId,
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editId ? "Contrato atualizado!" : "Contrato criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "contract_deleted", user_id: user!.id, resource_type: "contract",
        resource_id: id, organization_id: activeOrgId,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setDeleteId(null);
      toast.success("Contrato excluído!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => { setForm(emptyForm); setEditId(null); setTagInput(""); };
  const openEdit = (c: any) => {
    setForm({
      title: c.title, contract_type: c.contract_type, client_id: c.client_id || "",
      process_id: c.process_id || "", amount_cents: c.amount_cents, currency: c.currency,
      periodicity: c.periodicity || "monthly", start_date: c.start_date || "", end_date: c.end_date || "",
      status: c.status, description: c.description || "", terms: c.terms || "",
      clauses: c.clauses || "", payment_method: c.payment_method || "other",
      responsible_id: c.responsible_id || "", tags: c.tags || [], notes: c.notes || "",
    });
    setEditId(c.id);
    setDialogOpen(true);
  };

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const filtered = contracts.filter((c: any) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm(f => ({ ...f, tags: [...f.tags, tagInput.trim()] }));
      setTagInput("");
    }
  };

  const getClientName = (id: string) => clients.find((c: any) => c.id === id)?.full_name || "—";
  const getProcessTitle = (id: string) => processes.find((p: any) => p.id === id)?.title || "—";
  const getResponsibleName = (id: string) => orgMembers.find((m: any) => m.user_id === id)?.full_name || "—";

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <ScrollText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-overline text-primary mb-0.5">Gestão</p>
            <h1 className="text-display-lg">Contratos</h1>
          </div>
        </div>
        <p className="text-body-sm text-muted-foreground mt-1">Crie, gerencie e acompanhe contratos jurídicos e administrativos</p>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar contratos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <RoleGuard permissions={["MANAGE_CONTRACTS"]}>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Novo Contrato
          </Button>
        </RoleGuard>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: contracts.length, icon: ScrollText },
          { label: "Ativos", value: contracts.filter((c: any) => c.status === "active").length, icon: FileText },
          { label: "Valor Total", value: formatCurrency(contracts.reduce((s: number, c: any) => s + (c.amount_cents || 0), 0)), icon: DollarSign },
          { label: "Com Cliente", value: contracts.filter((c: any) => c.client_id).length, icon: Users },
        ].map((s, i) => (
          <LexCard key={i}>
            <div className="p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-overline text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </div>
          </LexCard>
        ))}
      </div>

      {/* Contracts List */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum contrato encontrado</p>
        ) : (
          filtered.map((c: any) => (
            <LexCard key={c.id} className="hover:border-primary/30 transition-colors">
              <div className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{c.title}</h3>
                    <LexBadge variant={statusVariants[c.status] as any}>{statusLabels[c.status] || c.status}</LexBadge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{typeLabels[c.contract_type] || c.contract_type}</span>
                    <span>{formatCurrency(c.amount_cents)}</span>
                    {c.periodicity && <span>{periodicityLabels[c.periodicity] || c.periodicity}</span>}
                    {c.client_id && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{getClientName(c.client_id)}</span>}
                    {c.start_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(c.start_date), "dd/MM/yyyy")}</span>}
                  </div>
                  {c.tags?.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {c.tags.map((t: string) => <LexBadge key={t} variant="outline" className="text-xs">{t}</LexBadge>)}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => setViewContract(c)}><Eye className="h-4 w-4" /></Button>
                  <RoleGuard permissions={["MANAGE_CONTRACTS"]}>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  </RoleGuard>
                  <RoleGuard permissions={["MANAGE_ORGANIZATION"]}>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </RoleGuard>
                </div>
              </div>
            </LexCard>
          ))
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewContract} onOpenChange={() => setViewContract(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewContract?.title}</DialogTitle></DialogHeader>
          {viewContract && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-muted-foreground">Tipo</p><p className="font-medium">{typeLabels[viewContract.contract_type] || viewContract.contract_type}</p></div>
                <div><p className="text-muted-foreground">Status</p><LexBadge variant={statusVariants[viewContract.status] as any}>{statusLabels[viewContract.status]}</LexBadge></div>
                <div><p className="text-muted-foreground">Valor</p><p className="font-medium">{formatCurrency(viewContract.amount_cents)}</p></div>
                <div><p className="text-muted-foreground">Periodicidade</p><p className="font-medium">{periodicityLabels[viewContract.periodicity] || "—"}</p></div>
                <div><p className="text-muted-foreground">Forma de Pagamento</p><p className="font-medium">{paymentMethodLabels[viewContract.payment_method] || "—"}</p></div>
                <div><p className="text-muted-foreground">Cliente</p><p className="font-medium">{viewContract.client_id ? getClientName(viewContract.client_id) : "—"}</p></div>
                <div><p className="text-muted-foreground">Processo</p><p className="font-medium">{viewContract.process_id ? getProcessTitle(viewContract.process_id) : "—"}</p></div>
                <div><p className="text-muted-foreground">Responsável</p><p className="font-medium">{viewContract.responsible_id ? getResponsibleName(viewContract.responsible_id) : "—"}</p></div>
                <div><p className="text-muted-foreground">Início</p><p className="font-medium">{viewContract.start_date ? format(new Date(viewContract.start_date), "dd/MM/yyyy") : "—"}</p></div>
                <div><p className="text-muted-foreground">Término</p><p className="font-medium">{viewContract.end_date ? format(new Date(viewContract.end_date), "dd/MM/yyyy") : "—"}</p></div>
              </div>
              {viewContract.description && <div><p className="text-muted-foreground mb-1">Descrição</p><p>{viewContract.description}</p></div>}
              {viewContract.clauses && <div><p className="text-muted-foreground mb-1">Cláusulas</p><p className="whitespace-pre-wrap">{viewContract.clauses}</p></div>}
              {viewContract.terms && <div><p className="text-muted-foreground mb-1">Termos</p><p className="whitespace-pre-wrap">{viewContract.terms}</p></div>}
              {viewContract.notes && <div><p className="text-muted-foreground mb-1">Observações Internas</p><p>{viewContract.notes}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar Contrato" : "Novo Contrato"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Tabs defaultValue="general">
              <TabsList className="w-full">
                <TabsTrigger value="general" className="flex-1">Geral</TabsTrigger>
                <TabsTrigger value="legal" className="flex-1">Jurídico</TabsTrigger>
                <TabsTrigger value="internal" className="flex-1">Interno</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-3 mt-4">
                <Input placeholder="Título *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={form.contract_type} onValueChange={v => setForm(f => ({ ...f, contract_type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={form.client_id || "none"} onValueChange={v => setForm(f => ({ ...f, client_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem cliente</SelectItem>
                      {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={form.process_id || "none"} onValueChange={v => setForm(f => ({ ...f, process_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Processo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem processo</SelectItem>
                      {processes.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.number} — {p.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input type="number" placeholder="Valor (centavos)" value={form.amount_cents} onChange={e => setForm(f => ({ ...f, amount_cents: parseInt(e.target.value) || 0 }))} />
                  <Select value={form.periodicity} onValueChange={v => setForm(f => ({ ...f, periodicity: v }))}>
                    <SelectTrigger><SelectValue placeholder="Periodicidade" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(periodicityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger><SelectValue placeholder="Pagamento" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(paymentMethodLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground">Início</label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                  <div><label className="text-xs text-muted-foreground">Término</label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
                </div>
                <Textarea placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
              </TabsContent>

              <TabsContent value="legal" className="space-y-3 mt-4">
                <Textarea placeholder="Cláusulas" value={form.clauses} onChange={e => setForm(f => ({ ...f, clauses: e.target.value }))} rows={6} />
                <Textarea placeholder="Termos e Condições" value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} rows={6} />
              </TabsContent>

              <TabsContent value="internal" className="space-y-3 mt-4">
                <Select value={form.responsible_id || "none"} onValueChange={v => setForm(f => ({ ...f, responsible_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Responsável interno" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {orgMembers.map((m: any) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tags</label>
                  <div className="flex gap-2">
                    <Input placeholder="Adicionar tag" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} />
                    <Button variant="outline" size="sm" onClick={addTag}><Tag className="h-4 w-4" /></Button>
                  </div>
                  {form.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {form.tags.map(t => (
                        <LexBadge key={t} variant="outline" className="cursor-pointer" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}>{t} ×</LexBadge>
                      ))}
                    </div>
                  )}
                </div>
                <Textarea placeholder="Observações internas" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={4} />
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Contracts;
