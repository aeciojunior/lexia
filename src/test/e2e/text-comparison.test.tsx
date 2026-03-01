import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
      <span data-testid="diff-original">{original.slice(0, 50)}</span>
      <span data-testid="diff-revised">{revised.slice(0, 50)}</span>
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

describe("TextComparison Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title and input areas", () => {
    renderPage();
    expect(screen.getByText("Comparação de Textos")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox").length).toBeGreaterThanOrEqual(2);
  });

  it("shows comparison type selector with options", async () => {
    renderPage();
    const trigger = screen.getByText("Geral");
    expect(trigger).toBeInTheDocument();
  });

  it("shows Upload PDF buttons", () => {
    renderPage();
    const uploadButtons = screen.getAllByText("Upload PDF");
    expect(uploadButtons).toHaveLength(2);
  });

  it("disables compare button when texts are empty", () => {
    renderPage();
    const compareBtn = screen.getByText("Comparar Textos");
    expect(compareBtn.closest("button")).toBeDisabled();
  });

  it("enables compare button when both texts are filled", async () => {
    renderPage();
    const user = userEvent.setup();
    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);
    
    await user.type(textareas[0], "Texto do documento A com conteúdo jurídico");
    await user.type(textareas[1], "Texto do documento B com alterações jurídicas");

    const compareBtn = screen.getByText("Comparar Textos");
    expect(compareBtn.closest("button")).not.toBeDisabled();
  });

  it("renders DiffView with pasted texts", async () => {
    renderPage();
    const user = userEvent.setup();
    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);

    await user.type(textareas[0], "Texto original");
    await user.type(textareas[1], "Texto modificado");

    // Click Diff Literal tab
    const diffTab = screen.getByText("Diff Literal");
    await user.click(diffTab);

    const diffView = screen.getByTestId("diff-view");
    expect(diffView).toBeInTheDocument();
    expect(screen.getByTestId("diff-original")).toHaveTextContent("Texto original");
    expect(screen.getByTestId("diff-revised")).toHaveTextContent("Texto modificado");
  });

  it("calls compare-texts edge function and shows AI analysis", async () => {
    const mockAnalysis = {
      resumo: "Os textos possuem diferenças significativas na fundamentação jurídica.",
      alteracoes_criticas: [
        { trecho: "Art. 5º CF", tipo: "modificação", descricao: "Fundamento alterado", risco: "alto" },
      ],
      alteracoes_semanticas: [
        { original: "O réu deve pagar", modificado: "O réu poderá pagar", impacto: "Mudança de obrigatoriedade" },
      ],
      alteracoes_juridicas: [
        { aspecto: "Pedido principal", antes: "Condenação", depois: "Declaração", impacto_juridico: "Mudança de natureza do pedido", risco: "alto" },
      ],
      sugestoes_harmonizacao: ["Revisar fundamentação do Art. 5º"],
      risco_geral: "alto",
    };

    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "comp-1" }, analysis: mockAnalysis },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();
    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);

    await user.type(textareas[0], "Texto A jurídico");
    await user.type(textareas[1], "Texto B modificado");

    const compareBtn = screen.getByText("Comparar Textos");
    await user.click(compareBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("compare-texts", {
        body: expect.objectContaining({
          textA: "Texto A jurídico",
          textB: "Texto B modificado",
          comparisonType: "general",
          organizationId: "test-org-id",
        }),
      });
    });

    // After loading, the analysis tab should be active
    await waitFor(() => {
      expect(screen.getByText(/diferenças significativas/)).toBeInTheDocument();
    });

    // Check risk badge
    expect(screen.getByText("Risco alto")).toBeInTheDocument();

    // Check critical changes
    expect(screen.getByText("Alterações Críticas (1)")).toBeInTheDocument();
    expect(screen.getByText("Fundamento alterado")).toBeInTheDocument();

    // Check semantic changes
    expect(screen.getByText("Alterações Semânticas (1)")).toBeInTheDocument();

    // Check suggestions
    expect(screen.getByText(/Revisar fundamentação/)).toBeInTheDocument();
  });

  it("shows risk panel with juridical changes", async () => {
    const mockAnalysis = {
      resumo: "Resumo",
      alteracoes_criticas: [],
      alteracoes_semanticas: [],
      alteracoes_juridicas: [
        { aspecto: "Cláusula de rescisão", antes: "Multa de 10%", depois: "Multa de 50%", impacto_juridico: "Aumento significativo de penalidade", risco: "alto" },
      ],
      sugestoes_harmonizacao: [],
      risco_geral: "alto",
    };

    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "comp-2" }, analysis: mockAnalysis },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();
    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);

    await user.type(textareas[0], "Contrato v1");
    await user.type(textareas[1], "Contrato v2");
    await user.click(screen.getByText("Comparar Textos"));

    await waitFor(() => {
      expect(screen.getByText("Resumo")).toBeInTheDocument();
    });

    // Navigate to Risks tab
    const risksTab = screen.getByText("Riscos");
    await user.click(risksTab);

    await waitFor(() => {
      expect(screen.getByText("Cláusula de rescisão")).toBeInTheDocument();
      expect(screen.getByText("Multa de 10%")).toBeInTheDocument();
      expect(screen.getByText("Multa de 50%")).toBeInTheDocument();
      expect(screen.getByText("Aumento significativo de penalidade")).toBeInTheDocument();
    });
  });

  it("shows character count for both text areas", async () => {
    renderPage();
    const user = userEvent.setup();
    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);

    await user.type(textareas[0], "ABC");

    expect(screen.getByText("3 caracteres")).toBeInTheDocument();
  });

  it("handles API error gracefully", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { error: "Erro no gateway de IA" },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();
    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);

    await user.type(textareas[0], "Texto A");
    await user.type(textareas[1], "Texto B");
    await user.click(screen.getByText("Comparar Textos"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
  });
});
