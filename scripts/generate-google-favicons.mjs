import sharp from "sharp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "public", "favicon-brand.png");
const out = join(root, "public");

const sizes = [
  ["favicon-32.png", 32],
  ["favicon.png", 48],
  ["favicon-48.png", 48],
  ["favicon-96.png", 96],
  ["favicon-192.png", 192],
  ["apple-touch-icon.png", 180],
  ["icon-512.png", 512],
];

for (const [name, size] of sizes) {
  await sharp(src)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(join(out, name));
  console.log("wrote", name, size);
}
