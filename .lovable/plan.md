

# RF-066 to RF-077 — Legal Intelligence Hub, Risk Prediction, Internal Precedents, Strategy Engine, Performance Analytics, Financial Impact, Compliance Engine, Smart Contracts, Case Clustering, Governance Engine, Knowledge Management, Regulatory Risk

## Analysis

These 12 RFs map well to existing pages and new pages. Many are enhancements to existing modules rather than net-new tables. The strategy is to maximize reuse of existing infrastructure (risks, predictions, compliance, governance, contracts, wiki) and create only the truly new pages/tables.

### Mapping to existing vs new

| RF | Implementation | Target |
|----|---------------|--------|
| RF-066 | **New page** — Legal Intelligence Dashboard | `/legal-intelligence` |
| RF-067 | **Enhance** existing Predictions page | `src/pages/Predictions.tsx` |
| RF-068 | **New table + page** — Internal Precedents | `/precedents` |
| RF-069 | **New page** — Strategy Engine (uses AI edge function) | `/legal-strategy` |
| RF-070 | **Enhance** existing Metrics page | `src/pages/Metrics.tsx` |
| RF-071 | **New page** — Financial Impact predictions | `/financial-impact` |
| RF-072 | **Enhance** existing Compliance page | `src/pages/Compliance.tsx` |
| RF-073 | **Enhance** existing Contracts page | `src/pages/Contracts.tsx` |
| RF-074 | **New page** — Case Clustering | `/case-clustering` |
| RF-075 | **Enhance** existing Governance page | `src/pages/Governance.tsx` |
| RF-076 | **Enhance** existing Wiki page (Knowledge Management) | `src/pages/Wiki.tsx` |
| RF-077 | **Enhance** existing RegulatoryIntelligence page | `src/pages/RegulatoryIntelligence.tsx` |

## Database

### New table: `internal_precedents`
- `id`, `organization_id`, `title`, `description`, `type` (piece/argument/decision/strategy/clause/analysis), `legal_area`, `tribunal`, `result_obtained`, `context`, `relevant_excerpts` (text), `recommendations`, `limitations`, `tags` (text[]), `created_by`, `created_at`, `updated_at`
- RLS: org membership

No other new tables needed. RF-066 is a read-only dashboard aggregating existing tables. RF-067/071/074 extend predictions. RF-069 uses AI. RF-070/072/073/075/076/077 enhance existing pages with new tabs/panels.

## New Pages (4)

### 1. `src/pages/LegalIntelligence.tsx` (RF-066)
Unified dashboard with cards aggregating:
- Risk summary from `risks` table (count by level)
- Recent decisions from `court_monitoring_decisions` (last 10)
- Legislative updates from `legislative_updates` (last 10)
- Regulatory updates from `regulatory_updates` (last 10)
- Critical processes from `processes` (status-based)
- Deadline alerts from `deadlines` (upcoming)
- Tabs: Overview, By Client, By Area, By Tribunal
- Audit: `legal_intelligence_dashboard_accessed`

### 2. `src/pages/InternalPrecedents.tsx` (RF-068)
CRUD for internal precedents with search, filter by type/area/tribunal, tags. Audit: `internal_precedent_created`

### 3. `src/pages/LegalStrategy.tsx` (RF-069)
AI-powered strategy generation panel. Select a process, invoke edge function to generate strategy. Display strategies with sections (procedural, probatory, argumentative). Audit: `legal_strategy_generated`

### 4. `src/pages/CaseClustering.tsx` (RF-074)
Panel showing process clusters by similar facts/area/tribunal. Groups processes and shows scenario predictions. Audit: `case_cluster_identified`

## Enhanced Pages (6)

### `Predictions.tsx` (RF-067)
- Add risk subtypes: procedural, merit, probatory, strategic
- Add source fields and mitigation recommendations display

### `Metrics.tsx` (RF-070)
- Add "Performance Jurídica" tab with favorability rates, strategy efficacy, tribunal comparison

### `Compliance.tsx` (RF-072)
- Add "Motor de Compliance" tab with obligation monitoring status (conforme/não conforme/risco)

### `Contracts.tsx` (RF-073)
- Add "Análise Inteligente" tab showing risk analysis, obligation alerts, renegotiation suggestions

### `Governance.tsx` (RF-075)
- Add "Inteligência" tab with governance risk map and strategic recommendations

### `Wiki.tsx` (RF-076)
- Add knowledge management features: type classification, usage tracking, result obtained field

### `RegulatoryIntelligence.tsx` (RF-077)
- Add "Riscos Regulatórios" tab with risk classification and monitoring

## Permissions

Add 8 new permissions:
- `VIEW_LEGAL_INTELLIGENCE`, `VIEW_INTERNAL_PRECEDENTS`, `MANAGE_INTERNAL_PRECEDENTS`
- `VIEW_LEGAL_STRATEGY`, `GENERATE_LEGAL_STRATEGY`
- `VIEW_CASE_CLUSTERING`
- `VIEW_FINANCIAL_IMPACT`
- `VIEW_LEGAL_PERFORMANCE`

## Routing & Sidebar

Add 4 new routes and nav items:
- `/legal-intelligence` — "Inteligência" (Brain icon)
- `/precedents` — "Precedentes" (BookOpen icon)
- `/legal-strategy` — "Estratégia" (Target icon)
- `/case-clustering` — "Clusters" (GitBranch icon)

## Edge Function

### `generate-legal-strategy/index.ts` (RF-069)
Uses Lovable AI Gateway to generate strategies based on process data, risks, and precedents. Returns structured strategy with sections.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | 1 new table (`internal_precedents`) |
| `src/hooks/usePermissions.ts` | 8 new permissions |
| `src/pages/LegalIntelligence.tsx` | New dashboard page |
| `src/pages/InternalPrecedents.tsx` | New CRUD page |
| `src/pages/LegalStrategy.tsx` | New AI strategy page |
| `src/pages/CaseClustering.tsx` | New clustering page |
| `src/pages/Predictions.tsx` | Add risk subtypes |
| `src/pages/Metrics.tsx` | Add performance tab |
| `src/pages/Compliance.tsx` | Add compliance engine tab |
| `src/pages/Contracts.tsx` | Add smart analysis tab |
| `src/pages/Governance.tsx` | Add intelligence tab |
| `src/pages/Wiki.tsx` | Add KM features |
| `src/pages/RegulatoryIntelligence.tsx` | Add regulatory risks tab |
| `src/components/AppSidebar.tsx` | 4 new nav items |
| `src/App.tsx` | 4 new routes |
| `supabase/functions/generate-legal-strategy/index.ts` | New edge function |

