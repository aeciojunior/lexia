import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export type PlanType = "free" | "trial" | "pro" | "enterprise";

interface PlanLimits {
  maxProcesses: number;
  maxDocuments: number;
  maxMembers: number;
  maxStorageGB: number;
  advancedAI: boolean;
  agents: boolean;
  automations: boolean;
  financialModule: boolean;
  auditLogs: boolean;
  customBranding: boolean;
  integrations: boolean;
  digitalSignature: boolean;
}

const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxProcesses: 10,
    maxDocuments: 100,
    maxMembers: 1,
    maxStorageGB: 1,
    advancedAI: false,
    agents: false,
    automations: false,
    financialModule: false,
    auditLogs: false,
    customBranding: false,
    integrations: false,
    digitalSignature: false,
  },
  trial: {
    maxProcesses: 50,
    maxDocuments: 500,
    maxMembers: 5,
    maxStorageGB: 5,
    advancedAI: true,
    agents: false,
    automations: true,
    financialModule: true,
    auditLogs: true,
    customBranding: false,
    integrations: true,
    digitalSignature: false,
  },
  pro: {
    maxProcesses: 500,
    maxDocuments: 5000,
    maxMembers: 20,
    maxStorageGB: 50,
    advancedAI: true,
    agents: true,
    automations: true,
    financialModule: true,
    auditLogs: true,
    customBranding: false,
    integrations: true,
    digitalSignature: true,
  },
  enterprise: {
    maxProcesses: Infinity,
    maxDocuments: Infinity,
    maxMembers: Infinity,
    maxStorageGB: Infinity,
    advancedAI: true,
    agents: true,
    automations: true,
    financialModule: true,
    auditLogs: true,
    customBranding: true,
    integrations: true,
    digitalSignature: true,
  },
};

export const PLAN_LABELS: Record<PlanType, string> = {
  free: "Gratuito",
  trial: "Trial (14 dias)",
  pro: "Profissional",
  enterprise: "Enterprise",
};

export const usePlanLimits = () => {
  const { activeOrgId } = useOrganization();

  const { data: orgData, isLoading } = useQuery({
    queryKey: ["org-plan", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("plan, trial_ends_at, status")
        .eq("id", activeOrgId!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!activeOrgId,
  });

  // Auto-convert expired trial to free
  const rawPlan = (orgData?.plan as PlanType) || "free";
  const trialEndsAt = orgData?.trial_ends_at ? new Date(orgData.trial_ends_at) : null;
  const isTrialExpired = rawPlan === "trial" && trialEndsAt && trialEndsAt < new Date();
  const currentPlan: PlanType = isTrialExpired ? "free" : rawPlan;
  const limits = PLAN_LIMITS[currentPlan];

  const trialDaysLeft = rawPlan === "trial" && trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const canUseFeature = (feature: keyof Omit<PlanLimits, "maxProcesses" | "maxDocuments" | "maxMembers" | "maxStorageGB">) =>
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
    isTrial: currentPlan === "trial",
    isTrialExpired,
    trialDaysLeft,
    orgStatus: (orgData?.status as string) || "active",
  };
};
