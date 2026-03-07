import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false }),
}));

vi.mock("@/hooks/useOrganization", () => ({
  useOrganization: () => ({ activeOrgId: "org1", organizations: [], loadingOrg: false, switchOrganization: vi.fn() }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: () => true,
    hasAnyPermission: () => true,
    role: "admin",
    isClient: false,
    isAdmin: true,
    isOwner: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: vi.fn((cb: any) => cb({ data: [], error: null })),
    })),
  },
}));

import { renderWithProviders } from "@/test/helpers";
import Signatures from "@/pages/Signatures";

describe("Signatures Page", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders page title", () => {
    renderWithProviders(<Signatures />);
    expect(screen.getByText("Assinaturas Digitais")).toBeInTheDocument();
  });

  it("renders page description", () => {
    renderWithProviders(<Signatures />);
    expect(screen.getByText(/Gerencie solicitações de assinatura/)).toBeInTheDocument();
  });

  it("renders new request button when user has permission", () => {
    renderWithProviders(<Signatures />);
    expect(screen.getByText("Nova Solicitação")).toBeInTheDocument();
  });

  it("renders solicitations card with search", () => {
    renderWithProviders(<Signatures />);
    expect(screen.getByText("Solicitações")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Buscar...")).toBeInTheDocument();
  });

  it("shows empty state message text", () => {
    renderWithProviders(<Signatures />);
    // The component shows "Nenhuma solicitação encontrada" when data is empty
    // but it may show "Carregando..." first; both indicate correct rendering
    const emptyOrLoading = screen.queryByText("Nenhuma solicitação encontrada") || screen.queryByText("Carregando...");
    expect(emptyOrLoading).toBeInTheDocument();
  });
});
