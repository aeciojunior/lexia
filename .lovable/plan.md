

# RF-059 — Contextual Legal Analysis

## What Exists

The `compare-texts` edge function already produces `alteracoes_juridicas` (aspect/before/after/impact/risk). RF-059 deepens this into a full contextual legal analysis with impact categories (facts, foundations, claims, evidence, jurisprudence, contracts, procedural), pedagogical explanations, court-specific analysis, and scenario simulation.

## Approach

Extend the existing comparison pipeline rather than creating a separate module. Add a new `analise_juridica_contextualizada` section to the AI tool schema, enhance the system prompt with detailed legal analysis instructions, and add a dedicated UI tab.

---

## 1. Edge Function (`compare-texts/index.ts`)

### New comparison type
- Add `contextual_legal` to supported types with specialized system prompt covering all 7 impact categories (facts, foundations, claims, evidence, jurisprudence, contractual, procedural).

### Extended tool schema
Add a new `analise_juridica_contextualizada` object to `buildToolSchema` for types `contextual_legal`, `legal_piece`, and `contract`:

```
analise_juridica_contextualizada: {
  impactos: [{
    descricao_alteracao, interpretacao_juridica,
    categoria: "fatos"|"fundamentos"|"pedidos"|"provas"|"jurisprudencia"|"contratual"|"processual",
    impacto: "alto"|"medio"|"baixo",
    fundamentos_afetados, jurisprudencia_relacionada,
    riscos_introduzidos, riscos_removidos,
    sugestoes_mitigacao,
    recomendacao: "manter"|"revisar"|"reverter",
    explicacao_simples, explicacao_tecnica,
    exemplo_pratico
  }],
  analise_por_tribunal: {
    tribunal, entendimento_predominante,
    riscos_especificos, recomendacoes_adaptadas
  },
  cenarios: [{
    nome, descricao, impacto_juridico,
    impacto_probatorio, impacto_financeiro,
    riscos, vantagens, desvantagens,
    recomendacao
  }],
  resumo_impacto_geral
}
```

### System prompt additions
- Instructions for pedagogical dual-mode explanations (simple + technical)
- Court-specific analysis when process context is available
- Scenario simulation (with/without change, alternative approaches)
- Rules: no conclusive predictions, qualitative terms only

### New audit events
- `contextual_legal_analysis_performed`
- `contextual_legal_risk_detected` (when any high-impact item)
- `contextual_legal_risk_high`
- `contextual_scenario_simulation_performed`

---

## 2. Frontend (`TextComparison.tsx`)

### New comparison type in Select
- `contextual_legal` — "Análise Jurídica Contextualizada"

### New `AiAnalysis` interface fields
```ts
analise_juridica_contextualizada?: {
  impactos: Array<{ descricao_alteracao; interpretacao_juridica; categoria; impacto; ... }>;
  analise_por_tribunal?: { tribunal; entendimento_predominante; ... };
  cenarios?: Array<{ nome; descricao; impacto_juridico; ... }>;
  resumo_impacto_geral?: string;
}
```

### New tab: "Impacto Jurídico"
Visible when `analise_juridica_contextualizada` has data. Contains:
- **Summary card** with `resumo_impacto_geral`
- **Impact cards** grouped by category, each showing: description, interpretation, risk badge, recommendation badge (manter/revisar/reverter), toggle between simple/technical explanation, example
- **Court analysis card** (if present): tribunal name, predominant understanding, specific risks
- **Scenarios section**: cards comparing with/without change, risks and advantages side-by-side

### PDF export extension
Add contextual legal analysis section to the exported PDF report.

---

## 3. No Database Changes

All new data fits within the existing `ai_analysis` JSONB column on `text_comparisons`. No migration needed.

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/compare-texts/index.ts` | New type, extended schema, enhanced prompt, new audit events |
| `src/pages/TextComparison.tsx` | New type option, interface extension, "Impacto Jurídico" tab, PDF export update |

