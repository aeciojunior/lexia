import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers";

vi.mock("@/assets/hero-bg.jpg", () => ({ default: "hero-bg-mock.jpg" }));

let Auth: any;
beforeAll(async () => {
  Auth = (await import("@/pages/Auth")).default;
});

describe("Password Strength — E2E", () => {
  async function goToRegister() {
    renderWithProviders(<Auth />);
    const createLinks = screen.getAllByText("Criar conta");
    const linkInParagraph = createLinks.find(el => el.tagName === "BUTTON" && el.closest("p"));
    await userEvent.click(linkInParagraph || createLinks[0]);
  }

  it("shows 'Fraca' for short passwords", async () => {
    await goToRegister();
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "ab");
    expect(screen.getByText("Fraca")).toBeInTheDocument();
  });

  it("shows 'Média' for medium passwords", async () => {
    await goToRegister();
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "Abcde12");
    expect(screen.getByText("Média")).toBeInTheDocument();
  });

  it("shows 'Boa' for good passwords", async () => {
    await goToRegister();
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "Abcdefg1");
    expect(screen.getByText("Boa")).toBeInTheDocument();
  });

  it("shows 'Forte' for strong passwords", async () => {
    await goToRegister();
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "StrongPass1!");
    expect(screen.getByText("Forte")).toBeInTheDocument();
  });

  it("checks all 5 criteria", async () => {
    await goToRegister();
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "a");
    
    expect(screen.getByText("Mínimo 8 caracteres")).toBeInTheDocument();
    expect(screen.getByText("Letra maiúscula")).toBeInTheDocument();
    expect(screen.getByText("Letra minúscula")).toBeInTheDocument();
    expect(screen.getByText("Número")).toBeInTheDocument();
    expect(screen.getByText("Caractere especial")).toBeInTheDocument();
  });

  it("does not show strength indicator on login mode", async () => {
    renderWithProviders(<Auth />);
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "test");
    expect(screen.queryByText("Fraca")).not.toBeInTheDocument();
    expect(screen.queryByText("Mínimo 8 caracteres")).not.toBeInTheDocument();
  });
});
