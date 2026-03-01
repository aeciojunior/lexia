import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { mockSupabase } from "../helpers";

vi.mock("@/assets/hero-bg.jpg", () => ({ default: "hero-bg-mock.jpg" }));

// Mock useAuth for routing tests
const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: any) => children,
}));

describe("Routing — E2E", () => {
  describe("NotFound Page", () => {
    it("renders 404 page for unknown routes", () => {
      render(
        <MemoryRouter initialEntries={["/unknown-route"]}>
          <NotFound />
        </MemoryRouter>
      );
      expect(screen.getByText("404")).toBeInTheDocument();
      expect(screen.getByText("Oops! Page not found")).toBeInTheDocument();
    });

    it("has return home link", () => {
      render(
        <MemoryRouter initialEntries={["/unknown"]}>
          <NotFound />
        </MemoryRouter>
      );
      const link = screen.getByText("Return to Home");
      expect(link).toHaveAttribute("href", "/");
    });
  });

  describe("Auth Page Access", () => {
    it("renders Auth page at /auth route", async () => {
      mockUseAuth.mockReturnValue({ user: null, session: null, loading: false, signOut: vi.fn() });

      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const Auth = (await import("@/pages/Auth")).default;

      render(
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <MemoryRouter initialEntries={["/auth"]}>
              <Auth />
            </MemoryRouter>
          </TooltipProvider>
        </QueryClientProvider>
      );

      expect(screen.getByText("Bem-vindo de volta")).toBeInTheDocument();
    });
  });

  describe("Protected Route Behavior", () => {
    it("redirects unauthenticated users to /auth", async () => {
      mockUseAuth.mockReturnValue({ user: null, session: null, loading: false, signOut: vi.fn() });

      const { ProtectedRoute } = await import("@/components/ProtectedRoute");
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      const { container } = render(
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <MemoryRouter initialEntries={["/dashboard"]}>
              <ProtectedRoute>
                <div>Dashboard Content</div>
              </ProtectedRoute>
            </MemoryRouter>
          </TooltipProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.queryByText("Dashboard Content")).not.toBeInTheDocument();
      });
    });

    it("shows loading state while checking auth", async () => {
      mockUseAuth.mockReturnValue({ user: null, session: null, loading: true, signOut: vi.fn() });

      const { ProtectedRoute } = await import("@/components/ProtectedRoute");
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <MemoryRouter initialEntries={["/dashboard"]}>
              <ProtectedRoute>
                <div>Dashboard Content</div>
              </ProtectedRoute>
            </MemoryRouter>
          </TooltipProvider>
        </QueryClientProvider>
      );

      expect(screen.queryByText("Dashboard Content")).not.toBeInTheDocument();
    });
  });
});
