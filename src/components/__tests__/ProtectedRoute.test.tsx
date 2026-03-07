import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mockUseAuth = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      then: vi.fn((cb: any) => cb({ data: null, error: null })),
    })),
  },
}));

import { ProtectedRoute } from "@/components/ProtectedRoute";

function renderProtected(route = "/protected") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/auth" element={<div data-testid="auth-page">Auth</div>} />
        <Route path="/no-organization" element={<div data-testid="no-org">No Org</div>} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div data-testid="protected-content">Secret</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("shows loading state while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderProtected();
    // Should show loading dots, not auth page
    expect(screen.queryByTestId("auth-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("redirects to /auth when unauthenticated", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderProtected();
    expect(await screen.findByTestId("auth-page")).toBeInTheDocument();
  });
});
