import { describe, it, expect, vi } from "vitest";

const mockSave = vi.fn();
const mockText = vi.fn();
const mockSplitTextToSize = vi.fn((t: string) => [t]);
const mockAddPage = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetFont = vi.fn();
const mockSetTextColor = vi.fn();
const mockSetFillColor = vi.fn();
const mockSetDrawColor = vi.fn();
const mockSetLineWidth = vi.fn();
const mockRect = vi.fn();
const mockRoundedRect = vi.fn();
const mockLine = vi.fn();
const mockCircle = vi.fn();
const mockGetNumberOfPages = vi.fn(() => 1);
const mockSetPage = vi.fn();

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    setFontSize: mockSetFontSize,
    setFont: mockSetFont,
    setTextColor: mockSetTextColor,
    setFillColor: mockSetFillColor,
    setDrawColor: mockSetDrawColor,
    setLineWidth: mockSetLineWidth,
    rect: mockRect,
    roundedRect: mockRoundedRect,
    line: mockLine,
    circle: mockCircle,
    text: mockText,
    splitTextToSize: mockSplitTextToSize,
    addPage: mockAddPage,
    save: mockSave,
    getNumberOfPages: mockGetNumberOfPages,
    setPage: mockSetPage,
  })),
}));

import { exportContractPDF } from "@/components/contracts/contractPdfExport";

describe("contractPdfExport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates PDF with correct filename", () => {
    exportContractPDF({
      title: "Análise Completa",
      contractTitle: "Contrato de Serviços",
      analysisType: "full_analysis",
      content: "# Resumo\n\nConteúdo da análise",
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    const filename = mockSave.mock.calls[0][0];
    expect(filename).toContain("LexIA_");
    expect(filename).toContain("Análise_Completa");
    expect(filename).toContain(".pdf");
  });

  it("renders header with LexIA branding", () => {
    exportContractPDF({
      title: "Cláusulas",
      contractTitle: "NDA Corp",
      analysisType: "clause_analysis",
      content: "Conteúdo",
    });

    // Verify header bg (slate-900)
    expect(mockSetFillColor).toHaveBeenCalledWith(15, 23, 42);
    // Verify LexIA text
    expect(mockText).toHaveBeenCalledWith("LexIA", expect.any(Number), expect.any(Number));
  });

  it("renders metadata box with contract and analysis type", () => {
    exportContractPDF({
      title: "Benchmarking",
      contractTitle: "Contrato ABC",
      analysisType: "benchmarking",
      content: "Conteúdo",
    });

    expect(mockText).toHaveBeenCalledWith("CONTRATO", expect.any(Number), expect.any(Number));
    expect(mockText).toHaveBeenCalledWith("Contrato ABC", expect.any(Number), expect.any(Number));
    expect(mockText).toHaveBeenCalledWith("TIPO DE ANÁLISE", expect.any(Number), expect.any(Number));
  });

  it("renders organization name when provided", () => {
    exportContractPDF({
      title: "Análise",
      contractTitle: "Contrato XYZ",
      analysisType: "full_analysis",
      content: "Conteúdo",
      orgName: "Escritório Silva",
    });

    expect(mockText).toHaveBeenCalledWith("ORGANIZAÇÃO", expect.any(Number), expect.any(Number));
    expect(mockText).toHaveBeenCalledWith("Escritório Silva", expect.any(Number), expect.any(Number));
  });

  it("parses markdown headers correctly", () => {
    exportContractPDF({
      title: "Análise",
      contractTitle: "Test",
      analysisType: "full_analysis",
      content: "# Título Principal\n## Subtítulo\n### Seção\n- Item de lista\n**Texto bold**\nTexto normal",
    });

    // Verify headers rendered - h1 uses rect background
    expect(mockRect).toHaveBeenCalled();
    // Verify h2 uses line separator
    expect(mockLine).toHaveBeenCalled();
    // Verify bullets rendered
    expect(mockCircle).toHaveBeenCalled();
  });

  it("renders disclaimer footer", () => {
    exportContractPDF({
      title: "Minuta",
      contractTitle: "Contrato",
      analysisType: "draft_contract",
      content: "# Minuta\n\nConteúdo da minuta",
    });

    // Verify amber disclaimer box
    expect(mockSetFillColor).toHaveBeenCalledWith(255, 251, 235);
    expect(mockText).toHaveBeenCalledWith("⚠ AVISO LEGAL", expect.any(Number), expect.any(Number));
  });

  it("adds page numbers", () => {
    exportContractPDF({
      title: "Test",
      contractTitle: "Test",
      analysisType: "full_analysis",
      content: "Content",
    });

    expect(mockSetPage).toHaveBeenCalledWith(1);
    expect(mockText).toHaveBeenCalledWith(
      expect.stringContaining("Página 1"),
      expect.any(Number),
      expect.any(Number),
      expect.any(Object)
    );
  });

  it("maps all analysis types to labels", () => {
    const types = ["full_analysis", "clause_analysis", "renegotiation", "benchmarking", "abusive_detection", "draft_contract"];
    for (const type of types) {
      vi.clearAllMocks();
      exportContractPDF({ title: "T", contractTitle: "C", analysisType: type, content: "X" });
      expect(mockSave).toHaveBeenCalledTimes(1);
    }
  });
});
