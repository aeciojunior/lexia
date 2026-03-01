import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProcessSummary360 from "@/components/process/ProcessSummary360";
import { renderWithProviders, mockSupabase } from "../helpers";

vi.mock("@/assets/hero-bg.jpg", () => ({ default: "hero-bg-mock.jpg" }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, session: { user: { id: "u1" } }, loading: false, signOut: vi.fn() }),
  AuthProvider: ({ children }: any) => children,
}));

describe("ProcessSummary360 — E2E", () => {
  const createMockFrom = (maybeSingleData: any = null) => () => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: maybeSingleData, error: null }),
    then: vi.fn((cb: any) => cb({ data: [], error: null })),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockImplementation(createMockFrom(null));
  });

  it("renders empty state when no summary exists", async () => {
    renderWithProviders(
      <ProcessSummary360 processId="p1" organizationId="o1" />
    );

    await waitFor(() => {
      expect(screen.getByText("Nenhum resumo gerado para este processo.")).toBeInTheDocument();
    });
  });

  it("shows generate button in empty state", async () => {
    renderWithProviders(
      <ProcessSummary360 processId="p1" organizationId="o1" />
    );

    await waitFor(() => {
      expect(screen.getByText("Gerar resumo com IA")).toBeInTheDocument();
    });
  });

  it("renders section header with Resumo 360 label", () => {
    renderWithProviders(
      <ProcessSummary360 processId="p1" organizationId="o1" />
    );
    expect(screen.getByText("Resumo 360 (IA)")).toBeInTheDocument();
  });

  it("opens config dialog on refresh button click", async () => {
    renderWithProviders(
      <ProcessSummary360 processId="p1" organizationId="o1" />
    );

    const refreshBtn = screen.getByTitle("Gerar/Configurar resumo");
    await userEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByText("Configurar Resumo")).toBeInTheDocument();
    });
  });

  it("shows style and detail options in config dialog", async () => {
    renderWithProviders(
      <ProcessSummary360 processId="p1" organizationId="o1" />
    );

    await userEvent.click(screen.getByTitle("Gerar/Configurar resumo"));

    await waitFor(() => {
      expect(screen.getByText("Estilo")).toBeInTheDocument();
      expect(screen.getByText("Detalhamento")).toBeInTheDocument();
      expect(screen.getByText("Foco (opcional)")).toBeInTheDocument();
    });
  });

  it("shows focus options in config dialog", async () => {
    renderWithProviders(
      <ProcessSummary360 processId="p1" organizationId="o1" />
    );

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
    renderWithProviders(
      <ProcessSummary360 processId="p1" organizationId="o1" />
    );

    await userEvent.click(screen.getByTitle("Gerar/Configurar resumo"));

    await waitFor(() => {
      expect(screen.getByText("Classificação (RF-034)")).toBeInTheDocument();
      expect(screen.getByText("Decisões (RF-040)")).toBeInTheDocument();
      expect(screen.getByText("Prazos (RF-041)")).toBeInTheDocument();
      expect(screen.getByText("Documentos (RF-042)")).toBeInTheDocument();
    });
  });

  it("renders summary text when data exists", async () => {
    const summaryData = {
      id: "s1",
      process_id: "p1",
      summary_type: "processo",
      summary_text: "Trata-se de ação de cobrança com risco alto.",
      confidence: 0.87,
      origin: "automatica",
      config: { style: "executivo" },
      relevant_excerpts: ["ação de cobrança", "risco alto"],
      created_at: "2026-02-13T10:00:00Z",
    };

    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: summaryData, error: null }),
    }));

    renderWithProviders(
      <ProcessSummary360 processId="p1" organizationId="o1" />
    );

    await waitFor(() => {
      expect(screen.getByText("Trata-se de ação de cobrança com risco alto.")).toBeInTheDocument();
    });
  });

  it("shows confidence bar and badges for existing summary", async () => {
    const summaryData = {
      id: "s1",
      process_id: "p1",
      summary_text: "Resumo de teste",
      confidence: 0.87,
      origin: "automatica",
      config: { style: "executivo" },
      relevant_excerpts: [],
      created_at: "2026-02-13T10:00:00Z",
    };

    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: summaryData, error: null }),
    }));

    renderWithProviders(
      <ProcessSummary360 processId="p1" organizationId="o1" />
    );

    await waitFor(() => {
      expect(screen.getByText("87%")).toBeInTheDocument();
      expect(screen.getByText("IA")).toBeInTheDocument();
      expect(screen.getByText("Executivo")).toBeInTheDocument();
    });
  });

  it("can collapse and expand the section", async () => {
    renderWithProviders(
      <ProcessSummary360 processId="p1" organizationId="o1" />
    );

    const toggleBtn = screen.getByText("Resumo 360 (IA)").closest("button")!;
    
    // Collapse
    await userEvent.click(toggleBtn);
    await waitFor(() => {
      expect(screen.queryByText("Nenhum resumo gerado para este processo.")).not.toBeInTheDocument();
    });

    // Expand
    await userEvent.click(toggleBtn);
    await waitFor(() => {
      expect(screen.getByText("Nenhum resumo gerado para este processo.")).toBeInTheDocument();
    });
  });
});
