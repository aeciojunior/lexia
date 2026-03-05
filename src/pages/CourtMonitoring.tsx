import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { RoleGuard } from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Eye, Bell, BarChart3, Gavel, Sparkles, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const LEGAL_AREAS = ["Civil", "Consumidor", "Trabalhista", "Empresarial", "Tributário", "Administrativo", "Previdenciário", "Penal", "Ambiental", "Regulatório"];
const COURTS = ["STF", "STJ", "TST", "TRF-1", "TRF-2", "TRF-3", "TRF-4", "TRF-5", "TRT-1", "TRT-2", "TRT-15", "TJSP", "TJRJ", "TJMG", "TJRS", "TJPR"];
const DEFAULT_THEMES = ["Responsabilidade civil", "Rescisão contratual", "Danos morais", "Ônus da prova", "Prescrição", "Tutela de urgência", "Temas repetitivos"];
const FREQUENCIES = [
  { value: "hourly", label: "A cada hora" },
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
];

const relevanceBadge = (level: string) => {
  const map: Record<string, { label: string; variant: "destructive" | "default" | "secondary" }> = {
    high: { label: "Alta", variant: "destructive" },
    medium: { label: "Média", variant: "default" },
    low: { label: "Baixa", variant: "secondary" },
  };
  const r = map[level] || map.medium;
  return <Badge variant={r.variant}>{r.label}</Badge>;
};

const CourtMonitoring = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const qc = useQueryClient();

  // Config form state
  const [configOpen, setConfigOpen] = useState(false);
  const [configName, setConfigName] = useState("");
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedCourts, setSelectedCourts] = useState<string[]>([]);
  const [frequency, setFrequency] = useState("daily");

  const { data: configs, isLoading: loadingConfigs } = useQuery({
    queryKey: ["court-monitoring-configs", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("court_monitoring_configs")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const { data: decisions, isLoading: loadingDecisions } = useQuery({
    queryKey: ["court-monitoring-decisions", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("court_monitoring_decisions")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createConfig = useMutation({
    mutationFn: async () => {
      const keywords = keywordsInput.split(",").map((k) => k.trim()).filter(Boolean);
      const { error } = await supabase.from("court_monitoring_configs").insert({
        organization_id: activeOrgId!,
        created_by: user!.id,
        name: configName,
        themes: selectedThemes,
        keywords,
        legal_areas: selectedAreas,
        courts: selectedCourts,
        frequency,
      } as any);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "court_monitoring_configured",
        user_id: user!.id,
        organization_id: activeOrgId,
        resource_type: "court_monitoring",
        metadata: { themes: selectedThemes, keywords, courts: selectedCourts },
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["court-monitoring-configs"] });
      setConfigOpen(false);
      setConfigName("");
      setSelectedThemes([]);
      setKeywordsInput("");
      setSelectedAreas([]);
      setSelectedCourts([]);
      toast({ title: "Monitoramento configurado" });
    },
  });

  const toggleConfig = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("court_monitoring_configs").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["court-monitoring-configs"] }),
  });

  const toggleChip = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const alerts = decisions?.filter((d: any) => d.relevance_level === "high" && !d.alert_sent) || [];
  const totalDecisions = decisions?.length || 0;
  const highRelevance = decisions?.filter((d: any) => d.relevance_level === "high").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Eye className="h-6 w-6 text-primary" /> Monitoramento de Tribunais
          </h1>
          <p className="text-muted-foreground">RF-060/061/064 — Monitore decisões, receba alertas e visualize tendências</p>
        </div>
        <RoleGuard permissions={["MANAGE_COURT_MONITORING"]}>
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Configuração</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Configurar Monitoramento</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Nome da configuração" value={configName} onChange={(e) => setConfigName(e.target.value)} />

                <div>
                  <p className="text-sm font-medium mb-2">Temas jurídicos</p>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_THEMES.map((t) => (
                      <Badge key={t} variant={selectedThemes.includes(t) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleChip(selectedThemes, t, setSelectedThemes)}>
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Palavras-chave (separadas por vírgula)</p>
                  <Input placeholder="inadimplemento, nulidade, cláusula abusiva" value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} />
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Áreas jurídicas</p>
                  <div className="flex flex-wrap gap-2">
                    {LEGAL_AREAS.map((a) => (
                      <Badge key={a} variant={selectedAreas.includes(a) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleChip(selectedAreas, a, setSelectedAreas)}>
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Tribunais</p>
                  <div className="flex flex-wrap gap-2">
                    {COURTS.map((c) => (
                      <Badge key={c} variant={selectedCourts.includes(c) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleChip(selectedCourts, c, setSelectedCourts)}>
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger><SelectValue placeholder="Frequência" /></SelectTrigger>
                  <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>

                <Button onClick={() => createConfig.mutate()} disabled={!configName || selectedCourts.length === 0}>
                  Salvar Configuração
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      <Tabs defaultValue="configs">
        <TabsList>
          <TabsTrigger value="configs">Configurações</TabsTrigger>
          <TabsTrigger value="decisions">Decisões ({totalDecisions})</TabsTrigger>
          <TabsTrigger value="alerts">Alertas ({alerts.length})</TabsTrigger>
          <TabsTrigger value="dashboard">Painel Estratégico</TabsTrigger>
        </TabsList>

        {/* CONFIGS TAB */}
        <TabsContent value="configs">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loadingConfigs && <p className="text-muted-foreground col-span-full">Carregando...</p>}
            {configs?.map((cfg: any) => (
              <Card key={cfg.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{cfg.name}</CardTitle>
                    <Switch checked={cfg.is_active} onCheckedChange={(v) => toggleConfig.mutate({ id: cfg.id, active: v })} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cfg.themes?.length > 0 && (
                    <div><p className="text-xs text-muted-foreground">Temas</p><div className="flex flex-wrap gap-1 mt-1">{cfg.themes.map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div></div>
                  )}
                  {cfg.keywords?.length > 0 && (
                    <div><p className="text-xs text-muted-foreground">Palavras-chave</p><div className="flex flex-wrap gap-1 mt-1">{cfg.keywords.map((k: string) => <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>)}</div></div>
                  )}
                  {cfg.courts?.length > 0 && (
                    <div><p className="text-xs text-muted-foreground">Tribunais</p><p className="text-xs">{cfg.courts.join(", ")}</p></div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                    <span>Frequência: {FREQUENCIES.find((f) => f.value === cfg.frequency)?.label}</span>
                    {cfg.last_run_at && <span>Última: {format(new Date(cfg.last_run_at), "dd/MM HH:mm")}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loadingConfigs && configs?.length === 0 && (
              <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">Nenhuma configuração de monitoramento. Clique em "Nova Configuração" para começar.</CardContent></Card>
            )}
          </div>
        </TabsContent>

        {/* DECISIONS TAB */}
        <TabsContent value="decisions">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tribunal</TableHead>
                  <TableHead>Decisão</TableHead>
                  <TableHead>Resumo</TableHead>
                  <TableHead>Relevância</TableHead>
                  <TableHead>Impacto</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingDecisions && <TableRow><TableCell colSpan={6}>Carregando...</TableCell></TableRow>}
                {decisions?.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell><Badge variant="outline">{d.tribunal}</Badge>{d.chamber && <span className="text-xs text-muted-foreground ml-1">{d.chamber}</span>}</TableCell>
                    <TableCell className="font-medium text-sm">{d.decision_number || "—"}</TableCell>
                    <TableCell className="max-w-xs"><p className="text-sm truncate">{d.summary || "Sem resumo"}</p></TableCell>
                    <TableCell>{relevanceBadge(d.relevance_level)}</TableCell>
                    <TableCell>{relevanceBadge(d.impact_level)}</TableCell>
                    <TableCell className="text-sm">{d.decision_date ? format(new Date(d.decision_date), "dd/MM/yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
                {!loadingDecisions && decisions?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma decisão monitorada ainda.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ALERTS TAB */}
        <TabsContent value="alerts">
          <div className="space-y-4">
            {alerts.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum alerta pendente.</CardContent></Card>}
            {alerts.map((a: any) => (
              <Card key={a.id} className="border-l-4 border-l-destructive">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-destructive" />
                        <span className="font-semibold">{a.tribunal} — {a.decision_number || "Decisão"}</span>
                        {relevanceBadge(a.relevance_level)}
                      </div>
                      {a.thesis && <p className="text-sm mt-1"><strong>Tese:</strong> {a.thesis}</p>}
                      {a.summary && <p className="text-sm text-muted-foreground mt-1">{a.summary}</p>}
                    </div>
                  </div>
                  {a.matched_themes?.length > 0 && (
                    <div className="flex flex-wrap gap-1">{a.matched_themes.map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
                  )}
                  {a.ai_recommendation && (
                    <div className="bg-muted/50 rounded-lg p-3 mt-2">
                      <p className="text-xs font-semibold flex items-center gap-1"><Sparkles className="h-3 w-3 text-secondary" /> Recomendação IA</p>
                      <p className="text-sm mt-1">{a.ai_recommendation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* STRATEGIC DASHBOARD TAB (RF-064) */}
        <TabsContent value="dashboard">
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card><CardContent className="pt-6 text-center"><Gavel className="h-8 w-8 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{totalDecisions}</p><p className="text-sm text-muted-foreground">Decisões Monitoradas</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" /><p className="text-2xl font-bold">{highRelevance}</p><p className="text-sm text-muted-foreground">Alta Relevância</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><TrendingUp className="h-8 w-8 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{decisions?.filter((d: any) => d.status === "favorable").length || 0}</p><p className="text-sm text-muted-foreground">Favoráveis</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><TrendingDown className="h-8 w-8 mx-auto text-destructive mb-2" /><p className="text-2xl font-bold">{decisions?.filter((d: any) => d.status === "unfavorable").length || 0}</p><p className="text-sm text-muted-foreground">Desfavoráveis</p></CardContent></Card>
          </div>

          {/* Trend by tribunal */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Distribuição por Tribunal</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const byTribunal: Record<string, number> = {};
                decisions?.forEach((d: any) => { byTribunal[d.tribunal] = (byTribunal[d.tribunal] || 0) + 1; });
                const entries = Object.entries(byTribunal).sort((a, b) => b[1] - a[1]);
                if (entries.length === 0) return <p className="text-muted-foreground text-sm">Sem dados para exibir.</p>;
                const max = entries[0][1];
                return (
                  <div className="space-y-2">
                    {entries.map(([tribunal, count]) => (
                      <div key={tribunal} className="flex items-center gap-3">
                        <span className="text-sm font-medium w-16">{tribunal}</span>
                        <div className="flex-1 bg-muted rounded-full h-3">
                          <div className="bg-primary rounded-full h-3 transition-all" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                        <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CourtMonitoring;
