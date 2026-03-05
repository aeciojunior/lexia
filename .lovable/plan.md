

# RF-060/061/062/063/064/065 — Court Monitoring, Jurisprudence Alerts, Legislative Updates, Legal Risk Management, Strategic Jurisprudence Dashboard, Regulatory Intelligence

## Summary

This is a large set of interrelated features forming the **Legal Intelligence** module. Given the scope, I will implement the core data layer and three new pages with full CRUD, plus integrate with the existing notification and audit systems.

## Database Migration

Create 4 new tables:

### `court_monitoring_configs`
Stores monitoring configurations per organization: themes, keywords, legal areas, selected courts, frequency, active status.

### `court_monitoring_decisions`
Stores detected decisions: tribunal, chamber, date, summary, thesis, relevance level, impact level, related themes/keywords, related process_id, AI recommendation.

### `legislative_updates`
Stores legislative changes: norm type, norm identifier, change type (creation/revocation/partial), old text, new text, impact analysis (JSON), affected areas, affected clients, scenarios, status, AI recommendations.

### `regulatory_updates`
Stores regulatory norm changes: agency, norm identifier, change type, impact analysis, affected sectors, affected clients, urgency level, recommendations.

No changes to the existing `risks` table — RF-063 extends the existing Risks page with legal risk subtypes rather than a new table.

All tables use `organization_id` with RLS policies requiring org membership.

## New Pages

### 1. `src/pages/CourtMonitoring.tsx` (RF-060 + RF-061 + RF-064)
- **Config Tab**: CRUD for monitoring configs (themes, keywords, areas, courts, frequency)
- **Decisions Tab**: List of detected decisions with relevance/impact badges, tribunal info, AI summary, link to related processes
- **Alerts Tab**: Shows alerts grouped by theme with priority, includes recommendation panel
- **Dashboard Tab**: Strategic jurisprudence panel (RF-064) with trend indicators, favorability index, tribunal comparison
- Audit events: `court_monitoring_configured`, `court_monitoring_decision_detected`, `jurisprudence_alert_generated`, `jurisprudence_dashboard_accessed`

### 2. `src/pages/LegislativeUpdates.tsx` (RF-062 + RF-062.1/2/3)
- **Updates Tab**: List of legislative changes with norm type, change type, impact badges
- **Impact by Area Tab**: Breakdown by legal area with specific impacts
- **Impact by Client Tab**: Shows affected clients with urgency levels
- **Scenarios Tab**: Simulation panel showing juridical/operational/financial scenarios
- Audit events: `legislative_update_detected`, `legislative_area_impact_analyzed`, `legislative_client_impact_analyzed`, `legislative_scenario_simulation_performed`

### 3. `src/pages/RegulatoryIntelligence.tsx` (RF-065)
- Panel listing regulatory changes by agency
- Impact analysis by sector and client
- Recommendations with urgency
- Audit events: `regulatory_update_detected`, `regulatory_impact_analyzed`

## Existing Page Enhancement

### `src/pages/Risks.tsx` (RF-063)
- Add new risk types: `procedural`, `probatory`, `merit`, `contractual`, `regulatory`, `legislative`, `strategic`
- Add source fields (related process, client, document)
- Add timeline/history view
- Add AI-generated risk explanation panel
- Audit events: `legal_risk_detected`, `legal_risk_updated`, `legal_risk_mitigated`

## Permissions

Add to `usePermissions.ts`:
- `VIEW_COURT_MONITORING`, `MANAGE_COURT_MONITORING`
- `VIEW_LEGISLATIVE_UPDATES`, `MANAGE_LEGISLATIVE_UPDATES`
- `VIEW_REGULATORY`, `MANAGE_REGULATORY`

Grant to owner, admin, user (view), intern (view).

## Routing & Sidebar

Add 3 new routes in `App.tsx` and nav items in `AppSidebar.tsx`:
- `/court-monitoring` — "Monitoramento" (Eye icon)
- `/legislative-updates` — "Legislação" (ScrollText icon)
- `/regulatory` — "Regulatório" (ShieldCheck icon)

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | 4 new tables + RLS policies |
| `src/hooks/usePermissions.ts` | 6 new permissions + role mappings |
| `src/pages/CourtMonitoring.tsx` | New page (configs + decisions + alerts + dashboard) |
| `src/pages/LegislativeUpdates.tsx` | New page (updates + area/client impact + scenarios) |
| `src/pages/RegulatoryIntelligence.tsx` | New page (regulatory panel) |
| `src/pages/Risks.tsx` | Expand risk types and add legal risk features |
| `src/components/AppSidebar.tsx` | 3 new nav items |
| `src/App.tsx` | 3 new routes |

