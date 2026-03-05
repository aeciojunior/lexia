import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Scale, AlertTriangle, TrendingUp, GitBranch } from "lucide-react";

export default function MassLitigation() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();

  useEffect(() => {
    if (user && activeOrgId) {
      supabase.from("audit_logs").insert({
        action: "mass_litigation_cluster_identified", user_id: user.id,
        organization_id: activeOrgId, resource_type: "mass_litigation",
      } as any).then(() => {});
    }
  }, [user, activeOrgId]);

  const { data: processes = [] } = useQuery({
    queryKey: ["ml-processes", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("processes").select("id, title, number, type, status, priority, legal_area, description").eq("archived", false).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  // Group by type for repetitive litigation detection
  const byType: Record<string, any[]> = {};
  processes.forEach((p: any) => {
    const key = p.type || "outros";
    if (!byType[key]) byType[key] = [];
    byType[key].push(p);
  });

  // Only show clusters with 2+ processes (repetitive)
  const repetitiveClusters = Object.entries(byType).filter(([, items]) => items.length >= 2).sort((a, b) => b[1].length - a[1].length);
  const totalRepetitive = repetitiveClusters.reduce((sum, [, items]) => sum + items.length, 0);

  // Group by legal_area
  const byArea: Record<string, any[]> = {};
  processes.forEach((p: any) => {
    const key = p.legal_area || "não definida";
    if (!byArea[key]) byArea[key] = [];
    byArea[key].push(p);
  });
  const repetitiveAreas = Object.entries(byArea).filter(([, items]) => items.length >= 2).sort((a, b) => b[1].length - a[1].length);

  const riskLevel = (count: number) => {
    if (count >= 10) return { label: "Risco Alto — demanda massificada", variant: "destructive" as const };
    if (count >= 5) return { label: "Risco Médio — padrão recorrente", variant: "default" as const };
    return { label: "Risco Baixo — poucos casos", variant: "secondary" as const };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Litígios Repetitivos</h1>
          <p className="text-sm text-muted-foreground">RF-080 — Identificação de padrões e estratégias para demandas massificadas</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{processes.length}</p><p className="text-xs text-muted-foreground">Total de Processos</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{totalRepetitive}</p><p className="text-xs text-muted-foreground">Em Clusters Repetitivos</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{repetitiveClusters.length}</p><p className="text-xs text-muted-foreground">Clusters por Tipo</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{repetitiveAreas.length}</p><p className="text-xs text-muted-foreground">Clusters por Área</p></CardContent></Card>
      </div>

      {/* Clusters by Type */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Scale className="h-5 w-5" />Padrões por Tipo Processual</h2>
        {repetitiveClusters.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum padrão repetitivo identificado.</CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {repetitiveClusters.map(([type, items]) => {
              const risk = riskLevel(items.length);
              const highPriority = items.filter((p: any) => p.priority === "high" || p.priority === "urgent").length;
              return (
                <Card key={type} className="hover:border-primary/30 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{type}</span>
                      <Badge variant="outline">{items.length} processos</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Badge variant={risk.variant}>{risk.label}</Badge>
                    {highPriority > 0 && (
                      <div className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3" />{highPriority} com prioridade alta
                      </div>
                    )}
                    <div className="space-y-1 mt-2">
                      {items.slice(0, 4).map((p: any) => (
                        <div key={p.id} className="text-xs text-muted-foreground flex items-center gap-1">
                          <span className="truncate">{p.number || p.title}</span>
                          {p.priority === "urgent" && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                        </div>
                      ))}
                      {items.length > 4 && <p className="text-xs text-muted-foreground">+{items.length - 4} mais</p>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Clusters by Area */}
      {repetitiveAreas.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><GitBranch className="h-5 w-5" />Padrões por Área Jurídica</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {repetitiveAreas.map(([area, items]) => {
              const risk = riskLevel(items.length);
              return (
                <Card key={area}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{area}</span>
                      <Badge variant="outline">{items.length} processos</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Badge variant={risk.variant}>{risk.label}</Badge>
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
      )}

      <Card className="border-muted">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">📊 A Inteligência de Litígios Repetitivos (RF-080) identifica demandas massificadas, analisa comportamento de tribunais e sugere estratégias padronizadas. Clusters com mais processos indicam maior potencial de padronização estratégica.</p>
        </CardContent>
      </Card>
    </div>
  );
}
