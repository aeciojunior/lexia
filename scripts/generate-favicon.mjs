#!/usr/bin/env node
/**
 * Gera favicon.png, favicon.ico e apple-touch-icon.png a partir de favicon.svg
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const svg = readFileSync(join(publicDir, "favicon.svg"), "utf8");

function render(size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "transparent",
  });
  return resvg.render().asPng();
}

const png16 = render(16);
const png32 = render(32);
const png48 = render(48);
const png180 = render(180);
const png512 = render(512);

writeFileSync(join(publicDir, "favicon.png"), png512);
writeFileSync(join(publicDir, "apple-touch-icon.png"), png180);

const ico = await pngToIco([png16, png32, png48]);
writeFileSync(join(publicDir, "favicon.ico"), ico);

console.log("Favicons gerados em public/");
