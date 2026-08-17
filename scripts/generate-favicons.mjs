import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const logoPath = join(publicDir, "favicon-brand.png");
const photoPath = join(publicDir, "img", "gym-04.jpg");
const bg = { r: 255, g: 255, b: 255, alpha: 1 };
// Favicon onglet = celui de la boutique (BOXPLUS/storefront/public/assets).
// Ne pas régénérer favicon.ico / favicon.svg ici.

async function circularIcon(size) {
  const pad = Math.round(size * 0.06);
  const inner = size - pad * 2;
  const logoW = Math.round(inner * 0.96);

  const logo = await sharp(logoPath)
    .resize(logoW, Math.round(logoW * 0.58), { fit: "inside", withoutEnlargement: false })
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

/** ICO with embedded PNG frames (supported by Chrome, Safari, Googlebot). */
function pngsToIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  const entries = [];
  let offset = 6 + 16 * frames.length;
  for (const { size, buf } of frames) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += buf.length;
  }
  return Buffer.concat([header, ...entries, ...frames.map((f) => f.buf)]);
}

const sizes = [
  { name: "favicon-32.png", size: 32 },
  { name: "favicon.png", size: 48 },
  { name: "favicon-48.png", size: 48 },
  { name: "favicon-96.png", size: 96 },
  { name: "favicon-192.png", size: 192 },
  { name: "apple-touch-icon.png", size: 180 },
];

const pngBySize = {};
for (const { name, size } of sizes) {
  const buf = await circularIcon(size);
  pngBySize[size] = buf;
  await sharp(buf).toFile(join(publicDir, name));
  console.log(`Wrote ${name} (${size}x${size})`);
}

writeFileSync(
  join(publicDir, "favicon.ico"),
  pngsToIco([
    { size: 48, buf: pngBySize[48] },
    { size: 32, buf: pngBySize[32] },
  ])
);
console.log("Wrote favicon.ico");

const fav48 = pngBySize[48];
const b64 = fav48.toString("base64");
writeFileSync(
  join(publicDir, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img" aria-label="Boxing Center">
  <image href="data:image/png;base64,${b64}" width="48" height="48"/>
</svg>`
);
console.log("Wrote favicon.svg");

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
