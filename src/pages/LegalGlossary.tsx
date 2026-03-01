import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, BookText, Search, Pencil, Trash2, ArrowRightLeft } from "lucide-react";

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "processual", label: "Processual" },
  { value: "material", label: "Material" },
  { value: "trabalhista", label: "Trabalhista" },
  { value: "tributario", label: "Tributário" },
  { value: "civil", label: "Civil" },
  { value: "penal", label: "Penal" },
  { value: "constitucional", label: "Constitucional" },
  { value: "empresarial", label: "Empresarial" },
  { value: "administrativo", label: "Administrativo" },
];

export default function LegalGlossary() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [term, setTerm] = useState("");
  const [preferredTerm, setPreferredTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [category, setCategory] = useState("geral");

  const { data: glossary, isLoading } = useQuery({
    queryKey: ["legal-glossary", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_glossary" as any)
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("term");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!activeOrgId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!term.trim() || !preferredTerm.trim()) throw new Error("Termo e termo preferido são obrigatórios");

      if (editing) {
        const { error } = await supabase
          .from("legal_glossary" as any)
          .update({ term: term.trim(), preferred_term: preferredTerm.trim(), definition, category })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("legal_glossary" as any)
          .insert({
            organization_id: activeOrgId!,
            term: term.trim(),
            preferred_term: preferredTerm.trim(),
            definition,
            category,
            created_by: user!.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Termo atualizado" : "Termo adicionado" });
      queryClient.invalidateQueries({ queryKey: ["legal-glossary"] });
      resetForm();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("legal_glossary" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Termo removido" });
      queryClient.invalidateQueries({ queryKey: ["legal-glossary"] });
    },
  });

  const resetForm = () => {
    setTerm("");
    setPreferredTerm("");
    setDefinition("");
    setCategory("geral");
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (item: any) => {
    setTerm(item.term);
    setPreferredTerm(item.preferred_term);
    setDefinition(item.definition || "");
    setCategory(item.category || "geral");
    setEditing(item);
    setShowForm(true);
  };

  const filtered = glossary?.filter(
    (g) =>
      !search ||
      g.term.toLowerCase().includes(search.toLowerCase()) ||
      g.preferred_term.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookText className="h-6 w-6 text-primary" /> Glossário Jurídico
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Padronize a terminologia da sua organização para revisões com IA
          </p>
        </div>
        <Dialog open={showForm} onOpenChange={(o) => { if (!o) resetForm(); else setShowForm(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo Termo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Termo" : "Adicionar Termo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Termo (a ser substituído)</Label>
                <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Ex: ação de despejo" />
              </div>
              <div>
                <Label>Termo Preferido</Label>
                <Input value={preferredTerm} onChange={(e) => setPreferredTerm(e.target.value)} placeholder="Ex: ação de despejo por falta de pagamento" />
              </div>
              <div>
                <Label>Definição (opcional)</Label>
                <Textarea value={definition} onChange={(e) => setDefinition(e.target.value)} placeholder="Breve explicação do uso correto..." rows={3} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="w-full"
              >
                {editing ? "Salvar Alterações" : "Adicionar ao Glossário"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar termos..."
          className="pl-9"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <Badge variant="outline" className="text-xs">{glossary?.length || 0} termos</Badge>
        {CATEGORIES.filter((c) => glossary?.some((g) => g.category === c.value)).map((c) => (
          <Badge key={c.value} variant="secondary" className="text-xs">
            {c.label}: {glossary?.filter((g) => g.category === c.value).length}
          </Badge>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[calc(100vh-320px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Termo</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    <ArrowRightLeft className="h-3.5 w-3.5 inline mr-1" />
                    Termo Preferido
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))}
                {filtered?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">{item.term}</span>
                        {item.definition && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.definition}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-sm text-primary font-medium">{item.preferred_term}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="text-[10px]">
                        {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (!filtered || filtered.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      <BookText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum termo cadastrado</p>
                      <p className="text-xs">Adicione termos para padronizar a terminologia nas revisões</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
