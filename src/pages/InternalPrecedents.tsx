import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { RoleGuard } from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  BookOpen, Plus, Search, Scale, Tag, Eye, FileText,
  Lightbulb, Gavel, Shield, ScrollText, Trophy
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRECEDENT_TYPES = [
  { value: "piece", label: "Peça Jurídica", icon: FileText },
  { value: "argument", label: "Argumento", icon: Lightbulb },
  { value: "decision", label: "Decisão Favorável", icon: Gavel },
  { value: "strategy", label: "Estratégia", icon: Trophy },
  { value: "clause", label: "Cláusula Contratual", icon: Shield },
  { value: "analysis", label: "Análise Jurídica", icon: ScrollText },
];

const LEGAL_AREAS = [
  "Civil", "Criminal", "Trabalhista", "Tributário", "Administrativo",
  "Constitucional", "Empresarial", "Ambiental", "Consumidor", "Outro",
];

export default function InternalPrecedents() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [form, setForm] = useState({
    title: "", description: "", precedent_type: "piece", legal_area: "", tribunal: "",
    result_obtained: "", context: "", relevant_excerpts: "", recommendations: "", limitations: "", tags: "",
  });

  // Audit on access
  useEffect(() => {
    if (user && activeOrgId) {
      supabase.from("audit_logs").insert({
        action: "internal_precedent_accessed", user_id: user.id,
        organization_id: activeOrgId, resource_type: "internal_precedent",
      } as any).then(() => {});
    }
  }, [user, activeOrgId]);

  const { data: precedents = [], isLoading } = useQuery({
    queryKey: ["internal-precedents", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("internal_precedents" as any)
        .select("*").eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!activeOrgId,
  });

  const createPrecedent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("internal_precedents" as any).insert({
        organization_id: activeOrgId!, created_by: user!.id,
        title: form.title, description: form.description || null,
        precedent_type: form.precedent_type, legal_area: form.legal_area || null,
        tribunal: form.tribunal || null, result_obtained: form.result_obtained || null,
        context: form.context || null, relevant_excerpts: form.relevant_excerpts || null,
        recommendations: form.recommendations || null, limitations: form.limitations || null,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      } as any);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "internal_precedent_created", user_id: user!.id,
        organization_id: activeOrgId!, resource_type: "internal_precedent",
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-precedents"] });
      setOpen(false);
      setForm({ title: "", description: "", precedent_type: "piece", legal_area: "", tribunal: "", result_obtained: "", context: "", relevant_excerpts: "", recommendations: "", limitations: "", tags: "" });
      toast({ title: "Precedente interno criado" });
    },
    onError: () => toast({ title: "Erro ao criar precedente", variant: "destructive" }),
  });

  const filtered = useMemo(() => precedents.filter((p: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q)
      || (p.description || "").toLowerCase().includes(q)
      || (p.tags || []).some((t: string) => t.toLowerCase().includes(q));
    const matchType = typeFilter === "all" || p.precedent_type === typeFilter;
    const matchArea = areaFilter === "all" || p.legal_area === areaFilter;
    return matchSearch && matchType && matchArea;
  }), [precedents, search, typeFilter, areaFilter]);

  // KPI summaries
  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    precedents.forEach((p: any) => { map[p.precedent_type] = (map[p.precedent_type] || 0) + 1; });
    return map;
  }, [precedents]);

  const areaCounts = useMemo(() => {
    const map: Record<string, number> = {};
    precedents.forEach((p: any) => {
      if (p.legal_area) map[p.legal_area] = (map[p.legal_area] || 0) + 1;
    });
    return map;
  }, [precedents]);

  const topArea = useMemo(() => {
    const entries = Object.entries(areaCounts);
    if (entries.length === 0) return "—";
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }, [areaCounts]);

  const getTypeInfo = (value: string) => PRECEDENT_TYPES.find(t => t.value === value) || PRECEDENT_TYPES[0];

  const handleViewDetail = (item: any) => {
    setDetailItem(item);
    // Audit: precedent used/viewed
    if (user && activeOrgId) {
      supabase.from("audit_logs").insert({
        action: "internal_precedent_used", user_id: user.id,
        organization_id: activeOrgId, resource_type: "internal_precedent",
        resource_id: item.id,
      } as any).then(() => {});
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Precedentes Internos</h1>
            <p className="text-sm text-muted-foreground">RF-068 — Repositório de peças, argumentos e estratégias vencedoras</p>
          </div>
        </div>
        <RoleGuard permissions={["MANAGE_INTERNAL_PRECEDENTS"]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Novo Precedente</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Criar Precedente Interno</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={form.precedent_type} onValueChange={v => setForm(f => ({ ...f, precedent_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PRECEDENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Área do Direito</Label>
                    <Select value={form.legal_area} onValueChange={v => setForm(f => ({ ...f, legal_area: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{LEGAL_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Tribunal</Label><Input value={form.tribunal} onChange={e => setForm(f => ({ ...f, tribunal: e.target.value }))} placeholder="Ex: TJSP" /></div>
                  <div><Label>Resultado Obtido</Label><Input value={form.result_obtained} onChange={e => setForm(f => ({ ...f, result_obtained: e.target.value }))} placeholder="Ex: Provido" /></div>
                </div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
                <div><Label>Contexto do Caso</Label><Textarea value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} rows={3} /></div>
                <div><Label>Trechos Relevantes</Label><Textarea value={form.relevant_excerpts} onChange={e => setForm(f => ({ ...f, relevant_excerpts: e.target.value }))} rows={3} /></div>
                <div><Label>Recomendações de Uso</Label><Textarea value={form.recommendations} onChange={e => setForm(f => ({ ...f, recommendations: e.target.value }))} rows={2} /></div>
                <div><Label>Limitações</Label><Textarea value={form.limitations} onChange={e => setForm(f => ({ ...f, limitations: e.target.value }))} rows={2} /></div>
                <div><Label>Tags (separadas por vírgula)</Label><Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="Ex: rescisão, dano moral, consumidor" /></div>
                <Button onClick={() => createPrecedent.mutate()} disabled={!form.title || createPrecedent.isPending} className="w-full">Criar Precedente</Button>
              </div>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Total de Precedentes</p>
            <p className="text-2xl font-bold mt-1">{precedents.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-secondary">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Tipos Cadastrados</p>
            <p className="text-2xl font-bold mt-1">{Object.keys(typeCounts).length}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(typeCounts).slice(0, 3).map(([type, count]) => (
                <Badge key={type} variant="outline" className="text-[10px]">{getTypeInfo(type).label}: {count}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-accent">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Áreas Cobertas</p>
            <p className="text-2xl font-bold mt-1">{Object.keys(areaCounts).length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-muted-foreground">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Área mais Frequente</p>
            <p className="text-lg font-bold mt-1">{topArea}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por título, descrição ou tag..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {PRECEDENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            {LEGAL_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      {search || typeFilter !== "all" || areaFilter !== "all" ? (
        <p className="text-xs text-muted-foreground">{filtered.length} resultado(s) encontrado(s)</p>
      ) : null}

      {/* List */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Nenhum precedente encontrado</p>
          <p className="text-xs text-muted-foreground">Crie precedentes para construir a inteligência reutilizável do escritório.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((p: any) => {
            const typeInfo = getTypeInfo(p.precedent_type);
            const TypeIcon = typeInfo.icon;
            return (
              <Card key={p.id} className="hover:border-primary/30 transition-colors cursor-pointer group" onClick={() => handleViewDetail(p)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <TypeIcon className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-semibold text-sm truncate">{p.title}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{typeInfo.label}</Badge>
                      <Eye className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {p.legal_area && <Badge variant="secondary" className="text-[10px]"><Scale className="h-3 w-3 mr-1" />{p.legal_area}</Badge>}
                    {p.tribunal && <Badge variant="outline" className="text-[10px]">{p.tribunal}</Badge>}
                    {p.result_obtained && <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">{p.result_obtained}</Badge>}
                  </div>
                  {p.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.tags.slice(0, 5).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-[10px]"><Tag className="h-2.5 w-2.5 mr-0.5" />{t}</Badge>
                      ))}
                      {p.tags.length > 5 && <Badge variant="outline" className="text-[10px]">+{p.tags.length - 5}</Badge>}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">{format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={v => !v && setDetailItem(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailItem && (() => {
            const typeInfo = getTypeInfo(detailItem.precedent_type);
            const TypeIcon = typeInfo.icon;
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TypeIcon className="h-4 w-4 text-primary" />
                    </div>
                    <DialogTitle>{detailItem.title}</DialogTitle>
                  </div>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Meta badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{typeInfo.label}</Badge>
                    {detailItem.legal_area && <Badge variant="secondary">{detailItem.legal_area}</Badge>}
                    {detailItem.tribunal && <Badge variant="outline">{detailItem.tribunal}</Badge>}
                    {detailItem.result_obtained && <Badge className="bg-primary/10 text-primary border-primary/20">{detailItem.result_obtained}</Badge>}
                    <Badge variant="outline" className="text-[10px]">{format(new Date(detailItem.created_at), "dd/MM/yyyy", { locale: ptBR })}</Badge>
                  </div>

                  {detailItem.description && (
                    <Section label="Descrição" text={detailItem.description} />
                  )}
                  {detailItem.context && (
                    <Section label="Contexto do Caso" text={detailItem.context} />
                  )}
                  {detailItem.relevant_excerpts && (
                    <Section label="Trechos Relevantes" text={detailItem.relevant_excerpts} />
                  )}
                  {detailItem.recommendations && (
                    <Section label="Recomendações de Uso" text={detailItem.recommendations} />
                  )}
                  {detailItem.limitations && (
                    <Section label="Limitações" text={detailItem.limitations} />
                  )}

                  {detailItem.tags?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {detailItem.tags.map((t: string) => (
                          <Badge key={t} variant="outline" className="text-xs"><Tag className="h-3 w-3 mr-1" />{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
      <div className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">{text}</div>
    </div>
  );
}
