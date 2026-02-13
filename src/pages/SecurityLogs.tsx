import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, Search, AlertTriangle, Info, AlertOctagon, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const SEVERITY_CONFIG: Record<string, { icon: any; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  info: { icon: Info, variant: "outline", color: "text-blue-400" },
  warning: { icon: AlertTriangle, variant: "secondary", color: "text-yellow-400" },
  error: { icon: AlertOctagon, variant: "destructive", color: "text-destructive" },
  critical: { icon: ShieldAlert, variant: "destructive", color: "text-red-500" },
};

const SecurityLogs = () => {
  const { activeOrgId } = useOrganization();
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["security-events", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_events")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["security-alerts", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_alerts")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const filtered = events.filter(e => {
    if (severityFilter !== "all" && e.severity !== severityFilter) return false;
    if (search && !e.description?.toLowerCase().includes(search.toLowerCase()) && !e.event_type.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openAlerts = alerts.filter(a => a.status === "open").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Logs de Segurança</h1>
          <p className="text-muted-foreground">Monitoramento de eventos e alertas de segurança (SIEM)</p>
        </div>
        {openAlerts > 0 && <Badge variant="destructive" className="text-sm">{openAlerts} alerta(s) aberto(s)</Badge>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Eventos", value: events.length, icon: Info, color: "text-primary" },
          { label: "Anomalias", value: events.filter(e => e.is_anomaly).length, icon: AlertTriangle, color: "text-yellow-400" },
          { label: "Alertas Abertos", value: openAlerts, icon: ShieldAlert, color: "text-destructive" },
          { label: "Resolvidos", value: alerts.filter(a => a.status === "resolved").length, icon: CheckCircle, color: "text-accent" },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <c.icon className={`h-8 w-8 ${c.color}`} />
              <div><p className="text-2xl font-bold">{c.value}</p><p className="text-xs text-muted-foreground">{c.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="alerts">Alertas ({openAlerts})</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar eventos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Severidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? <p className="text-muted-foreground">Carregando...</p> :
            filtered.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum evento encontrado</p></CardContent></Card>
            ) : (
              <div className="space-y-2">
                {filtered.map(e => {
                  const cfg = SEVERITY_CONFIG[e.severity] || SEVERITY_CONFIG.info;
                  const Icon = cfg.icon;
                  return (
                    <Card key={e.id} className={e.is_anomaly ? "border-destructive/40" : ""}>
                      <CardContent className="p-4 flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{e.event_type}</span>
                            <Badge variant={cfg.variant} className="text-xs">{e.severity}</Badge>
                            {e.is_anomaly && <Badge variant="destructive" className="text-xs">Anomalia</Badge>}
                            <span className="text-xs text-muted-foreground ml-auto">{format(new Date(e.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}</span>
                          </div>
                          {e.description && <p className="text-sm text-muted-foreground mt-1">{e.description}</p>}
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                            {e.source && <span>Fonte: {e.source}</span>}
                            {e.ip_address && <span>IP: {e.ip_address}</span>}
                            {e.resource_type && <span>Recurso: {e.resource_type}</span>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )
          }
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {alerts.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><CheckCircle className="h-12 w-12 mx-auto text-accent mb-4" /><p className="text-muted-foreground">Nenhum alerta</p></CardContent></Card>
          ) : (
            alerts.map(a => (
              <Card key={a.id} className={a.status === "open" ? "border-destructive/40" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-5 w-5 ${a.status === "open" ? "text-destructive" : "text-muted-foreground"}`} />
                      <CardTitle className="text-base">{a.title}</CardTitle>
                      <Badge variant={a.status === "open" ? "destructive" : "outline"}>{a.status}</Badge>
                      <Badge variant="outline">{a.severity}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                </CardHeader>
                {a.description && <CardContent><p className="text-sm text-muted-foreground">{a.description}</p></CardContent>}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityLogs;
