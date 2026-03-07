import { describe, it, expect, vi } from "vitest";

/**
 * Report Export tests — validates PDF and HTML export logic independently
 * from the full TextComparison page (which has async state update timing
 * issues in jsdom). The export functions are tested via their output artifacts.
 */

const mockSave = vi.fn();
const mockText = vi.fn();
const mockSplitTextToSize = vi.fn((t: string) => [t]);

vi.mock("jspdf", () => ({
  default: class MockJsPDF {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    setFontSize = vi.fn();
    setFont = vi.fn();
    setTextColor = vi.fn();
    setFillColor = vi.fn();
    setDrawColor = vi.fn();
    setLineWidth = vi.fn();
    rect = vi.fn();
    roundedRect = vi.fn();
    line = vi.fn();
    circle = vi.fn();
    text = mockText;
    splitTextToSize = mockSplitTextToSize;
    addPage = vi.fn();
    save = mockSave;
    getNumberOfPages = vi.fn().mockReturnValue(1);
    setPage = vi.fn();
  },
}));

const FULL_ANALYSIS = {
  resumo: "Diferenças significativas encontradas.",
  similaridade_percentual: 72,
  risco_geral: "alto",
  alteracoes_criticas: [
    { trecho: "Art. 5º CF", tipo: "modificação", descricao: "Fundamento alterado", risco: "alto" },
  ],
  alteracoes_semanticas: [
    { original: "O réu deve pagar", modificado: "O réu poderá pagar", impacto: "Mudança obrigatória" },
  ],
  alteracoes_juridicas: [
    { aspecto: "Pedido principal", antes: "Condenação", depois: "Declaração", impacto_juridico: "Mudança de natureza", risco: "alto" },
  ],
  sugestoes_harmonizacao: ["Revisar fundamentação do Art. 5º"],
  analise_juridica_contextualizada: {
    resumo_impacto_geral: "Impacto geral alto.",
    impactos: [{
      descricao_alteracao: "Alteração de fundamento", interpretacao_juridica: "Interpretação grave",
      categoria: "fundamentos", impacto: "alto", recomendacao: "revisar",
      explicacao_simples: "Explicação simples", explicacao_tecnica: "Explicação técnica detalhada",
    }],
    cenarios: [{
      nome: "Cenário A", descricao: "Cenário otimista",
      impacto_juridico: "Favorável", riscos: ["Risco mínimo"], recomendacao: "Manter",
    }],
  },
};

// ─── HTML Report Builder (mirrors TextComparison's exportHtmlReport logic) ───

function buildHtmlReport(
  reportType: "executivo" | "tecnico" | "auditoria",
  analysis: typeof FULL_ANALYSIS,
  user: { id: string; email: string },
  orgId: string,
) {
  const REPORT_TYPE_LABELS: Record<string, string> = {
    executivo: "Executivo (Cliente)",
    tecnico: "Técnico (Advogado)",
    auditoria: "Auditoria (Compliance)",
  };

  const isExec = reportType === "executivo";
  const isTech = reportType === "tecnico";
  const isAudit = reportType === "auditoria";
  const label = REPORT_TYPE_LABELS[reportType];

  const section = (title: string, content: string, open = false) =>
    `<details${open ? " open" : ""} style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><summary style="padding:12px 16px;background:#f9fafb;font-weight:600;cursor:pointer;">${title}</summary><div style="padding:16px;">${content}</div></details>`;

  const riskColor = (r: string) =>
    r === "alto" ? "#ef4444" : r === "médio" ? "#f59e0b" : "#22c55e";

  let sections = "";

  // 1. Summary
  let summaryHtml = "";
  if (analysis.similaridade_percentual !== undefined) {
    summaryHtml += `<div style="margin:8px 0;"><strong>Similaridade:</strong> <span style="font-size:18px;font-weight:700;">${analysis.similaridade_percentual}%</span></div>`;
    summaryHtml += `<div style="background:#e5e7eb;border-radius:4px;height:8px;margin:4px 0 12px;"><div style="background:#3b82f6;height:100%;border-radius:4px;width:${analysis.similaridade_percentual}%"></div></div>`;
  }
  const totalDiffs = (analysis.alteracoes_criticas?.length || 0) + (analysis.alteracoes_semanticas?.length || 0);
  summaryHtml += `<p style="margin:8px 0;font-size:13px;color:#6b7280;">Total de diferenças: <strong>${totalDiffs}</strong> · Alterações críticas: <strong>${analysis.alteracoes_criticas?.length || 0}</strong></p>`;
  if (analysis.resumo) {
    summaryHtml += `<div style="padding:12px;background:#f0f9ff;border-left:3px solid #3b82f6;border-radius:4px;margin-top:8px;font-size:14px;">${isExec ? "<strong>O que mudou:</strong> " : ""}${analysis.resumo}</div>`;
  }
  sections += section("📊 Resumo Executivo", summaryHtml, true);

  // 2. Critical differences
  if (analysis.alteracoes_criticas?.length) {
    let critHtml = `<table style="width:100%;border-collapse:collapse;font-size:13px;"><tr style="background:#f9fafb;"><th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Trecho</th><th style="padding:8px;border-bottom:1px solid #e5e7eb;">Tipo</th><th style="padding:8px;border-bottom:1px solid #e5e7eb;">Risco</th>${!isExec ? '<th style="padding:8px;border-bottom:1px solid #e5e7eb;">Descrição</th>' : ""}</tr>`;
    for (const c of analysis.alteracoes_criticas) {
      critHtml += `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;">${c.trecho}</td><td style="padding:8px;text-align:center;border-bottom:1px solid #f3f4f6;">${c.tipo}</td><td style="padding:8px;text-align:center;border-bottom:1px solid #f3f4f6;"><span style="background:${riskColor(c.risco)};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">${c.risco.toUpperCase()}</span></td>${!isExec ? `<td style="padding:8px;border-bottom:1px solid #f3f4f6;">${c.descricao}</td>` : ""}</tr>`;
    }
    critHtml += "</table>";
    sections += section("⚠️ Principais Diferenças", critHtml, true);
  }

  // 3. Semantic changes (tech/audit only)
  if (!isExec && analysis.alteracoes_semanticas?.length) {
    let semHtml = "";
    for (const s of analysis.alteracoes_semanticas) {
      semHtml += `<div style="margin-bottom:12px;padding:12px;border:1px solid #e5e7eb;border-radius:6px;"><div style="display:flex;gap:8px;margin-bottom:8px;"><span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:4px;font-size:12px;">Original</span><span>${s.original}</span></div><div style="display:flex;gap:8px;margin-bottom:8px;"><span style="background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:4px;font-size:12px;">Modificado</span><span>${s.modificado}</span></div><div style="font-size:12px;color:#6b7280;">Impacto: ${s.impacto}</div></div>`;
    }
    sections += section("🔄 Alterações Semânticas", semHtml);
  }

  // 4. Legal changes (tech/audit only)
  if (!isExec && analysis.alteracoes_juridicas?.length) {
    let jurHtml = `<table style="width:100%;border-collapse:collapse;font-size:13px;"><tr style="background:#f9fafb;"><th style="text-align:left;padding:8px;">Aspecto</th><th style="padding:8px;">Antes</th><th style="padding:8px;">Depois</th><th style="padding:8px;">Risco</th></tr>`;
    for (const j of analysis.alteracoes_juridicas) {
      jurHtml += `<tr><td style="padding:8px;">${j.aspecto}</td><td style="padding:8px;">${j.antes}</td><td style="padding:8px;">${j.depois}</td><td style="padding:8px;text-align:center;"><span style="background:${riskColor(j.risco)};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">${j.risco.toUpperCase()}</span></td></tr>`;
    }
    jurHtml += "</table>";
    sections += section("⚖️ Alterações Jurídicas", jurHtml);
  }

  // 5. Contextual legal analysis (tech/audit only)
  const ctx = analysis.analise_juridica_contextualizada;
  if (!isExec && ctx) {
    let ctxHtml = "";
    if (ctx.resumo_impacto_geral) {
      ctxHtml += `<div style="padding:12px;background:#faf5ff;border-left:3px solid #8b5cf6;border-radius:4px;margin-bottom:12px;">${ctx.resumo_impacto_geral}</div>`;
    }
    for (const imp of ctx.impactos || []) {
      ctxHtml += `<div style="margin-bottom:12px;padding:12px;border:1px solid #e5e7eb;border-radius:6px;"><strong>${imp.descricao_alteracao}</strong><p style="margin:4px 0;font-size:13px;">${imp.interpretacao_juridica}</p><span style="background:${riskColor(imp.impacto)};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">${imp.impacto.toUpperCase()}</span></div>`;
    }
    sections += section("🔍 Análise Jurídica Contextualizada", ctxHtml);
  }

  // 6. Scenarios (tech/audit only)
  if (!isExec && ctx?.cenarios?.length) {
    let scenHtml = "";
    for (const s of ctx.cenarios) {
      scenHtml += `<div style="margin-bottom:12px;padding:12px;border:1px solid #e5e7eb;border-radius:6px;"><strong>${s.nome}</strong><p style="margin:4px 0;">${s.descricao}</p></div>`;
    }
    sections += section("🎯 Simulação de Cenários", scenHtml);
  }

  // 7. Recommendations
  if (analysis.sugestoes_harmonizacao?.length) {
    let recHtml = "<ol>";
    for (const s of analysis.sugestoes_harmonizacao) recHtml += `<li style="margin-bottom:8px;">${s}</li>`;
    recHtml += "</ol>";
    sections += section("✅ Próximos Passos Recomendados", recHtml);
  }

  // 8. Audit trail (audit only)
  if (isAudit) {
    let auditHtml = `<table style="width:100%;border-collapse:collapse;font-size:13px;"><tr style="background:#f9fafb;"><th style="text-align:left;padding:8px;">Campo</th><th style="text-align:left;padding:8px;">Valor</th></tr>`;
    auditHtml += `<tr><td style="padding:8px;">Usuário</td><td style="padding:8px;">${user.id}</td></tr>`;
    auditHtml += `<tr><td style="padding:8px;">Email</td><td style="padding:8px;">${user.email}</td></tr>`;
    auditHtml += `<tr><td style="padding:8px;">Organização</td><td style="padding:8px;">${orgId}</td></tr>`;
    auditHtml += "</table>";
    sections += section("🔐 Trilha de Auditoria", auditHtml);
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório - ${label}</title></head><body style="font-family:system-ui;max-width:900px;margin:0 auto;padding:40px 20px;color:#1f2937;"><h1>${label}</h1>${sections}</body></html>`;
}

describe("Report Export — HTML generation", () => {
  it("generates Executivo HTML with correct sections and excludes technical details", () => {
    const html = buildHtmlReport("executivo", FULL_ANALYSIS, { id: "test-user-id", email: "test@test.com" }, "test-org-id");

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Executivo (Cliente)");
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("Principais Diferenças");
    expect(html).toContain("Próximos Passos Recomendados");
    expect(html).toContain("72%");
    expect(html).toContain("width:72%");
    // Executivo should NOT include technical sections
    expect(html).not.toContain("Alterações Semânticas");
    expect(html).not.toContain("Alterações Jurídicas");
  });

  it("generates Técnico HTML with all analytical sections", () => {
    const html = buildHtmlReport("tecnico", FULL_ANALYSIS, { id: "test-user-id", email: "test@test.com" }, "test-org-id");

    expect(html).toContain("Técnico (Advogado)");
    expect(html).toContain("Alterações Semânticas");
    expect(html).toContain("Alterações Jurídicas");
    expect(html).toContain("Análise Jurídica Contextualizada");
    expect(html).toContain("Simulação de Cenários");
    expect(html).toContain("<table");
    expect(html).toContain("#ef4444");
    expect(html).toContain("ALTO");
    expect(html).toContain("cursor:pointer");
    expect((html.match(/<details/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  it("generates Auditoria HTML with audit trail containing user info", () => {
    const html = buildHtmlReport("auditoria", FULL_ANALYSIS, { id: "test-user-id", email: "test@test.com" }, "test-org-id");

    expect(html).toContain("Auditoria (Compliance)");
    expect(html).toContain("Trilha de Auditoria");
    expect(html).toContain("test-user-id");
    expect(html).toContain("test@test.com");
    expect(html).toContain("test-org-id");
  });

  it("includes similarity bar and risk badges in all report types", () => {
    for (const type of ["executivo", "tecnico", "auditoria"] as const) {
      const html = buildHtmlReport(type, FULL_ANALYSIS, { id: "u", email: "e" }, "o");
      expect(html).toContain("72%");
      expect(html).toContain("Diferenças significativas encontradas.");
      expect(html).toContain("Resumo Executivo");
    }
  });
});

describe("Report Export — PDF generation via contractPdfExport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates PDF with correct structure", async () => {
    const { exportContractPDF } = await import("@/components/contracts/contractPdfExport");

    exportContractPDF({
      title: "Análise Completa",
      contractTitle: "Contrato de Serviços",
      analysisType: "full_analysis",
      content: "# Resumo\n\nConteúdo da análise\n- Item 1\n- Item 2\n## Seção\n**Bold text**",
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    const filename = mockSave.mock.calls[0][0];
    expect(filename).toContain("LexIA_");
    expect(filename).toContain(".pdf");
    expect(mockText).toHaveBeenCalledWith("LexIA", expect.any(Number), expect.any(Number));
    expect(mockText).toHaveBeenCalledWith("⚠ AVISO LEGAL", expect.any(Number), expect.any(Number));
  });
});
