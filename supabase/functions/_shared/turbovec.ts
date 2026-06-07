const TURBOVEC_API_URL = () =>
  (Deno.env.get("TURBOVEC_API_URL") || "").replace(/\/$/, "");

const TURBOVEC_API_SECRET = () => Deno.env.get("TURBOVEC_API_SECRET") || "";

export function isTurbovecConfigured(): boolean {
  return Boolean(TURBOVEC_API_URL());
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = TURBOVEC_API_SECRET();
  if (secret) headers.Authorization = `Bearer ${secret}`;
  return headers;
}

export interface TurbovecSearchHit {
  vector_id: number;
  score: number;
}

export async function turbovecUpsert(
  organizationId: string,
  items: { vector_id: number; text: string }[],
): Promise<{ indexed: number; dim?: number | null }> {
  const base = TURBOVEC_API_URL();
  if (!base) throw new Error("TURBOVEC_API_URL not configured");
  if (!items.length) return { indexed: 0 };

  const res = await fetch(`${base}/v1/upsert`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ organization_id: organizationId, items }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TurboVec upsert failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function turbovecRemove(
  organizationId: string,
  vectorIds: number[],
): Promise<number> {
  const base = TURBOVEC_API_URL();
  if (!base || !vectorIds.length) return 0;

  const res = await fetch(`${base}/v1/remove`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ organization_id: organizationId, vector_ids: vectorIds }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TurboVec remove failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.removed ?? 0;
}

export async function turbovecSearch(
  organizationId: string,
  query: string,
  k = 8,
  allowlist?: number[],
): Promise<TurbovecSearchHit[]> {
  const base = TURBOVEC_API_URL();
  if (!base) return [];

  const res = await fetch(`${base}/v1/search`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      organization_id: organizationId,
      query,
      k,
      allowlist: allowlist?.length ? allowlist : undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("TurboVec search error:", res.status, text);
    return [];
  }

  const data = await res.json();
  return data.results ?? [];
}

/** Divide texto em chunks compatíveis com o serviço Python. */
export function chunkText(text: string, chunkSize = 900, overlap = 120): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    const piece = cleaned.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= cleaned.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}
