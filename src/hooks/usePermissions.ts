import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";

// All permission codes in the system
export type Permission =
  | "MANAGE_ORGANIZATION"
  | "MANAGE_USERS"
  | "VIEW_USERS"
  | "MANAGE_PROCESSES"
  | "VIEW_PROCESSES"
  | "MANAGE_DOCUMENTS"
  | "VIEW_DOCUMENTS"
  | "MANAGE_TASKS"
  | "VIEW_TASKS"
  | "MANAGE_CLIENTS"
  | "VIEW_CLIENTS"
  | "USE_IA_ADVANCED"
  | "USE_IA_BASIC"
  | "MANAGE_AUTOMATIONS"
  | "VIEW_AUTOMATIONS"
  | "MANAGE_AGENTS"
  | "USE_AGENTS"
  | "VIEW_FINANCIAL"
  | "MANAGE_FINANCIAL"
  | "VIEW_AUDIT_LOGS"
  | "ACCESS_CLIENT_PORTAL"
  | "DELETE_ORGANIZATION"
  | "MANAGE_HEARINGS"
  | "VIEW_HEARINGS"
  | "MANAGE_LEGAL_REFS"
  | "VIEW_LEGAL_REFS";

export type OrgRole = "owner" | "admin" | "user" | "intern" | "client";

const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  owner: [
    "MANAGE_ORGANIZATION", "DELETE_ORGANIZATION",
    "MANAGE_USERS", "VIEW_USERS",
    "MANAGE_PROCESSES", "VIEW_PROCESSES",
    "MANAGE_DOCUMENTS", "VIEW_DOCUMENTS",
    "MANAGE_TASKS", "VIEW_TASKS",
    "MANAGE_CLIENTS", "VIEW_CLIENTS",
    "USE_IA_ADVANCED", "USE_IA_BASIC",
    "MANAGE_AUTOMATIONS", "VIEW_AUTOMATIONS",
    "MANAGE_AGENTS", "USE_AGENTS",
    "VIEW_FINANCIAL", "MANAGE_FINANCIAL",
    "VIEW_AUDIT_LOGS", "ACCESS_CLIENT_PORTAL",
    "MANAGE_HEARINGS", "VIEW_HEARINGS",
    "MANAGE_LEGAL_REFS", "VIEW_LEGAL_REFS",
  ],
  admin: [
    "MANAGE_USERS", "VIEW_USERS",
    "MANAGE_PROCESSES", "VIEW_PROCESSES",
    "MANAGE_DOCUMENTS", "VIEW_DOCUMENTS",
    "MANAGE_TASKS", "VIEW_TASKS",
    "MANAGE_CLIENTS", "VIEW_CLIENTS",
    "USE_IA_ADVANCED", "USE_IA_BASIC",
    "MANAGE_AUTOMATIONS", "VIEW_AUTOMATIONS",
    "MANAGE_AGENTS", "USE_AGENTS",
    "VIEW_FINANCIAL", "MANAGE_FINANCIAL",
    "VIEW_AUDIT_LOGS", "ACCESS_CLIENT_PORTAL",
    "MANAGE_HEARINGS", "VIEW_HEARINGS",
    "MANAGE_LEGAL_REFS", "VIEW_LEGAL_REFS",
  ],
  user: [
    "MANAGE_PROCESSES", "VIEW_PROCESSES",
    "MANAGE_DOCUMENTS", "VIEW_DOCUMENTS",
    "MANAGE_TASKS", "VIEW_TASKS",
    "MANAGE_CLIENTS", "VIEW_CLIENTS",
    "USE_IA_ADVANCED", "USE_IA_BASIC",
    "USE_AGENTS",
    "ACCESS_CLIENT_PORTAL",
    "MANAGE_HEARINGS", "VIEW_HEARINGS",
    "MANAGE_LEGAL_REFS", "VIEW_LEGAL_REFS",
  ],
  intern: [
    "VIEW_PROCESSES",
    "VIEW_DOCUMENTS",
    "MANAGE_TASKS", "VIEW_TASKS",
    "VIEW_CLIENTS",
    "USE_IA_BASIC",
    "ACCESS_CLIENT_PORTAL",
    "VIEW_HEARINGS",
    "VIEW_LEGAL_REFS",
  ],
  client: [
    "VIEW_PROCESSES",
    "VIEW_DOCUMENTS",
    "ACCESS_CLIENT_PORTAL",
    "VIEW_HEARINGS",
  ],
};

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Administrador",
  user: "Advogado",
  intern: "Estagiário",
  client: "Cliente",
};

export const ROLE_BADGE_VARIANT: Record<OrgRole, string> = {
  owner: "destructive",
  admin: "destructive",
  user: "default",
  intern: "warning",
  client: "secondary",
};

export function getPermissionsForRole(role: OrgRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function roleHasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export const usePermissions = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();

  const { data: orgRole, isLoading } = useQuery({
    queryKey: ["org-role", user?.id, activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_organizations")
        .select("role")
        .eq("user_id", user!.id)
        .eq("organization_id", activeOrgId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as OrgRole) || "user";
    },
    enabled: !!user && !!activeOrgId,
  });

  const role: OrgRole = orgRole || "user";
  const permissions = getPermissionsForRole(role);

  const hasPermission = (permission: Permission) => permissions.includes(permission);
  const hasAnyPermission = (...perms: Permission[]) => perms.some((p) => permissions.includes(p));
  const hasAllPermissions = (...perms: Permission[]) => perms.every((p) => permissions.includes(p));

  return {
    role,
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isLoading,
    isOwner: role === "owner",
    isAdmin: role === "admin" || role === "owner",
    isIntern: role === "intern",
    isClient: role === "client",
  };
};
