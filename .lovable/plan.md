

# RF-073.7 — Motor de Redação Automática de Contratos Completos

## Current State

The `draft_contract` analysis type already exists with a basic 4-field form (parties, object, sector, contractType) and a simple system prompt. RF-073.7 requires a much richer drafting engine with comprehensive inputs, contextual data fetching, consistency checks, and compliance validation.

## Changes

### 1. Enhanced Edge Function (`supabase/functions/analyze-contract/index.ts`)

- Expand the `draft_contract` system prompt to enforce all 12 structural sections (identification, object, obligations, financials, deadlines, guarantees, liability, LGPD, confidentiality, compliance, forum, annexes)
- Add instructions for consistency verification (cross-clause conflict detection, obligation-deadline alignment)
- Add conformity checks (CDC/LGPD/CLT abusive clause blocking, regulatory compliance)
- Add a "PONTOS DE ATENÇÃO" section listing items requiring human review
- When `analysis_type === "draft_contract"`, fetch additional context:
  - Similar contracts from the same org (by type/sector) for reference
  - Document templates tagged as contract models
  - Compliance policies from the org
- Log multiple audit actions: `contract_generated`, `contract_consistency_checked`, `contract_compliance_checked`

### 2. Enhanced UI Form (`ContractIntelligencePanel.tsx`)

Expand the draft form with additional fields:
- **Parties** (textarea) — existing
- **Object** (textarea) — existing  
- **Sector** (select) — existing
- **Contract Type** (select) — existing
- **New fields**:
  - `value` (input) — contract value
  - `currency` (select) — BRL/USD/EUR
  - `duration` (input) — duration in months
  - `jurisdiction` (input) — forum/jurisdiction
  - `riskLevel` (select) — conservative/moderate/aggressive
  - `formality` (select) — formal/simplified
  - `complexity` (select) — executive/technical
  - `lgpdRequired` (checkbox/switch) — include LGPD clauses
  - `arbitration` (checkbox/switch) — include arbitration clause
  - `includeAnnexes` (checkbox/switch) — generate annex structure

All new fields are serialized into the `extra_context` string sent to the edge function.

### 3. Files Changed

| File | Change |
|------|--------|
| `supabase/functions/analyze-contract/index.ts` | Enhanced draft_contract prompt, fetch similar contracts/templates, multiple audit actions |
| `src/components/contracts/ContractIntelligencePanel.tsx` | Expanded draft form with 10+ fields, richer context assembly |

