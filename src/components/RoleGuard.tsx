import { usePermissions, Permission } from "@/hooks/usePermissions";
import type { ReactNode } from "react";

interface RoleGuardProps {
  /** Require at least one of these permissions */
  permissions?: Permission[];
  /** Require ALL of these permissions */
  requireAll?: boolean;
  /** Content to show when access denied (default: nothing) */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally renders children based on the user's org role permissions.
 * 
 * Usage:
 * <RoleGuard permissions={["MANAGE_USERS"]}>
 *   <AdminPanel />
 * </RoleGuard>
 */
export const RoleGuard = ({ permissions = [], requireAll = false, fallback = null, children }: RoleGuardProps) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();

  if (isLoading) return null;

  if (permissions.length === 0) return <>{children}</>;

  const allowed = requireAll
    ? hasAllPermissions(...permissions)
    : hasAnyPermission(...permissions);

  return allowed ? <>{children}</> : <>{fallback}</>;
};
