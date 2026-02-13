import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { LexCard } from "@/components/lexia/LexCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Search, FileText, Edit, Trash2, Copy, Clock, Eye, BookTemplate } from "lucide-react";

const TEMPLATE_CATEGORIES = [
  { value: "petition", label: "Petição" },
  { value: "contract", label: "Contrato" },
  { value: "opinion", label: "Parecer" },
  { value: "notification", label: "Notificação" },
  { value: "minutes", label: "Minuta" },
  { value: "internal", label: "Interno" },
  { value: "other", label: "Outro" },
];

const DocumentTemplates = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission, isIntern, isClient } = usePermissions();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  const [form, setForm] = useState({ title: "", category: "other", content: "", tags: "" });

  const resetForm = () => { setForm({ title: "", category: "other", content: "", tags: "" }); setEditId(null); };

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["document-templates", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_templates" as any)
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["template-versions", selectedTemplate?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_template_versions" as any)
        .select("*")
        .eq("template_id", selectedTemplate!.id)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!selectedTemplate?.id && viewOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const tagsArray = values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
      if (editId) {
        // Save version before updating
        const current = templates.find((t: any) => t.id === editId);
        if (current) {
          await supabase.from("document_template_versions" as any).insert({
            template_id: editId,
            version: current.version,
            content: current.content,
            created_by: user!.id,
          });
        }
        const { error } = await supabase.from("document_templates" as any).update({
          title: values.title,
          category: values.category,
          content: values.content,
          tags: tagsArray,
          updated_by: user!.id,
          version: (current?.version || 0) + 1,
        }).eq("id", editId);
        if (error) throw error;
        await supabase.from("audit_logs").insert({ action: "template_updated", user_id: user!.id, organization_id: activeOrgId, resource_type: "template", resource_id: editId } as any);
      } else {
        const { data, error } = await supabase.from("document_templates" as any).insert({
          organization_id: activeOrgId,
          title: values.title,
          category: values.category,
          content: values.content,
          tags: tagsArray,
          created_by: user!.id,
        }).select("id").single();
        if (error) throw error;
        await supabase.from("audit_logs").insert({ action: "template_created", user_id: user!.id, organization_id: activeOrgId, resource_type: "template", resource_id: (data as any).id } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success(editId ? "Modelo atualizado (nova versão criada)!" : "Modelo criado!");
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("document_templates" as any).delete().eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "template_deleted", user_id: user!.id, organization_id: activeOrgId, resource_type: "template", resource_id: id } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success("Modelo excluído.");
    },
  });

  const openEdit = (t: any) => {
    setForm({ title: t.title, category: t.category, content: t.content, tags: (t.tags || []).join(", ") });
    setEditId(t.id);
    setOpen(true);
  };

  const duplicateTemplate = (t: any) => {
    setForm({ title: `${t.title} (cópia)`, category: t.category, content: t.content, tags: (t.tags || []).join(", ") });
    setEditId(null);
    setOpen(true);
  };

  const filtered = useMemo(() => {
    return templates.filter((t: any) => {
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!t.title?.toLowerCase().includes(s) && !t.content?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [templates, filterCategory, search]);

  const canCreate = hasPermission("MANAGE_DOCUMENTS") && !isIntern && !isClient;
  const canDelete = hasPermission("MANAGE_DOCUMENTS") && !isIntern && !isClient;

  if (isClient) return <p className="text-muted-foreground text-center py-8">Acesso não autorizado.</p>;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <BookTemplate className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-primary mb-0.5">Gestão</p>
            <h1 className="text-2xl font-bold text-foreground">Modelos de Documentos</h1>
          </div>
        </div>
        {canCreate && (
          <Button className="gap-2" onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo Modelo
          </Button>
        )}
      </div>

      {/* Filters */}
      <LexCard hover={false}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar modelos por título ou conteúdo..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {TEMPLATE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </LexCard>

      {/* Templates grid */}
      {isLoading ? (
        <LexCard hover={false}>
          <p className="text-muted-foreground text-center py-6">Carregando modelos...</p>
        </LexCard>
      ) : filtered.length === 0 ? (
        <LexCard hover={false}>
          <div className="text-center py-10 space-y-2">
            <BookTemplate className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">Nenhum modelo encontrado.</p>
            {canCreate && <p className="text-xs text-muted-foreground">Clique em "Novo Modelo" para criar.</p>}
          </div>
        </LexCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t: any) => {
            const catInfo = TEMPLATE_CATEGORIES.find((c) => c.value === t.category);
            return (
              <LexCard key={t.id} className="cursor-pointer" onClick={() => { setSelectedTemplate(t); setViewOpen(true); }}>
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{t.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{catInfo?.label || t.category}</Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> v{t.version}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.content?.slice(0, 120)}...</p>
                  {t.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.tags.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-[9px]">{tag}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(t.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedTemplate(t); setViewOpen(true); }}><Eye className="h-3.5 w-3.5" /></Button>
                      {canCreate && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Edit className="h-3.5 w-3.5" /></Button>}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateTemplate(t)}><Copy className="h-3.5 w-3.5" /></Button>
                      {canDelete && <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => deleteMutation.mutate(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </div>
                </div>
              </LexCard>
            );
          })}
        </div>
      )}

      {/* View/Versions Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.title || "Modelo"}</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <Tabs defaultValue="content">
              <TabsList>
                <TabsTrigger value="content">Conteúdo (v{selectedTemplate.version})</TabsTrigger>
                <TabsTrigger value="versions">Histórico de Versões</TabsTrigger>
              </TabsList>
              <TabsContent value="content" className="mt-4">
                <div className="rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto font-mono">
                  {selectedTemplate.content || "Sem conteúdo."}
                </div>
                <div className="flex gap-2 mt-4">
                  {canCreate && <Button size="sm" onClick={() => { openEdit(selectedTemplate); setViewOpen(false); }}>Editar</Button>}
                  <Button size="sm" variant="outline" onClick={() => { duplicateTemplate(selectedTemplate); setViewOpen(false); }}>Duplicar</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    navigator.clipboard.writeText(selectedTemplate.content || "");
                    toast.success("Conteúdo copiado!");
                  }}>Copiar conteúdo</Button>
                </div>
              </TabsContent>
              <TabsContent value="versions" className="mt-4">
                {versions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 text-sm">Nenhuma versão anterior.</p>
                ) : (
                  <div className="space-y-3">
                    {versions.map((v: any) => (
                      <div key={v.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Versão {v.version}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(v.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">{v.content?.slice(0, 300)}...</p>
                        <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => {
                          navigator.clipboard.writeText(v.content || "");
                          toast.success("Versão copiada!");
                        }}>Copiar esta versão</Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Modelo" : "Novo Modelo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="contrato, civil, urgente..." />
            </div>
            <div>
              <Label>Conteúdo do Modelo *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={12}
                required
                className="font-mono text-sm"
                placeholder="Digite o conteúdo do modelo... Use {{variável}} para placeholders."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending || !form.title || !form.content}>
                {saveMutation.isPending ? "Salvando..." : editId ? "Atualizar (nova versão)" : "Criar Modelo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentTemplates;
