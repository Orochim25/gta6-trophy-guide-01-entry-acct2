import { cpSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-frontend.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const app = join(root, "app");
const images = join(root, "screenshots");
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

function preflight() {
  if (!statSync(join(app, "index.html"), { throwIfNoEntry: false })?.isFile()) {
    throw new Error("Missing app/index.html.");
  }
  let data;
  try {
    data = JSON.parse(readFileSync(join(app, "data", "trophies.json"), "utf8"));
  } catch (error) {
    throw new Error("Could not parse app/data/trophies.json.", { cause: error });
  }
  if (!Array.isArray(data?.trophies) || data.trophies.length !== 55) {
    throw new Error("Expected 55 trophies in app/data/trophies.json.");
  }
  if (!statSync(images, { throwIfNoEntry: false })?.isDirectory() ||
      !readdirSync(images, { withFileTypes: true }).some(file => file.isFile() && /^[^.].*\.(png|jpe?g)$/i.test(file.name))) {
    throw new Error("No screenshot images found in screenshots/. Capture the atlas before packaging.");
  }
}

preflight();
mkdirSync(output, { recursive: true });
cpSync(app, join(output, "app"), { recursive: true });
cpSync(images, join(output, "screenshots"), { recursive: true });
const dossier = buildDossier(output, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648
});
writeFileSync(join(output, "dossier.json"), dossier);
console.log(`Wrote dossier.json (${Buffer.byteLength(dossier)} bytes) to ${output}`);
