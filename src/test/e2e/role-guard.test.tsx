import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUsePermissions = vi.fn();
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import { RoleGuard } from "@/components/RoleGuard";

describe("RoleGuard — Integration", () => {
  const defaultPerms = {
    role: "owner",
    permissions: ["MANAGE_USERS", "VIEW_USERS", "MANAGE_PROCESSES"],
    hasPermission: (p: string) => ["MANAGE_USERS", "VIEW_USERS", "MANAGE_PROCESSES"].includes(p),
    hasAnyPermission: (...ps: string[]) => ps.some(p => ["MANAGE_USERS", "VIEW_USERS", "MANAGE_PROCESSES"].includes(p)),
    hasAllPermissions: (...ps: string[]) => ps.every(p => ["MANAGE_USERS", "VIEW_USERS", "MANAGE_PROCESSES"].includes(p)),
    isLoading: false,
    isOwner: true,
    isAdmin: true,
  };

  it("renders children when no permissions required", () => {
    mockUsePermissions.mockReturnValue(defaultPerms);
    render(<RoleGuard><div>Content</div></RoleGuard>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders children when user has required permission", () => {
    mockUsePermissions.mockReturnValue(defaultPerms);
    render(<RoleGuard permissions={["MANAGE_USERS" as any]}><div>Admin</div></RoleGuard>);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("hides children when user lacks permission", () => {
    mockUsePermissions.mockReturnValue({
      ...defaultPerms,
      permissions: ["VIEW_USERS"],
      hasAnyPermission: (...ps: string[]) => ps.some(p => ["VIEW_USERS"].includes(p)),
      hasAllPermissions: (...ps: string[]) => ps.every(p => ["VIEW_USERS"].includes(p)),
    });
    render(<RoleGuard permissions={["MANAGE_USERS" as any]}><div>Admin</div></RoleGuard>);
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows fallback when access denied", () => {
    mockUsePermissions.mockReturnValue({
      ...defaultPerms,
      permissions: [],
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
    });
    render(
      <RoleGuard permissions={["MANAGE_USERS" as any]} fallback={<div>Acesso negado</div>}>
        <div>Admin</div>
      </RoleGuard>
    );
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.getByText("Acesso negado")).toBeInTheDocument();
  });

  it("renders nothing while loading", () => {
    mockUsePermissions.mockReturnValue({ ...defaultPerms, isLoading: true });
    const { container } = render(
      <RoleGuard permissions={["MANAGE_USERS" as any]}><div>Content</div></RoleGuard>
    );
    expect(container.innerHTML).toBe("");
  });

  it("requireAll=true requires all permissions", () => {
    mockUsePermissions.mockReturnValue({
      ...defaultPerms,
      permissions: ["MANAGE_USERS"],
      hasAllPermissions: (...ps: string[]) => ps.every(p => ["MANAGE_USERS"].includes(p)),
    });
    render(
      <RoleGuard permissions={["MANAGE_USERS" as any, "MANAGE_PROCESSES" as any]} requireAll>
        <div>Full Access</div>
      </RoleGuard>
    );
    expect(screen.queryByText("Full Access")).not.toBeInTheDocument();
  });

  it("requireAll=false (default) allows any permission", () => {
    mockUsePermissions.mockReturnValue({
      ...defaultPerms,
      permissions: ["MANAGE_USERS"],
      hasAnyPermission: (...ps: string[]) => ps.some(p => ["MANAGE_USERS"].includes(p)),
    });
    render(
      <RoleGuard permissions={["MANAGE_USERS" as any, "MANAGE_PROCESSES" as any]}>
        <div>Partial Access</div>
      </RoleGuard>
    );
    expect(screen.getByText("Partial Access")).toBeInTheDocument();
  });
});
