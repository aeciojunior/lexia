import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContractDraftForm } from "@/components/contracts/ContractDraftForm";

const DEFAULT_FORM = {
  parties: "", object: "", sector: "tecnologia", contractType: "service",
  value: "", currency: "BRL", duration: "", jurisdiction: "",
  riskLevel: "moderate", formality: "formal", complexity: "technical",
  lgpdRequired: false, arbitration: false, includeAnnexes: false,
};

describe("ContractDraftForm — Integration", () => {
  it("renders all form fields", () => {
    render(<ContractDraftForm form={DEFAULT_FORM} onChange={vi.fn()} />);
    expect(screen.getByText("Partes")).toBeInTheDocument();
    expect(screen.getByText("Objeto")).toBeInTheDocument();
    expect(screen.getByText("Setor")).toBeInTheDocument();
    expect(screen.getByText("Tipo")).toBeInTheDocument();
    expect(screen.getByText("Valor")).toBeInTheDocument();
    expect(screen.getByText("Moeda")).toBeInTheDocument();
    expect(screen.getByText("Duração (meses)")).toBeInTheDocument();
    expect(screen.getByText("Foro / Jurisdição")).toBeInTheDocument();
    expect(screen.getByText("Nível de Risco")).toBeInTheDocument();
    expect(screen.getByText("Formalidade")).toBeInTheDocument();
    expect(screen.getByText("Complexidade")).toBeInTheDocument();
  });

  it("renders toggle switches", () => {
    render(<ContractDraftForm form={DEFAULT_FORM} onChange={vi.fn()} />);
    expect(screen.getByText("Cláusulas LGPD")).toBeInTheDocument();
    expect(screen.getByText("Cláusula de Arbitragem")).toBeInTheDocument();
    expect(screen.getByText("Gerar Anexos")).toBeInTheDocument();
  });

  it("calls onChange when typing in parties field", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ContractDraftForm form={DEFAULT_FORM} onChange={onChange} />);

    const partiesField = screen.getByPlaceholderText(/Descreva as partes/);
    await user.type(partiesField, "A");

    expect(onChange).toHaveBeenCalled();
  });

  it("calls onChange when typing value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ContractDraftForm form={DEFAULT_FORM} onChange={onChange} />);

    const valueField = screen.getByPlaceholderText("Ex: 150.000,00");
    await user.type(valueField, "1");

    expect(onChange).toHaveBeenCalled();
  });

  it("calls onChange when typing duration", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ContractDraftForm form={DEFAULT_FORM} onChange={onChange} />);

    const durationField = screen.getByPlaceholderText("Ex: 12");
    await user.type(durationField, "6");

    expect(onChange).toHaveBeenCalled();
  });

  it("renders with pre-filled values", () => {
    const form = { ...DEFAULT_FORM, parties: "Empresa A vs Empresa B", value: "100.000,00" };
    render(<ContractDraftForm form={form} onChange={vi.fn()} />);

    const partiesField = screen.getByPlaceholderText(/Descreva as partes/) as HTMLTextAreaElement;
    expect(partiesField.value).toBe("Empresa A vs Empresa B");

    const valueField = screen.getByPlaceholderText("Ex: 150.000,00") as HTMLInputElement;
    expect(valueField.value).toBe("100.000,00");
  });
});
