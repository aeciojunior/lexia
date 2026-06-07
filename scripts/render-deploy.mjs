#!/usr/bin/env node
/**
 * Cria o static site LexIA no Render via API.
 * Uso: RENDER_API_KEY=rnd_... node scripts/render-deploy.mjs
 */
const TOKEN = process.env.RENDER_API_KEY;
const OWNER_ID = "tea-d6cfc7p5pdvs73d3t1ig";
const REPO = "https://github.com/aeciojunior/lexia";

if (!TOKEN) {
  console.error("Defina RENDER_API_KEY");
  process.exit(1);
}

const envVars = [
  { key: "VITE_SUPABASE_PROJECT_ID", value: "vnxuibjgayhmcitpjmde" },
  { key: "VITE_SUPABASE_URL", value: "https://vnxuibjgayhmcitpjmde.supabase.co" },
  {
    key: "VITE_SUPABASE_PUBLISHABLE_KEY",
    value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZueHVpYmpnYXlobWNpdHBqbWRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTM5MTYsImV4cCI6MjA5NjQyOTkxNn0.UnmaZ0ejyAvW8pj9LIGx1vUpSZA5YIXR4EZ0NL-cMBg",
  },
];

async function api(path, options = {}) {
  const res = await fetch(`https://api.render.com/v1${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const existing = await api("/services?limit=50");
  const found = existing.find((x) => x.service?.name === "lexia");
  if (found) {
    console.log("Serviço já existe:", found.service.serviceDetails?.url || found.service.dashboardUrl);
    await api(`/services/${found.service.id}/deploys`, { method: "POST", body: JSON.stringify({}) });
    console.log("Deploy disparado.");
    return;
  }

  const created = await api("/services", {
    method: "POST",
    body: JSON.stringify({
      type: "static_site",
      name: "lexia",
      ownerId: OWNER_ID,
      repo: REPO,
      branch: "main",
      autoDeploy: "yes",
      serviceDetails: {
        buildCommand: "npm ci && npm run build",
        publishPath: "dist",
      },
      envVars,
    }),
  });

  const svc = created.service || created;
  console.log("Criado:", svc.serviceDetails?.url || svc.dashboardUrl);
}

main().catch((err) => {
  console.error(err.message);
  if (String(err.message).includes("unfetchable")) {
    console.error("\nO Render não consegue acessar o repositório.");
    console.error("Conceda acesso em: https://github.com/settings/installations");
    console.error("→ Render → Configure → Repository access → inclua aeciojunior/lexia");
  }
  process.exit(1);
});
