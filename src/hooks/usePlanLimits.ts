import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export type PlanType = "free" | "pro" | "enterprise";

interface PlanLimits {
  maxProcesses: number;
  maxDocuments: number;
  maxMembers: number;
  advancedAI: boolean;
  agents: boolean;
  automations: boolean;
  financialModule: boolean;
  auditLogs: boolean;
  customBranding: boolean;
}

const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxProcesses: 25,
    maxDocuments: 100,
    maxMembers: 3,
    advancedAI: false,
    agents: false,
    automations: false,
    financialModule: false,
    auditLogs: false,
    customBranding: false,
  },
  pro: {
    maxProcesses: 500,
    maxDocuments: 5000,
    maxMembers: 20,
    advancedAI: true,
    agents: true,
    automations: true,
    financialModule: true,
    auditLogs: true,
    customBranding: false,
  },
  enterprise: {
    maxProcesses: Infinity,
    maxDocuments: Infinity,
    maxMembers: Infinity,
    advancedAI: true,
    agents: true,
    automations: true,
    financialModule: true,
    auditLogs: true,
    customBranding: true,
  },
};

export const PLAN_LABELS: Record<PlanType, string> = {
  free: "Gratuito",
  pro: "Profissional",
  enterprise: "Enterprise",
};

export const usePlanLimits = () => {
  const { activeOrgId } = useOrganization();

  const { data: plan, isLoading } = useQuery({
    queryKey: ["org-plan", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("plan")
        .eq("id", activeOrgId!)
        .single();
      if (error) throw error;
      return ((data as any)?.plan as PlanType) || "free";
    },
    enabled: !!activeOrgId,
  });

  const currentPlan: PlanType = plan || "free";
  const limits = PLAN_LIMITS[currentPlan];

  const canUseFeature = (feature: keyof Omit<PlanLimits, "maxProcesses" | "maxDocuments" | "maxMembers">) =>
    limits[feature] === true;

  const isAtLimit = async (resource: "processes" | "documents" | "members") => {
    if (!activeOrgId) return false;
    const limitKey = resource === "processes" ? "maxProcesses" : resource === "documents" ? "maxDocuments" : "maxMembers";
    const max = limits[limitKey];
    if (max === Infinity) return false;

    const table = resource === "members" ? "user_organizations" : resource;
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", activeOrgId);

    return (count || 0) >= max;
  };

  return {
    plan: currentPlan,
    limits,
    canUseFeature,
    isAtLimit,
    isLoading,
    isPro: currentPlan === "pro" || currentPlan === "enterprise",
    isEnterprise: currentPlan === "enterprise",
    isFree: currentPlan === "free",
  };
};
