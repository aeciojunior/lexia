import fs from "fs";
import path from "path";

const importLine =
  "import { hfChat, getHfModel, requireHfToken } from '../_shared/huggingface.ts';";

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== "_shared") walk(p);
    else if (ent.name === "index.ts") fix(p);
  }
}

function fix(file) {
  let c = fs.readFileSync(file, "utf8");
  if (!c.includes("HF_CHAT_URL_PLACEHOLDER")) return;

  if (!c.includes("_shared/huggingface")) {
    const m = c.match(/^import .+;\n/m);
    if (m) {
      const pos = m.index + m[0].length;
      c = c.slice(0, pos) + importLine + "\n" + c.slice(pos);
    }
  }

  c = c.replace(
    /const HUGGINGFACE_API_KEY = Deno\.env\.get\("HUGGINGFACE_API_KEY"\);\s*if \(!HUGGINGFACE_API_KEY\) \{[\s\S]*?\}\s*/g,
    "requireHfToken();\n    ",
  );
  c = c.replace(
    /const hfToken = Deno\.env\.get\("HUGGINGFACE_API_KEY"\);\s*if \(!hfToken\) throw new Error\([^)]+\);\s*/g,
    "requireHfToken();\n    ",
  );
  c = c.replace(/const apiKey = Deno\.env\.get\("HUGGINGFACE_API_KEY"\);\s*/g, "");

  c = c.replace(
    /await fetch\("HF_CHAT_URL_PLACEHOLDER", \{\s*method: "POST",\s*headers: \{[\s\S]*?\},\s*body: JSON\.stringify\(([\s\S]*?)\),\s*\}\);/g,
    "await hfChat($1);",
  );

  fs.writeFileSync(file, c);
  console.log("fixed", file);
}

walk("supabase/functions");
