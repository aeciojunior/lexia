import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false }),
}));

vi.mock("@/hooks/useOrganization", () => ({
  useOrganization: () => ({ activeOrgId: "org1", organizations: [], loadingOrg: false, switchOrganization: vi.fn() }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((cb: any) => cb({ data: [], error: null })),
    })),
  },
}));

import { renderWithProviders } from "@/test/helpers";
import DueDiligence from "@/pages/DueDiligence";

describe("DueDiligence Page", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders title and description", () => {
    renderWithProviders(<DueDiligence />);
    expect(screen.getByText("Due Diligence Automatizada")).toBeInTheDocument();
    expect(screen.getByText(/RF-078/)).toBeInTheDocument();
  });

  it("renders due diligence type selector", () => {
    renderWithProviders(<DueDiligence />);
    expect(screen.getByText("Tipo de Due Diligence")).toBeInTheDocument();
  });

  it("renders target input", () => {
    renderWithProviders(<DueDiligence />);
    expect(screen.getByText("Alvo da Análise")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nome da empresa/)).toBeInTheDocument();
  });

  it("renders context textarea", () => {
    renderWithProviders(<DueDiligence />);
    expect(screen.getByText("Contexto e Documentos Relevantes")).toBeInTheDocument();
  });

  it("renders execute button", () => {
    renderWithProviders(<DueDiligence />);
    expect(screen.getByText("Executar Due Diligence")).toBeInTheDocument();
  });

  it("renders checklist cards when no report", () => {
    renderWithProviders(<DueDiligence />);
    expect(screen.getByText("Riscos Jurídicos")).toBeInTheDocument();
    expect(screen.getByText("Compliance")).toBeInTheDocument();
    expect(screen.getByText("Impacto Financeiro")).toBeInTheDocument();
    expect(screen.getByText("Inconsistências")).toBeInTheDocument();
  });

  it("execute button is disabled without target name", () => {
    renderWithProviders(<DueDiligence />);
    const btn = screen.getByText("Executar Due Diligence").closest("button");
    expect(btn).toBeDisabled();
  });
});
