

# RF-070, RF-071, RF-072 — Previsão Processual e Tomada de Decisão Estratégica

## Overview

Create a unified **Process Prediction** module that generates three AI-powered qualitative analyses for a given process: time estimation, success probability, and settlement recommendation. All three share the same flow (select process → invoke AI → display structured result), so they will be consolidated into a single edge function with a `type` parameter and a single new page with tabs.

## Architecture

```text
┌─────────────────────────────────┐
│  ProcessPredictions.tsx (NEW)   │
│  Tabs: Tempo | Êxito | Acordo  │
│  Select process → Generate     │
└──────────┬──────────────────────┘
           │ supabase.functions.invoke
           ▼
┌─────────────────────────────────┐
│  process-predictions/index.ts   │
│  type: time | success | settle  │
│  Fetches process + risks +      │
│  precedents → Lovable AI        │
│  Returns structured markdown    │
└─────────────────────────────────┘
```

## 1. Edge Function: `supabase/functions/process-predictions/index.ts`

- Accepts `{ process_id, organization_id, prediction_type }` where type is `"time_estimation" | "success_probability" | "settlement_recommendation"`
- Fetches process data, active risks, and internal precedents (reuses pattern from `generate-legal-strategy`)
- Uses different system prompts per type:
  - **time_estimation**: Estimate qualitative duration (curto/médio/longo) per phase, justification, accelerating/delaying factors, delay risks, strategic recommendations
  - **success_probability**: Qualitative probability (alta/moderada/baixa), favorable/unfavorable factors, associated risks, strategic recommendations
  - **settlement_recommendation**: Qualitative recommendation (favorável/neutra/desfavorável), mitigated risks, advantages/disadvantages, strategic alternatives
- All prompts enforce: no exact dates/numbers/percentages, qualitative terms only, state limitations
- Handles 429/402 errors
- Add to `supabase/config.toml`

## 2. New Page: `src/pages/ProcessPredictions.tsx`

- Route: `/process-predictions`
- Three tabs: "Tempo de Tramitação" (Clock), "Probabilidade de Êxito" (Target), "Sugestão de Acordo" (Handshake)
- Each tab: process selector dropdown + "Gerar Análise" button (RoleGuard `GENERATE_PREDICTIONS`)
- Result rendered as markdown (ReactMarkdown) in a styled card
- Audit logging on generation:
  - `processing_time_estimated`
  - `success_probability_estimated`
  - `settlement_recommendation_generated`

## 3. Permissions

Add to `usePermissions.ts`:
- `VIEW_PROCESS_PREDICTIONS` — added to owner, admin, user roles
- `GENERATE_PROCESS_PREDICTIONS` — added to owner, admin roles

## 4. Routing & Navigation

- Add route `/process-predictions` in `App.tsx`
- Add sidebar item "Previsões" with TrendingUp icon after "Estratégia", with permission `VIEW_PROCESS_PREDICTIONS`

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/process-predictions/index.ts` | New edge function |
| `supabase/config.toml` | Register function |
| `src/pages/ProcessPredictions.tsx` | New page with 3 tabs |
| `src/hooks/usePermissions.ts` | 2 new permissions |
| `src/components/AppSidebar.tsx` | 1 new nav item |
| `src/App.tsx` | 1 new route + import |

