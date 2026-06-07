import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, requireOrgMember, jsonResponse, corsHeaders } from "../_shared/auth.ts";
import { isTurbovecConfigured, turbovecSearch } from "../_shared/turbovec.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const { organization_id, query, k = 8, process_id, document_id } = await req.json();

    if (!organization_id || !query?.trim()) {
      return jsonResponse({ error: "organization_id e query são obrigatórios" }, 400);
    }

    const memberError = await requireOrgMember(auth.supabase, auth.userId, organization_id);
    if (memberError) return memberError;

    if (!isTurbovecConfigured()) {
      return jsonResponse({ results: [], configured: false });
    }

    let allowlist: number[] | undefined;

    if (process_id || document_id) {
      let chunkQuery = auth.supabase
        .from("document_chunks")
        .select("vector_id")
        .eq("organization_id", organization_id);

      if (document_id) chunkQuery = chunkQuery.eq("document_id", document_id);
      if (process_id) chunkQuery = chunkQuery.eq("process_id", process_id);

      const { data: scopedChunks } = await chunkQuery.limit(5000);
      allowlist = (scopedChunks || []).map((c: { vector_id: number }) => Number(c.vector_id));

      if (!allowlist.length) {
        return jsonResponse({ results: [], configured: true });
      }
    }

    const hits = await turbovecSearch(organization_id, String(query), Math.min(Number(k) || 8, 20), allowlist);
    if (!hits.length) {
      return jsonResponse({ results: [], configured: true });
    }

    const vectorIds = hits.map((h) => h.vector_id);
    const { data: chunks } = await auth.supabase
      .from("document_chunks")
      .select("vector_id, content, document_id, process_id, chunk_index")
      .in("vector_id", vectorIds);

    const chunkMap = new Map(
      (chunks || []).map((c: { vector_id: number; content: string; document_id: string | null; process_id: string | null; chunk_index: number }) => [
        Number(c.vector_id),
        c,
      ]),
    );

    const docIds = [...new Set((chunks || []).map((c: { document_id: string | null }) => c.document_id).filter(Boolean))];
    const { data: docs } = docIds.length
      ? await auth.supabase.from("documents").select("id, file_name, category").in("id", docIds)
      : { data: [] };

    const docMap = new Map((docs || []).map((d: { id: string; file_name: string; category: string }) => [d.id, d]));

    const results = hits
      .map((hit) => {
        const chunk = chunkMap.get(hit.vector_id);
        if (!chunk) return null;
        const doc = chunk.document_id ? docMap.get(chunk.document_id) : null;
        return {
          vector_id: hit.vector_id,
          score: hit.score,
          content: chunk.content,
          chunk_index: chunk.chunk_index,
          document_id: chunk.document_id,
          process_id: chunk.process_id,
          file_name: doc?.file_name ?? null,
          category: doc?.category ?? null,
        };
      })
      .filter(Boolean);

    return jsonResponse({ results, configured: true });
  } catch (err) {
    console.error("semantic-search error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      500,
    );
  }
});
