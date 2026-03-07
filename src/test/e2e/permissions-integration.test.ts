import { describe, it, expect } from "vitest";
import { getPermissionsForRole, roleHasPermission, OrgRole } from "@/hooks/usePermissions";

describe("Permissions — Role Hierarchy Integration", () => {
  const ROLES: OrgRole[] = ["owner", "admin", "user", "intern", "client"];

  it("owner has all permissions that admin has", () => {
    const ownerPerms = getPermissionsForRole("owner");
    const adminPerms = getPermissionsForRole("admin");
    for (const p of adminPerms) {
      expect(ownerPerms).toContain(p);
    }
  });

  it("admin has all permissions that user has", () => {
    const adminPerms = getPermissionsForRole("admin");
    const userPerms = getPermissionsForRole("user");
    for (const p of userPerms) {
      expect(adminPerms).toContain(p);
    }
  });

  it("only owner can DELETE_ORGANIZATION", () => {
    for (const role of ROLES) {
      if (role === "owner") {
        expect(roleHasPermission(role, "DELETE_ORGANIZATION")).toBe(true);
      } else {
        expect(roleHasPermission(role, "DELETE_ORGANIZATION")).toBe(false);
      }
    }
  });

  it("only owner can MANAGE_ORGANIZATION", () => {
    for (const role of ROLES) {
      if (role === "owner") {
        expect(roleHasPermission(role, "MANAGE_ORGANIZATION")).toBe(true);
      } else {
        expect(roleHasPermission(role, "MANAGE_ORGANIZATION")).toBe(false);
      }
    }
  });

  it("client has minimal permissions", () => {
    const clientPerms = getPermissionsForRole("client");
    expect(clientPerms.length).toBeLessThan(15);
    expect(clientPerms).toContain("VIEW_PROCESSES");
    expect(clientPerms).toContain("ACCESS_CLIENT_PORTAL");
    expect(clientPerms).toContain("USE_CHATBOT");
    expect(clientPerms).not.toContain("MANAGE_USERS");
    expect(clientPerms).not.toContain("USE_IA_ADVANCED");
  });

  it("intern cannot manage processes or users", () => {
    expect(roleHasPermission("intern", "MANAGE_PROCESSES")).toBe(false);
    expect(roleHasPermission("intern", "MANAGE_USERS")).toBe(false);
    expect(roleHasPermission("intern", "MANAGE_DOCUMENTS")).toBe(false);
  });

  it("intern can manage tasks and view processes", () => {
    expect(roleHasPermission("intern", "MANAGE_TASKS")).toBe(true);
    expect(roleHasPermission("intern", "VIEW_PROCESSES")).toBe(true);
    expect(roleHasPermission("intern", "VIEW_DOCUMENTS")).toBe(true);
  });

  it("user can analyze contracts but not draft", () => {
    expect(roleHasPermission("user", "ANALYZE_CONTRACTS")).toBe(true);
    expect(roleHasPermission("user", "DRAFT_CONTRACTS")).toBe(false);
  });

  it("owner and admin can draft contracts", () => {
    expect(roleHasPermission("owner", "DRAFT_CONTRACTS")).toBe(true);
    expect(roleHasPermission("admin", "DRAFT_CONTRACTS")).toBe(true);
  });

  it("all roles have VIEW_PROCESSES except unknown", () => {
    for (const role of ROLES) {
      expect(roleHasPermission(role, "VIEW_PROCESSES")).toBe(true);
    }
  });

  it("permission counts grow with role level", () => {
    const counts = ROLES.map(r => getPermissionsForRole(r).length);
    // client < intern < user < admin <= owner
    expect(counts[4]).toBeLessThan(counts[3]); // client < intern
    expect(counts[3]).toBeLessThan(counts[2]); // intern < user
    expect(counts[2]).toBeLessThan(counts[1]); // user < admin
    expect(counts[1]).toBeLessThanOrEqual(counts[0]); // admin <= owner
  });

  it("all authenticated roles can USE_CHATBOT", () => {
    for (const role of ROLES) {
      expect(roleHasPermission(role, "USE_CHATBOT")).toBe(true);
    }
  });

  it("mass litigation is owner/admin only", () => {
    expect(roleHasPermission("owner", "VIEW_MASS_LITIGATION")).toBe(true);
    expect(roleHasPermission("admin", "VIEW_MASS_LITIGATION")).toBe(true);
    expect(roleHasPermission("user", "VIEW_MASS_LITIGATION")).toBe(false);
  });

  it("due diligence execution is owner/admin only", () => {
    expect(roleHasPermission("owner", "PERFORM_DUE_DILIGENCE")).toBe(true);
    expect(roleHasPermission("admin", "PERFORM_DUE_DILIGENCE")).toBe(true);
    expect(roleHasPermission("user", "PERFORM_DUE_DILIGENCE")).toBe(false);
  });
});
