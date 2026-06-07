import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, requireOrgMember, jsonResponse, corsHeaders } from "../_shared/auth.ts";
import { chunkText, isTurbovecConfigured, turbovecRemove, turbovecUpsert } from "../_shared/turbovec.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const { document_id, organization_id, text, process_id } = await req.json();

    if (!document_id || !organization_id || !text?.trim()) {
      return jsonResponse({ error: "document_id, organization_id e text são obrigatórios" }, 400);
    }

    const memberError = await requireOrgMember(auth.supabase, auth.userId, organization_id);
    if (memberError) return memberError;

    const { data: document, error: docError } = await auth.supabase
      .from("documents")
      .select("id, organization_id, process_id, file_name")
      .eq("id", document_id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (docError || !document) {
      return jsonResponse({ error: "Documento não encontrado" }, 404);
    }

    const chunks = chunkText(String(text));
    if (!chunks.length) {
      return jsonResponse({ error: "Texto vazio após processamento" }, 400);
    }

    const { data: existingChunks } = await auth.supabase
      .from("document_chunks")
      .select("vector_id")
      .eq("document_id", document_id);

    const oldVectorIds = (existingChunks || []).map((c: { vector_id: number }) => Number(c.vector_id));

    await auth.supabase.from("document_chunks").delete().eq("document_id", document_id);

    const resolvedProcessId = process_id ?? document.process_id ?? null;
    const rows = chunks.map((content, chunk_index) => ({
      organization_id,
      document_id,
      process_id: resolvedProcessId,
      chunk_index,
      content,
      source_type: "document",
    }));

    const { data: inserted, error: insertError } = await auth.supabase
      .from("document_chunks")
      .insert(rows)
      .select("vector_id, content, chunk_index");

    if (insertError || !inserted?.length) {
      console.error("document_chunks insert error:", insertError);
      return jsonResponse({ error: "Falha ao salvar chunks" }, 500);
    }

    let indexed = 0;
    if (isTurbovecConfigured()) {
      if (oldVectorIds.length) {
        await turbovecRemove(organization_id, oldVectorIds);
      }

      const upsertItems = inserted.map((row: { vector_id: number; content: string }) => ({
        vector_id: Number(row.vector_id),
        text: row.content,
      }));

      const result = await turbovecUpsert(organization_id, upsertItems);
      indexed = result.indexed;
    }

    await auth.supabase
      .from("documents")
      .update({ vector_indexed_at: new Date().toISOString() })
      .eq("id", document_id);

    await auth.supabase.from("audit_logs").insert({
      action: "document_vector_indexed",
      user_id: auth.userId,
      organization_id,
      resource_type: "document",
      resource_id: document_id,
      metadata: {
        chunks: inserted.length,
        indexed,
        file_name: document.file_name,
        turbovec: isTurbovecConfigured(),
      },
    });

    return jsonResponse({
      ok: true,
      chunks: inserted.length,
      indexed,
      vector_ids: inserted.map((r: { vector_id: number }) => r.vector_id),
    });
  } catch (err) {
    console.error("index-document error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      500,
    );
  }
});
