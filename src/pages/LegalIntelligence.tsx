import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, AlertTriangle, Scale, ScrollText, ShieldCheck, CalendarDays, TrendingUp, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function LegalIntelligence() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();

  // Audit on access
  useEffect(() => {
    if (user && activeOrgId) {
      supabase.from("audit_logs").insert({
        action: "legal_intelligence_dashboard_accessed",
        user_id: user.id,
        organization_id: activeOrgId,
        resource_type: "legal_intelligence",
      } as any).then(() => {});
    }
  }, [user, activeOrgId]);

  const { data: risks = [] } = useQuery({
    queryKey: ["li-risks", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("risks").select("id, title, severity, status, category").eq("organization_id", activeOrgId!).order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: decisions = [] } = useQuery({
    queryKey: ["li-decisions", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("court_monitoring_decisions").select("id, tribunal, decision_number, summary, relevance_level, impact_level, decision_date, matched_themes").eq("organization_id", activeOrgId!).order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: legislativeUpdates = [] } = useQuery({
    queryKey: ["li-legislative", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("legislative_updates").select("id, title, law_type, status, impact_level, published_at").eq("organization_id", activeOrgId!).order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: regulatoryUpdates = [] } = useQuery({
    queryKey: ["li-regulatory", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("regulatory_updates").select("id, agency, norm_title, urgency, change_type, created_at").eq("organization_id", activeOrgId!).order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: criticalProcesses = [] } = useQuery({
    queryKey: ["li-processes", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("processes").select("id, title, number, status, type, priority").eq("archived", false).limit(10);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: upcomingDeadlines = [] } = useQuery({
    queryKey: ["li-deadlines", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("deadlines").select("id, title, due_date, priority, status").eq("status", "pending").gte("due_date", new Date().toISOString().split("T")[0]).order("due_date").limit(10);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const riskByLevel = risks.reduce((acc: Record<string, number>, r: any) => {
    acc[r.severity] = (acc[r.severity] || 0) + 1;
    return acc;
  }, {});

  const severityColor = (s: string) => s === "critical" || s === "high" ? "destructive" : s === "medium" ? "default" : "secondary";
  const impactColor = (l: string) => l === "high" ? "destructive" : l === "medium" ? "default" : "secondary";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inteligência Jurídica</h1>
          <p className="text-sm text-muted-foreground">RF-066 — Painel consolidado de informações estratégicas</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { icon: AlertTriangle, label: "Riscos Ativos", value: risks.filter((r: any) => r.status === "open").length, color: "text-destructive" },
          { icon: Scale, label: "Decisões Recentes", value: decisions.length, color: "text-primary" },
          { icon: ScrollText, label: "Atualizações Legis.", value: legislativeUpdates.length, color: "text-primary" },
          { icon: ShieldCheck, label: "Atualizações Reg.", value: regulatoryUpdates.length, color: "text-primary" },
          { icon: Scale, label: "Processos Críticos", value: criticalProcesses.length, color: "text-destructive" },
          { icon: CalendarDays, label: "Prazos Próximos", value: upcomingDeadlines.length, color: "text-warning" },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-bold">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risk Summary */}
      {Object.keys(riskByLevel).length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Índice de Risco por Nível</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(riskByLevel).map(([level, count]) => (
                <div key={level} className="flex items-center gap-2">
                  <Badge variant={severityColor(level) as any}>{level}</Badge>
                  <span className="font-bold">{count as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="decisions">
        <TabsList className="flex-wrap">
          <TabsTrigger value="decisions">Decisões ({decisions.length})</TabsTrigger>
          <TabsTrigger value="legislative">Legislação ({legislativeUpdates.length})</TabsTrigger>
          <TabsTrigger value="regulatory">Regulatório ({regulatoryUpdates.length})</TabsTrigger>
          <TabsTrigger value="processes">Processos Críticos ({criticalProcesses.length})</TabsTrigger>
          <TabsTrigger value="deadlines">Prazos ({upcomingDeadlines.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="decisions" className="space-y-3 mt-4">
          {decisions.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhuma decisão recente.</p> : decisions.map((d: any) => (
            <Card key={d.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{d.tribunal}</Badge>
                    {d.decision_number && <span className="text-sm font-medium">{d.decision_number}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={impactColor(d.impact_level) as any}>{d.impact_level}</Badge>
                    <Badge variant={d.relevance_level === "high" ? "destructive" : "secondary"}>{d.relevance_level}</Badge>
                  </div>
                </div>
                {d.summary && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{d.summary}</p>}
                {d.matched_themes?.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">{d.matched_themes.map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="legislative" className="space-y-3 mt-4">
          {legislativeUpdates.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhuma atualização legislativa.</p> : legislativeUpdates.map((l: any) => (
            <Card key={l.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{l.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{l.law_type}</Badge>
                    <Badge variant={impactColor(l.impact_level) as any}>{l.impact_level}</Badge>
                  </div>
                </div>
                {l.published_at && <span className="text-xs text-muted-foreground">{format(new Date(l.published_at), "dd/MM/yyyy", { locale: ptBR })}</span>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="regulatory" className="space-y-3 mt-4">
          {regulatoryUpdates.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhuma atualização regulatória.</p> : regulatoryUpdates.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{r.norm_title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{r.agency}</Badge>
                    <Badge variant={r.urgency === "high" ? "destructive" : "secondary"}>{r.urgency}</Badge>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="processes" className="space-y-3 mt-4">
          {criticalProcesses.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhum processo crítico.</p> : criticalProcesses.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{p.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {p.number && <Badge variant="outline">{p.number}</Badge>}
                    <Badge variant={p.priority === "urgent" ? "destructive" : "default"}>{p.priority}</Badge>
                    <Badge variant="secondary">{p.type}</Badge>
                  </div>
                </div>
                <Badge>{p.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="deadlines" className="space-y-3 mt-4">
          {upcomingDeadlines.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhum prazo próximo.</p> : upcomingDeadlines.map((d: any) => (
            <Card key={d.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{d.title}</p>
                  <Badge variant={d.priority === "high" ? "destructive" : "secondary"} className="mt-1">{d.priority}</Badge>
                </div>
                <span className="text-sm font-medium">{format(new Date(d.due_date), "dd/MM/yyyy", { locale: ptBR })}</span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
