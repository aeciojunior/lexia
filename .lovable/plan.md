

# RF-073 — Gestão de Contratos Inteligente (Contract Intelligence)

## Overview

Enhance the existing Contracts module with AI-powered contract intelligence. The existing page already has "Análise Inteligente" and "Auditoria Contínua" tabs (currently static placeholders). We'll create a single versatile edge function and a new `ContractIntelligencePanel` component that replaces the placeholder content with real AI analysis across 7 sub-modules (RF-073 through RF-073.7).

## Architecture

```text
┌──────────────────────────────────────────┐
│  Contracts.tsx (enhanced tabs)           │
│  + ContractIntelligencePanel.tsx (NEW)   │
│  Tabs: Análise | Cláusulas | CLM |      │
│        Renegociação | Benchmarking |     │
│        Abusivas | Redação                │
└──────────┬───────────────────────────────┘
           │ supabase.functions.invoke
           ▼
┌──────────────────────────────────────────┐
│  analyze-contract/index.ts (NEW)         │
│  analysis_type:                          │
│    full_analysis | clause_analysis |     │
│    renegotiation | benchmarking |        │
│    abusive_detection | draft_contract    │
│  Fetches contract + risks + precedents   │
│  Returns structured markdown             │
└──────────────────────────────────────────┘
```

## 1. Edge Function: `supabase/functions/analyze-contract/index.ts`

- Accepts `{ contract_id, organization_id, analysis_type, extra_context? }`
- Types: `full_analysis`, `clause_analysis`, `renegotiation`, `benchmarking`, `abusive_detection`, `draft_contract`
- Fetches contract data, related risks, internal precedents, legislative updates
- Each type gets a specialized system prompt:
  - **full_analysis** (RF-073): Executive summary, clause analysis, obligations, deadlines, risks (juridical/financial/regulatory/operational/litigation), legislative impact, strategic recommendations
  - **clause_analysis** (RF-073.3): Classify each clause as Padrão/Aceitável/Divergente/Crítica/Proibida with justification and risk
  - **renegotiation** (RF-073.1): Detect triggers, suggest renegotiation types, alternatives, justification
  - **benchmarking** (RF-073.5): Compare against sector standards, identify deviations, adherence rating
  - **abusive_detection** (RF-073.6): Check CDC/LGPD/CLT/Civil Code violations, classify severity
  - **draft_contract** (RF-073.7): Generate complete contract from user-provided parameters (parties, object, sector, type)
- All prompts enforce qualitative-only language, limitations disclosure, no auto-approval
- Standard 429/402 error handling
- Register in `supabase/config.toml`

## 2. New Component: `src/components/contracts/ContractIntelligencePanel.tsx`

- Receives selected contract as prop
- 7 sub-tabs matching each RF
- Each tab: description card + "Gerar Análise" button + ReactMarkdown result display
- Draft tab (RF-073.7): Additional form inputs for parties, object, sector, contract type before generation
- Audit logging on each generation with appropriate action codes
- History: queries `predictions` table with `target_type: "contract"` to show past analyses

## 3. Enhance `src/pages/Contracts.tsx`

- Replace the static "Análise Inteligente" tab content with `ContractIntelligencePanel`
- Add new tabs: "Cláusulas", "CLM", "Renegociação", "Benchmarking", "Abusivas", "Redação"
- CLM tab (RF-073.2): Visual timeline of contract lifecycle phases (creation → review → approval → signature → execution → audit → renewal → closure) based on contract metadata and audit_logs
- All AI tabs gated by `ANALYZE_CONTRACTS` permission

## 4. Permissions

Add to `usePermissions.ts`:
- `ANALYZE_CONTRACTS` — owner, admin, user
- `DRAFT_CONTRACTS` — owner, admin

## 5. Audit Actions

All analyses log to `audit_logs`:
- `contract_analyzed`, `contract_risk_detected`, `contract_clause_risk_detected`, `contract_clause_classified`
- `contract_renegotiation_suggested`, `contract_benchmark_performed`
- `abusive_clause_detected`, `clause_generated`, `contract_generated`
- `contract_clm_event_logged`, `contract_compliance_checked`, `contract_consistency_checked`

## 6. Persistent History

Each AI analysis result is saved to `predictions` table with:
- `target_type: "contract"`, `target_id: contract_id`
- `prediction_type` matching the analysis_type
- `ai_explanation` with the full markdown result

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/analyze-contract/index.ts` | New edge function |
| `supabase/config.toml` | Register function |
| `src/components/contracts/ContractIntelligencePanel.tsx` | New component with 7 AI analysis tabs |
| `src/pages/Contracts.tsx` | Replace placeholder tabs, integrate panel |
| `src/hooks/usePermissions.ts` | Add `ANALYZE_CONTRACTS`, `DRAFT_CONTRACTS` |

