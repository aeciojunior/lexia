import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { RiskIndicator } from "@/components/lexia/LegalComponents";
import { Scale, AlertTriangle, CheckCircle, MessageSquare, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: processes = [] } = useQuery({
    queryKey: ["processes-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("processes").select("*").eq("archived", false).order("created_at", { ascending: false }).limit(5);
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
    { label: "Ativos", value: active, icon: Scale, gradient: "from-primary/20 to-primary/5", text: "text-primary", border: "border-primary/20" },
    { label: "Alto Risco", value: highRisk, icon: AlertTriangle, gradient: "from-destructive/20 to-destructive/5", text: "text-destructive", border: "border-destructive/20" },
    { label: "Encerrados", value: closed, icon: CheckCircle, gradient: "from-success/20 to-success/5", text: "text-success", border: "border-success/20" },
    { label: "Total", value: total, icon: TrendingUp, gradient: "from-secondary/20 to-secondary/5", text: "text-secondary", border: "border-secondary/20" },
  ];

  const statusMap: Record<string, string> = { active: "Ativo", pending: "Pendente", closed: "Encerrado", suspended: "Suspenso" };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <p className="text-overline text-primary mb-1">Dashboard</p>
        <h1 className="text-display-lg">
          Olá, {user?.user_metadata?.full_name?.split(" ")[0] || "Advogado"} <span className="inline-block animate-float">👋</span>
        </h1>
        <p className="text-body-sm text-muted-foreground mt-1">Visão geral dos seus processos e atividades</p>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          >
            <div className={`rounded-xl border ${kpi.border} bg-gradient-to-br ${kpi.gradient} p-5 transition-all hover:shadow-lg hover:-translate-y-0.5`}>
              <div className="flex items-center justify-between mb-3">
                <kpi.icon className={`h-5 w-5 ${kpi.text}`} />
                <span className="text-overline text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-display-lg ${kpi.text}`}>{kpi.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent processes */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <LexCard hover={false} variant="default">
            <LexCardHeader>
              <LexCardTitle>Processos Recentes</LexCardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/processes")} className="text-primary">
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </LexCardHeader>
            {processes.length === 0 ? (
              <div className="py-12 text-center">
                <Scale className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-body-sm text-muted-foreground">Nenhum processo cadastrado ainda.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/processes")}>
                  Criar primeiro processo
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Número", "Título", "Cliente", "Status", "Risco"].map((h) => (
                        <th key={h} className="text-left py-2.5 text-overline text-muted-foreground font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {processes.map((p) => (
                      <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => navigate("/processes")}>
                        <td className="py-3.5 font-mono text-caption text-primary">{p.number}</td>
                        <td className="py-3.5 font-medium">{p.title}</td>
                        <td className="py-3.5 text-muted-foreground">{p.client_name}</td>
                        <td className="py-3.5">
                          <LexBadge variant={p.status === "active" ? "success" : p.status === "closed" ? "default" : "warning"}>
                            {statusMap[p.status] || p.status}
                          </LexBadge>
                        </td>
                        <td className="py-3.5"><RiskIndicator level={p.risk_level as any || "low"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </LexCard>
        </motion.div>

        {/* AI Chat widget */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <LexCard variant="ai" hover={false} className="flex flex-col h-full overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-3xl" />

            <LexCardHeader className="relative z-10">
              <LexCardTitle className="gradient-text">LexIA Chat</LexCardTitle>
              <LexBadge variant="ai"><span className="h-1.5 w-1.5 rounded-full bg-success mr-1.5 inline-block animate-pulse-glow" />Online</LexBadge>
            </LexCardHeader>
            <div className="flex-1 flex flex-col items-center justify-center py-6 text-center relative z-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/20 mb-4">
                <Sparkles className="h-7 w-7 text-secondary animate-float" />
              </div>
              <p className="text-body-sm text-muted-foreground mb-5 max-w-[200px]">
                Assistente jurídico com IA avançada pronto para ajudar.
              </p>
              <Button variant="ai" onClick={() => navigate("/chat")}>
                <MessageSquare className="h-4 w-4" /> Iniciar conversa
              </Button>
            </div>
          </LexCard>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
