import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useOrganization = () => {
  const { user } = useAuth();

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

  const { data: organizations = [] } = useQuery({
    queryKey: ["user-organizations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_organizations" as any)
        .select("organization_id, role, organizations(id, name)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user,
  });

  const switchOrganization = async (orgId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ active_organization_id: orgId } as any)
      .eq("user_id", user.id);
    if (error) throw error;
  };

  return {
    activeOrgId: activeOrgId || null,
    organizations,
    loadingOrg,
    switchOrganization,
  };
};
