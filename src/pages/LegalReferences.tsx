import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { LexPageHeader } from "@/components/lexia/LexPageHeader";
import { LexCard } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Plus, Star, StarOff, Trash2, Edit, BookOpen, Scale, FolderOpen,
  ChevronLeft, ChevronRight, ExternalLink, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PAGE_SIZE = 12;

const referenceTypeMap: Record<string, string> = {
  jurisprudence: "Jurisprudência",
  legislation: "Legislação",
  doctrine: "Doutrina",
  precedent: "Súmula",
  article: "Artigo",
  other: "Outro",
};

const categoryOptions = [
  "Direito Civil", "Direito Penal", "Direito Trabalhista", "Direito Tributário",
  "Direito Constitucional", "Direito Administrativo", "Direito Empresarial",
  "Direito do Consumidor", "Direito Ambiental", "Outro",
];

const LegalReferences = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission, isIntern } = usePermissions();
  const queryClient = useQueryClient();
  const canManage = hasPermission("MANAGE_PROCESSES") && !isIntern;

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [editingRef, setEditingRef] = useState<any>(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedRef, setSelectedRef] = useState<any>(null);

  // Form state
  const [form, setForm] = useState({
    title: "", reference_type: "jurisprudence", category: "", court: "",
    source: "", content: "", notes: "", folder: "", tags: "",
    decision_date: "",
  });

  const resetForm = () => {
    setForm({ title: "", reference_type: "jurisprudence", category: "", court: "", source: "", content: "", notes: "", folder: "", tags: "", decision_date: "" });
    setEditingRef(null);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["legal-references", search, typeFilter, categoryFilter, favoritesOnly, page],
    queryFn: async () => {
      let q = supabase
        .from("legal_references")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (typeFilter !== "all") q = q.eq("reference_type", typeFilter);
      if (categoryFilter !== "all") q = q.eq("category", categoryFilter);
      if (favoritesOnly) q = q.eq("is_favorite", true);
      if (search) q = q.or(`title.ilike.%${search}%,court.ilike.%${search}%,source.ilike.%${search}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { items: data || [], count: count || 0 };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !activeOrgId) throw new Error("Sem sessão");
      const payload = {
        title: form.title,
        reference_type: form.reference_type,
        category: form.category || null,
        court: form.court || null,
        source: form.source || null,
        content: form.content || null,
        notes: form.notes || null,
        folder: form.folder || null,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        decision_date: form.decision_date || null,
        user_id: user.id,
        organization_id: activeOrgId,
      };
      if (editingRef) {
        const { error } = await supabase.from("legal_references").update(payload).eq("id", editingRef.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("legal_references").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-references"] });
      setDialog(false);
      resetForm();
      toast.success(editingRef ? "Referência atualizada!" : "Referência criada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("legal_references").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-references"] });
      toast.success("Referência excluída!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleFavorite = useMutation({
    mutationFn: async (ref: any) => {
      const { error } = await supabase.from("legal_references").update({ is_favorite: !ref.is_favorite }).eq("id", ref.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["legal-references"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (ref: any) => {
    setForm({
      title: ref.title, reference_type: ref.reference_type, category: ref.category || "",
      court: ref.court || "", source: ref.source || "", content: ref.content || "",
      notes: ref.notes || "", folder: ref.folder || "", tags: (ref.tags || []).join(", "),
      decision_date: ref.decision_date || "",
    });
    setEditingRef(ref);
    setDialog(true);
  };

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <LexPageHeader
        overline="Pesquisa"
        title="Biblioteca Jurídica"
        description="Jurisprudência, legislação, doutrina e referências"
        actions={
          canManage ? (
            <Button variant="hero" onClick={() => { resetForm(); setDialog(true); }}>
              <Plus className="h-4 w-4" /> Nova Referência
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10 h-11 rounded-xl bg-muted border-border" placeholder="Buscar referência..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40 h-11 rounded-xl bg-muted border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Tipos</SelectItem>
            {Object.entries(referenceTypeMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48 h-11 rounded-xl bg-muted border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Áreas</SelectItem>
            {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={favoritesOnly ? "default" : "outline"} size="sm" className="h-11 rounded-xl" onClick={() => { setFavoritesOnly(!favoritesOnly); setPage(0); }}>
          <Star className="h-4 w-4" /> Favoritos
        </Button>
      </motion.div>

      {/* Grid */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="flex gap-1.5 justify-center mb-3">
              <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
              <span className="h-2.5 w-2.5 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
              <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" style={{ animationDelay: "400ms" }} />
            </div>
            <p className="text-body-sm text-muted-foreground">Carregando referências...</p>
          </div>
        ) : !data?.items.length ? (
          <LexCard hover={false}>
            <div className="py-16 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-body-sm text-muted-foreground mb-3">Nenhuma referência encontrada.</p>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => { resetForm(); setDialog(true); }}>
                  Adicionar primeira referência
                </Button>
              )}
            </div>
          </LexCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((ref: any, i: number) => (
              <motion.div key={ref.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.3 }}>
                <LexCard variant="default" className="flex flex-col h-full group">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                      <Scale className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm font-medium line-clamp-2">{ref.title}</p>
                      {ref.court && <p className="text-caption text-muted-foreground truncate">{ref.court}</p>}
                    </div>
                    {canManage && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => toggleFavorite.mutate(ref)}>
                        {ref.is_favorite ? <Star className="h-4 w-4 text-warning fill-warning" /> : <StarOff className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <LexBadge variant="default">{referenceTypeMap[ref.reference_type] || ref.reference_type}</LexBadge>
                    {ref.category && <LexBadge variant="outline" className="truncate max-w-[140px]">{ref.category}</LexBadge>}
                    {ref.folder && <LexBadge variant="info" className="truncate max-w-[100px]">{ref.folder}</LexBadge>}
                  </div>

                  {ref.content && <p className="text-caption text-muted-foreground line-clamp-3 mb-3">{ref.content}</p>}

                  {ref.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {ref.tags.slice(0, 4).map((t: string) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{t}</span>
                      ))}
                      {ref.tags.length > 4 && <span className="text-[10px] text-muted-foreground">+{ref.tags.length - 4}</span>}
                    </div>
                  )}

                  <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between">
                    <p className="text-caption text-muted-foreground">
                      {ref.decision_date ? new Date(ref.decision_date).toLocaleDateString("pt-BR") : new Date(ref.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-normal">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => { setSelectedRef(ref); setViewDialog(true); }}><ExternalLink className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => { navigator.clipboard.writeText(ref.content || ref.title); toast.success("Copiado!"); }}><Copy className="h-3.5 w-3.5" /></Button>
                      {canManage && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openEdit(ref)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:text-destructive" onClick={() => deleteMutation.mutate(ref.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </>
                      )}
                    </div>
                  </div>
                </LexCard>
              </motion.div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4">
            <p className="text-caption text-muted-foreground">{data?.count} referências • Página {page + 1}/{totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">{editingRef ? "Editar Referência" : "Nova Referência"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Título *</label>
              <Input className="bg-muted border-border rounded-xl" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título da referência..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Tipo</label>
                <Select value={form.reference_type} onValueChange={(v) => setForm({ ...form, reference_type: v })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(referenceTypeMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Área do Direito</label>
                <Select value={form.category || "none"} onValueChange={(v) => setForm({ ...form, category: v === "none" ? "" : v })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Tribunal / Órgão</label>
                <Input className="bg-muted border-border rounded-xl" value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} placeholder="STF, STJ, TRF..." />
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Data Decisão</label>
                <Input type="date" className="bg-muted border-border rounded-xl" value={form.decision_date} onChange={(e) => setForm({ ...form, decision_date: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Fonte / Link</label>
              <Input className="bg-muted border-border rounded-xl" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="URL ou referência..." />
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Conteúdo / Ementa</label>
              <Textarea className="bg-muted border-border rounded-xl" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Texto da ementa, artigo ou trecho relevante..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Pasta</label>
                <Input className="bg-muted border-border rounded-xl" value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })} placeholder="Organização..." />
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Tags (separadas por vírgula)</label>
                <Input className="bg-muted border-border rounded-xl" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tag1, tag2..." />
              </div>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Notas Internas</label>
              <Textarea className="bg-muted border-border rounded-xl" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anotações..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.title || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editingRef ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Detalhes da Referência</DialogTitle></DialogHeader>
          {selectedRef && (
            <div className="space-y-4 text-body-sm max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><span className="text-overline text-muted-foreground block mb-0.5">Título</span><span className="font-medium">{selectedRef.title}</span></div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Tipo</span><LexBadge>{referenceTypeMap[selectedRef.reference_type]}</LexBadge></div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Área</span>{selectedRef.category || "—"}</div>
                {selectedRef.court && <div><span className="text-overline text-muted-foreground block mb-0.5">Tribunal</span>{selectedRef.court}</div>}
                {selectedRef.decision_date && <div><span className="text-overline text-muted-foreground block mb-0.5">Data Decisão</span>{new Date(selectedRef.decision_date).toLocaleDateString("pt-BR")}</div>}
                {selectedRef.source && (
                  <div className="col-span-2"><span className="text-overline text-muted-foreground block mb-0.5">Fonte</span>
                    {selectedRef.source.startsWith("http") ? <a href={selectedRef.source} target="_blank" rel="noopener noreferrer" className="text-primary underline">{selectedRef.source}</a> : selectedRef.source}
                  </div>
                )}
              </div>
              {selectedRef.content && <div><span className="text-overline text-muted-foreground block mb-1">Conteúdo</span><p className="rounded-xl bg-muted p-3 whitespace-pre-wrap">{selectedRef.content}</p></div>}
              {selectedRef.notes && <div><span className="text-overline text-muted-foreground block mb-1">Notas</span><p className="rounded-xl bg-muted p-3">{selectedRef.notes}</p></div>}
              {selectedRef.tags?.length > 0 && (
                <div><span className="text-overline text-muted-foreground block mb-1">Tags</span>
                  <div className="flex flex-wrap gap-1">{selectedRef.tags.map((t: string) => <LexBadge key={t} variant="outline">{t}</LexBadge>)}</div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(selectedRef.content || selectedRef.title); toast.success("Copiado!"); }}><Copy className="h-4 w-4" /> Copiar</Button>
                {canManage && <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => { deleteMutation.mutate(selectedRef.id); setViewDialog(false); }}><Trash2 className="h-4 w-4" /> Excluir</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LegalReferences;
