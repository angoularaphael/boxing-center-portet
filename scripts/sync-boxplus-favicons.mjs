import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const assetsDir = join(publicDir, "assets");
const master = join(publicDir, "favicon-brand.png");

mkdirSync(assetsDir, { recursive: true });

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
  const dest = join(publicDir, name);
  await sharp(master)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 }, kernel: "lanczos3" })
    .png()
    .toFile(dest);
  if (name === "favicon-48.png") copyFileSync(dest, join(assetsDir, "favicon-48.png"));
  console.log("wrote", name, size);
}

copyFileSync(master, join(assetsDir, "favicon-brand.png"));
console.log("favicons Google depuis favicon-brand.png (carré 225px)");
