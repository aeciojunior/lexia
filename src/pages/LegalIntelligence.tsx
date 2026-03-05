import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Brain, AlertTriangle, Scale, ScrollText, ShieldCheck,
  CalendarDays, TrendingUp, Users, Gavel, Building2
} from "lucide-react";
import { format, subMonths, startOfMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Legend
} from "recharts";

export default function LegalIntelligence() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();

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

  // --- Data queries ---
  const { data: risks = [] } = useQuery({
    queryKey: ["li-risks", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("risks")
        .select("id, title, severity, status, category, created_at")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: decisions = [] } = useQuery({
    queryKey: ["li-decisions", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("court_monitoring_decisions")
        .select("id, tribunal, decision_number, summary, relevance_level, impact_level, decision_date, matched_themes, created_at")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false }).limit(30);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: legislativeUpdates = [] } = useQuery({
    queryKey: ["li-legislative", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("legislative_updates")
        .select("id, title, law_type, status, impact_level, published_at, legal_areas, created_at")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: regulatoryUpdates = [] } = useQuery({
    queryKey: ["li-regulatory", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("regulatory_updates")
        .select("id, agency, norm_title, urgency, change_type, created_at")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ["li-processes", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("processes")
        .select("id, title, number, status, type, priority, legal_area, client_id, created_at")
        .eq("archived", false).limit(100);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: upcomingDeadlines = [] } = useQuery({
    queryKey: ["li-deadlines", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("deadlines")
        .select("id, title, due_date, priority, status, created_at")
        .eq("status", "pending")
        .gte("due_date", new Date().toISOString().split("T")[0])
        .order("due_date").limit(15);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["li-clients", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("clients")
        .select("id, full_name")
        .eq("organization_id", activeOrgId!)
        .eq("status", "active").limit(50);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  // --- Computed KPIs ---
  const openRisks = risks.filter((r: any) => r.status === "open");
  const highRisks = openRisks.filter((r: any) => r.severity === "critical" || r.severity === "high");
  const medRisks = openRisks.filter((r: any) => r.severity === "medium");
  const lowRisks = openRisks.filter((r: any) => r.severity === "low");

  // Risk Index: weighted score (critical=4, high=3, medium=2, low=1)
  const riskIndex = useMemo(() => {
    const weights: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const total = openRisks.reduce((s: number, r: any) => s + (weights[r.severity] || 1), 0);
    const max = openRisks.length * 4;
    if (max === 0) return "Baixo";
    const pct = total / max;
    if (pct >= 0.7) return "Alto";
    if (pct >= 0.4) return "Médio";
    return "Baixo";
  }, [openRisks]);

  // Favorability rate: high-impact favorable decisions vs total
  const favorabilityRate = useMemo(() => {
    if (decisions.length === 0) return "—";
    const favorable = decisions.filter((d: any) => d.relevance_level === "high" && d.impact_level !== "high").length;
    return `${Math.round((favorable / decisions.length) * 100)}%`;
  }, [decisions]);

  const criticalProcessCount = processes.filter((p: any) => p.priority === "urgent" || p.priority === "high").length;

  const recentLegislativeCount = legislativeUpdates.length + regulatoryUpdates.length;

  // --- Chart Data ---

  // 1. Radar: Risks by legal area (from processes with risks category match)
  const radarData = useMemo(() => {
    const areaMap: Record<string, number> = {};
    const areaLabels: Record<string, string> = {
      civil: "Cível", criminal: "Criminal", labor: "Trabalhista",
      tax: "Tributário", administrative: "Administrativo", corporate: "Societário",
    };
    openRisks.forEach((r: any) => {
      const cat = r.category || "outros";
      const label = areaLabels[cat] || cat;
      areaMap[label] = (areaMap[label] || 0) + 1;
    });
    // Also count from processes by legal_area
    processes.forEach((p: any) => {
      if (p.legal_area) {
        const label = areaLabels[p.legal_area] || p.legal_area;
        areaMap[label] = (areaMap[label] || 0);
      }
    });
    return Object.entries(areaMap).map(([area, count]) => ({ area, riscos: count }));
  }, [openRisks, processes]);

  // 2. Line chart: Monthly trend (last 6 months) — decisions + risks
  const trendData = useMemo(() => {
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = startOfMonth(subMonths(new Date(), i));
      const end = startOfMonth(subMonths(new Date(), i - 1));
      months.push({ label: format(start, "MMM/yy", { locale: ptBR }), start, end });
    }
    return months.map(m => {
      const dCount = decisions.filter((d: any) => {
        const dt = new Date(d.created_at);
        return dt >= m.start && dt < m.end;
      }).length;
      const rCount = risks.filter((r: any) => {
        const dt = new Date(r.created_at);
        return dt >= m.start && dt < m.end;
      }).length;
      return { mes: m.label, decisões: dCount, riscos: rCount };
    });
  }, [decisions, risks]);

  // 3. Bar chart: Decisions by tribunal
  const tribunalData = useMemo(() => {
    const map: Record<string, number> = {};
    decisions.forEach((d: any) => {
      const t = d.tribunal || "Outro";
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tribunal, total]) => ({ tribunal, total }));
  }, [decisions]);

  // 4. Timeline events: merge decisions, legislative, regulatory, deadlines
  const timelineEvents = useMemo(() => {
    const events: { date: string; type: string; title: string; badge: string; badgeVariant: string }[] = [];
    decisions.slice(0, 5).forEach((d: any) => events.push({
      date: d.decision_date || d.created_at, type: "Decisão",
      title: d.summary?.slice(0, 80) || d.decision_number || "Decisão",
      badge: d.impact_level, badgeVariant: d.impact_level === "high" ? "destructive" : "secondary",
    }));
    legislativeUpdates.slice(0, 5).forEach((l: any) => events.push({
      date: l.published_at || l.created_at, type: "Legislação",
      title: l.title,
      badge: l.impact_level, badgeVariant: l.impact_level === "high" ? "destructive" : "secondary",
    }));
    regulatoryUpdates.slice(0, 3).forEach((r: any) => events.push({
      date: r.created_at, type: "Regulatório",
      title: r.norm_title,
      badge: r.urgency, badgeVariant: r.urgency === "high" ? "destructive" : "secondary",
    }));
    upcomingDeadlines.slice(0, 3).forEach((d: any) => events.push({
      date: d.due_date, type: "Prazo",
      title: d.title,
      badge: d.priority, badgeVariant: d.priority === "high" || d.priority === "urgent" ? "destructive" : "secondary",
    }));
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [decisions, legislativeUpdates, regulatoryUpdates, upcomingDeadlines]);

  // Tab views
  const processesByClient = useMemo(() => {
    const map: Record<string, { name: string; count: number; critical: number }> = {};
    const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c.full_name]));
    processes.forEach((p: any) => {
      if (!p.client_id) return;
      const name = clientMap[p.client_id] || p.client_id;
      if (!map[p.client_id]) map[p.client_id] = { name, count: 0, critical: 0 };
      map[p.client_id].count++;
      if (p.priority === "urgent" || p.priority === "high") map[p.client_id].critical++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [processes, clients]);

  const processesByArea = useMemo(() => {
    const areaLabels: Record<string, string> = {
      civil: "Cível", criminal: "Criminal", labor: "Trabalhista",
      tax: "Tributário", administrative: "Administrativo", corporate: "Societário",
    };
    const map: Record<string, { count: number; critical: number }> = {};
    processes.forEach((p: any) => {
      const area = areaLabels[p.legal_area] || p.legal_area || "Não definida";
      if (!map[area]) map[area] = { count: 0, critical: 0 };
      map[area].count++;
      if (p.priority === "urgent" || p.priority === "high") map[area].critical++;
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [processes]);

  const processesByTribunal = useMemo(() => {
    const map: Record<string, number> = {};
    decisions.forEach((d: any) => {
      const t = d.tribunal || "Outro";
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [decisions]);

  const riskColor = (level: string) =>
    level === "Alto" ? "text-destructive" : level === "Médio" ? "text-amber-500" : "text-emerald-500";
  const severityColor = (s: string) => s === "critical" || s === "high" ? "destructive" : s === "medium" ? "default" : "secondary";
  const impactColor = (l: string) => l === "high" ? "destructive" : l === "medium" ? "default" : "secondary";

  return (
    <div className="space-y-6">
      {/* Header */}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Índice de Risco Geral</p>
                <p className={`text-2xl font-bold mt-1 ${riskColor(riskIndex)}`}>{riskIndex}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive/30" />
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="destructive" className="text-[10px]">{highRisks.length} alto</Badge>
              <Badge variant="default" className="text-[10px]">{medRisks.length} médio</Badge>
              <Badge variant="secondary" className="text-[10px]">{lowRisks.length} baixo</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Taxa de Favorabilidade</p>
                <p className="text-2xl font-bold mt-1 text-primary">{favorabilityRate}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary/30" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Baseado em {decisions.length} decisões recentes</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Processos Críticos</p>
                <p className="text-2xl font-bold mt-1">{criticalProcessCount}</p>
              </div>
              <Scale className="h-8 w-8 text-amber-500/30" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Prioridade alta/urgente de {processes.length} ativos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-secondary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Alterações Legislativas</p>
                <p className="text-2xl font-bold mt-1">{recentLegislativeCount}</p>
              </div>
              <ScrollText className="h-8 w-8 text-secondary/30" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">{legislativeUpdates.length} legis. + {regulatoryUpdates.length} regulat.</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar: Risks by Area */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Riscos por Área Jurídica
            </CardTitle>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="area" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Radar name="Riscos" dataKey="riscos" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados de risco por área.</p>
            )}
          </CardContent>
        </Card>

        {/* Line: Monthly Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Tendência Mensal (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="decisões" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="riscos" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar: Decisions by Tribunal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Decisões por Tribunal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tribunalData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={tribunalData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="tribunal" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={120} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem decisões por tribunal.</p>
            )}
          </CardContent>
        </Card>

        {/* Timeline of Events */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Timeline de Eventos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[280px] overflow-y-auto pr-2">
            {timelineEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Nenhum evento recente.</p>
            ) : (
              <div className="relative border-l-2 border-border pl-4 space-y-4">
                {timelineEvents.map((ev, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[22px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className="text-[10px]">{ev.type}</Badge>
                      <Badge variant={ev.badgeVariant as any} className="text-[10px]">{ev.badge}</Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {ev.date ? format(new Date(ev.date), "dd/MM/yy", { locale: ptBR }) : "—"}
                      </span>
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{ev.title}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Views */}
      <Tabs defaultValue="alerts">
        <TabsList className="flex-wrap">
          <TabsTrigger value="alerts" className="gap-1"><CalendarDays className="h-3 w-3" />Alertas</TabsTrigger>
          <TabsTrigger value="byClient" className="gap-1"><Users className="h-3 w-3" />Por Cliente</TabsTrigger>
          <TabsTrigger value="byArea" className="gap-1"><Scale className="h-3 w-3" />Por Área</TabsTrigger>
          <TabsTrigger value="byTribunal" className="gap-1"><Gavel className="h-3 w-3" />Por Tribunal</TabsTrigger>
        </TabsList>

        {/* Alerts */}
        <TabsContent value="alerts" className="space-y-3 mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {/* Recent Decisions */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1"><Gavel className="h-4 w-4" />Decisões Relevantes</h3>
              {decisions.slice(0, 5).map((d: any) => (
                <Card key={d.id}><CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">{d.tribunal}</Badge>
                    <Badge variant={impactColor(d.impact_level) as any} className="text-[10px]">{d.impact_level}</Badge>
                  </div>
                  <p className="text-xs line-clamp-2">{d.summary || d.decision_number}</p>
                </CardContent></Card>
              ))}
              {decisions.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma decisão.</p>}
            </div>

            {/* Critical Deadlines */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1"><CalendarDays className="h-4 w-4" />Prazos Críticos</h3>
              {upcomingDeadlines.slice(0, 5).map((d: any) => (
                <Card key={d.id}><CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">{d.title}</p>
                    <Badge variant={d.priority === "high" || d.priority === "urgent" ? "destructive" : "secondary"} className="text-[10px] mt-1">{d.priority}</Badge>
                  </div>
                  <span className="text-xs font-medium">{format(new Date(d.due_date), "dd/MM", { locale: ptBR })}</span>
                </CardContent></Card>
              ))}
              {upcomingDeadlines.length === 0 && <p className="text-xs text-muted-foreground">Nenhum prazo próximo.</p>}
            </div>

            {/* Legislative */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1"><ScrollText className="h-4 w-4" />Alterações Legislativas</h3>
              {legislativeUpdates.slice(0, 4).map((l: any) => (
                <Card key={l.id}><CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium line-clamp-1">{l.title}</p>
                    <Badge variant={impactColor(l.impact_level) as any} className="text-[10px] mt-1">{l.impact_level}</Badge>
                  </div>
                  {l.published_at && <span className="text-[10px] text-muted-foreground">{format(new Date(l.published_at), "dd/MM", { locale: ptBR })}</span>}
                </CardContent></Card>
              ))}
              {legislativeUpdates.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma atualização.</p>}
            </div>

            {/* Regulatory */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1"><ShieldCheck className="h-4 w-4" />Alterações Regulatórias</h3>
              {regulatoryUpdates.slice(0, 4).map((r: any) => (
                <Card key={r.id}><CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium line-clamp-1">{r.norm_title}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">{r.agency}</Badge>
                  </div>
                  <Badge variant={r.urgency === "high" ? "destructive" : "secondary"} className="text-[10px]">{r.urgency}</Badge>
                </CardContent></Card>
              ))}
              {regulatoryUpdates.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma atualização.</p>}
            </div>
          </div>
        </TabsContent>

        {/* By Client */}
        <TabsContent value="byClient" className="mt-4">
          <div className="space-y-3">
            {processesByClient.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum processo vinculado a clientes.</p>
            ) : processesByClient.slice(0, 15).map((c, i) => (
              <Card key={i}><CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.count} processos</p>
                  </div>
                </div>
                {c.critical > 0 && <Badge variant="destructive">{c.critical} críticos</Badge>}
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>

        {/* By Area */}
        <TabsContent value="byArea" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {processesByArea.map(([area, data]) => (
              <Card key={area}><CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">{area}</p>
                  <Badge variant="outline">{data.count} processos</Badge>
                </div>
                {data.critical > 0 && <Badge variant="destructive" className="text-[10px]">{data.critical} críticos</Badge>}
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min((data.count / Math.max(processes.length, 1)) * 100, 100)}%` }} />
                </div>
              </CardContent></Card>
            ))}
            {processesByArea.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhum dado por área.</p>}
          </div>
        </TabsContent>

        {/* By Tribunal */}
        <TabsContent value="byTribunal" className="mt-4">
          <div className="space-y-3">
            {processesByTribunal.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma decisão por tribunal.</p>
            ) : processesByTribunal.map(([tribunal, count]) => (
              <Card key={tribunal}><CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{tribunal}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min((count / Math.max(decisions.length, 1)) * 100, 100)}%` }} />
                  </div>
                  <Badge variant="outline">{count}</Badge>
                </div>
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
