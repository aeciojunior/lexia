import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import Landing from "@/pages/Landing";
import { renderWithProviders } from "../helpers";

vi.mock("@/assets/hero-bg.jpg", () => ({ default: "hero-bg-mock.jpg" }));

describe("Landing Page — E2E", () => {
  it("renders navbar with logo and CTA buttons", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText("Entrar")).toBeInTheDocument();
    // "Criar conta" appears in both nav and CTA sections
    expect(screen.getAllByText("Criar conta").length).toBeGreaterThanOrEqual(1);
  });

  it("renders hero section with headline", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText(/inteligência jurídica que/i)).toBeInTheDocument();
    expect(screen.getByText("transforma")).toBeInTheDocument();
  });

  it("renders social proof stats", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText("500+ advogados")).toBeInTheDocument();
    expect(screen.getByText("12.000+ processos")).toBeInTheDocument();
    expect(screen.getByText("99.8% uptime")).toBeInTheDocument();
    expect(screen.getByText("4.9★ avaliação")).toBeInTheDocument();
  });

  it("renders all 6 feature cards", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText("IA Jurídica Avançada")).toBeInTheDocument();
    expect(screen.getByText("Gestão de Documentos")).toBeInTheDocument();
    expect(screen.getByText("Prazos Inteligentes")).toBeInTheDocument();
    expect(screen.getByText("Multi-tenant")).toBeInTheDocument();
    expect(screen.getByText("Segurança Total")).toBeInTheDocument();
    expect(screen.getByText("Dashboards Analíticos")).toBeInTheDocument();
  });

  it("renders pricing section with 3 plans", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Profissional")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(screen.getByText("R$ 97")).toBeInTheDocument();
    expect(screen.getByText("R$ 247")).toBeInTheDocument();
    expect(screen.getByText("Sob consulta")).toBeInTheDocument();
  });

  it("marks Profissional as most popular", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText("Mais popular")).toBeInTheDocument();
  });

  it("renders features for each plan", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText("1 usuário")).toBeInTheDocument();
    expect(screen.getByText("5 usuários")).toBeInTheDocument();
    expect(screen.getByText("Usuários ilimitados")).toBeInTheDocument();
    expect(screen.getByText("SSO / SAML")).toBeInTheDocument();
  });

  it("renders CTA section", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText("Pronto para transformar seu escritório?")).toBeInTheDocument();
  });

  it("renders how it works section with 4 steps", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText("Crie sua conta")).toBeInTheDocument();
    expect(screen.getByText("Importe seus processos")).toBeInTheDocument();
    expect(screen.getByText("IA analisa e sugere")).toBeInTheDocument();
    expect(screen.getByText("Acompanhe resultados")).toBeInTheDocument();
  });

  it("renders testimonials section", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText("Dra. Camila Ferreira")).toBeInTheDocument();
    expect(screen.getByText("Dr. Rafael Mendes")).toBeInTheDocument();
    expect(screen.getByText("Dra. Juliana Costa")).toBeInTheDocument();
  });

  it("renders integrations section", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText("Tribunais Estaduais")).toBeInTheDocument();
    expect(screen.getByText("API Aberta")).toBeInTheDocument();
  });

  it("renders FAQ section", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText("O LexIA é seguro para armazenar dados sensíveis de processos?")).toBeInTheDocument();
    expect(screen.getByText("Existe período de teste gratuito?")).toBeInTheDocument();
  });

  it("renders footer with copyright", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText("© 2026 LexIA. Todos os direitos reservados.")).toBeInTheDocument();
  });

  it("renders the brand name 'LexIA' on the homepage", () => {
    const { container } = renderWithProviders(<Landing />);
    const matches = container.textContent?.match(/LexIA/g) ?? [];
    expect(matches.length).toBeGreaterThan(0);
  });

  it("never renders forbidden brand variations", () => {
    const { container } = renderWithProviders(<Landing />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/LegalFlow/);
    expect(text).not.toMatch(/Lex IA/);
    expect(text).not.toMatch(/\bLexia\b/);
    expect(text).not.toMatch(/\bLEXIA\b/);
    expect(text).not.toMatch(/LexAI/);
    expect(text).not.toMatch(/Lex\.IA/);
  });

  it("has navigation links pointing to /auth", () => {
    renderWithProviders(<Landing />);
    const enterLink = screen.getByText("Entrar").closest("a");
    expect(enterLink).toHaveAttribute("href", "/auth");
  });

  it("has anchor links to features and pricing sections", () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText("Funcionalidades", { selector: "a" })).toHaveAttribute("href", "#features");
    expect(screen.getByText("Preços", { selector: "a" })).toHaveAttribute("href", "#pricing");
  });
});
