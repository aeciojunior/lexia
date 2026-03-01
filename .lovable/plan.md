

# RF-060 — Relatório de Comparação

## What Exists
The `exportPdfReport` function in `TextComparison.tsx` (line 416-557) generates a single basic PDF with summary, critical changes, legal changes, contextual analysis, and suggestions. There's no report type selection, no executive/technical/audit modes, and no audit logging for report generation.

## Approach
Enhance the existing PDF export into a multi-mode report system entirely on the frontend. No new edge functions or DB migrations needed -- audit logs will be inserted via the Supabase client.

## Changes

### 1. `src/pages/TextComparison.tsx`

**Report type dialog**: Replace the single "Exportar Relatório" button with a dropdown offering 3 report types:
- **Executivo** (client-facing, simple language, focused on risks/impacts/recommendations)
- **Técnico** (full legal analysis, all sections, jurisprudence, detailed diffs)  
- **Auditoria** (technical + metadata, sources, AI decisions, timestamps, user info)

**Enhanced `exportPdfReport(type)`**: Refactor into a function that accepts a report type and generates structured sections accordingly:

| Section | Executivo | Técnico | Auditoria |
|---------|-----------|---------|-----------|
| Cover page with metadata | Yes | Yes | Yes |
| Executive summary (similarity %, risk, key points) | Yes | Yes | Yes |
| Critical differences (simplified) | Yes (simplified) | Yes (full) | Yes (full) |
| Semantic changes | No | Yes | Yes |
| Legal changes (before/after) | Summary only | Yes | Yes |
| Contextual legal impacts | Summary | Full with all categories | Full |
| Court analysis | Summary | Full | Full |
| Scenario simulation | Key points | Full | Full |
| Financial analysis | Yes if present | Yes if present | Yes if present |
| Multilingual analysis | No | Yes if present | Yes if present |
| Fraud indicators | Summary | Full | Full |
| Similarities | No | Yes | Yes |
| Harmonization suggestions | Yes | Yes | Yes |
| Recommendations section | Yes (actionable) | Yes (strategic) | Yes |
| Audit trail (user, timestamp, sources, AI decisions) | No | No | Yes |

**Audit logging**: After PDF generation, insert audit_log via Supabase client:
- `comparison_report_generated` (always)
- `executive_report_generated` / `technical_report_generated` / `audit_trail_report_generated` (by type)

### 2. Files Changed

| File | Change |
|------|--------|
| `src/pages/TextComparison.tsx` | Report type dropdown, enhanced multi-mode PDF generator, audit log insertion |

