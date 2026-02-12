import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { LexCard } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Plus, RefreshCcw, Trash2, Eye, Link2, Unlink, Building2,
  ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Clock, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PAGE_SIZE = 10;

const courtSystemMap: Record<string, string> = {
  pje: "PJe",
  esaj: "e-SAJ",
  projudi: "PROJUDI",
  eproc: "e-Proc",
  tucujuris: "Tucujuris",
  other: "Outro",
};

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "success" },
  syncing: { label: "Sincronizando", variant: "warning" },
  error: { label: "Erro", variant: "destructive" },
  inactive: { label: "Inativo", variant: "outline" },
};

const CourtIntegrations = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [systemFilter, setSystemFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedInteg, setSelectedInteg] = useState<any>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState({
    process_id: "none",
    court_system: "pje",
    court_process_id: "",
  });

  const resetForm = () => setForm({ process_id: "none", court_system: "pje", court_process_id: "" });

  // Fetch integrations
  const { data, isLoading } = useQuery({
    queryKey: ["court-integrations", search, systemFilter, page],
    queryFn: async () => {
      let q = supabase
        .from("court_integrations")
        .select("*, processes(title, number)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (systemFilter !== "all") q = q.eq("court_system", systemFilter);
      if (search) q = q.or(`court_process_id.ilike.%${search}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { items: data || [], count: count || 0 };
    },
  });

  // Fetch processes for linking
  const { data: processes = [] } = useQuery({
    queryKey: ["processes-for-court"],
    queryFn: async () => {
      const { data, error } = await supabase.from("processes").select("id, title, number").eq("archived", false).order("number");
      if (error) throw error;
      return data;
    },
  });

  // Create integration
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user || !activeOrgId || form.process_id === "none") throw new Error("Selecione um processo");
      const { error } = await supabase.from("court_integrations").insert({
        organization_id: activeOrgId,
        process_id: form.process_id,
        court_system: form.court_system,
        court_process_id: form.court_process_id || null,
        status: "active",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["court-integrations"] });
      setDialog(false);
      resetForm();
      toast.success("Integração criada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete integration
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("court_integrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["court-integrations"] });
      toast.success("Integração removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Sync (call edge function)
  const handleSync = async (integ: any) => {
    setSyncingId(integ.id);
    try {
      // Update status to syncing
      await supabase.from("court_integrations").update({ status: "syncing" } as any).eq("id", integ.id);

      const { data, error } = await supabase.functions.invoke("court-sync", {
        body: { integration_id: integ.id },
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["court-integrations"] });
      toast.success(`Sincronização concluída! ${data?.movements_found || 0} movimentações encontradas.`);
    } catch (err: any) {
      await supabase.from("court_integrations").update({ status: "error" } as any).eq("id", integ.id);
      queryClient.invalidateQueries({ queryKey: ["court-integrations"] });
      toast.error("Erro na sincronização: " + (err.message || "Tente novamente"));
    } finally {
      setSyncingId(null);
    }
  };

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-overline text-primary mb-1">Integrações</p>
          <h1 className="text-display-lg">Tribunais</h1>
          <p className="text-body-sm text-muted-foreground mt-1">Consulta automática ao PJe e sincronização de movimentações</p>
        </div>
        {isAdmin && (
          <Button variant="hero" onClick={() => { resetForm(); setDialog(true); }}>
            <Plus className="h-4 w-4" /> Nova Integração
          </Button>
        )}
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10 h-11 rounded-xl bg-muted border-border" placeholder="Buscar por número do processo no tribunal..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={systemFilter} onValueChange={(v) => { setSystemFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36 h-11 rounded-xl bg-muted border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Sistemas</SelectItem>
            {Object.entries(courtSystemMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      {/* List */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="flex gap-1.5 justify-center mb-3">
              <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
              <span className="h-2.5 w-2.5 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
              <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" style={{ animationDelay: "400ms" }} />
            </div>
            <p className="text-body-sm text-muted-foreground">Carregando integrações...</p>
          </div>
        ) : !data?.items.length ? (
          <LexCard hover={false}>
            <div className="py-16 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-body-sm text-muted-foreground mb-3">Nenhuma integração com tribunal configurada.</p>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => { resetForm(); setDialog(true); }}>
                  Configurar primeira integração
                </Button>
              )}
            </div>
          </LexCard>
        ) : (
          <div className="space-y-3">
            {data.items.map((integ: any, i: number) => {
              const process = integ.processes as any;
              const st = statusMap[integ.status] || statusMap.inactive;
              const isSyncing = syncingId === integ.id || integ.status === "syncing";

              return (
                <motion.div key={integ.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <LexCard variant="default" className="group">
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Icon */}
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-body-sm font-medium">{process?.number || "—"}</p>
                          <LexBadge variant={st.variant}>{st.label}</LexBadge>
                          <LexBadge variant="outline">{courtSystemMap[integ.court_system]}</LexBadge>
                        </div>
                        <p className="text-caption text-muted-foreground">{process?.title || "Processo vinculado"}</p>
                        {integ.court_process_id && (
                          <p className="text-caption text-muted-foreground/70 mt-0.5 font-mono">ID Tribunal: {integ.court_process_id}</p>
                        )}
                      </div>

                      {/* Sync info */}
                      <div className="text-right shrink-0">
                        <p className="text-caption text-muted-foreground">
                          {integ.last_sync_at ? `Última sync: ${new Date(integ.last_sync_at).toLocaleString("pt-BR")}` : "Nunca sincronizado"}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1.5 shrink-0">
                        <Button variant="outline" size="sm" className="rounded-lg gap-1.5" disabled={isSyncing} onClick={() => handleSync(integ)}>
                          {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                          {isSyncing ? "Sincronizando..." : "Sincronizar"}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setSelectedInteg(integ); setViewDialog(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-destructive" onClick={() => deleteMutation.mutate(integ.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </LexCard>
                </motion.div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4">
            <p className="text-caption text-muted-foreground">{data?.count} integrações • Página {page + 1}/{totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Create Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Nova Integração com Tribunal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Processo *</label>
              <Select value={form.process_id} onValueChange={(v) => setForm({ ...form, process_id: v })}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Selecione um processo</SelectItem>
                  {processes.map((p) => <SelectItem key={p.id} value={p.id}>{p.number} — {p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Sistema do Tribunal</label>
              <Select value={form.court_system} onValueChange={(v) => setForm({ ...form, court_system: v })}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(courtSystemMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">ID do Processo no Tribunal (opcional)</label>
              <Input className="bg-muted border-border rounded-xl" value={form.court_process_id} onChange={(e) => setForm({ ...form, court_process_id: e.target.value })} placeholder="Número ou ID no sistema do tribunal..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={form.process_id === "none" || createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Integração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Detalhes da Integração</DialogTitle></DialogHeader>
          {selectedInteg && (
            <div className="space-y-4 text-body-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-overline text-muted-foreground block mb-0.5">Sistema</span>
                  <LexBadge>{courtSystemMap[selectedInteg.court_system]}</LexBadge>
                </div>
                <div>
                  <span className="text-overline text-muted-foreground block mb-0.5">Status</span>
                  <LexBadge variant={statusMap[selectedInteg.status]?.variant || "outline"}>
                    {statusMap[selectedInteg.status]?.label || selectedInteg.status}
                  </LexBadge>
                </div>
                {selectedInteg.processes && (
                  <div className="col-span-2">
                    <span className="text-overline text-muted-foreground block mb-0.5">Processo Vinculado</span>
                    <span className="font-medium">{selectedInteg.processes.number} — {selectedInteg.processes.title}</span>
                  </div>
                )}
                {selectedInteg.court_process_id && (
                  <div className="col-span-2">
                    <span className="text-overline text-muted-foreground block mb-0.5">ID no Tribunal</span>
                    <span className="font-mono">{selectedInteg.court_process_id}</span>
                  </div>
                )}
                <div>
                  <span className="text-overline text-muted-foreground block mb-0.5">Criado em</span>
                  {new Date(selectedInteg.created_at).toLocaleString("pt-BR")}
                </div>
                <div>
                  <span className="text-overline text-muted-foreground block mb-0.5">Última Sincronização</span>
                  {selectedInteg.last_sync_at ? new Date(selectedInteg.last_sync_at).toLocaleString("pt-BR") : "Nunca"}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => { handleSync(selectedInteg); setViewDialog(false); }}>
                  <RefreshCcw className="h-4 w-4" /> Sincronizar Agora
                </Button>
                {isAdmin && (
                  <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => { deleteMutation.mutate(selectedInteg.id); setViewDialog(false); }}>
                    <Trash2 className="h-4 w-4" /> Remover
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CourtIntegrations;
