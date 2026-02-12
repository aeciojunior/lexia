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
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Eye, Users, Building2, User, Phone, Mail, MapPin, Lock, ChevronLeft, ChevronRight, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const PAGE_SIZE = 10;

const statusLabels: Record<string, string> = { active: "Ativo", inactive: "Inativo", archived: "Arquivado" };
const typeLabels: Record<string, string> = { individual: "Pessoa Física", company: "Pessoa Jurídica" };

interface ClientForm {
  full_name: string;
  document_type: string;
  document_number: string;
  email: string;
  phone: string;
  address: string;
  client_type: string;
  business_area: string;
  responsible_id: string;
  tags: string;
  internal_notes: string;
  status: string;
}

const emptyForm: ClientForm = {
  full_name: "", document_type: "cpf", document_number: "", email: "", phone: "",
  address: "", client_type: "individual", business_area: "", responsible_id: "none",
  tags: "", internal_notes: "", status: "active",
};

const Clients = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission, isIntern } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [formTouched, setFormTouched] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  const canManage = hasPermission("MANAGE_CLIENTS");
  const canView = hasPermission("VIEW_CLIENTS");

  const { data: orgMembers = [] } = useQuery({
    queryKey: ["org-members-clients", activeOrgId],
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

  const getMemberName = (userId: string) => {
    const member = orgMembers.find((m: any) => m.user_id === userId);
    return (member?.profiles as any)?.full_name || "Membro";
  };

  const { data, isLoading } = useQuery({
    queryKey: ["clients", activeOrgId, search, statusFilter, typeFilter, page],
    queryFn: async () => {
      let q = supabase.from("clients" as any).select("*", { count: "exact" })
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (typeFilter !== "all") q = q.eq("client_type", typeFilter);
      if (search) q = q.or(`full_name.ilike.%${search}%,document_number.ilike.%${search}%,email.ilike.%${search}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { items: (data as any[]) || [], count: count || 0 };
    },
    enabled: !!activeOrgId && canView,
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ["clients-stats", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients" as any).select("status, client_type").eq("organization_id", activeOrgId!);
      if (error) throw error;
      const items = (data as any[]) || [];
      return {
        total: items.length,
        active: items.filter(c => c.status === "active").length,
        individuals: items.filter(c => c.client_type === "individual").length,
        companies: items.filter(c => c.client_type === "company").length,
      };
    },
    enabled: !!activeOrgId && canView,
  });

  const logAudit = async (action: string, resourceId: string, metadata: Record<string, any> = {}) => {
    if (!user) return;
    await supabase.from("audit_logs").insert({
      action, user_id: user.id, organization_id: activeOrgId,
      resource_type: "client", resource_id: resourceId, metadata,
    } as any);
  };

  const saveMutation = useMutation({
    mutationFn: async (formData: ClientForm) => {
      const tagsArray = formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      const payload = {
        full_name: formData.full_name,
        document_type: formData.document_type,
        document_number: formData.document_number || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        client_type: formData.client_type,
        business_area: formData.business_area || null,
        responsible_id: formData.responsible_id === "none" ? null : formData.responsible_id,
        tags: tagsArray,
        internal_notes: formData.internal_notes || null,
        status: formData.status,
      };
      if (editingId) {
        const { error } = await supabase.from("clients" as any).update(payload).eq("id", editingId);
        if (error) throw error;
        await logAudit("client_updated", editingId, { fields_changed: Object.keys(payload) });
      } else {
        const { data: inserted, error } = await supabase.from("clients" as any)
          .insert({ ...payload, user_id: user!.id, organization_id: activeOrgId })
          .select("id").single();
        if (error) throw error;
        await logAudit("client_created", (inserted as any).id, { full_name: formData.full_name });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-stats"] });
      setDialogOpen(false); setEditingId(null); setForm(emptyForm); setFormTouched(false);
      toast.success(editingId ? "Cliente atualizado!" : "Cliente cadastrado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients" as any).delete().eq("id", id);
      if (error) throw error;
      await logAudit("client_deleted", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-stats"] });
      toast.success("Cliente excluído!");
    },
  });

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      full_name: c.full_name, document_type: c.document_type, document_number: c.document_number || "",
      email: c.email || "", phone: c.phone || "", address: c.address || "",
      client_type: c.client_type, business_area: c.business_area || "",
      responsible_id: c.responsible_id || "none", tags: (c.tags || []).join(", "),
      internal_notes: c.internal_notes || "", status: c.status,
    });
    setFormTouched(false);
    setDialogOpen(true);
  };

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Lock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-display-sm text-muted-foreground">Acesso restrito</h2>
          <p className="text-body-sm text-muted-foreground/60 mt-2">Você não tem permissão para acessar o módulo de clientes.</p>
        </div>
      </div>
    );
  }

  const maskDocument = (value: string, type: string) => {
    const digits = value.replace(/\D/g, "");
    if (type === "cpf") {
      return digits.slice(0, 11).replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, d) =>
        [a, b, c].filter(Boolean).join(".") + (d ? `-${d}` : "")
      );
    }
    return digits.slice(0, 14).replace(/(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, (_, a, b, c, d, e) =>
      a + (b ? `.${b}` : "") + (c ? `.${c}` : "") + (d ? `/${d}` : "") + (e ? `-${e}` : "")
    );
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-overline text-primary mb-1">Gestão</p>
          <h1 className="text-display-lg">Clientes</h1>
          <p className="text-body-sm text-muted-foreground mt-1">Gerencie seus clientes e suas informações</p>
        </div>
        {canManage && (
          <Button variant="hero" onClick={() => { setEditingId(null); setForm(emptyForm); setFormTouched(false); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
        )}
      </motion.div>

      {/* Stats */}
      {stats && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total de clientes", value: stats.total, icon: Users, color: "text-primary" },
            { label: "Ativos", value: stats.active, icon: User, color: "text-success" },
            { label: "Pessoa Física", value: stats.individuals, icon: User, color: "text-muted-foreground" },
            { label: "Pessoa Jurídica", value: stats.companies, icon: Building2, color: "text-secondary" },
          ].map((card) => (
            <div key={card.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-display-sm leading-none">{card.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{card.label}</p>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10 h-11 rounded-xl bg-muted border-border" placeholder="Buscar por nome, documento ou e-mail..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36 h-11 rounded-xl bg-muted border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40 h-11 rounded-xl bg-muted border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

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
              <p className="text-body-sm text-muted-foreground">Carregando clientes...</p>
            </div>
          ) : !data?.items.length ? (
            <div className="py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-body-sm text-muted-foreground mb-3">Nenhum cliente encontrado.</p>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => { setEditingId(null); setForm(emptyForm); setFormTouched(false); setDialogOpen(true); }}>
                  Cadastrar primeiro cliente
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Nome", "Tipo", "Documento", "Contato", "Status", "Responsável", "Ações"].map((h) => (
                      <th key={h} className="text-left py-3 text-overline text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c: any, i: number) => (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors group"
                    >
                      <td className="py-3.5 font-medium">{c.full_name}</td>
                      <td className="py-3.5">
                        <LexBadge variant={c.client_type === "company" ? "secondary" : "outline"}>
                          {typeLabels[c.client_type] || c.client_type}
                        </LexBadge>
                      </td>
                      <td className="py-3.5 font-mono text-caption text-muted-foreground">{c.document_number || "—"}</td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                          {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                          {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                          {!c.email && !c.phone && "—"}
                        </div>
                      </td>
                      <td className="py-3.5">
                        <LexBadge variant={c.status === "active" ? "success" : c.status === "inactive" ? "warning" : "default"}>
                          {statusLabels[c.status] || c.status}
                        </LexBadge>
                      </td>
                      <td className="py-3.5 text-muted-foreground text-xs">
                        {c.responsible_id ? getMemberName(c.responsible_id) : "—"}
                      </td>
                      <td className="py-3.5">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setSelectedClient(c); setViewDialog(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(canManage || isIntern) && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(c)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canManage && !isIntern && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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
              <p className="text-caption text-muted-foreground">{data?.count} clientes • Página {page + 1}/{totalPages}</p>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </LexCard>
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">{editingId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            setFormTouched(true);
            if (!form.full_name.trim()) {
              toast.error("Preencha o nome do cliente.");
              return;
            }
            saveMutation.mutate(form);
          }} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Nome completo <span className="text-destructive">*</span></label>
                <Input className={`bg-muted border-border rounded-xl ${formTouched && !form.full_name.trim() ? "border-destructive ring-1 ring-destructive/30" : ""}`} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                {formTouched && !form.full_name.trim() && <p className="text-[10px] text-destructive mt-1">Campo obrigatório</p>}
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Tipo</label>
                <Select value={form.client_type} onValueChange={(v) => setForm({ ...form, client_type: v, document_type: v === "company" ? "cnpj" : "cpf", document_number: "" })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Pessoa Física</SelectItem>
                    <SelectItem value="company">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">{form.document_type === "cpf" ? "CPF" : "CNPJ"}</label>
                <Input className="bg-muted border-border rounded-xl" value={form.document_number}
                  onChange={(e) => setForm({ ...form, document_number: maskDocument(e.target.value, form.document_type) })}
                  placeholder={form.document_type === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                  maxLength={form.document_type === "cpf" ? 14 : 18}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">E-mail</label>
                <Input className="bg-muted border-border rounded-xl" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="cliente@email.com" />
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Telefone</label>
                <Input className="bg-muted border-border rounded-xl" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Área de atuação</label>
                <Input className="bg-muted border-border rounded-xl" value={form.business_area} onChange={(e) => setForm({ ...form, business_area: e.target.value })} placeholder="Tecnologia, Saúde..." />
              </div>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Endereço</label>
              <Input className="bg-muted border-border rounded-xl" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro, cidade..." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Responsável interno</label>
                <Select value={form.responsible_id} onValueChange={(v) => setForm({ ...form, responsible_id: v })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {orgMembers.map((m: any) => (
                      <SelectItem key={m.user_id} value={m.user_id}>{(m.profiles as any)?.full_name || "Membro"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Tags (vírgula)</label>
                <Input className="bg-muted border-border rounded-xl" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="VIP, urgente..." />
              </div>
            </div>
            {!isIntern && (
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Observações internas</label>
                <Textarea className="bg-muted border-border rounded-xl" value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} rows={2} />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Detalhes do Cliente</DialogTitle></DialogHeader>
          {selectedClient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-overline text-muted-foreground mb-1">Nome</p>
                  <p className="font-medium">{selectedClient.full_name}</p>
                </div>
                <div>
                  <p className="text-overline text-muted-foreground mb-1">Tipo</p>
                  <LexBadge variant={selectedClient.client_type === "company" ? "secondary" : "outline"}>
                    {typeLabels[selectedClient.client_type]}
                  </LexBadge>
                </div>
                <div>
                  <p className="text-overline text-muted-foreground mb-1">{selectedClient.document_type === "cpf" ? "CPF" : "CNPJ"}</p>
                  <p className="font-mono text-sm">{selectedClient.document_number || "—"}</p>
                </div>
                <div>
                  <p className="text-overline text-muted-foreground mb-1">Status</p>
                  <LexBadge variant={selectedClient.status === "active" ? "success" : "warning"}>
                    {statusLabels[selectedClient.status]}
                  </LexBadge>
                </div>
                {selectedClient.email && (
                  <div>
                    <p className="text-overline text-muted-foreground mb-1">E-mail</p>
                    <p className="text-sm flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{selectedClient.email}</p>
                  </div>
                )}
                {selectedClient.phone && (
                  <div>
                    <p className="text-overline text-muted-foreground mb-1">Telefone</p>
                    <p className="text-sm flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{selectedClient.phone}</p>
                  </div>
                )}
                {selectedClient.address && (
                  <div className="col-span-2">
                    <p className="text-overline text-muted-foreground mb-1">Endereço</p>
                    <p className="text-sm flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{selectedClient.address}</p>
                  </div>
                )}
                {selectedClient.business_area && (
                  <div>
                    <p className="text-overline text-muted-foreground mb-1">Área de atuação</p>
                    <p className="text-sm">{selectedClient.business_area}</p>
                  </div>
                )}
                {selectedClient.responsible_id && (
                  <div>
                    <p className="text-overline text-muted-foreground mb-1">Responsável</p>
                    <p className="text-sm">{getMemberName(selectedClient.responsible_id)}</p>
                  </div>
                )}
              </div>
              {selectedClient.tags?.length > 0 && (
                <div>
                  <p className="text-overline text-muted-foreground mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedClient.tags.map((t: string) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                  </div>
                </div>
              )}
              {selectedClient.internal_notes && !isIntern && (
                <div>
                  <p className="text-overline text-muted-foreground mb-1">Observações internas</p>
                  <p className="text-sm text-muted-foreground">{selectedClient.internal_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;
