import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUsePermissions = vi.fn();

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

import { RoleGuard } from "@/components/RoleGuard";

describe("RoleGuard", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders children when user has required permission", () => {
    mockUsePermissions.mockReturnValue({
      hasPermission: (p: string) => p === "VIEW_PROCESSES",
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
      isLoading: false,
      role: "admin",
    });
    render(
      <RoleGuard permissions={["VIEW_PROCESSES"]}>
        <div data-testid="guarded">Content</div>
      </RoleGuard>
    );
    expect(screen.getByTestId("guarded")).toBeInTheDocument();
  });

  it("does not render children when user lacks permission", () => {
    mockUsePermissions.mockReturnValue({
      hasPermission: () => false,
      hasAnyPermission: () => false,
      role: "viewer",
    });
    render(
      <RoleGuard permissions={["MANAGE_USERS"]}>
        <div data-testid="guarded">Content</div>
      </RoleGuard>
    );
    expect(screen.queryByTestId("guarded")).not.toBeInTheDocument();
  });

  it("renders fallback when provided and permission denied", () => {
    mockUsePermissions.mockReturnValue({
      hasPermission: () => false,
      hasAnyPermission: () => false,
      role: "viewer",
    });
    render(
      <RoleGuard permissions={["MANAGE_USERS"]} fallback={<div data-testid="fallback">No access</div>}>
        <div data-testid="guarded">Content</div>
      </RoleGuard>
    );
    expect(screen.queryByTestId("guarded")).not.toBeInTheDocument();
    expect(screen.getByTestId("fallback")).toBeInTheDocument();
  });
});
