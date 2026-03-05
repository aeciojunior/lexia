import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, AlertTriangle, TrendingUp, Scale } from "lucide-react";

export default function FinancialImpact() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();

  useEffect(() => {
    if (user && activeOrgId) {
      supabase.from("audit_logs").insert({
        action: "financial_impact_predicted", user_id: user.id,
        organization_id: activeOrgId, resource_type: "financial_impact",
      } as any).then(() => {});
    }
  }, [user, activeOrgId]);

  const { data: contracts = [] } = useQuery({
    queryKey: ["fi-contracts", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("contracts").select("id, title, amount_cents, status, contract_type").eq("status", "active");
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: risks = [] } = useQuery({
    queryKey: ["fi-risks", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("risks").select("id, title, severity, status, financial_impact").eq("organization_id", activeOrgId!).eq("status", "open");
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ["fi-processes", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("processes").select("id, title, number, type, priority, cause_value").eq("archived", false);
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const totalContractValue = contracts.reduce((sum: number, c: any) => sum + (c.amount_cents || 0), 0);
  const totalCauseValue = processes.reduce((sum: number, p: any) => sum + (p.cause_value || 0), 0);
  const highRisks = risks.filter((r: any) => r.severity === "high" || r.severity === "critical");
  const fmt = (v: number) => `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const impactLevel = (value: number) => {
    if (value > 50000000) return { label: "Alto Impacto", variant: "destructive" as const };
    if (value > 10000000) return { label: "Médio Impacto", variant: "default" as const };
    return { label: "Baixo Impacto", variant: "secondary" as const };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <DollarSign className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Impacto Financeiro de Litígios</h1>
          <p className="text-sm text-muted-foreground">RF-071 — Estimativas qualitativas de impacto financeiro</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><DollarSign className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">Valor em Contratos</p><p className="text-lg font-bold">{fmt(totalContractValue)}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Scale className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">Valor da Causa Total</p><p className="text-lg font-bold">{fmt(totalCauseValue)}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-destructive" /><div><p className="text-xs text-muted-foreground">Riscos Alto Impacto</p><p className="text-lg font-bold">{highRisks.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><TrendingUp className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">Processos Ativos</p><p className="text-lg font-bold">{processes.length}</p></div></CardContent></Card>
      </div>

      {/* Processes with Financial Impact */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Processos por Faixa de Impacto Financeiro</h2>
        <div className="space-y-3">
          {processes.filter((p: any) => p.cause_value).sort((a: any, b: any) => (b.cause_value || 0) - (a.cause_value || 0)).slice(0, 15).map((p: any) => {
            const impact = impactLevel(p.cause_value || 0);
            return (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{p.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {p.number && <Badge variant="outline">{p.number}</Badge>}
                      <Badge variant="secondary">{p.type}</Badge>
                      <Badge variant={impact.variant}>{impact.label}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{fmt(p.cause_value)}</p>
                    <p className="text-xs text-muted-foreground">valor da causa</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {processes.filter((p: any) => p.cause_value).length === 0 && (
            <p className="text-muted-foreground text-center py-8">Nenhum processo com valor da causa informado.</p>
          )}
        </div>
      </div>

      {/* Risks with Financial Impact */}
      {highRisks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Riscos com Impacto Financeiro</h2>
          <div className="space-y-3">
            {highRisks.map((r: any) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{r.title}</p>
                    <Badge variant="destructive" className="mt-1">{r.severity}</Badge>
                  </div>
                  {r.financial_impact && <Badge variant="outline">{r.financial_impact}</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
