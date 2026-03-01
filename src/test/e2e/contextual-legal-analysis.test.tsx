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
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
    from: () => ({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
      delete: mockDelete,
    }),
  },
}));

// Mock DiffView
vi.mock("@/components/drafts/DiffView", () => ({
  default: ({ original, revised }: { original: string; revised: string }) => (
    <div data-testid="diff-view">
      <span>{original.slice(0, 20)}</span>
      <span>{revised.slice(0, 20)}</span>
    </div>
  ),
}));

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

const fullMockAnalysis = {
  resumo: "Análise contextualizada concluída",
  risco_geral: "alto",
  alteracoes_criticas: [],
  alteracoes_semanticas: [],
  alteracoes_juridicas: [],
  sugestoes_harmonizacao: [],
  analise_juridica_contextualizada: {
    resumo_impacto_geral: "As alterações introduzem riscos significativos na fundamentação jurídica do caso.",
    impactos: [
      {
        descricao_alteracao: "Alteração do fundamento constitucional invocado",
        interpretacao_juridica: "A troca do Art. 5º pelo Art. 37 modifica a base de argumentação",
        categoria: "fundamentos",
        impacto: "alto",
        fundamentos_afetados: ["Art. 5º CF", "Art. 37 CF"],
        jurisprudencia_relacionada: ["STF RE 123456"],
        riscos_introduzidos: ["Perda de precedente favorável"],
        riscos_removidos: ["Argumento fraco eliminado"],
        sugestoes_mitigacao: ["Manter referência subsidiária ao Art. 5º"],
        recomendacao: "revisar",
        explicacao_simples: "A mudança pode enfraquecer o argumento principal do caso.",
        explicacao_tecnica: "A substituição do fundamento constitucional altera o paradigma jurisprudencial aplicável.",
        exemplo_pratico: "Se um juiz seguir o entendimento do STF, a nova fundamentação pode não ser aceita.",
      },
      {
        descricao_alteracao: "Remoção de pedido cautelar",
        interpretacao_juridica: "A ausência do pedido cautelar elimina proteção provisória",
        categoria: "pedidos",
        impacto: "medio",
        recomendacao: "reverter",
        explicacao_simples: "Sem a cautelar, não há proteção temporária enquanto o caso tramita.",
        explicacao_tecnica: "A supressão do pedido de tutela provisória remove a possibilidade de antecipação dos efeitos.",
      },
    ],
    analise_por_tribunal: {
      tribunal: "TJ-SP",
      entendimento_predominante: "O TJ-SP tende a aceitar fundamentação com base no Art. 37 em casos administrativos",
      riscos_especificos: ["Câmara de Direito Público pode divergir", "Prazo recursal diferenciado"],
      recomendacoes_adaptadas: ["Incluir precedente local do TJ-SP", "Citar Súmula 473 STF"],
    },
    cenarios: [
      {
        nome: "Cenário A: Manter alterações",
        descricao: "Prosseguir com a nova fundamentação baseada no Art. 37",
        impacto_juridico: "Risco moderado de improcedência",
        impacto_probatorio: "Provas documentais permanecem válidas",
        impacto_financeiro: "Custo adicional com perícia",
        riscos: ["Rejeição pelo tribunal", "Necessidade de emenda"],
        vantagens: ["Argumento mais moderno", "Alinhamento com jurisprudência recente"],
        desvantagens: ["Perda de precedente consolidado", "Risco de indeferimento liminar"],
        recomendacao: "Prosseguir com cautela e manter fundamentação subsidiária",
      },
      {
        nome: "Cenário B: Reverter alterações",
        descricao: "Retornar à fundamentação original com Art. 5º",
        impacto_juridico: "Risco baixo, fundamentação consolidada",
        riscos: ["Argumento pode ser considerado ultrapassado"],
        vantagens: ["Precedente favorável existente"],
        desvantagens: ["Não acompanha evolução jurisprudencial"],
        recomendacao: "Opção mais segura, recomendada para casos conservadores",
      },
    ],
  },
};

describe("Contextual Legal Analysis — Full E2E", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects contextual_legal type, compares texts, and shows Impacto Jurídico tab", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "ctx-1" }, analysis: fullMockAnalysis },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();

    // 1. Select "Análise Jurídica Contextualizada"
    const trigger = screen.getByText("Geral");
    await user.click(trigger);
    const option = await screen.findByText("Análise Jurídica Contextualizada");
    await user.click(option);

    // 2. Fill both texts
    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
    await user.type(textareas[0], "Petição inicial com Art. 5º CF");
    await user.type(textareas[1], "Petição revisada com Art. 37 CF");

    // 3. Click compare
    const compareBtn = screen.getByText("Comparar Textos");
    await user.click(compareBtn);

    // 4. Verify edge function called with contextual_legal type
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("compare-texts", {
        body: expect.objectContaining({
          comparisonType: "contextual_legal",
          organizationId: "test-org-id",
        }),
      });
    });

    // 5. Verify Impacto Jurídico tab auto-activates and shows summary
    await waitFor(() => {
      expect(screen.getByText("Resumo do Impacto Geral")).toBeInTheDocument();
    });
    expect(screen.getByText(/riscos significativos na fundamentação/)).toBeInTheDocument();
  });

  it("renders impact cards grouped by category with correct badges", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "ctx-2" }, analysis: fullMockAnalysis },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();

    const trigger = screen.getByText("Geral");
    await user.click(trigger);
    await user.click(await screen.findByText("Análise Jurídica Contextualizada"));

    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
    await user.type(textareas[0], "Texto A");
    await user.type(textareas[1], "Texto B");
    await user.click(screen.getByText("Comparar Textos"));

    await waitFor(() => {
      expect(screen.getByText("Resumo do Impacto Geral")).toBeInTheDocument();
    });

    // Category headers
    expect(screen.getByText(/Fundamentos Jurídicos \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Pedidos \(1\)/)).toBeInTheDocument();

    // Impact descriptions
    expect(screen.getByText("Alteração do fundamento constitucional invocado")).toBeInTheDocument();
    expect(screen.getByText("Remoção de pedido cautelar")).toBeInTheDocument();

    // Recommendation badges
    expect(screen.getByText("revisar")).toBeInTheDocument();
    expect(screen.getByText("reverter")).toBeInTheDocument();

    // Risk badges
    expect(screen.getByText("alto")).toBeInTheDocument();
    expect(screen.getByText("medio")).toBeInTheDocument();
  });

  it("toggles between simple and technical explanations", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "ctx-3" }, analysis: fullMockAnalysis },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();

    const trigger = screen.getByText("Geral");
    await user.click(trigger);
    await user.click(await screen.findByText("Análise Jurídica Contextualizada"));

    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
    await user.type(textareas[0], "Texto A");
    await user.type(textareas[1], "Texto B");
    await user.click(screen.getByText("Comparar Textos"));

    await waitFor(() => {
      expect(screen.getByText("Resumo do Impacto Geral")).toBeInTheDocument();
    });

    // Default is simple mode
    expect(screen.getByText("A mudança pode enfraquecer o argumento principal do caso.")).toBeInTheDocument();

    // Toggle to technical mode
    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    expect(screen.getByText("A substituição do fundamento constitucional altera o paradigma jurisprudencial aplicável.")).toBeInTheDocument();
  });

  it("shows court analysis section with tribunal details", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "ctx-4" }, analysis: fullMockAnalysis },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();

    const trigger = screen.getByText("Geral");
    await user.click(trigger);
    await user.click(await screen.findByText("Análise Jurídica Contextualizada"));

    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
    await user.type(textareas[0], "Texto A");
    await user.type(textareas[1], "Texto B");
    await user.click(screen.getByText("Comparar Textos"));

    await waitFor(() => {
      expect(screen.getByText(/Análise por Tribunal: TJ-SP/)).toBeInTheDocument();
    });

    expect(screen.getByText("Entendimento predominante")).toBeInTheDocument();
    expect(screen.getByText(/TJ-SP tende a aceitar/)).toBeInTheDocument();
    expect(screen.getByText("Riscos específicos do tribunal")).toBeInTheDocument();
    expect(screen.getByText("Câmara de Direito Público pode divergir")).toBeInTheDocument();
    expect(screen.getByText("Recomendações adaptadas")).toBeInTheDocument();
    expect(screen.getByText("Incluir precedente local do TJ-SP")).toBeInTheDocument();
  });

  it("renders scenario simulation cards with details", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "ctx-5" }, analysis: fullMockAnalysis },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();

    const trigger = screen.getByText("Geral");
    await user.click(trigger);
    await user.click(await screen.findByText("Análise Jurídica Contextualizada"));

    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
    await user.type(textareas[0], "Texto A");
    await user.type(textareas[1], "Texto B");
    await user.click(screen.getByText("Comparar Textos"));

    await waitFor(() => {
      expect(screen.getByText(/Simulação de Cenários \(2\)/)).toBeInTheDocument();
    });

    // Scenario A
    expect(screen.getByText("Cenário A: Manter alterações")).toBeInTheDocument();
    expect(screen.getByText(/Risco moderado de improcedência/)).toBeInTheDocument();
    expect(screen.getByText("Argumento mais moderno")).toBeInTheDocument();
    expect(screen.getByText("Perda de precedente consolidado")).toBeInTheDocument();

    // Scenario B
    expect(screen.getByText("Cenário B: Reverter alterações")).toBeInTheDocument();
    expect(screen.getByText(/fundamentação consolidada/)).toBeInTheDocument();
    expect(screen.getByText("Precedente favorável existente")).toBeInTheDocument();
  });

  it("shows risks introduced, removed, and mitigation suggestions in impact cards", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "ctx-6" }, analysis: fullMockAnalysis },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();

    const trigger = screen.getByText("Geral");
    await user.click(trigger);
    await user.click(await screen.findByText("Análise Jurídica Contextualizada"));

    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
    await user.type(textareas[0], "Texto A");
    await user.type(textareas[1], "Texto B");
    await user.click(screen.getByText("Comparar Textos"));

    await waitFor(() => {
      expect(screen.getByText("Resumo do Impacto Geral")).toBeInTheDocument();
    });

    // Risks & suggestions from first impact
    expect(screen.getByText("Perda de precedente favorável")).toBeInTheDocument();
    expect(screen.getByText("Manter referência subsidiária ao Art. 5º")).toBeInTheDocument();

    // Fundamentos badges
    expect(screen.getByText("Art. 5º CF")).toBeInTheDocument();
    expect(screen.getByText("Art. 37 CF")).toBeInTheDocument();
    expect(screen.getByText("STF RE 123456")).toBeInTheDocument();

    // Practical example
    expect(screen.getByText(/Se um juiz seguir o entendimento do STF/)).toBeInTheDocument();
  });
});
