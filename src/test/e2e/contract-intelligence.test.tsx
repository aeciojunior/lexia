import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, mockSupabase } from "../helpers";

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    setFillColor: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    line: vi.fn(),
    circle: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn((t: string) => [t]),
    addPage: vi.fn(),
    save: vi.fn(),
    getNumberOfPages: vi.fn(() => 1),
    setPage: vi.fn(),
  })),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@test.com" }, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock("@/hooks/useOrganization", () => ({
  useOrganization: () => ({ activeOrgId: "org-1", organizations: [], loadingOrg: false }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    role: "owner",
    permissions: ["ANALYZE_CONTRACTS", "DRAFT_CONTRACTS"],
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
    isLoading: false,
    isOwner: true,
    isAdmin: true,
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

import { ContractIntelligencePanel } from "@/components/contracts/ContractIntelligencePanel";

const MOCK_CONTRACT = {
  id: "c1",
  title: "Contrato de Prestação de Serviços",
  contract_type: "service",
  status: "active",
  amount_cents: 15000000,
  currency: "BRL",
  organization_id: "org-1",
};

function setupChainMock(data: any = []) {
  const chain: any = {};
  ["select", "insert", "update", "delete", "eq", "neq", "gte", "order", "limit", "single", "in"].forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null });
  chain.then = vi.fn((cb: any) => cb({ data, error: null }));
  return chain;
}

describe("ContractIntelligencePanel — Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockImplementation(() => setupChainMock([]));
  });

  it("renders empty state when no contract selected", () => {
    renderWithProviders(<ContractIntelligencePanel contract={null} contracts={[]} />);
    expect(screen.getByText("Selecione um contrato na lista para acessar a inteligência contratual.")).toBeInTheDocument();
  });

  it("renders all 6 analysis tabs", () => {
    renderWithProviders(<ContractIntelligencePanel contract={MOCK_CONTRACT} contracts={[]} />);
    expect(screen.getByText("Análise Completa")).toBeInTheDocument();
    expect(screen.getByText("Cláusulas")).toBeInTheDocument();
    expect(screen.getByText("Renegociação")).toBeInTheDocument();
    expect(screen.getByText("Benchmarking")).toBeInTheDocument();
    expect(screen.getByText("Abusivas")).toBeInTheDocument();
    expect(screen.getByText("Redação")).toBeInTheDocument();
  });

  it("shows contract title in header", () => {
    renderWithProviders(<ContractIntelligencePanel contract={MOCK_CONTRACT} contracts={[]} />);
    expect(screen.getByText(`Inteligência Contratual — ${MOCK_CONTRACT.title}`)).toBeInTheDocument();
  });

  it("shows context textarea for non-draft tabs", () => {
    renderWithProviders(<ContractIntelligencePanel contract={MOCK_CONTRACT} contracts={[]} />);
    expect(screen.getByPlaceholderText("Contexto adicional (opcional)...")).toBeInTheDocument();
  });

  it("shows draft form when Redação tab is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ContractIntelligencePanel contract={MOCK_CONTRACT} contracts={[]} />);
    await user.click(screen.getByText("Redação"));
    await waitFor(() => {
      expect(screen.getByText("Partes")).toBeInTheDocument();
      expect(screen.getByText("Objeto")).toBeInTheDocument();
      expect(screen.getByText("Setor")).toBeInTheDocument();
      expect(screen.getByText("Valor")).toBeInTheDocument();
      expect(screen.getByText("Cláusulas LGPD")).toBeInTheDocument();
      expect(screen.getByText("Cláusula de Arbitragem")).toBeInTheDocument();
    });
  });

  it("calls analyze-contract edge function on Gerar Análise click", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { result: "# Análise Completa\n\nResultado da análise...", prediction_id: "p1" },
      error: null,
    });

    const user = userEvent.setup();
    renderWithProviders(<ContractIntelligencePanel contract={MOCK_CONTRACT} contracts={[]} />);

    await user.click(screen.getByText("Gerar Análise"));

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("analyze-contract", {
        body: expect.objectContaining({
          contract_id: "c1",
          organization_id: "org-1",
          analysis_type: "full_analysis",
          user_id: "u1",
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Resultado da análise")).toBeInTheDocument();
    });
  });

  it("shows Exportar PDF button after analysis result", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { result: "Resultado da análise completa", prediction_id: "p1" },
      error: null,
    });

    const user = userEvent.setup();
    renderWithProviders(<ContractIntelligencePanel contract={MOCK_CONTRACT} contracts={[]} />);
    await user.click(screen.getByText("Gerar Análise"));

    await waitFor(() => {
      expect(screen.getByText("Exportar PDF")).toBeInTheDocument();
    });
  });

  it("shows history toggle button", () => {
    renderWithProviders(<ContractIntelligencePanel contract={MOCK_CONTRACT} contracts={[]} />);
    expect(screen.getByText("Histórico")).toBeInTheDocument();
  });

  it("shows empty history message when toggled", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ContractIntelligencePanel contract={MOCK_CONTRACT} contracts={[]} />);
    await user.click(screen.getByText("Histórico"));
    await waitFor(() => {
      expect(screen.getByText("Nenhuma análise anterior encontrada.")).toBeInTheDocument();
    });
  });

  it("calls edge function for draft_contract with form context", async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { result: "# Minuta de Contrato\n\nCláusulas...", prediction_id: "p2" },
      error: null,
    });

    const user = userEvent.setup();
    renderWithProviders(<ContractIntelligencePanel contract={MOCK_CONTRACT} contracts={[]} />);
    await user.click(screen.getByText("Redação"));

    await waitFor(() => expect(screen.getByText("Gerar Minuta Completa")).toBeInTheDocument());
    await user.click(screen.getByText("Gerar Minuta Completa"));

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("analyze-contract", {
        body: expect.objectContaining({
          analysis_type: "draft_contract",
        }),
      });
    });
  });
});
