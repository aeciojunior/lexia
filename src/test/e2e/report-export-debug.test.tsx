import { describe, it, expect, vi, beforeEach } from "vitest";
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
    <div data-testid="diff-view">
      <span>{original.slice(0, 50)}</span>
      <span>{revised.slice(0, 50)}</span>
    </div>
  ),
}));

// jsPDF mock
const mockSave = vi.fn();
vi.mock("jspdf", () => {
  return {
    default: class MockJsPDF {
      setFontSize = vi.fn();
      text = vi.fn();
      splitTextToSize = vi.fn().mockReturnValue(["line"]);
      addPage = vi.fn();
      save = mockSave;
    },
  };
});

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

describe("Debug: with jsPDF mock", () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    mockInsert.mockClear();
    mockSave.mockClear();
  });

  it("comparison works with jsPDF mocked", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { comparison: { id: "comp-1" }, analysis: { resumo: "Test resumo" } },
      error: null,
    });

    renderPage();
    const user = userEvent.setup();
    const textareas = screen.getAllByPlaceholderText(/Cole texto aqui/);

    await user.type(textareas[0], "AAA");
    await user.type(textareas[1], "BBB");

    await user.click(screen.getByText("Comparar Textos"));

    await waitFor(() => {
      expect(screen.getByText("Test resumo")).toBeInTheDocument();
    });
  });
});
