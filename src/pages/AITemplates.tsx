import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LexCard } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Brain, Plus, Search, History, Trash2, Pencil, Copy, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

const TEMPLATE_TYPES = [
  { value: "general", label: "Geral" },
  { value: "legal_piece", label: "Peças Jurídicas" },
  { value: "contract", label: "Contratos" },
  { value: "summary", label: "Resumos" },
  { value: "analysis", label: "Análises" },
  { value: "agent", label: "Agentes" },
  { value: "automation", label: "Automações" },
  { value: "communication", label: "Comunicações" },
];

const AITemplates = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [versionsDialogId, setVersionsDialogId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "", template_type: "general", content: "", description: "", is_active: true,
  });

  const resetForm = () => { setForm({ title: "", template_type: "general", content: "", description: "", is_active: true }); setEditId(null); };

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["ai-templates", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_templates" as any)
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["ai-template-versions", versionsDialogId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_template_versions" as any)
        .select("*")
        .eq("template_id", versionsDialogId!)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!versionsDialogId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      if (editId) {
        // Get current template to bump version
        const existing = templates.find((t: any) => t.id === editId);
        const newVersion = (existing?.version || 1) + 1;

        // Save version history
        await supabase.from("ai_template_versions" as any).insert({
          template_id: editId, version: existing?.version || 1,
          content: existing?.content || "", created_by: user!.id,
        });

        const { error } = await supabase.from("ai_templates" as any).update({
          title: values.title, template_type: values.template_type,
          content: values.content, description: values.description || null,
          is_active: values.is_active, version: newVersion, updated_by: user!.id,
        }).eq("id", editId);
        if (error) throw error;

        await supabase.from("audit_logs").insert({ action: "ai_template_updated", user_id: user!.id, organization_id: activeOrgId, resource_type: "ai_template", resource_id: editId, metadata: { version: newVersion } } as any);
      } else {
        const { data, error } = await supabase.from("ai_templates" as any).insert({
          organization_id: activeOrgId, title: values.title,
          template_type: values.template_type, content: values.content,
          description: values.description || null, is_active: values.is_active,
          created_by: user!.id,
        }).select("id").single();
        if (error) throw error;
        await supabase.from("audit_logs").insert({ action: "ai_template_created", user_id: user!.id, organization_id: activeOrgId, resource_type: "ai_template", resource_id: (data as any).id } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-templates"] });
      toast.success(editId ? "Template atualizado!" : "Template criado!");
      setOpen(false); resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_templates" as any).delete().eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "ai_template_deleted", user_id: user!.id, organization_id: activeOrgId, resource_type: "ai_template", resource_id: id } as any);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ai-templates"] }); toast.success("Template excluído."); },
  });

  const openEdit = (t: any) => {
    setForm({ title: t.title, template_type: t.template_type, content: t.content, description: t.description || "", is_active: t.is_active });
    setEditId(t.id); setOpen(true);
  };

  const filtered = useMemo(() => {
    return templates.filter((t: any) => {
      if (filterType !== "all" && t.template_type !== filterType) return false;
      if (search && !t.title?.toLowerCase().includes(search.toLowerCase()) && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [templates, filterType, search]);

  const canManage = hasPermission("MANAGE_AI_TEMPLATES");

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 border border-secondary/20">
              <Brain className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-secondary mb-0.5">Inteligência Artificial</p>
              <h1 className="text-2xl font-bold text-foreground">Templates de IA</h1>
            </div>
          </div>
          {canManage && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Template</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editId ? "Editar Template" : "Novo Template"}</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
                    <div>
                      <Label>Tipo</Label>
                      <Select value={form.template_type} onValueChange={(v) => setForm({ ...form, template_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TEMPLATE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descreva o propósito deste template" /></div>
                  <div>
                    <Label>Instruções para IA *</Label>
                    <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10} placeholder="Escreva as instruções que a IA deve seguir ao usar este template..." className="font-mono text-sm" required />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                    <Label>Template ativo</Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={saveMutation.isPending || !form.title || !form.content}>
                    {saveMutation.isPending ? "Salvando..." : editId ? "Atualizar (nova versão)" : "Criar Template"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </motion.div>

      {/* Filters */}
      <LexCard hover={false}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar templates..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TEMPLATE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </LexCard>

      {/* Templates grid */}
      {isLoading ? (
        <LexCard hover={false}><p className="text-center text-muted-foreground py-6">Carregando...</p></LexCard>
      ) : filtered.length === 0 ? (
        <LexCard hover={false}>
          <div className="text-center py-10 space-y-2">
            <Brain className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">Nenhum template encontrado.</p>
            {canManage && <p className="text-xs text-muted-foreground">Crie templates para personalizar o comportamento da IA.</p>}
          </div>
        </LexCard>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((t: any) => {
            const typeInfo = TEMPLATE_TYPES.find((tp) => tp.value === t.template_type);
            return (
              <LexCard key={t.id} className="hover:border-primary/30 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-foreground truncate">{t.title}</h3>
                        {t.is_active ? (
                          <LexBadge variant="success">Ativo</LexBadge>
                        ) : (
                          <LexBadge variant="outline">Inativo</LexBadge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{typeInfo?.label || t.template_type}</Badge>
                        <span className="text-xs text-muted-foreground">v{t.version}</span>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setVersionsDialogId(t.id)}><History className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Excluir template?")) deleteMutation.mutate(t.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                  <pre className="text-xs text-muted-foreground/70 bg-muted/30 rounded-lg p-3 max-h-24 overflow-hidden line-clamp-4 whitespace-pre-wrap font-mono">{t.content}</pre>
                  <p className="text-xs text-muted-foreground">Atualizado em {format(new Date(t.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
              </LexCard>
            );
          })}
        </div>
      )}

      {/* Versions Dialog */}
      <Dialog open={!!versionsDialogId} onOpenChange={(v) => { if (!v) setVersionsDialogId(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico de Versões</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma versão anterior.</p>
            ) : (
              versions.map((v: any) => (
                <div key={v.id} className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Versão {v.version}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(v.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-32 overflow-auto">{v.content}</pre>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AITemplates;
