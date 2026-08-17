import sharp from "sharp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const photoPath = join(publicDir, "img", "gym-04.jpg");
// Favicon onglet = copie boutique (scripts/sync-boxplus-favicons.mjs).
// Ce script ne régénère que les images Open Graph.

const ogJpeg = await sharp(photoPath)
  .rotate()
  .resize(1200, 630, { fit: "cover", position: "centre" })
  .modulate({ brightness: 1.04, saturation: 1.08 })
  .sharpen()
  .jpeg({ quality: 84, mozjpeg: true })
  .toBuffer();

await sharp(ogJpeg).toFile(join(publicDir, "og.jpg"));
console.log("Wrote og.jpg (1200x630)");

await sharp(photoPath)
  .rotate()
  .resize(1200, 1200, { fit: "cover", position: "centre" })
  .modulate({ brightness: 1.04, saturation: 1.08 })
  .sharpen()
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(join(publicDir, "og-square.jpg"));
console.log("Wrote og-square.jpg (1200x1200)");
