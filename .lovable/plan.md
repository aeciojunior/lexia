

# RF-058 — Comparação de Arquivos (File Comparison)

## What Already Exists

RF-057 already provides text-based comparison with PDF OCR. RF-058 extends this to support **multi-format file uploads** (DOCX, TXT, HTML, RTF, images), **expanded comparison types** (financial, multilingual, fraud detection), a **richer AI analysis schema**, and **PDF report export**.

## Approach

Rather than creating an entirely separate module, we evolve the existing `TextComparison.tsx` page and `compare-texts` edge function. The core flow stays the same: extract text from files client-side or via OCR, send to AI for structured analysis, persist results. The key additions are format support, new comparison modes, and richer output sections.

---

## 1. Database Migration

Extend the existing `text_comparisons` table with new columns to support the expanded feature set:

```sql
ALTER TABLE public.text_comparisons
  ADD COLUMN IF NOT EXISTS similarity_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS file_a_format TEXT,
  ADD COLUMN IF NOT EXISTS file_b_format TEXT,
  ADD COLUMN IF NOT EXISTS file_a_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS file_b_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS detected_languages JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS fraud_indicators JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS financial_analysis JSONB DEFAULT '{}';
```

No new tables needed -- the single `text_comparisons` table with its JSONB columns is flexible enough to store all analysis variants.

---

## 2. Client-Side File Extraction (`src/lib/file-extract.ts`)

New utility module that handles text extraction for non-PDF formats on the client side:

- **DOCX**: Use a lightweight library (`mammoth` -- needs to be added as dependency) to extract raw text from .docx files
- **TXT / HTML / RTF**: Read as text directly via `FileReader`. For HTML, strip tags. For RTF, strip control codes with regex
- **Images (JPG/PNG)**: No client-side extraction; send directly to `extract-pdf-text` edge function for OCR (already supports image input)

Export a single function: `extractTextFromFile(file: File) => Promise<{ text: string; format: string; pageCount?: number; needsOcr: boolean }>` that dispatches based on MIME type.

---

## 3. Updated `compare-texts` Edge Function

Extend the existing function to handle new comparison types and return expanded analysis:

### New comparison types added to the `comparisonType` parameter:
- `financial` -- focuses on values, formulas, indices, dates, calculations
- `multilingual` -- cross-language semantic comparison
- `fraud_detection` -- identifies manipulation indicators

### Extended AI tool schema:
Add these new fields to the `comparison_analysis` tool parameters:

```
similaridade_percentual: number (0-100)
similaridades: [{ trecho, tipo: "identico"|"equivalente"|"preservado" }]
analise_financeira: { diferencas_valores, indices_alterados, impacto_financeiro, erros_calculo }
analise_multilingue: { idioma_a, idioma_b, omissoes, adicoes_nao_autorizadas, inconsistencias_terminologicas }
indicios_fraude: { tipo, descricao, pagina, probabilidade: "alta"|"media"|"baixa", recomendacao }
qualidade_ocr: "boa"|"parcial"|"insuficiente"
```

### Updated system prompt:
Add specialized instructions per comparison type (financial analysis focuses on values/formulas/indices; multilingual focuses on cross-language equivalences; fraud detection uses qualitative language like "indício" and "suspeita").

### New audit events:
- `file_comparison_performed`
- `file_comparison_pdf_ocr_executed`
- `file_comparison_semantic_change_detected`
- `file_comparison_legal_change_detected`
- `financial_comparison_performed`
- `multilingual_comparison_performed`
- `fraud_indicator_detected`

---

## 4. Updated `TextComparison.tsx` Page

### File upload expansion:
- Change the `accept` attribute to support `.pdf,.docx,.doc,.txt,.html,.rtf,.jpg,.jpeg,.png`
- Update `handleFileInput` to route by MIME type: PDF goes through existing `pdf-extract.ts`, DOCX through `mammoth`, text/HTML/RTF through `FileReader`, images through OCR edge function
- Show file format badge next to each input (e.g., "PDF", "DOCX", "PNG/OCR")

### New comparison type options in the Select dropdown:
- `financial` -- "Financeiro (valores, cálculos)"
- `multilingual` -- "Multilíngue (tradução)"
- `fraud_detection` -- "Detecção de Fraude"

### New results tabs/sections:
- **Similaridades tab**: Shows similarity percentage bar + list of identical/equivalent sections
- **Financeiro tab** (visible when comparison type is `financial`): Table of value changes, formula differences, index substitutions
- **Fraude tab** (visible when type is `fraud_detection`): List of fraud indicators with probability badges and recommendations
- **Multilíngue section** within Analysis tab: Detected languages, omissions, unauthorized additions

### PDF Export button:
- Add an "Exportar Relatório" button using the existing `jspdf` dependency
- Generates a PDF with: executive summary, similarity %, differences list, risk panel, and legal analysis
- Follows the report structure defined in the spec (sections 4.1-4.5)

---

## 5. New Dependency

- `mammoth` (DOCX text extraction, ~50KB) -- for client-side .docx parsing

---

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Add columns to `text_comparisons` |
| `src/lib/file-extract.ts` | New: multi-format extraction utility |
| `src/lib/pdf-extract.ts` | No changes needed |
| `supabase/functions/compare-texts/index.ts` | Extend with new types + expanded tool schema |
| `src/pages/TextComparison.tsx` | Multi-format upload, new tabs, PDF export |
| `package.json` | Add `mammoth` dependency |

