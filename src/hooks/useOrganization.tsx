import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ORG_CHANGED_EVENT } from "@/lib/orgEvents";
import { useEffect } from "react";

export const useOrganization = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["active-org", user.id] });
        queryClient.invalidateQueries({ queryKey: ["user-organizations", user.id] });
      }
    };
    window.addEventListener(ORG_CHANGED_EVENT, handler);
    return () => window.removeEventListener(ORG_CHANGED_EVENT, handler);
  }, [user?.id, queryClient]);

  const { data: activeOrgId, isLoading: loadingOrg } = useQuery({
    queryKey: ["active-org", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("active_organization_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.active_organization_id as string | null;
    },
    enabled: !!user,
  });

  const { data: organizations = [], isLoading: loadingOrganizations } = useQuery({
    queryKey: ["user-organizations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_organizations" as any)
        .select("organization_id, role, organizations(id, name, logo_url)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user,
  });

  const switchOrganization = async (orgId: string) => {
    if (!user) return;
    const oldOrgId = activeOrgId;
    const { error } = await supabase
      .from("profiles")
      .update({ active_organization_id: orgId } as any)
      .eq("user_id", user.id);
    if (error) throw error;

    await queryClient.invalidateQueries({ queryKey: ["active-org", user.id] });
    await queryClient.invalidateQueries({ queryKey: ["user-organizations", user.id] });

    await supabase.from("audit_logs").insert({
      action: "change_active_organization",
      user_id: user.id,
      organization_id: orgId,
      resource_type: "organization",
      resource_id: orgId,
      metadata: { old_organization_id: oldOrgId, new_organization_id: orgId },
    } as any);
  };

  return {
    activeOrgId: activeOrgId || null,
    organizations,
    loadingOrg,
    loadingOrganizations,
    switchOrganization,
  };
};
