export const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

export function getHfModel(): string {
  return Deno.env.get("HUGGINGFACE_MODEL") || "meta-llama/Meta-Llama-3.1-8B-Instruct";
}

export function requireHfToken(): string {
  const token = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!token) throw new Error("HUGGINGFACE_API_KEY not configured");
  return token;
}

/** OpenAI-compatible chat completions via Hugging Face router. */
export async function hfChat(body: Record<string, unknown>): Promise<Response> {
  const model = (body.model as string | undefined) || getHfModel();
  return fetch(HF_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireHfToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, model }),
  });
}
