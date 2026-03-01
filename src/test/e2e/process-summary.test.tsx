import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProcessSummary360 from "@/components/process/ProcessSummary360";
import { renderWithProviders, mockSupabase, createTestQueryClient } from "../helpers";

vi.mock("@/assets/hero-bg.jpg", () => ({ default: "hero-bg-mock.jpg" }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, session: { user: { id: "u1" } }, loading: false, signOut: vi.fn() }),
  AuthProvider: ({ children }: any) => children,
}));

describe("ProcessSummary360 — E2E", () => {
  const createChainMock = (finalData: any = null) => {
    const chain: any = {};
    const methods = ["select", "insert", "update", "delete", "eq", "neq", "gte", "order", "limit", "single"];
    methods.forEach(m => { chain[m] = vi.fn().mockReturnValue(chain); });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: finalData, error: null });
    chain.then = vi.fn((cb: any) => cb({ data: finalData ? [finalData] : [], error: null }));
    return chain;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockImplementation(() => createChainMock(null));
  });

  const render360 = (mockData: any = null, processId = "p1") => {
    if (mockData) {
      mockSupabase.from.mockImplementation(() => createChainMock(mockData));
    }
    return renderWithProviders(
      <ProcessSummary360 processId={processId} organizationId="o1" />,
      { queryClient: createTestQueryClient() }
    );
  };

  it("renders empty state when no summary exists", async () => {
    render360();
    await waitFor(() => {
      expect(screen.getByText("Nenhum resumo gerado para este processo.")).toBeInTheDocument();
    });
  });

  it("shows generate button in empty state", async () => {
    render360();
    await waitFor(() => {
      expect(screen.getByText("Gerar resumo com IA")).toBeInTheDocument();
    });
  });

  it("renders section header with Resumo 360 label", () => {
    render360();
    expect(screen.getByText("Resumo 360 (IA)")).toBeInTheDocument();
  });

  it("opens config dialog on refresh button click", async () => {
    render360();
    await userEvent.click(screen.getByTitle("Gerar/Configurar resumo"));
    await waitFor(() => {
      expect(screen.getByText("Configurar Resumo")).toBeInTheDocument();
    });
  });

  it("shows style and detail options in config dialog", async () => {
    render360();
    await userEvent.click(screen.getByTitle("Gerar/Configurar resumo"));
    await waitFor(() => {
      expect(screen.getByText("Estilo")).toBeInTheDocument();
      expect(screen.getByText("Detalhamento")).toBeInTheDocument();
      expect(screen.getByText("Foco (opcional)")).toBeInTheDocument();
    });
  });

  it("shows all focus options in config dialog", async () => {
    render360();
    await userEvent.click(screen.getByTitle("Gerar/Configurar resumo"));
    await waitFor(() => {
      expect(screen.getByText("Riscos")).toBeInTheDocument();
      expect(screen.getByText("Prazos")).toBeInTheDocument();
      expect(screen.getByText("Decisões")).toBeInTheDocument();
      expect(screen.getByText("Documentos")).toBeInTheDocument();
      expect(screen.getByText("Fatos")).toBeInTheDocument();
      expect(screen.getByText("Pedidos")).toBeInTheDocument();
    });
  });

  it("shows RF references in config dialog", async () => {
    render360();
    await userEvent.click(screen.getByTitle("Gerar/Configurar resumo"));
    await waitFor(() => {
      expect(screen.getByText("Classificação (RF-034)")).toBeInTheDocument();
      expect(screen.getByText("Decisões (RF-040)")).toBeInTheDocument();
      expect(screen.getByText("Prazos (RF-041)")).toBeInTheDocument();
      expect(screen.getByText("Documentos (RF-042)")).toBeInTheDocument();
    });
  });

  it("renders summary text when data exists", async () => {
    render360({
      id: "s1",
      process_id: "p1",
      summary_type: "processo",
      summary_text: "Trata-se de ação de cobrança com risco alto.",
      confidence: 0.87,
      origin: "automatica",
      config: { style: "executivo" },
      relevant_excerpts: ["ação de cobrança", "risco alto"],
      created_at: "2026-02-13T10:00:00Z",
    });
    await waitFor(() => {
      expect(screen.getByText("Trata-se de ação de cobrança com risco alto.")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("shows confidence and badges for existing summary", async () => {
    render360({
      id: "s1",
      process_id: "p1",
      summary_text: "Resumo de teste",
      confidence: 0.87,
      origin: "automatica",
      config: { style: "executivo" },
      relevant_excerpts: [],
      created_at: "2026-02-13T10:00:00Z",
    });
    await waitFor(() => {
      expect(screen.getByText("87%")).toBeInTheDocument();
      expect(screen.getByText("IA")).toBeInTheDocument();
      expect(screen.getByText("Executivo")).toBeInTheDocument();
    });
  });

  it("can collapse and expand the section", async () => {
    render360();
    const toggleBtn = screen.getByText("Resumo 360 (IA)").closest("button")!;
    
    await userEvent.click(toggleBtn);
    await waitFor(() => {
      expect(screen.queryByText("Nenhum resumo gerado para este processo.")).not.toBeInTheDocument();
    });

    await userEvent.click(toggleBtn);
    await waitFor(() => {
      expect(screen.getByText("Nenhum resumo gerado para este processo.")).toBeInTheDocument();
    });
  });
});
