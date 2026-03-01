import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TextComparison from "@/pages/TextComparison";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      insert: (...args: any[]) => mockInsert(...args),
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
Object.defineProperty(URL, "createObjectURL", { value: mockCreateObjectURL, writable: true });
Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), writable: true });

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

describe("Report Export — PDF and HTML", () => {
  it("exports PDF with audit logs, then HTML with collapsible sections and audit trail", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "comp-1" }, analysis: FULL_ANALYSIS },
      error: null,
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <BrowserRouter><TextComparison /></BrowserRouter>
      </QueryClientProvider>
    );

    // Before comparison — no export button
    expect(screen.queryByText("Exportar Relatório")).not.toBeInTheDocument();

    // Run comparison
    const user = userEvent.setup();
    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
    await user.type(textareas[0], "Texto A jurídico");
    await user.type(textareas[1], "Texto B modificado");
    await user.click(screen.getByText("Comparar Textos"));

    await waitFor(() => expect(screen.getByText(/Diferenças significativas/)).toBeInTheDocument());

    // ═══ 1. Verify all 6 export options ═══
    await user.click(screen.getByText("Exportar Relatório"));
    expect(screen.getByText("Executivo (PDF)")).toBeInTheDocument();
    expect(screen.getByText("Técnico (PDF)")).toBeInTheDocument();
    expect(screen.getByText("Auditoria (PDF)")).toBeInTheDocument();
    expect(screen.getByText("Executivo (HTML)")).toBeInTheDocument();
    expect(screen.getByText("Técnico (HTML)")).toBeInTheDocument();
    expect(screen.getByText("Auditoria (HTML)")).toBeInTheDocument();

    // ═══ 2. Export Técnico PDF ═══
    await user.click(screen.getByText("Técnico (PDF)"));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(expect.stringMatching(/comparacao-tecnico-.*\.pdf/));
    });
    await waitFor(() => {
      const actions = mockInsert.mock.calls.map((c: any) => c[0]?.action);
      expect(actions).toContain("comparison_report_generated");
      expect(actions).toContain("technical_report_generated");
      expect(actions).toContain("comparison_report_risk_detected");
      expect(actions).toContain("comparison_report_recommendation_generated");
    });

    // ═══ 3. Export Executivo HTML ═══
    mockInsert.mockClear();
    mockCreateObjectURL.mockClear();
    mockCreateObjectURL.mockReturnValue("blob:test");

    await user.click(screen.getByText("Exportar Relatório"));
    await user.click(screen.getByText("Executivo (HTML)"));

    await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());
    const execBlob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(execBlob.type).toBe("text/html;charset=utf-8");
    const execHtml = await execBlob.text();

    expect(execHtml).toContain("<!DOCTYPE html>");
    expect(execHtml).toContain("Executivo (Cliente)");
    expect(execHtml).toContain("<details");
    expect(execHtml).toContain("<summary");
    expect(execHtml).toContain("Principais Diferenças");
    expect(execHtml).toContain("Próximos Passos Recomendados");
    expect(execHtml).toContain("72%");
    expect(execHtml).toContain("width:72%");
    expect(execHtml).not.toContain("Alterações Semânticas");

    // ═══ 4. Export Técnico HTML ═══
    mockCreateObjectURL.mockClear();
    mockCreateObjectURL.mockReturnValue("blob:test");

    await user.click(screen.getByText("Exportar Relatório"));
    await user.click(screen.getByText("Técnico (HTML)"));

    await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());
    const techHtml = await (mockCreateObjectURL.mock.calls[0][0] as Blob).text();

    expect(techHtml).toContain("Técnico (Advogado)");
    expect(techHtml).toContain("Alterações Semânticas");
    expect(techHtml).toContain("Alterações Jurídicas");
    expect(techHtml).toContain("Análise Jurídica Contextualizada");
    expect(techHtml).toContain("Simulação de Cenários");
    expect(techHtml).toContain("<table");
    expect(techHtml).toContain("#ef4444");
    expect(techHtml).toContain("ALTO");
    expect(techHtml).toContain("cursor:pointer");
    expect((techHtml.match(/<details/g) || []).length).toBeGreaterThanOrEqual(4);

    // ═══ 5. Export Auditoria HTML ═══
    mockInsert.mockClear();
    mockCreateObjectURL.mockClear();
    mockCreateObjectURL.mockReturnValue("blob:test");

    await user.click(screen.getByText("Exportar Relatório"));
    await user.click(screen.getByText("Auditoria (HTML)"));

    await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());
    const auditHtml = await (mockCreateObjectURL.mock.calls[0][0] as Blob).text();

    expect(auditHtml).toContain("Auditoria (Compliance)");
    expect(auditHtml).toContain("Trilha de Auditoria");
    expect(auditHtml).toContain("test-user-id");
    expect(auditHtml).toContain("test@test.com");
    expect(auditHtml).toContain("test-org-id");

    // Verify HTML audit log includes export_format
    await waitFor(() => {
      const call = mockInsert.mock.calls.find((c: any) => c[0]?.action === "comparison_report_generated");
      expect(call).toBeDefined();
      expect(call![0].metadata.export_format).toBe("html");
    });
  });
});
