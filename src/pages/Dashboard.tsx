import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { RiskIndicator } from "@/components/lexia/LegalComponents";
import { Scale, Users, AlertTriangle, CheckCircle, MessageSquare, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: processes = [] } = useQuery({
    queryKey: ["processes-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processes")
        .select("*")
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: allProcesses = [] } = useQuery({
    queryKey: ["processes-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("processes").select("status, risk_level, archived");
      if (error) throw error;
      return data;
    },
  });

  const active = allProcesses.filter((p) => p.status === "active" && !p.archived).length;
  const highRisk = allProcesses.filter((p) => (p.risk_level === "high" || p.risk_level === "critical") && !p.archived).length;
  const closed = allProcesses.filter((p) => p.status === "closed").length;
  const total = allProcesses.filter((p) => !p.archived).length;

  const kpis = [
    { label: "Processos Ativos", value: active, icon: Scale, color: "text-primary" },
    { label: "Alto Risco", value: highRisk, icon: AlertTriangle, color: "text-destructive" },
    { label: "Encerrados", value: closed, icon: CheckCircle, color: "text-success" },
    { label: "Total", value: total, icon: TrendingUp, color: "text-secondary" },
  ];

  const statusMap: Record<string, string> = {
    active: "Ativo",
    pending: "Pendente",
    closed: "Encerrado",
    suspended: "Suspenso",
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-display-lg">Dashboard</h1>
        <p className="text-body-sm text-muted-foreground mt-1">Visão geral dos seus processos e atividades</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <LexCard key={kpi.label} hover={false} className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-muted ${kpi.color}`}>
              <kpi.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-display-sm">{kpi.value}</p>
              <p className="text-caption text-muted-foreground">{kpi.label}</p>
            </div>
          </LexCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent processes */}
        <div className="lg:col-span-2">
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle>Processos Recentes</LexCardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate("/processes")}>Ver todos</Button>
            </LexCardHeader>
            {processes.length === 0 ? (
              <p className="text-body-sm text-muted-foreground py-8 text-center">Nenhum processo cadastrado ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-caption text-muted-foreground font-medium">Número</th>
                      <th className="text-left py-2 text-caption text-muted-foreground font-medium">Título</th>
                      <th className="text-left py-2 text-caption text-muted-foreground font-medium">Cliente</th>
                      <th className="text-left py-2 text-caption text-muted-foreground font-medium">Status</th>
                      <th className="text-left py-2 text-caption text-muted-foreground font-medium">Risco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processes.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => navigate("/processes")}>
                        <td className="py-3 font-mono text-caption">{p.number}</td>
                        <td className="py-3">{p.title}</td>
                        <td className="py-3 text-muted-foreground">{p.client_name}</td>
                        <td className="py-3">
                          <LexBadge variant={p.status === "active" ? "success" : p.status === "closed" ? "default" : "warning"}>
                            {statusMap[p.status] || p.status}
                          </LexBadge>
                        </td>
                        <td className="py-3"><RiskIndicator level={p.risk_level as any || "low"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </LexCard>
        </div>

        {/* Quick AI chat */}
        <div>
          <LexCard variant="ai" hover={false} className="flex flex-col h-full">
            <LexCardHeader>
              <LexCardTitle>Chat IA</LexCardTitle>
              <LexBadge variant="ai">Online</LexBadge>
            </LexCardHeader>
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 mb-4">
                <MessageSquare className="h-7 w-7 text-secondary" />
              </div>
              <p className="text-body-sm text-muted-foreground mb-4">Pergunte à IA sobre seus processos, prazos e documentos.</p>
              <Button variant="ai" onClick={() => navigate("/chat")}>
                Iniciar conversa
              </Button>
            </div>
          </LexCard>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
