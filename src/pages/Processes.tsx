import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { RiskIndicator } from "@/components/lexia/LegalComponents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Archive, Edit, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 10;

const statusMap: Record<string, string> = { active: "Ativo", pending: "Pendente", closed: "Encerrado", suspended: "Suspenso" };
const typeMap: Record<string, string> = { civil: "Cível", criminal: "Criminal", labor: "Trabalhista", tax: "Tributário", admin: "Administrativo" };

interface ProcessForm {
  number: string;
  title: string;
  client_name: string;
  type: string;
  status: string;
  risk_level: string;
  court: string;
  judge: string;
  notes: string;
}

const emptyForm: ProcessForm = {
  number: "", title: "", client_name: "", type: "civil", status: "active", risk_level: "low", court: "", judge: "", notes: "",
};

const Processes = () => {
  const { user } = useAuth();
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
      let q = supabase
        .from("processes")
        .select("*", { count: "exact" })
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (search) q = q.or(`title.ilike.%${search}%,number.ilike.%${search}%,client_name.ilike.%${search}%`);

      const { data, error, count } = await q;
      if (error) throw error;
      return { items: data || [], count: count || 0 };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: ProcessForm) => {
      if (editingId) {
        const { error } = await supabase.from("processes").update(formData).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("processes").insert({ ...formData, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      queryClient.invalidateQueries({ queryKey: ["processes-summary"] });
      queryClient.invalidateQueries({ queryKey: ["processes-stats"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Processo atualizado!" : "Processo criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("processes").update({ archived: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      queryClient.invalidateQueries({ queryKey: ["processes-stats"] });
      toast.success("Processo arquivado!");
    },
  });

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({ number: p.number, title: p.title, client_name: p.client_name, type: p.type, status: p.status, risk_level: p.risk_level || "low", court: p.court || "", judge: p.judge || "", notes: p.notes || "" });
    setDialogOpen(true);
  };

  const openView = (p: any) => { setSelectedProcess(p); setViewDialog(true); };

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display-lg">Processos</h1>
          <p className="text-body-sm text-muted-foreground mt-1">Gerencie todos os seus processos judiciais</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo Processo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar por título, número ou cliente..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="closed">Encerrado</SelectItem>
            <SelectItem value="suspended">Suspenso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <LexCard hover={false}>
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Carregando...</div>
        ) : !data?.items.length ? (
          <div className="py-12 text-center text-muted-foreground">Nenhum processo encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Número", "Título", "Cliente", "Tipo", "Status", "Risco", "Ações"].map((h) => (
                    <th key={h} className="text-left py-2.5 text-caption text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="py-3 font-mono text-caption">{p.number}</td>
                    <td className="py-3 font-medium">{p.title}</td>
                    <td className="py-3 text-muted-foreground">{p.client_name}</td>
                    <td className="py-3"><LexBadge variant="outline">{typeMap[p.type] || p.type}</LexBadge></td>
                    <td className="py-3">
                      <LexBadge variant={p.status === "active" ? "success" : p.status === "closed" ? "default" : "warning"}>
                        {statusMap[p.status] || p.status}
                      </LexBadge>
                    </td>
                    <td className="py-3"><RiskIndicator level={p.risk_level as any || "low"} /></td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openView(p)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => archiveMutation.mutate(p.id)}><Archive className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
            <p className="text-caption text-muted-foreground">{data?.count} processos • Página {page + 1} de {totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </LexCard>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Processo" : "Novo Processo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-label block mb-1">Número</label>
                <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="0000000-00.0000.0.00.0000" required />
              </div>
              <div>
                <label className="text-label block mb-1">Cliente</label>
                <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="text-label block mb-1">Título</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-label block mb-1">Tipo</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-label block mb-1">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-label block mb-1">Risco</label>
                <Select value={form.risk_level} onValueChange={(v) => setForm({ ...form, risk_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixo</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-label block mb-1">Vara/Tribunal</label><Input value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} /></div>
              <div><label className="text-label block mb-1">Juiz</label><Input value={form.judge} onChange={(e) => setForm({ ...form, judge: e.target.value })} /></div>
            </div>
            <div>
              <label className="text-label block mb-1">Observações</label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes do Processo</DialogTitle></DialogHeader>
          {selectedProcess && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-body-sm">
                <div><span className="text-caption text-muted-foreground block">Número</span><span className="font-mono">{selectedProcess.number}</span></div>
                <div><span className="text-caption text-muted-foreground block">Cliente</span>{selectedProcess.client_name}</div>
                <div><span className="text-caption text-muted-foreground block">Título</span>{selectedProcess.title}</div>
                <div><span className="text-caption text-muted-foreground block">Tipo</span>{typeMap[selectedProcess.type] || selectedProcess.type}</div>
                <div><span className="text-caption text-muted-foreground block">Status</span><LexBadge variant={selectedProcess.status === "active" ? "success" : "warning"}>{statusMap[selectedProcess.status]}</LexBadge></div>
                <div><span className="text-caption text-muted-foreground block">Risco</span><RiskIndicator level={selectedProcess.risk_level || "low"} /></div>
                {selectedProcess.court && <div><span className="text-caption text-muted-foreground block">Vara/Tribunal</span>{selectedProcess.court}</div>}
                {selectedProcess.judge && <div><span className="text-caption text-muted-foreground block">Juiz</span>{selectedProcess.judge}</div>}
              </div>
              {selectedProcess.notes && (
                <div><span className="text-caption text-muted-foreground block mb-1">Observações</span><p className="text-body-sm">{selectedProcess.notes}</p></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Processes;
