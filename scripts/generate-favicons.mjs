import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const logoPath = existsSync(join(publicDir, "logo.png"))
  ? join(publicDir, "logo.png")
  : join(publicDir, "brand-logo.png");
const bg = { r: 15, g: 23, b: 42, alpha: 1 };

async function circularIcon(size) {
  const logoW = Math.round(size * 0.72);
  const logo = await sharp(logoPath)
    .resize(logoW, Math.round(logoW * 0.47), { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
    </svg>`
  );

  const base = await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();

  return sharp(base)
    .composite([{ input: await sharp(mask).png().toBuffer(), blend: "dest-in" }])
    .png()
    .toBuffer();
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Boxing Center">
  <circle cx="32" cy="32" r="32" fill="#0f172a"/>
</svg>`;

writeFileSync(join(publicDir, "favicon.svg"), svg);

const sizes = [
  { name: "favicon.png", size: 32 },
  { name: "favicon-192.png", size: 192 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of sizes) {
  const buf = await circularIcon(size);
  await sharp(buf).toFile(join(publicDir, name));
  console.log(`Wrote ${name} (${size}x${size})`);
}

const fav32 = await circularIcon(32);
const b64 = (await sharp(fav32).png().toBuffer()).toString("base64");
writeFileSync(
  join(publicDir, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Boxing Center">
  <image href="data:image/png;base64,${b64}" width="32" height="32"/>
</svg>`
);
console.log("Wrote favicon.svg");
