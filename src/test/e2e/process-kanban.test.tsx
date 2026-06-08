import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import ProcessKanban from "@/pages/ProcessKanban";
import { renderWithProviders, mockSupabase, createTestQueryClient } from "../helpers";
import { getKanbanColumns, getProcessColumnId } from "@/lib/processConstants";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

const mockProcesses = [
  {
    id: "p1",
    number: "0001234-56.2024.8.26.0100",
    title: "Ação de Cobrança",
    client_name: "João Silva",
    type: "civil",
    status: "active",
    fase: "Inicial",
    risk_level: "medium",
    responsible_id: "u1",
    kanban_position: 0,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "p2",
    number: "0009876-54.2023.8.26.0100",
    title: "Recurso Especial",
    client_name: "Maria Souza",
    type: "civil",
    status: "pending",
    fase: "Recurso",
    risk_level: "high",
    responsible_id: "u2",
    kanban_position: 0,
    created_at: "2024-02-01T00:00:00Z",
  },
];

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

vi.mock("@/hooks/useOrganization", () => ({
  useOrganization: () => ({ activeOrgId: "org-1", organizations: [], loadingOrg: false }),
}));

const { mockUsePermissions } = vi.hoisted(() => ({
  mockUsePermissions: vi.fn(() => ({
    hasPermission: (p: string) => p === "VIEW_PROCESSES" || p === "MANAGE_PROCESSES",
    isIntern: false,
    isClient: false,
  })),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
  ROLE_LABELS: {},
}));

function seedKanbanQueries() {
  const qc = createTestQueryClient();
  qc.setDefaultOptions({
    queries: { retry: false, gcTime: 0, staleTime: Infinity, refetchOnMount: false },
  });
  qc.setQueryData(["process-kanban", "org-1"], mockProcesses);
  qc.setQueryData(["org-members-kanban", "org-1"], [
    { user_id: "u1", full_name: "Ana Advogada" },
    { user_id: "u2", full_name: "Bruno Advogado" },
  ]);
  qc.setQueryData(["process-kanban-deadlines", "org-1"], {});
  return qc;
}

describe("Process Kanban", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({
      hasPermission: (p: string) => p === "VIEW_PROCESSES" || p === "MANAGE_PROCESSES",
      isIntern: false,
      isClient: false,
    });
    mockSupabase.from.mockImplementation((table: string) => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      const self = () => chain as any;

      const resolve = () => {
        if (table === "processes") return Promise.resolve({ data: mockProcesses, error: null });
        if (table === "user_organizations") {
          return Promise.resolve({
            data: [
              { user_id: "u1", profiles: { full_name: "Ana Advogada" } },
              { user_id: "u2", profiles: { full_name: "Bruno Advogado" } },
            ],
            error: null,
          });
        }
        if (table === "deadlines") return Promise.resolve({ data: [], error: null });
        if (table === "audit_logs") return Promise.resolve({ error: null });
        return Promise.resolve({ data: [], error: null });
      };

      for (const method of ["select", "insert", "update", "eq", "not"]) {
        chain[method] = vi.fn((col?: string) => {
          if (table === "processes" && method === "eq" && col === "archived") {
            return { order: vi.fn().mockImplementation(resolve) };
          }
          if (table === "user_organizations" && method === "eq" && col === "status") {
            return resolve();
          }
          if (table === "deadlines" && method === "not") {
            return resolve();
          }
          return self();
        });
      }

      chain.order = vi.fn().mockImplementation(resolve);
      chain.single = vi.fn().mockImplementation(() =>
        Promise.resolve({ data: mockProcesses[0], error: null }),
      );

      return self();
    });
  });

  const renderKanban = () =>
    renderWithProviders(<ProcessKanban />, { queryClient: createTestQueryClient() });

  it("renderiza colunas de fase por padrão", async () => {
    renderKanban();
    expect(await screen.findByText("Kanban de Processos")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Inicial")).toBeInTheDocument();
      expect(screen.getByText("Recurso")).toBeInTheDocument();
    });
  });

  it("agrupa processos mockados nas colunas corretas (fase)", () => {
    expect(getProcessColumnId(mockProcesses[0], "fase")).toBe("Inicial");
    expect(getProcessColumnId(mockProcesses[1], "fase")).toBe("Recurso");
  });

  it("exibe cards com título e cliente após carregar", async () => {
    renderWithProviders(<ProcessKanban />, { queryClient: seedKanbanQueries() });
    expect(await screen.findByText("Ação de Cobrança")).toBeInTheDocument();
    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText("Recurso Especial")).toBeInTheDocument();
  });

  it("exibe responsável e badge de risco nos cards", async () => {
    renderWithProviders(<ProcessKanban />, { queryClient: seedKanbanQueries() });
    expect(await screen.findByText("Médio")).toBeInTheDocument();
    expect(screen.getByText("Alto")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("desabilita drag quando MANAGE_PROCESSES ausente", async () => {
    mockUsePermissions.mockReturnValue({
      hasPermission: (p: string) => p === "VIEW_PROCESSES",
      isIntern: false,
      isClient: false,
    });
    renderWithProviders(<ProcessKanban />, { queryClient: seedKanbanQueries() });
    expect(await screen.findByText(/somente leitura/i)).toBeInTheDocument();
    expect(await screen.findByText("Ação de Cobrança")).toBeInTheDocument();
    expect(document.querySelector(".lucide-grip-vertical")).not.toBeInTheDocument();
  });

  it("mostra link para lista de processos", async () => {
    renderKanban();
    expect(await screen.findByRole("link", { name: /Ver lista/i })).toHaveAttribute("href", "/processes");
  });

  it("agrupa por status operacional", () => {
    expect(getProcessColumnId(mockProcesses[0], "status")).toBe("active");
    expect(getProcessColumnId(mockProcesses[1], "status")).toBe("pending");
    expect(getKanbanColumns("status").map((c) => c.id)).toContain("active");
  });
});
