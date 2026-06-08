import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { usePlanLimits, PLAN_LABELS } from "@/hooks/usePlanLimits";
import { LexPageHeader } from "@/components/lexia/LexPageHeader";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Crown, Check, X, Zap, Shield, Bot, DollarSign, FileText, Users, Scale, Brain, Cpu, ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const plans = [
  {
    id: "free" as const,
    icon: Zap,
    price: "R$ 0",
    period: "/mês",
    description: "Para advogados individuais começando",
    features: [
      { label: "1 usuário", included: true },
      { label: "10 processos", included: true },
      { label: "1 GB armazenamento", included: true },
      { label: "IA básica", included: true },
      { label: "IA avançada", included: false },
      { label: "Agentes de IA", included: false },
      { label: "Automações", included: false },
      { label: "Integrações", included: false },
    ],
  },
  {
    id: "trial" as const,
    icon: Crown,
    price: "R$ 0",
    period: "/ 14 dias",
    description: "Experimente todos os recursos gratuitamente",
    features: [
      { label: "5 usuários", included: true },
      { label: "50 processos", included: true },
      { label: "5 GB armazenamento", included: true },
      { label: "IA completa", included: true },
      { label: "Automações", included: true },
      { label: "Integrações", included: true },
      { label: "Módulo financeiro", included: true },
      { label: "Agentes de IA", included: false },
    ],
  },
  {
    id: "pro" as const,
    icon: Crown,
    price: "R$ 197",
    period: "/mês",
    description: "Para escritórios em crescimento",
    popular: true,
    features: [
      { label: "20 usuários", included: true },
      { label: "500 processos", included: true },
      { label: "50 GB armazenamento", included: true },
      { label: "IA completa + Agentes", included: true },
      { label: "Automações ilimitadas", included: true },
      { label: "Integrações completas", included: true },
      { label: "Módulo financeiro", included: true },
      { label: "Assinatura digital", included: true },
    ],
  },
  {
    id: "enterprise" as const,
    icon: Shield,
    price: "Sob consulta",
    period: "",
    description: "Para grandes escritórios e departamentos jurídicos",
    features: [
      { label: "Tudo ilimitado", included: true },
      { label: "IA avançada + preditiva", included: true },
      { label: "Agentes ilimitados", included: true },
      { label: "Automações ilimitadas", included: true },
      { label: "Integrações ilimitadas", included: true },
      { label: "Assinatura digital ilimitada", included: true },
      { label: "Branding personalizado", included: true },
      { label: "SLA dedicado", included: true },
    ],
  },
];

const Settings = () => {
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const { plan: currentPlan, limits, isLoading, isTrial, trialDaysLeft, isTrialExpired } = usePlanLimits();
  const navigate = useNavigate();

  const { data: org } = useQuery({
    queryKey: ["org-settings", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", activeOrgId!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!activeOrgId,
  });

  const { data: stats } = useQuery({
    queryKey: ["org-usage-stats", activeOrgId],
    queryFn: async () => {
      const [processes, documents, members] = await Promise.all([
        supabase.from("processes").select("id", { count: "exact", head: true }).eq("organization_id", activeOrgId!),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("organization_id", activeOrgId!),
        supabase.from("user_organizations").select("id", { count: "exact", head: true }).eq("organization_id", activeOrgId!),
      ]);
      return {
        processes: processes.count || 0,
        documents: documents.count || 0,
        members: members.count || 0,
      };
    },
    enabled: !!activeOrgId,
  });

  const canManageOrg = hasPermission("MANAGE_ORGANIZATION");

  const usageItems = [
    { label: "Processos", current: stats?.processes || 0, max: limits.maxProcesses, icon: Scale },
    { label: "Documentos", current: stats?.documents || 0, max: limits.maxDocuments, icon: FileText },
    { label: "Membros", current: stats?.members || 0, max: limits.maxMembers, icon: Users },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <LexPageHeader
        overline="Configurações"
        title="Plano & Uso"
        description="Gerencie o plano da sua organização e acompanhe o uso de recursos"
      />

      {/* Current Plan */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <LexCard hover={false} className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
          <LexCardHeader>
            <LexCardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" /> Plano Atual
            </LexCardTitle>
            <LexBadge variant={currentPlan === "enterprise" ? "ai" : currentPlan === "pro" ? "success" : currentPlan === "trial" ? "warning" : "default"}>
              {PLAN_LABELS[currentPlan]}
            </LexBadge>
          </LexCardHeader>
          {isTrial && trialDaysLeft !== null && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 mb-4">
              <p className="text-body-sm text-warning font-medium">
                ⏳ Seu trial expira em <strong>{trialDaysLeft} dias</strong>. Faça upgrade para não perder acesso aos recursos.
              </p>
            </div>
          )}
          {isTrialExpired && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
              <p className="text-body-sm text-destructive font-medium">
                Seu trial expirou. Faça upgrade para restaurar o acesso completo.
              </p>
            </div>
          )}
          <p className="text-body-sm text-muted-foreground mb-4">
            {org?.name || "Sua organização"} está no plano <strong>{PLAN_LABELS[currentPlan]}</strong>.
          </p>

          {/* Usage bars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {usageItems.map((item) => {
              const pct = item.max === Infinity ? 0 : Math.min((item.current / item.max) * 100, 100);
              const isNearLimit = pct > 80;
              return (
                <div key={item.label} className="p-4 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-caption font-medium">{item.label}</span>
                    </div>
                    <span className="text-caption text-muted-foreground">
                      {item.current}/{item.max === Infinity ? "∞" : item.max}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isNearLimit ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${item.max === Infinity ? 5 : pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </LexCard>
      </motion.div>

      <Separator />

      {/* Plan Cards */}
      <div>
        <h2 className="text-display-sm mb-6">Escolha o plano ideal</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => {
            const isCurrent = plan.id === currentPlan;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <div
                  className={`relative rounded-2xl border p-6 transition-all ${
                    plan.popular
                      ? "border-primary/40 neon-border bg-gradient-to-b from-primary/5 to-transparent"
                      : "border-border bg-card"
                  } ${isCurrent ? "ring-2 ring-primary/30" : "hover:border-primary/20 hover:-translate-y-1"}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <LexBadge variant="ai">Mais popular</LexBadge>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <plan.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-display-sm">{PLAN_LABELS[plan.id]}</h3>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="text-display-md">{plan.price}</span>
                    <span className="text-body-sm text-muted-foreground">{plan.period}</span>
                  </div>

                  <p className="text-body-sm text-muted-foreground mb-6">{plan.description}</p>

                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f) => (
                      <li key={f.label} className="flex items-center gap-2 text-body-sm">
                        {f.included ? (
                          <Check className="h-4 w-4 text-success shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={f.included ? "" : "text-muted-foreground/60"}>{f.label}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Plano atual
                    </Button>
                  ) : plan.id === "enterprise" ? (
                    <Button variant="outline" className="w-full">
                      Fale conosco <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant={plan.popular ? "default" : "outline"} className="w-full">
                      {currentPlan === "enterprise" ? "Downgrade" : "Fazer upgrade"} <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Feature comparison for current plan */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <LexCard hover={false}>
          <LexCardHeader>
            <LexCardTitle>Recursos do seu plano</LexCardTitle>
          </LexCardHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "IA Avançada", enabled: limits.advancedAI, icon: Brain },
              { label: "Agentes de IA", enabled: limits.agents, icon: Bot },
              { label: "Automações", enabled: limits.automations, icon: Cpu },
              { label: "Financeiro", enabled: limits.financialModule, icon: DollarSign },
              { label: "Logs de Auditoria", enabled: limits.auditLogs, icon: Shield },
              { label: "Branding", enabled: limits.customBranding, icon: Crown },
            ].map((f) => (
              <div
                key={f.label}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  f.enabled ? "border-success/20 bg-success/5" : "border-border bg-muted/20 opacity-50"
                }`}
              >
                <f.icon className={`h-4 w-4 ${f.enabled ? "text-success" : "text-muted-foreground"}`} />
                <span className="text-body-sm">{f.label}</span>
                {f.enabled ? (
                  <Check className="h-3.5 w-3.5 text-success ml-auto" />
                ) : (
                  <X className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                )}
              </div>
            ))}
          </div>
        </LexCard>
      </motion.div>
    </div>
  );
};

export default Settings;
