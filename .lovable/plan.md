

# RF-053 — Perguntas em Linguagem Natural

## Summary

Enhance the existing `lexia-chat` edge function and `Chat.tsx` page to support context-aware natural language queries. The AI will fetch real organization data (processes, documents, clients, deadlines, movements, glossary) and inject it as context before answering. All queries are audited. The Chat UI gets an optional process/document context selector and improved response rendering with source references.

## Approach

Rather than creating multiple new edge functions (`/nl/query/process`, `/nl/query/document`), we consolidate everything into the existing `lexia-chat` function with an enhanced context-fetching pipeline. This avoids fragmentation and leverages the existing RBAC middleware.

## Database Migration

New `nl_queries` table for audit trail of NL interactions:

```sql
CREATE TABLE public.nl_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  conversation_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT DEFAULT '',
  sources_used JSONB DEFAULT '[]',
  query_type TEXT DEFAULT 'general',
  status TEXT DEFAULT 'answered',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.nl_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage nl_queries"
  ON public.nl_queries FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id));
```

No other new tables needed -- we use existing `audit_logs` for event tracking.

## Edge Function: Enhanced `lexia-chat`

Major rewrite of the existing function to add a **data context pipeline** before calling the AI:

1. **Intent classification** -- Detect what the user is asking about (process, document, client, deadline, risk, jurisprudence, calculation, general) using keyword matching
2. **Context fetching** -- Based on intent + optional `processId`/`documentId` from the request body:
   - **Processes**: fetch from `processes` table (title, number, status, court, risk_level, partes, valor_causa, fase)
   - **Documents**: fetch from `documents` table (name, category, status)
   - **Deadlines**: fetch from `deadlines` table (title, due_date, status)
   - **Movements**: fetch from `process_movements` (description, date, type)
   - **Clients**: fetch from `clients` table (name, email, phone, document_number)
   - **Glossary**: fetch from `legal_glossary` (term, preferred_term)
   - **Decision extractions**: fetch from `decision_extractions`
3. **Permission check** -- Sensitive documents (vault) checked against ACL rules; denied queries logged as `nl_query_denied_permission`
4. **System prompt enrichment** -- Inject fetched data as structured context sections into the system prompt
5. **Response handling** -- Parse AI response, persist to `nl_queries`, write audit log entries (`nl_query_answered`, `nl_query_source_used`)
6. **Error handling** -- 429/402 handling, insufficient data warnings

Key body params added: `processId?`, `documentId?`, `clientId?`

## Frontend Changes

### `Chat.tsx` Enhancements

1. **Context selector** -- Add an optional process/document picker in the header area:
   - Dropdown to select an active process (fetched from org's processes)
   - When selected, all queries are scoped to that process context
   - Shows a badge with the selected process number
   - "Clear context" button to return to general mode

2. **Enhanced suggestions** -- Update suggestion chips based on whether a process is selected:
   - With process: "Quais os prazos?", "Qual o risco?", "Resumo das movimentações", "Documentos pendentes"
   - Without process: Keep current general suggestions + add "Buscar jurisprudência sobre...", "Explicar artigo..."

3. **Source references in responses** -- The AI response (markdown) will naturally contain references. No special parsing needed since we use ReactMarkdown already.

4. **Query history sidebar** -- Add a collapsible panel showing recent NL queries from `nl_queries` table for the current user, allowing quick re-asking.

### No new pages needed -- everything integrates into the existing Chat page.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/lexia-chat/index.ts` | Major rewrite: add context pipeline, intent detection, data fetching, audit logging, nl_queries persistence |
| `src/pages/Chat.tsx` | Add process context selector, enhanced suggestions, query history sidebar |
| Migration SQL | Create `nl_queries` table |

## Technical Details

- Intent detection uses simple keyword matching (e.g., "prazo" → deadlines, "risco" → risk analysis, "jurisprudência/súmula" → jurisprudence, "documento/contrato/laudo" → documents, "valor/cálculo/dívida" → calculations)
- Context data is truncated to fit within token limits (~4000 chars max context injection)
- The `processId` param is passed from frontend when user selects a process context
- Vault documents are filtered out unless user has explicit ACL access
- All queries logged to `nl_queries` + `audit_logs` for compliance
- System prompt instructs AI to cite sources, avoid inventing data, use qualitative risk terms, and indicate when information is insufficient

