import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, mockSupabase } from "../helpers";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@test.com" }, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

import { NotificationBell } from "@/components/NotificationBell";

function setupChain(data: any = [], count: number | null = null) {
  const chain: any = {};
  ["select", "insert", "update", "delete", "eq", "neq", "order", "limit"].forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.then = vi.fn((cb: any) => cb({ data, error: null, count }));
  return chain;
}

describe("NotificationBell — Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders bell icon", () => {
    mockSupabase.from.mockImplementation(() => setupChain([], 0));
    renderWithProviders(<NotificationBell />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("shows empty state when no notifications", async () => {
    mockSupabase.from.mockImplementation(() => setupChain([], 0));
    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByText("Nenhuma notificação")).toBeInTheDocument();
    });
  });

  it("shows Notificações header in popover", async () => {
    mockSupabase.from.mockImplementation(() => setupChain([], 0));
    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByText("Notificações")).toBeInTheDocument();
    });
  });
});
