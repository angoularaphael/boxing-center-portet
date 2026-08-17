import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const assetsDir = join(publicDir, "assets");
const srcIco = join(
  __dirname,
  "..",
  "..",
  "BOXPLUS",
  "storefront",
  "public",
  "assets",
  "favicon.ico"
);
const srcSvg = join(
  __dirname,
  "..",
  "..",
  "BOXPLUS",
  "storefront",
  "public",
  "assets",
  "favicon.svg"
);

mkdirSync(assetsDir, { recursive: true });
copyFileSync(srcIco, join(publicDir, "favicon.ico"));
copyFileSync(srcSvg, join(publicDir, "favicon.svg"));
copyFileSync(srcIco, join(assetsDir, "favicon.ico"));
copyFileSync(srcSvg, join(assetsDir, "favicon.svg"));

const svg = readFileSync(srcSvg, "utf8");
const m = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
if (!m) throw new Error("PNG introuvable dans favicon.svg boutique");
const master = Buffer.from(m[1], "base64");

const sizes = [
  ["favicon-32.png", 32],
  ["favicon.png", 48],
  ["favicon-48.png", 48],
  ["favicon-96.png", 96],
  ["favicon-192.png", 192],
  ["apple-touch-icon.png", 180],
];
for (const [name, size] of sizes) {
  await sharp(master)
    .resize(size, size, { kernel: "lanczos3" })
    .png()
    .toFile(join(publicDir, name));
  console.log("wrote", name, size);
}

console.log("copied boutique ico/svg + pngs from svg");
