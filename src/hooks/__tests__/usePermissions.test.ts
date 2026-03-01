import { describe, it, expect } from "vitest";
import { getPermissionsForRole, roleHasPermission } from "../usePermissions";

describe("getPermissionsForRole", () => {
  it("returns permissions for owner", () => {
    const perms = getPermissionsForRole("owner");
    expect(perms).toContain("MANAGE_ORGANIZATION");
    expect(perms).toContain("DELETE_ORGANIZATION");
    expect(perms).toContain("MANAGE_USERS");
  });

  it("returns permissions for admin (no DELETE_ORGANIZATION)", () => {
    const perms = getPermissionsForRole("admin");
    expect(perms).toContain("MANAGE_USERS");
    expect(perms).not.toContain("DELETE_ORGANIZATION");
    expect(perms).not.toContain("MANAGE_ORGANIZATION");
  });

  it("returns limited permissions for client", () => {
    const perms = getPermissionsForRole("client");
    expect(perms).toContain("VIEW_PROCESSES");
    expect(perms).toContain("ACCESS_CLIENT_PORTAL");
    expect(perms).not.toContain("MANAGE_PROCESSES");
    expect(perms).not.toContain("MANAGE_USERS");
  });

  it("returns limited permissions for intern", () => {
    const perms = getPermissionsForRole("intern");
    expect(perms).toContain("VIEW_PROCESSES");
    expect(perms).toContain("MANAGE_TASKS");
    expect(perms).not.toContain("MANAGE_PROCESSES");
    expect(perms).not.toContain("MANAGE_USERS");
  });

  it("user role has advanced AI", () => {
    const perms = getPermissionsForRole("user");
    expect(perms).toContain("USE_IA_ADVANCED");
    expect(perms).toContain("MANAGE_PROCESSES");
  });

  it("returns empty array for unknown role", () => {
    expect(getPermissionsForRole("unknown" as any)).toEqual([]);
  });
});

describe("roleHasPermission", () => {
  it("owner has MANAGE_ORGANIZATION", () => {
    expect(roleHasPermission("owner", "MANAGE_ORGANIZATION")).toBe(true);
  });

  it("client does NOT have MANAGE_USERS", () => {
    expect(roleHasPermission("client", "MANAGE_USERS")).toBe(false);
  });

  it("intern has USE_IA_BASIC", () => {
    expect(roleHasPermission("intern", "USE_IA_BASIC")).toBe(true);
  });

  it("intern does NOT have USE_IA_ADVANCED", () => {
    expect(roleHasPermission("intern", "USE_IA_ADVANCED")).toBe(false);
  });

  it("returns false for unknown role", () => {
    expect(roleHasPermission("unknown" as any, "MANAGE_USERS")).toBe(false);
  });
});
