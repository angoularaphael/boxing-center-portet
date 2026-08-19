import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const boutiqueOg = join(
  __dirname,
  "..",
  "..",
  "BOXPLUS",
  "storefront",
  "public",
  "img",
  "bc",
  "og-logo.jpg"
);

// Favicon onglet = copie boutique (scripts/sync-boxplus-favicons.mjs).
// OG = même logo que la boutique / le favicon, plus la photo de salle.
const ogJpeg = await sharp(boutiqueOg)
  .rotate()
  .resize(1200, 630, {
    fit: "contain",
    background: { r: 245, g: 245, b: 245, alpha: 1 },
  })
  .jpeg({ quality: 90, mozjpeg: true })
  .toBuffer();

await sharp(ogJpeg).toFile(join(publicDir, "og.jpg"));
console.log("Wrote og.jpg (1200x630) from boutique logo");

await sharp(boutiqueOg)
  .rotate()
  .resize(1200, 1200, {
    fit: "contain",
    background: { r: 245, g: 245, b: 245, alpha: 1 },
  })
  .jpeg({ quality: 90, mozjpeg: true })
  .toFile(join(publicDir, "og-square.jpg"));
console.log("Wrote og-square.jpg (1200x1200) from boutique logo");

copyFileSync(boutiqueOg, join(publicDir, "og-logo.jpg"));
