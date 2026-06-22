// Seed a few real Portet clips into Cloudinary (tag=approved) so the gallery wall
// isn't empty. Run: set CLOUDINARY_URL then `node scripts/seed.mjs`. Idempotent.
import { v2 as cloudinary } from "cloudinary";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

// load .env if present (no dotenv dependency)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
try {
  for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}
// ESM imports run before the .env loader above, so configure explicitly from the URL.
const cu = process.env.CLOUDINARY_URL || "";
const mm = cu.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
if (!mm) { console.error("CLOUDINARY_URL missing/invalid in .env"); process.exit(1); }
cloudinary.config({ api_key: mm[1], api_secret: mm[2], cloud_name: mm[3], secure: true });

const media = path.join(root, "public", "media");
const FOLDER = "bcp-community";
const seeds = [
  ["clip-ring.mp4", "Le ring de Portet"],
  ["clip-bags.mp4", "Aux sacs lourds"],
  ["clip-cross.mp4", "Cross training"],
  ["clip-mats.mp4", "L'aire de combat"],
];

for (const [file, title] of seeds) {
  const src = path.join(media, file);
  if (!fs.existsSync(src)) { console.log("skip (missing):", file); continue; }
  const id = "seed-" + randomUUID().slice(0, 8);
  const up = await cloudinary.uploader.upload(src, {
    resource_type: "video", public_id: `${FOLDER}/${id}`, overwrite: true,
    tags: ["approved"], context: `title=${title}|author=Boxing Center`,
  });
  console.log("seeded:", title, "->", up.secure_url);
}
console.log("done.");
