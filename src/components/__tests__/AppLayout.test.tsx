import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock all heavy deps before importing component
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@test.com" },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/useOrganization", () => ({
  useOrganization: () => ({
    activeOrgId: "org1",
    organizations: [],
    loadingOrg: false,
    switchOrganization: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    role: "admin",
    hasPermission: () => true,
    hasAnyPermission: () => true,
    isClient: false,
    isAdmin: true,
    isOwner: false,
  }),
  ROLE_LABELS: { admin: "Admin", owner: "Owner", member: "Membro", viewer: "Visualizador", client: "Cliente" },
  ROLE_BADGE_VARIANT: { admin: "default", owner: "default", member: "secondary", viewer: "outline", client: "outline" },
}));

vi.mock("@/hooks/useRealtimeNotifications", () => ({
  useRealtimeNotifications: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      then: vi.fn((cb: any) => cb({ data: [], error: null })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

import AppLayout from "@/components/AppLayout";

function renderLayout(route = "/dashboard") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<div data-testid="child-page">Dashboard Content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

describe("AppLayout", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders sidebar and child route", () => {
    renderLayout();
    expect(screen.getByTestId("child-page")).toBeInTheDocument();
    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
  });

  it("renders main content area with correct structure", () => {
    renderLayout();
    const main = document.querySelector("main");
    expect(main).toBeInTheDocument();
    expect(main?.classList.contains("flex-1")).toBe(true);
  });

  it("renders top header bar", () => {
    renderLayout();
    const header = document.querySelector("header");
    expect(header).toBeInTheDocument();
  });
});
