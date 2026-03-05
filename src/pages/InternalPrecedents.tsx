import { useState } from "react";
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
import { BookOpen, Plus, Search, Scale, Tag } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRECEDENT_TYPES = [
  { value: "piece", label: "Peça Jurídica" },
  { value: "argument", label: "Argumento" },
  { value: "decision", label: "Decisão Favorável" },
  { value: "strategy", label: "Estratégia" },
  { value: "clause", label: "Cláusula Contratual" },
  { value: "analysis", label: "Análise Jurídica" },
];

const LEGAL_AREAS = [
  "Civil", "Criminal", "Trabalhista", "Tributário", "Administrativo", "Constitucional", "Empresarial", "Ambiental", "Consumidor", "Outro",
];

export default function InternalPrecedents() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [form, setForm] = useState({
    title: "", description: "", precedent_type: "piece", legal_area: "", tribunal: "",
    result_obtained: "", context: "", relevant_excerpts: "", recommendations: "", limitations: "", tags: "",
  });

  const { data: precedents = [], isLoading } = useQuery({
    queryKey: ["internal-precedents", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("internal_precedents" as any).select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!activeOrgId,
  });

  const createPrecedent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("internal_precedents" as any).insert({
        organization_id: activeOrgId!,
        created_by: user!.id,
        title: form.title,
        description: form.description || null,
        precedent_type: form.precedent_type,
        legal_area: form.legal_area || null,
        tribunal: form.tribunal || null,
        result_obtained: form.result_obtained || null,
        context: form.context || null,
        relevant_excerpts: form.relevant_excerpts || null,
        recommendations: form.recommendations || null,
        limitations: form.limitations || null,
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

  const filtered = precedents.filter((p: any) => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || (p.description || "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || p.precedent_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
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
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div><Label>Contexto do Caso</Label><Textarea value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} /></div>
                <div><Label>Trechos Relevantes</Label><Textarea value={form.relevant_excerpts} onChange={e => setForm(f => ({ ...f, relevant_excerpts: e.target.value }))} /></div>
                <div><Label>Recomendações de Uso</Label><Textarea value={form.recommendations} onChange={e => setForm(f => ({ ...f, recommendations: e.target.value }))} /></div>
                <div><Label>Limitações</Label><Textarea value={form.limitations} onChange={e => setForm(f => ({ ...f, limitations: e.target.value }))} /></div>
                <div><Label>Tags (separadas por vírgula)</Label><Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} /></div>
                <Button onClick={() => createPrecedent.mutate()} disabled={!form.title || createPrecedent.isPending} className="w-full">Criar Precedente</Button>
              </div>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar precedentes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {PRECEDENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Nenhum precedente encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((p: any) => (
            <Card key={p.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{p.title}</h3>
                  <Badge variant="outline">{PRECEDENT_TYPES.find(t => t.value === p.precedent_type)?.label}</Badge>
                </div>
                {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {p.legal_area && <Badge variant="secondary"><Scale className="h-3 w-3 mr-1" />{p.legal_area}</Badge>}
                  {p.tribunal && <Badge variant="outline">{p.tribunal}</Badge>}
                  {p.result_obtained && <Badge variant="default">{p.result_obtained}</Badge>}
                </div>
                {p.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">{p.tags.map((t: string) => <Badge key={t} variant="outline" className="text-xs"><Tag className="h-3 w-3 mr-1" />{t}</Badge>)}</div>
                )}
                <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
