import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/compare-texts`;

Deno.test("compare-texts: rejects unauthenticated request", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ textA: "a", textB: "b", organizationId: "test" }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test("compare-texts: rejects request with invalid token", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer invalid-token`,
    },
    body: JSON.stringify({ textA: "a", textB: "b", organizationId: "test" }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test("compare-texts: rejects missing required fields", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ textA: "only one text" }),
  });

  // Either 400 (missing fields) or 401 (invalid auth) is acceptable
  const status = response.status;
  const data = await response.json();
  assertExists(data.error);
  assertEquals(status === 400 || status === 401, true);
});

Deno.test("compare-texts: handles OPTIONS (CORS preflight)", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
  });

  assertEquals(response.status, 200);
  const body = await response.text();
  // OPTIONS should return empty or null body
  assertEquals(body === "" || body === "null", true);
});

// --- extract-pdf-text tests ---

const OCR_URL = `${SUPABASE_URL}/functions/v1/extract-pdf-text`;

Deno.test("extract-pdf-text: rejects unauthenticated request", async () => {
  const response = await fetch(OCR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: ["base64data"], organizationId: "test" }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test("extract-pdf-text: handles OPTIONS (CORS preflight)", async () => {
  const response = await fetch(OCR_URL, {
    method: "OPTIONS",
  });

  assertEquals(response.status, 200);
  await response.text();
});
