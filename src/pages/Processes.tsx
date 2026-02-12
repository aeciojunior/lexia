import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { RiskIndicator } from "@/components/lexia/LegalComponents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Archive, Edit, Eye, ChevronLeft, ChevronRight, Scale } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PAGE_SIZE = 10;
const statusMap: Record<string, string> = { active: "Ativo", pending: "Pendente", closed: "Encerrado", suspended: "Suspenso" };
const typeMap: Record<string, string> = { civil: "Cível", criminal: "Criminal", labor: "Trabalhista", tax: "Tributário", admin: "Administrativo" };

interface ProcessForm {
  number: string; title: string; client_name: string; type: string; status: string; risk_level: string; court: string; judge: string; notes: string; description: string; tags: string;
}
const emptyForm: ProcessForm = { number: "", title: "", client_name: "", type: "civil", status: "active", risk_level: "low", court: "", judge: "", notes: "", description: "", tags: "" };

const Processes = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProcessForm>(emptyForm);
  const [selectedProcess, setSelectedProcess] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["processes", search, statusFilter, page],
    queryFn: async () => {
      let q = supabase.from("processes").select("*", { count: "exact" }).eq("archived", false).order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (search) q = q.or(`title.ilike.%${search}%,number.ilike.%${search}%,client_name.ilike.%${search}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { items: data || [], count: count || 0 };
    },
  });

  const logAudit = async (action: string, resourceId: string, metadata: Record<string, any> = {}) => {
    if (!user) return;
    await supabase.from("audit_logs").insert({
      action,
      user_id: user.id,
      organization_id: activeOrgId,
      resource_type: "process",
      resource_id: resourceId,
      metadata,
    } as any);
  };

  const saveMutation = useMutation({
    mutationFn: async (formData: ProcessForm) => {
      const tagsArray = formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      const payload = {
        number: formData.number,
        title: formData.title,
        client_name: formData.client_name,
        type: formData.type,
        status: formData.status,
        risk_level: formData.risk_level,
        court: formData.court,
        judge: formData.judge,
        notes: formData.notes,
        description: formData.description,
        tags: tagsArray,
      };

      if (editingId) {
        const { error } = await supabase.from("processes").update(payload as any).eq("id", editingId);
        if (error) throw error;
        await logAudit("process_updated", editingId, { fields_changed: Object.keys(payload) });
      } else {
        const { data: inserted, error } = await supabase.from("processes").insert({ ...payload, user_id: user!.id, organization_id: activeOrgId } as any).select("id").single();
        if (error) throw error;
        await logAudit("process_created", inserted.id, { title: formData.title, number: formData.number });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      queryClient.invalidateQueries({ queryKey: ["processes-summary"] });
      queryClient.invalidateQueries({ queryKey: ["processes-stats"] });
      setDialogOpen(false); setEditingId(null); setForm(emptyForm);
      toast.success(editingId ? "Processo atualizado!" : "Processo criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("processes").update({ archived: true }).eq("id", id);
      if (error) throw error;
      await logAudit("process_archived", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      queryClient.invalidateQueries({ queryKey: ["processes-stats"] });
      toast.success("Processo arquivado!");
    },
  });

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      number: p.number, title: p.title, client_name: p.client_name, type: p.type, status: p.status,
      risk_level: p.risk_level || "low", court: p.court || "", judge: p.judge || "", notes: p.notes || "",
      description: p.description || "", tags: (p.tags || []).join(", "),
    });
    setDialogOpen(true);
  };

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-overline text-primary mb-1">Gestão</p>
          <h1 className="text-display-lg">Processos</h1>
          <p className="text-body-sm text-muted-foreground mt-1">Gerencie todos os seus processos judiciais</p>
        </div>
        <Button variant="hero" onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo Processo
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10 h-11 rounded-xl bg-muted border-border" placeholder="Buscar por título, número ou cliente..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40 h-11 rounded-xl bg-muted border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
              <p className="text-body-sm text-muted-foreground">Carregando processos...</p>
            </div>
          ) : !data?.items.length ? (
            <div className="py-16 text-center">
              <Scale className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-body-sm text-muted-foreground mb-3">Nenhum processo encontrado.</p>
              <Button variant="outline" size="sm" onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
                Criar primeiro processo
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Número", "Título", "Cliente", "Tipo", "Status", "Risco", "Ações"].map((h) => (
                      <th key={h} className="text-left py-3 text-overline text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors group"
                    >
                      <td className="py-3.5 font-mono text-caption text-primary">{p.number}</td>
                      <td className="py-3.5 font-medium">{p.title}</td>
                      <td className="py-3.5 text-muted-foreground">{p.client_name}</td>
                      <td className="py-3.5"><LexBadge variant="outline">{typeMap[p.type] || p.type}</LexBadge></td>
                      <td className="py-3.5">
                        <LexBadge variant={p.status === "active" ? "success" : p.status === "closed" ? "default" : "warning"}>
                          {statusMap[p.status] || p.status}
                        </LexBadge>
                      </td>
                      <td className="py-3.5"><RiskIndicator level={p.risk_level as any || "low"} /></td>
                      <td className="py-3.5">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-normal">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setSelectedProcess(p); setViewDialog(true); }}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-destructive" onClick={() => archiveMutation.mutate(p.id)}><Archive className="h-4 w-4" /></Button>
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
              <p className="text-caption text-muted-foreground">{data?.count} processos • Página {page + 1}/{totalPages}</p>
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
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">{editingId ? "Editar Processo" : "Novo Processo"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-overline text-muted-foreground block mb-1.5">Número</label><Input className="bg-muted border-border rounded-xl" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="0000000-00.0000.0.00.0000" required /></div>
              <div><label className="text-overline text-muted-foreground block mb-1.5">Cliente</label><Input className="bg-muted border-border rounded-xl" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} required /></div>
            </div>
            <div><label className="text-overline text-muted-foreground block mb-1.5">Título</label><Input className="bg-muted border-border rounded-xl" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><label className="text-overline text-muted-foreground block mb-1.5">Descrição</label><Textarea className="bg-muted border-border rounded-xl" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Descrição do processo..." /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="text-overline text-muted-foreground block mb-1.5">Tipo</label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(typeMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-overline text-muted-foreground block mb-1.5">Status</label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-overline text-muted-foreground block mb-1.5">Risco</label><Select value={form.risk_level} onValueChange={(v) => setForm({ ...form, risk_level: v })}><SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Baixo</SelectItem><SelectItem value="medium">Médio</SelectItem><SelectItem value="high">Alto</SelectItem><SelectItem value="critical">Crítico</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-overline text-muted-foreground block mb-1.5">Vara/Tribunal</label><Input className="bg-muted border-border rounded-xl" value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} /></div>
              <div><label className="text-overline text-muted-foreground block mb-1.5">Juiz</label><Input className="bg-muted border-border rounded-xl" value={form.judge} onChange={(e) => setForm({ ...form, judge: e.target.value })} /></div>
            </div>
            <div><label className="text-overline text-muted-foreground block mb-1.5">Tags (separadas por vírgula)</label><Input className="bg-muted border-border rounded-xl" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="cível, urgente, recurso..." /></div>
            <div><label className="text-overline text-muted-foreground block mb-1.5">Observações</label><Textarea className="bg-muted border-border rounded-xl" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Detalhes do Processo</DialogTitle></DialogHeader>
          {selectedProcess && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-body-sm">
                <div><span className="text-overline text-muted-foreground block mb-0.5">Número</span><span className="font-mono text-primary">{selectedProcess.number}</span></div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Cliente</span>{selectedProcess.client_name}</div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Título</span>{selectedProcess.title}</div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Tipo</span>{typeMap[selectedProcess.type] || selectedProcess.type}</div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Status</span><LexBadge variant={selectedProcess.status === "active" ? "success" : "warning"}>{statusMap[selectedProcess.status]}</LexBadge></div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Risco</span><RiskIndicator level={selectedProcess.risk_level || "low"} /></div>
                {selectedProcess.court && <div><span className="text-overline text-muted-foreground block mb-0.5">Vara/Tribunal</span>{selectedProcess.court}</div>}
                {selectedProcess.judge && <div><span className="text-overline text-muted-foreground block mb-0.5">Juiz</span>{selectedProcess.judge}</div>}
              </div>
              {selectedProcess.description && <div><span className="text-overline text-muted-foreground block mb-1">Descrição</span><p className="text-body-sm rounded-xl bg-muted p-3">{selectedProcess.description}</p></div>}
              {selectedProcess.tags?.length > 0 && (
                <div><span className="text-overline text-muted-foreground block mb-1">Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProcess.tags.map((tag: string) => <LexBadge key={tag} variant="outline">{tag}</LexBadge>)}
                  </div>
                </div>
              )}
              {selectedProcess.notes && <div><span className="text-overline text-muted-foreground block mb-1">Observações</span><p className="text-body-sm rounded-xl bg-muted p-3">{selectedProcess.notes}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Processes;
