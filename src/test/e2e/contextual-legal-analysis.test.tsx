import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TextComparison from "@/pages/TextComparison";
import { MemoryRouter } from "react-router-dom";
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

const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
  },
}));

vi.mock("@/components/drafts/DiffView", () => ({
  default: () => <div data-testid="diff-view" />,
}));

// Render with contextual_legal pre-selected via router state
function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[{ pathname: "/text-comparison", state: { comparisonType: "contextual_legal" } }]}>
        <TextComparison />
      </MemoryRouter>
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
        explicacao_simples: "Sem a cautelar, não há proteção temporária.",
        explicacao_tecnica: "A supressão do pedido de tutela provisória remove a possibilidade de antecipação dos efeitos.",
      },
    ],
    analise_por_tribunal: {
      tribunal: "TJ-SP",
      entendimento_predominante: "O TJ-SP tende a aceitar fundamentação com base no Art. 37",
      riscos_especificos: ["Câmara de Direito Público pode divergir"],
      recomendacoes_adaptadas: ["Incluir precedente local do TJ-SP"],
    },
    cenarios: [
      {
        nome: "Cenário A: Manter alterações",
        descricao: "Prosseguir com a nova fundamentação",
        impacto_juridico: "Risco moderado de improcedência",
        impacto_probatorio: "Provas documentais permanecem válidas",
        impacto_financeiro: "Custo adicional com perícia",
        riscos: ["Rejeição pelo tribunal"],
        vantagens: ["Argumento mais moderno"],
        desvantagens: ["Perda de precedente consolidado"],
        recomendacao: "Prosseguir com cautela",
      },
      {
        nome: "Cenário B: Reverter alterações",
        descricao: "Retornar à fundamentação original",
        impacto_juridico: "Risco baixo, fundamentação consolidada",
        riscos: ["Argumento pode ser considerado ultrapassado"],
        vantagens: ["Precedente favorável existente"],
        desvantagens: ["Não acompanha evolução jurisprudencial"],
        recomendacao: "Opção mais segura",
      },
    ],
  },
};

async function fillAndCompare() {
  mockInvoke.mockResolvedValueOnce({
    data: { comparison: { id: "ctx-1" }, analysis: fullMockAnalysis },
    error: null,
  });

  renderPage();
  const user = userEvent.setup();
  const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
  await user.type(textareas[0], "Petição Art 5");
  await user.type(textareas[1], "Petição Art 37");
  await user.click(screen.getByText("Comparar Textos"));
  return user;
}

describe("Contextual Legal Analysis — Full E2E", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls edge function with contextual_legal and shows summary", async () => {
    await fillAndCompare();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("compare-texts", {
        body: expect.objectContaining({ comparisonType: "contextual_legal" }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Resumo do Impacto Geral")).toBeInTheDocument();
    });
    expect(screen.getByText(/riscos significativos na fundamentação/)).toBeInTheDocument();
  });

  it("renders impacts grouped by category with badges", async () => {
    await fillAndCompare();

    await waitFor(() => {
      expect(screen.getByText(/Fundamentos Jurídicos \(1\)/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Pedidos \(1\)/)).toBeInTheDocument();
    expect(screen.getByText("Alteração do fundamento constitucional invocado")).toBeInTheDocument();
    expect(screen.getByText("revisar")).toBeInTheDocument();
    expect(screen.getByText("reverter")).toBeInTheDocument();
  });

  it("toggles simple/technical explanations", async () => {
    const user = await fillAndCompare();

    await waitFor(() => {
      expect(screen.getByText("A mudança pode enfraquecer o argumento principal do caso.")).toBeInTheDocument();
    });

    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    expect(screen.getByText("A substituição do fundamento constitucional altera o paradigma jurisprudencial aplicável.")).toBeInTheDocument();
  });

  it("shows court analysis", async () => {
    await fillAndCompare();

    await waitFor(() => {
      expect(screen.getByText(/Análise por Tribunal: TJ-SP/)).toBeInTheDocument();
    });
    expect(screen.getByText(/TJ-SP tende a aceitar/)).toBeInTheDocument();
    expect(screen.getByText("Câmara de Direito Público pode divergir")).toBeInTheDocument();
    expect(screen.getByText("Incluir precedente local do TJ-SP")).toBeInTheDocument();
  });

  it("renders scenario simulation cards", async () => {
    await fillAndCompare();

    await waitFor(() => {
      expect(screen.getByText(/Simulação de Cenários \(2\)/)).toBeInTheDocument();
    });
    expect(screen.getByText("Cenário A: Manter alterações")).toBeInTheDocument();
    expect(screen.getByText(/Risco moderado de improcedência/)).toBeInTheDocument();
    expect(screen.getByText("Argumento mais moderno")).toBeInTheDocument();
    expect(screen.getByText("Cenário B: Reverter alterações")).toBeInTheDocument();
  });

  it("shows risks, mitigations, fundamentos, and practical example", async () => {
    await fillAndCompare();

    await waitFor(() => {
      expect(screen.getByText("Perda de precedente favorável")).toBeInTheDocument();
    });
    expect(screen.getByText("Manter referência subsidiária ao Art. 5º")).toBeInTheDocument();
    expect(screen.getByText("Art. 5º CF")).toBeInTheDocument();
    expect(screen.getByText("STF RE 123456")).toBeInTheDocument();
    expect(screen.getByText(/Se um juiz seguir o entendimento do STF/)).toBeInTheDocument();
  });
});
