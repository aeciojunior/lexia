import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Scale, AlertTriangle } from "lucide-react";

export default function CaseClustering() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();

  useEffect(() => {
    if (user && activeOrgId) {
      supabase.from("audit_logs").insert({
        action: "case_cluster_identified", user_id: user.id,
        organization_id: activeOrgId, resource_type: "case_clustering",
      } as any).then(() => {});
    }
  }, [user, activeOrgId]);

  const { data: processes = [] } = useQuery({
    queryKey: ["clustering-processes", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("processes").select("id, title, number, type, status, priority, legal_area").eq("archived", false).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  // Group by type (simple clustering)
  const byType: Record<string, any[]> = {};
  processes.forEach((p: any) => {
    const key = p.type || "outros";
    if (!byType[key]) byType[key] = [];
    byType[key].push(p);
  });

  // Group by legal_area
  const byArea: Record<string, any[]> = {};
  processes.forEach((p: any) => {
    const key = p.legal_area || "não definida";
    if (!byArea[key]) byArea[key] = [];
    byArea[key].push(p);
  });

  const typeLabels: Record<string, string> = { civil: "Cível", criminal: "Criminal", labor: "Trabalhista", tax: "Tributário", administrative: "Administrativo" };

  const scenarioLabel = (count: number) => {
    if (count >= 5) return { text: "Cenário favorável — padrão consolidado", variant: "default" as const };
    if (count >= 3) return { text: "Cenário parcialmente favorável", variant: "secondary" as const };
    return { text: "Poucos dados para previsão", variant: "outline" as const };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <GitBranch className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clusterização de Casos</h1>
          <p className="text-sm text-muted-foreground">RF-074 — Agrupe casos semelhantes e preveja cenários qualitativos</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{processes.length}</p><p className="text-xs text-muted-foreground">Processos</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{Object.keys(byType).length}</p><p className="text-xs text-muted-foreground">Clusters por Tipo</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{Object.keys(byArea).length}</p><p className="text-xs text-muted-foreground">Clusters por Área</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{processes.filter((p: any) => p.priority === "high" || p.priority === "urgent").length}</p><p className="text-xs text-muted-foreground">Alto Risco</p></CardContent></Card>
      </div>

      {/* Clusters by Type */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Scale className="h-5 w-5" />Clusters por Tipo Processual</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(byType).sort((a, b) => b[1].length - a[1].length).map(([type, items]) => {
            const scenario = scenarioLabel(items.length);
            return (
              <Card key={type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{typeLabels[type] || type}</span>
                    <Badge variant="outline">{items.length} processos</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant={scenario.variant}>{scenario.text}</Badge>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((p: any) => (
                      <div key={p.id} className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="truncate">{p.number || p.title}</span>
                        {p.priority === "urgent" && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                      </div>
                    ))}
                    {items.length > 3 && <p className="text-xs text-muted-foreground">+{items.length - 3} mais</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Clusters by Legal Area */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><GitBranch className="h-5 w-5" />Clusters por Área Jurídica</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(byArea).sort((a, b) => b[1].length - a[1].length).map(([area, items]) => {
            const scenario = scenarioLabel(items.length);
            return (
              <Card key={area}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{area}</span>
                    <Badge variant="outline">{items.length} processos</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant={scenario.variant}>{scenario.text}</Badge>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((p: any) => (
                      <div key={p.id} className="text-xs text-muted-foreground truncate">{p.number || p.title}</div>
                    ))}
                    {items.length > 3 && <p className="text-xs text-muted-foreground">+{items.length - 3} mais</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {processes.length === 0 && (
        <div className="text-center py-16">
          <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum processo para clusterizar</p>
        </div>
      )}
    </div>
  );
}
