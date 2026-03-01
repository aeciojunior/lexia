import { describe, it, expect } from "vitest";
import { formatCNPJ, formatCPF, validateCNPJ, validateCPF } from "../fiscal-validation";

describe("formatCNPJ", () => {
  it("formats a 14-digit string as CNPJ", () => {
    expect(formatCNPJ("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("partially formats incomplete input", () => {
    expect(formatCNPJ("11222")).toBe("11.222");
  });

  it("strips non-digits", () => {
    expect(formatCNPJ("11.222.333/0001-81")).toBe("11.222.333/0001-81");
  });

  it("handles empty string", () => {
    expect(formatCNPJ("")).toBe("");
  });

  it("truncates beyond 14 digits", () => {
    const result = formatCNPJ("112223330001819999");
    expect(result).toBe("11.222.333/0001-81");
  });
});

describe("formatCPF", () => {
  it("formats an 11-digit string as CPF", () => {
    expect(formatCPF("52998224725")).toBe("529.982.247-25");
  });

  it("partially formats incomplete input", () => {
    expect(formatCPF("529")).toBe("529");
    expect(formatCPF("52998")).toBe("529.98");
  });

  it("handles empty string", () => {
    expect(formatCPF("")).toBe("");
  });

  it("truncates beyond 11 digits", () => {
    const result = formatCPF("529982247259999");
    expect(result).toBe("529.982.247-25");
  });
});

describe("validateCNPJ", () => {
  it("validates a correct CNPJ", () => {
    expect(validateCNPJ("11.222.333/0001-81")).toBe(true);
    expect(validateCNPJ("11222333000181")).toBe(true);
  });

  it("rejects wrong length", () => {
    expect(validateCNPJ("1234567890")).toBe(false);
  });

  it("rejects all same digits", () => {
    expect(validateCNPJ("11111111111111")).toBe(false);
    expect(validateCNPJ("00000000000000")).toBe(false);
  });

  it("rejects invalid check digits", () => {
    expect(validateCNPJ("11222333000182")).toBe(false);
  });

  it("handles empty string", () => {
    expect(validateCNPJ("")).toBe(false);
  });
});

describe("validateCPF", () => {
  it("validates a correct CPF", () => {
    expect(validateCPF("529.982.247-25")).toBe(true);
    expect(validateCPF("52998224725")).toBe(true);
  });

  it("rejects wrong length", () => {
    expect(validateCPF("12345")).toBe(false);
  });

  it("rejects all same digits", () => {
    expect(validateCPF("11111111111")).toBe(false);
    expect(validateCPF("00000000000")).toBe(false);
  });

  it("rejects invalid check digits", () => {
    expect(validateCPF("52998224726")).toBe(false);
  });

  it("handles empty string", () => {
    expect(validateCPF("")).toBe(false);
  });
});
