import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { RoleGuard } from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Plus, ScrollText, Scale, Users, Lightbulb, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const NORM_TYPES = [
  { value: "lei_federal", label: "Lei Federal" },
  { value: "lei_estadual", label: "Lei Estadual" },
  { value: "lei_municipal", label: "Lei Municipal" },
  { value: "decreto", label: "Decreto" },
  { value: "portaria", label: "Portaria" },
  { value: "resolucao", label: "Resolução" },
  { value: "instrucao_normativa", label: "Instrução Normativa" },
  { value: "norma_reguladora", label: "Norma Reguladora" },
];

const CHANGE_TYPES = [
  { value: "creation", label: "Criação" },
  { value: "revocation", label: "Revogação" },
  { value: "partial_change", label: "Alteração Parcial" },
  { value: "full_change", label: "Alteração Total" },
  { value: "deadline_change", label: "Mudança de Prazo" },
  { value: "penalty_change", label: "Mudança de Penalidade" },
];

const LEGAL_AREAS = ["Civil", "Consumidor", "Trabalhista", "Empresarial", "Tributário", "Administrativo", "Previdenciário", "Penal", "Ambiental", "Regulatório"];

const urgencyBadge = (u: string) => {
  const map: Record<string, { label: string; variant: "destructive" | "default" | "secondary" }> = {
    high: { label: "Alta", variant: "destructive" },
    medium: { label: "Média", variant: "default" },
    low: { label: "Baixa", variant: "secondary" },
  };
  const r = map[u] || map.medium;
  return <Badge variant={r.variant}>{r.label}</Badge>;
};

const LegislativeUpdates = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Form state
  const [normType, setNormType] = useState("lei_federal");
  const [normId, setNormId] = useState("");
  const [normTitle, setNormTitle] = useState("");
  const [changeType, setChangeType] = useState("creation");
  const [summary, setSummary] = useState("");
  const [oldText, setOldText] = useState("");
  const [newText, setNewText] = useState("");
  const [affectedAreas, setAffectedAreas] = useState<string[]>([]);
  const [urgency, setUrgency] = useState("medium");
  const [recommendations, setRecommendations] = useState("");

  const { data: updates, isLoading } = useQuery({
    queryKey: ["legislative-updates", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legislative_updates")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createUpdate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("legislative_updates").insert({
        organization_id: activeOrgId!,
        created_by: user!.id,
        norm_type: normType,
        norm_identifier: normId,
        norm_title: normTitle,
        change_type: changeType,
        summary,
        old_text: oldText || null,
        new_text: newText || null,
        affected_areas: affectedAreas,
        urgency,
        recommendations: recommendations || null,
      } as any);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "legislative_update_detected",
        user_id: user!.id,
        organization_id: activeOrgId,
        resource_type: "legislative_update",
        metadata: { norm_type: normType, norm_identifier: normId, change_type: changeType },
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legislative-updates"] });
      setOpen(false);
      setNormId("");
      setNormTitle("");
      setSummary("");
      setOldText("");
      setNewText("");
      setAffectedAreas([]);
      setRecommendations("");
      toast({ title: "Atualização legislativa registrada" });
    },
  });

  const toggleArea = (area: string) => {
    setAffectedAreas((prev) => prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]);
  };

  // Group updates by area for the impact tab
  const byArea: Record<string, any[]> = {};
  updates?.forEach((u: any) => {
    (u.affected_areas || []).forEach((area: string) => {
      if (!byArea[area]) byArea[area] = [];
      byArea[area].push(u);
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" /> Atualizações Legislativas
          </h1>
          <p className="text-muted-foreground">RF-062 — Monitore alterações em leis, decretos e normas</p>
        </div>
        <RoleGuard permissions={["MANAGE_LEGISLATIVE_UPDATES"]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Atualização</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Registrar Alteração Legislativa</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Select value={normType} onValueChange={setNormType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{NORM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={changeType} onValueChange={setChangeType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CHANGE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Input placeholder="Identificador (ex: Lei 14.133/2021)" value={normId} onChange={(e) => setNormId(e.target.value)} />
                <Input placeholder="Título da norma" value={normTitle} onChange={(e) => setNormTitle(e.target.value)} />
                <Textarea placeholder="Resumo da alteração" value={summary} onChange={(e) => setSummary(e.target.value)} />
                {(changeType === "partial_change" || changeType === "full_change") && (
                  <div className="grid grid-cols-2 gap-3">
                    <Textarea placeholder="Redação anterior" value={oldText} onChange={(e) => setOldText(e.target.value)} rows={3} />
                    <Textarea placeholder="Nova redação" value={newText} onChange={(e) => setNewText(e.target.value)} rows={3} />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-2">Áreas afetadas</p>
                  <div className="flex flex-wrap gap-2">
                    {LEGAL_AREAS.map((a) => (
                      <Badge key={a} variant={affectedAreas.includes(a) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleArea(a)}>
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger><SelectValue placeholder="Urgência" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea placeholder="Recomendações de adequação" value={recommendations} onChange={(e) => setRecommendations(e.target.value)} />
                <Button onClick={() => createUpdate.mutate()} disabled={!normId || !normTitle}>Registrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      <Tabs defaultValue="updates">
        <TabsList>
          <TabsTrigger value="updates">Atualizações</TabsTrigger>
          <TabsTrigger value="by-area">Impacto por Área</TabsTrigger>
          <TabsTrigger value="by-client">Impacto por Cliente</TabsTrigger>
          <TabsTrigger value="scenarios">Simulação de Cenários</TabsTrigger>
        </TabsList>

        <TabsContent value="updates">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Norma</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Alteração</TableHead>
                  <TableHead>Áreas</TableHead>
                  <TableHead>Urgência</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={6}>Carregando...</TableCell></TableRow>}
                {updates?.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div><p className="font-medium text-sm">{u.norm_title}</p><p className="text-xs text-muted-foreground">{u.norm_identifier}</p></div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{NORM_TYPES.find((t) => t.value === u.norm_type)?.label}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{CHANGE_TYPES.find((t) => t.value === u.change_type)?.label}</Badge></TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{(u.affected_areas || []).map((a: string) => <Badge key={a} variant="outline" className="text-xs">{a}</Badge>)}</div></TableCell>
                    <TableCell>{urgencyBadge(u.urgency)}</TableCell>
                    <TableCell className="text-sm">{format(new Date(u.created_at), "dd/MM/yyyy")}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && updates?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma atualização legislativa registrada.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="by-area">
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(byArea).length === 0 && (
              <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">Sem dados de impacto por área.</CardContent></Card>
            )}
            {Object.entries(byArea).map(([area, items]) => (
              <Card key={area}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" /> {area}
                    <Badge variant="outline">{items.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.slice(0, 5).map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{u.norm_title}</p>
                        <p className="text-xs text-muted-foreground">{CHANGE_TYPES.find((t) => t.value === u.change_type)?.label}</p>
                      </div>
                      {urgencyBadge(u.urgency)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="by-client">
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">A análise de impacto por cliente será gerada automaticamente pela IA ao correlacionar contratos e processos ativos com as alterações legislativas.</p>
              <p className="text-sm text-muted-foreground mt-2">Atualizações com clientes afetados aparecerão aqui.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scenarios">
          <Card>
            <CardContent className="py-8 text-center">
              <Lightbulb className="h-12 w-12 mx-auto text-secondary mb-3" />
              <p className="text-muted-foreground">A simulação de cenários avalia impactos jurídicos, operacionais e financeiros de alterações legislativas.</p>
              <p className="text-sm text-muted-foreground mt-2">Selecione uma atualização legislativa para gerar cenários com IA.</p>
              {updates && updates.length > 0 && (
                <div className="mt-4 space-y-2 max-w-md mx-auto">
                  {updates.slice(0, 3).map((u: any) => (
                    <Card key={u.id} className="text-left">
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{u.norm_title}</p>
                            <p className="text-xs text-muted-foreground">{u.norm_identifier}</p>
                          </div>
                          <Button size="sm" variant="outline" disabled>
                            <Lightbulb className="h-3 w-3 mr-1" /> Simular
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LegislativeUpdates;
