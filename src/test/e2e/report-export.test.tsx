import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TextComparison from "@/pages/TextComparison";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Exact same mock pattern as text-comparison.test.tsx
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id", email: "test@test.com" } }),
}));
vi.mock("@/hooks/useOrganization", () => ({
  useOrganization: () => ({
    activeOrgId: "test-org-id",
    organizations: [{ id: "test-org-id", name: "Test Org" }],
  }),
}));

const mockInvoke = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
    from: () => ({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
      delete: mockDelete,
      insert: mockInsert,
    }),
  },
}));

vi.mock("@/components/drafts/DiffView", () => ({
  default: ({ original, revised }: { original: string; revised: string }) => (
    <div data-testid="diff-view"><span>{original.slice(0, 50)}</span><span>{revised.slice(0, 50)}</span></div>
  ),
}));

const mockSave = vi.fn();
vi.mock("jspdf", () => ({
  default: class MockJsPDF {
    setFontSize = vi.fn();
    text = vi.fn();
    splitTextToSize = vi.fn().mockReturnValue(["line"]);
    addPage = vi.fn();
    save = mockSave;
  },
}));

const mockCreateObjectURL = vi.fn().mockReturnValue("blob:test");
const mockRevokeObjectURL = vi.fn();
Object.defineProperty(URL, "createObjectURL", { value: mockCreateObjectURL, writable: true });
Object.defineProperty(URL, "revokeObjectURL", { value: mockRevokeObjectURL, writable: true });

const FULL_ANALYSIS = {
  resumo: "Diferenças significativas encontradas.",
  similaridade_percentual: 72,
  risco_geral: "alto",
  alteracoes_criticas: [
    { trecho: "Art. 5º CF", tipo: "modificação", descricao: "Fundamento alterado", risco: "alto" },
  ],
  alteracoes_semanticas: [
    { original: "O réu deve pagar", modificado: "O réu poderá pagar", impacto: "Mudança obrigatória" },
  ],
  alteracoes_juridicas: [
    { aspecto: "Pedido principal", antes: "Condenação", depois: "Declaração", impacto_juridico: "Mudança de natureza", risco: "alto" },
  ],
  sugestoes_harmonizacao: ["Revisar fundamentação do Art. 5º"],
  analise_juridica_contextualizada: {
    resumo_impacto_geral: "Impacto geral alto.",
    impactos: [{
      descricao_alteracao: "Alteração de fundamento", interpretacao_juridica: "Interpretação grave",
      categoria: "fundamentos", impacto: "alto", recomendacao: "revisar",
      explicacao_simples: "Explicação simples", explicacao_tecnica: "Explicação técnica detalhada",
    }],
    cenarios: [{
      nome: "Cenário A", descricao: "Cenário otimista",
      impacto_juridico: "Favorável", riscos: ["Risco mínimo"], recomendacao: "Manter",
    }],
  },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter><TextComparison /></BrowserRouter>
    </QueryClientProvider>
  );
}

describe("Report Export Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore implementations cleared by clearAllMocks
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockOrder.mockReturnThis();
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockInsert.mockResolvedValue({ error: null });
    mockCreateObjectURL.mockReturnValue("blob:test");
  });

  it("does not show export button before comparison", () => {
    renderPage();
    expect(screen.queryByText("Exportar Relatório")).not.toBeInTheDocument();
  });

  it("shows 6 export options and exports Técnico PDF correctly", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "comp-1" }, analysis: FULL_ANALYSIS },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();
    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
    await user.type(textareas[0], "Texto A jurídico");
    await user.type(textareas[1], "Texto B modificado");
    await user.click(screen.getByText("Comparar Textos"));

    await waitFor(() => {
      expect(screen.getByText(/Diferenças significativas/)).toBeInTheDocument();
    });

    // Open dropdown
    await user.click(screen.getByText("Exportar Relatório"));

    // All 6 options present
    expect(screen.getByText("Executivo (PDF)")).toBeInTheDocument();
    expect(screen.getByText("Técnico (PDF)")).toBeInTheDocument();
    expect(screen.getByText("Auditoria (PDF)")).toBeInTheDocument();
    expect(screen.getByText("Executivo (HTML)")).toBeInTheDocument();
    expect(screen.getByText("Técnico (HTML)")).toBeInTheDocument();
    expect(screen.getByText("Auditoria (HTML)")).toBeInTheDocument();

    // Export PDF
    await user.click(screen.getByText("Técnico (PDF)"));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.stringMatching(/comparacao-tecnico-\d{4}-\d{2}-\d{2}-\d{4}\.pdf/)
      );
    });

    // Audit logs
    await waitFor(() => {
      const actions = mockInsert.mock.calls.map((c: any) => c[0]?.action);
      expect(actions).toContain("comparison_report_generated");
      expect(actions).toContain("technical_report_generated");
      expect(actions).toContain("comparison_report_risk_detected");
      expect(actions).toContain("comparison_report_recommendation_generated");
    });
  });

  it("exports Executivo HTML with simplified content and collapsible sections", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "comp-2" }, analysis: FULL_ANALYSIS },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();
    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
    await user.type(textareas[0], "Texto A");
    await user.type(textareas[1], "Texto B");
    await user.click(screen.getByText("Comparar Textos"));

    await waitFor(() => {
      expect(screen.getByText(/Diferenças significativas/)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Exportar Relatório"));
    await user.click(screen.getByText("Executivo (HTML)"));

    await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());

    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/html;charset=utf-8");
    const html = await blob.text();

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Executivo (Cliente)");
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("Principais Diferenças");
    expect(html).toContain("Próximos Passos Recomendados");
    expect(html).toContain("72%");
    expect(html).toContain("width:72%");
    expect(html).not.toContain("Alterações Semânticas");
  });

  it("exports Técnico HTML with full sections, tables and risk badges", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "comp-3" }, analysis: FULL_ANALYSIS },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();
    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
    await user.type(textareas[0], "Texto A");
    await user.type(textareas[1], "Texto B");
    await user.click(screen.getByText("Comparar Textos"));

    await waitFor(() => {
      expect(screen.getByText(/Diferenças significativas/)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Exportar Relatório"));
    await user.click(screen.getByText("Técnico (HTML)"));

    await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());

    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    const html = await blob.text();

    expect(html).toContain("Técnico (Advogado)");
    expect(html).toContain("Alterações Semânticas");
    expect(html).toContain("Alterações Jurídicas");
    expect(html).toContain("Análise Jurídica Contextualizada");
    expect(html).toContain("Simulação de Cenários");
    expect(html).toContain("<table");
    expect(html).toContain("#ef4444");
    expect(html).toContain("ALTO");
    expect(html).toContain("cursor:pointer");
    expect((html.match(/<details/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  it("exports Auditoria HTML with audit trail and logs export_format", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "comp-4" }, analysis: FULL_ANALYSIS },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();
    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
    await user.type(textareas[0], "Texto A");
    await user.type(textareas[1], "Texto B");
    await user.click(screen.getByText("Comparar Textos"));

    await waitFor(() => {
      expect(screen.getByText(/Diferenças significativas/)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Exportar Relatório"));
    await user.click(screen.getByText("Auditoria (HTML)"));

    await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());

    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    const html = await blob.text();

    expect(html).toContain("Auditoria (Compliance)");
    expect(html).toContain("Trilha de Auditoria");
    expect(html).toContain("test-user-id");
    expect(html).toContain("test@test.com");
    expect(html).toContain("test-org-id");

    await waitFor(() => {
      const reportCall = mockInsert.mock.calls.find(
        (c: any) => c[0]?.action === "comparison_report_generated"
      );
      expect(reportCall).toBeDefined();
      expect(reportCall![0].metadata.export_format).toBe("html");
    });
  });
});
