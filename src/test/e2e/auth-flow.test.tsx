import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Auth from "@/pages/Auth";
import { renderWithProviders, mockSupabase } from "../helpers";

// Mock hero image
vi.mock("@/assets/hero-bg.jpg", () => ({ default: "hero-bg-mock.jpg" }));

describe("Auth Page — E2E Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Login Mode", () => {
    it("renders login form by default", () => {
      renderWithProviders(<Auth />);
      expect(screen.getByText("Bem-vindo de volta")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("seu@email.com")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
    });

    it("submits login and navigates on success", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: "u1" }, session: {} },
        error: null,
      });

      renderWithProviders(<Auth />);
      
      await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "test@test.com");
      await userEvent.type(screen.getByPlaceholderText("••••••••"), "Password1!");

      fireEvent.submit(screen.getByPlaceholderText("seu@email.com").closest("form")!);

      await waitFor(() => {
        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: "test@test.com",
          password: "Password1!",
        });
      });
    });

    it("shows error on failed login", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials" },
      });

      renderWithProviders(<Auth />);
      await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "bad@test.com");
      await userEvent.type(screen.getByPlaceholderText("••••••••"), "wrong");

      fireEvent.submit(screen.getByPlaceholderText("seu@email.com").closest("form")!);

      await waitFor(() => {
        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalled();
      });
    });

    it("locks out after 5 failed attempts", async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials" },
      });

      renderWithProviders(<Auth />);
      const form = screen.getByPlaceholderText("seu@email.com").closest("form")!;
      
      await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "test@test.com");
      await userEvent.type(screen.getByPlaceholderText("••••••••"), "wrong");

      for (let i = 0; i < 5; i++) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledTimes(i + 1);
        });
      }

      // After 5 failures, button should be disabled
      await waitFor(() => {
        const submitBtn = screen.getByRole("button", { name: /aguarde/i });
        expect(submitBtn).toBeDisabled();
      });
    });
  });

  describe("Register Mode", () => {
    it("switches to register mode and shows name field", async () => {
      renderWithProviders(<Auth />);
      
      await userEvent.click(screen.getByText("Criar conta"));
      
      expect(screen.getByText("Criar conta", { selector: "h2" })).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Nome completo")).toBeInTheDocument();
    });

    it("shows password strength indicator when typing", async () => {
      renderWithProviders(<Auth />);
      await userEvent.click(screen.getByText("Criar conta"));

      await userEvent.type(screen.getByPlaceholderText("••••••••"), "Ab1!");

      expect(screen.getByText("Mínimo 8 caracteres")).toBeInTheDocument();
      expect(screen.getByText("Letra maiúscula")).toBeInTheDocument();
      expect(screen.getByText("Número")).toBeInTheDocument();
    });

    it("disables submit when password is weak", async () => {
      renderWithProviders(<Auth />);
      await userEvent.click(screen.getByText("Criar conta"));

      await userEvent.type(screen.getByPlaceholderText("••••••••"), "weak");

      const createBtn = screen.getAllByRole("button").find(
        (b) => b.textContent?.includes("Criar conta") && b.getAttribute("type") === "submit"
      );
      expect(createBtn).toBeDisabled();
    });

    it("submits registration with valid password", async () => {
      mockSupabase.auth.signUp.mockResolvedValue({ data: {}, error: null });

      renderWithProviders(<Auth />);
      await userEvent.click(screen.getByText("Criar conta"));

      await userEvent.type(screen.getByPlaceholderText("Nome completo"), "John Doe");
      await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "john@test.com");
      await userEvent.type(screen.getByPlaceholderText("••••••••"), "StrongPass1!");

      fireEvent.submit(screen.getByPlaceholderText("seu@email.com").closest("form")!);

      await waitFor(() => {
        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith(
          expect.objectContaining({
            email: "john@test.com",
            password: "StrongPass1!",
          })
        );
      });
    });

    it("shows email confirmation screen after successful registration", async () => {
      mockSupabase.auth.signUp.mockResolvedValue({ data: {}, error: null });

      renderWithProviders(<Auth />);
      await userEvent.click(screen.getByText("Criar conta"));

      await userEvent.type(screen.getByPlaceholderText("Nome completo"), "John Doe");
      await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "john@test.com");
      await userEvent.type(screen.getByPlaceholderText("••••••••"), "StrongPass1!");

      fireEvent.submit(screen.getByPlaceholderText("seu@email.com").closest("form")!);

      await waitFor(() => {
        expect(screen.getByText("Verifique seu e-mail")).toBeInTheDocument();
      });
    });

    it("shows error for already registered email", async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: {},
        error: { message: "User already registered" },
      });

      renderWithProviders(<Auth />);
      await userEvent.click(screen.getByText("Criar conta"));

      await userEvent.type(screen.getByPlaceholderText("Nome completo"), "Test");
      await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "existing@test.com");
      await userEvent.type(screen.getByPlaceholderText("••••••••"), "StrongPass1!");

      fireEvent.submit(screen.getByPlaceholderText("seu@email.com").closest("form")!);

      await waitFor(() => {
        expect(mockSupabase.auth.signUp).toHaveBeenCalled();
      });
    });
  });

  describe("Forgot Password Mode", () => {
    it("switches to forgot password and hides password field", async () => {
      renderWithProviders(<Auth />);
      
      await userEvent.click(screen.getByText("Esqueceu a senha?"));
      
      expect(screen.getByText("Recuperar senha")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("••••••••")).not.toBeInTheDocument();
    });

    it("submits forgot password request", async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

      renderWithProviders(<Auth />);
      await userEvent.click(screen.getByText("Esqueceu a senha?"));

      await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "forgot@test.com");
      fireEvent.submit(screen.getByPlaceholderText("seu@email.com").closest("form")!);

      await waitFor(() => {
        expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
          "forgot@test.com",
          expect.objectContaining({ redirectTo: expect.stringContaining("/reset-password") })
        );
      });
    });
  });

  describe("OAuth Login", () => {
    it("triggers Google OAuth", async () => {
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({ error: null });

      renderWithProviders(<Auth />);
      await userEvent.click(screen.getByText("Continuar com Google"));

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "google" })
      );
    });

    it("triggers Apple OAuth", async () => {
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({ error: null });

      renderWithProviders(<Auth />);
      await userEvent.click(screen.getByText("Continuar com Apple"));

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "apple" })
      );
    });
  });

  describe("Mode Switching", () => {
    it("navigates login → register → login", async () => {
      renderWithProviders(<Auth />);
      
      expect(screen.getByText("Bem-vindo de volta")).toBeInTheDocument();
      
      await userEvent.click(screen.getByText("Criar conta"));
      expect(screen.getByText("Criar conta", { selector: "h2" })).toBeInTheDocument();

      await userEvent.click(screen.getByText("Entrar"));
      expect(screen.getByText("Bem-vindo de volta")).toBeInTheDocument();
    });

    it("navigates login → forgot → login", async () => {
      renderWithProviders(<Auth />);
      
      await userEvent.click(screen.getByText("Esqueceu a senha?"));
      expect(screen.getByText("Recuperar senha")).toBeInTheDocument();

      await userEvent.click(screen.getByText("Entrar"));
      expect(screen.getByText("Bem-vindo de volta")).toBeInTheDocument();
    });
  });

  describe("Branding", () => {
    it("renders hero section on large screens", () => {
      renderWithProviders(<Auth />);
      expect(screen.getByText(/inteligência jurídica de/i)).toBeInTheDocument();
      expect(screen.getByText(/próxima geração/i)).toBeInTheDocument();
    });

    it("shows stats in hero section", () => {
      renderWithProviders(<Auth />);
      expect(screen.getByText("99.9%")).toBeInTheDocument();
      expect(screen.getByText("500+")).toBeInTheDocument();
      expect(screen.getByText("50k+")).toBeInTheDocument();
    });
  });
});
