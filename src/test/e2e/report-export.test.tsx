import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TextComparison from "@/pages/TextComparison";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock hooks
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id", email: "test@test.com" } }),
}));

vi.mock("@/hooks/useOrganization", () => ({
  useOrganization: () => ({
    activeOrgId: "test-org-id",
    organizations: [{ id: "test-org-id", name: "Test Org" }],
  }),
}));

// Mock supabase
const mockInvoke = vi.fn();
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFromChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
  insert: mockInsert,
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
    from: () => mockFromChain,
  },
}));

// Mock DiffView
vi.mock("@/components/drafts/DiffView", () => ({
  default: ({ original, revised }: { original: string; revised: string }) => (
    <div data-testid="diff-view">
      <span data-testid="diff-original">{original.slice(0, 50)}</span>
      <span data-testid="diff-revised">{revised.slice(0, 50)}</span>
    </div>
  ),
}));

// Mock jsPDF
const mockSave = vi.fn();
vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn().mockReturnValue(["line"]),
    addPage: vi.fn(),
    save: mockSave,
  })),
}));

// Mock URL.createObjectURL / revokeObjectURL for HTML export
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
    impactos: [
      {
        descricao_alteracao: "Alteração de fundamento",
        interpretacao_juridica: "Interpretação grave",
        categoria: "fundamentos",
        impacto: "alto",
        recomendacao: "revisar",
        explicacao_simples: "Explicação simples",
        explicacao_tecnica: "Explicação técnica detalhada",
      },
    ],
    cenarios: [
      {
        nome: "Cenário A",
        descricao: "Cenário otimista",
        impacto_juridico: "Favorável",
        riscos: ["Risco mínimo"],
        recomendacao: "Manter",
      },
    ],
  },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <TextComparison />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

async function runComparison() {
  const user = userEvent.setup();
  const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
  await user.type(textareas[0], "Texto A jurídico");
  await user.type(textareas[1], "Texto B modificado");
  await user.click(screen.getByText("Comparar Textos"));
  await waitFor(() => {
    expect(screen.getByText(/Diferenças significativas/)).toBeInTheDocument();
  });
  return user;
}

describe("Report Export Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({
      data: { comparison: { id: "comp-1" }, analysis: FULL_ANALYSIS },
      error: null,
    });
  });

  it("shows export dropdown with PDF and HTML options after comparison", async () => {
    renderPage();
    const user = await runComparison();

    const exportBtn = screen.getByText("Exportar Relatório");
    await user.click(exportBtn);

    // PDF options
    expect(screen.getByText("Executivo (PDF)")).toBeInTheDocument();
    expect(screen.getByText("Técnico (PDF)")).toBeInTheDocument();
    expect(screen.getByText("Auditoria (PDF)")).toBeInTheDocument();

    // HTML options
    expect(screen.getByText("Executivo (HTML)")).toBeInTheDocument();
    expect(screen.getByText("Técnico (HTML)")).toBeInTheDocument();
    expect(screen.getByText("Auditoria (HTML)")).toBeInTheDocument();
  });

  it("does not show export button before comparison", () => {
    renderPage();
    expect(screen.queryByText("Exportar Relatório")).not.toBeInTheDocument();
  });

  describe("PDF Export", () => {
    it.each([
      ["executivo", "Executivo (PDF)"],
      ["tecnico", "Técnico (PDF)"],
      ["auditoria", "Auditoria (PDF)"],
    ] as const)("exports %s PDF and logs audit events", async (type, label) => {
      renderPage();
      const user = await runComparison();

      await user.click(screen.getByText("Exportar Relatório"));
      await user.click(screen.getByText(label));

      await waitFor(() => {
        // jsPDF.save called with correct filename pattern
        expect(mockSave).toHaveBeenCalledWith(
          expect.stringMatching(new RegExp(`comparacao-${type}-\\d{4}-\\d{2}-\\d{2}-\\d{4}\\.pdf`))
        );
      });

      // Audit logs should be inserted (at least comparison_report_generated + type-specific)
      await waitFor(() => {
        const insertCalls = mockInsert.mock.calls;
        expect(insertCalls.length).toBeGreaterThanOrEqual(2);

        const actions = insertCalls.map((c: any) => c[0]?.action);
        expect(actions).toContain("comparison_report_generated");
      });
    });

    it("logs risk_detected for alto risk PDF", async () => {
      renderPage();
      const user = await runComparison();

      await user.click(screen.getByText("Exportar Relatório"));
      await user.click(screen.getByText("Técnico (PDF)"));

      await waitFor(() => {
        const actions = mockInsert.mock.calls.map((c: any) => c[0]?.action);
        expect(actions).toContain("comparison_report_risk_detected");
      });
    });

    it("logs recommendation_generated when suggestions exist", async () => {
      renderPage();
      const user = await runComparison();

      await user.click(screen.getByText("Exportar Relatório"));
      await user.click(screen.getByText("Executivo (PDF)"));

      await waitFor(() => {
        const actions = mockInsert.mock.calls.map((c: any) => c[0]?.action);
        expect(actions).toContain("comparison_report_recommendation_generated");
      });
    });
  });

  describe("HTML Export", () => {
    it.each([
      ["executivo", "Executivo (HTML)"],
      ["tecnico", "Técnico (HTML)"],
      ["auditoria", "Auditoria (HTML)"],
    ] as const)("exports %s HTML with correct blob", async (type, label) => {
      renderPage();
      const user = await runComparison();

      await user.click(screen.getByText("Exportar Relatório"));
      await user.click(screen.getByText(label));

      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledWith(
          expect.any(Blob)
        );
      });

      // Verify the blob content is HTML
      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      expect(blob.type).toBe("text/html;charset=utf-8");

      const htmlContent = await blob.text();
      expect(htmlContent).toContain("<!DOCTYPE html>");
      expect(htmlContent).toContain("Relatório de Comparação");
      expect(htmlContent).toContain("<details");
      expect(htmlContent).toContain("<summary");

      // Verify audit logging
      await waitFor(() => {
        const actions = mockInsert.mock.calls.map((c: any) => c[0]?.action);
        expect(actions).toContain("comparison_report_generated");
      });
    });

    it("HTML executivo contains simplified content", async () => {
      renderPage();
      const user = await runComparison();

      await user.click(screen.getByText("Exportar Relatório"));
      await user.click(screen.getByText("Executivo (HTML)"));

      await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const html = await blob.text();

      expect(html).toContain("Executivo (Cliente)");
      expect(html).toContain("Principais Diferenças");
      expect(html).toContain("Próximos Passos Recomendados");
      // Executive should NOT contain detailed semantic table
      expect(html).not.toContain("Alterações Semânticas");
    });

    it("HTML tecnico contains full analysis sections", async () => {
      renderPage();
      const user = await runComparison();

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
    });

    it("HTML auditoria contains audit trail section", async () => {
      renderPage();
      const user = await runComparison();

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
    });

    it("HTML report has collapsible sections with details/summary", async () => {
      renderPage();
      const user = await runComparison();

      await user.click(screen.getByText("Exportar Relatório"));
      await user.click(screen.getByText("Técnico (HTML)"));

      await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const html = await blob.text();

      // Count collapsible sections
      const detailsCount = (html.match(/<details/g) || []).length;
      expect(detailsCount).toBeGreaterThanOrEqual(4); // summary + diffs + legal + contextual at minimum

      // Check interactive elements
      expect(html).toContain("cursor:pointer");
      expect(html).toContain("<table");
    });

    it("HTML includes risk badges with color coding", async () => {
      renderPage();
      const user = await runComparison();

      await user.click(screen.getByText("Exportar Relatório"));
      await user.click(screen.getByText("Técnico (HTML)"));

      await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const html = await blob.text();

      // Risk colors present
      expect(html).toContain("#ef4444"); // alto = red
      expect(html).toContain("ALTO");
      expect(html).toContain("border-radius:999px"); // badge style
    });

    it("HTML includes similarity progress bar", async () => {
      renderPage();
      const user = await runComparison();

      await user.click(screen.getByText("Exportar Relatório"));
      await user.click(screen.getByText("Executivo (HTML)"));

      await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const html = await blob.text();

      expect(html).toContain("72%");
      expect(html).toContain("width:72%");
      expect(html).toContain("linear-gradient");
    });
  });

  describe("Audit metadata", () => {
    it("includes export_format in HTML audit logs", async () => {
      renderPage();
      const user = await runComparison();

      await user.click(screen.getByText("Exportar Relatório"));
      await user.click(screen.getByText("Técnico (HTML)"));

      await waitFor(() => {
        const calls = mockInsert.mock.calls;
        const reportCall = calls.find((c: any) => c[0]?.action === "comparison_report_generated");
        expect(reportCall).toBeDefined();
        expect(reportCall[0].metadata.export_format).toBe("html");
      });
    });
  });
});
