/**
 * Copie le favicon boutique vers les logiciels internes
 * (gestion-manager, compta, fiches, control, planning, séance offerte, aventure).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const boutiqueAssets = join(root, "BOXPLUS", "storefront", "public", "assets");
const srcIco = join(boutiqueAssets, "favicon.ico");
const srcSvg = join(boutiqueAssets, "favicon.svg");
const circularMasterPath = join(root, "gestion-manager", "public", "icons", "icon-192.png");
const circularMaster = existsSync(circularMasterPath)
  ? readFileSync(circularMasterPath)
  : null;

const apps = [
  { dir: join(root, "gestion-manager", "public"), icons: true },
  { dir: join(root, "compta-boxing", "public"), icons: true },
  { dir: join(root, "gestion-fiche", "public"), icons: true },
  { dir: join(root, "control-boxing-center", "public"), icons: true },
  { dir: join(root, "planning-boxing-center", "public"), icons: false },
  { dir: join(root, "bc-seance-offerte", "public"), icons: false },
  { dir: join(root, "balma-bc", "storefront", "public", "assets"), icons: false },
];

async function writeSized(src, dest, size) {
  await sharp(src)
    .resize(size, size, { fit: "cover", kernel: "lanczos3" })
    .png()
    .toFile(dest);
}

for (const app of apps) {
  if (!existsSync(dirname(app.dir))) {
    console.log("skip missing", app.dir);
    continue;
  }
  mkdirSync(app.dir, { recursive: true });
  copyFileSync(srcIco, join(app.dir, "favicon.ico"));
  copyFileSync(srcSvg, join(app.dir, "favicon.svg"));
  if (circularMaster) {
    await writeSized(circularMaster, join(app.dir, "favicon.png"), 48);
    await writeSized(circularMaster, join(app.dir, "apple-touch-icon.png"), 180);
    if (app.icons) {
      const iconsDir = join(app.dir, "icons");
      mkdirSync(iconsDir, { recursive: true });
      await writeSized(circularMaster, join(iconsDir, "icon-192.png"), 192);
      await writeSized(circularMaster, join(iconsDir, "icon-512.png"), 512);
      await writeSized(circularMaster, join(iconsDir, "apple-touch-icon.png"), 180);
    }
  }
  console.log("synced", app.dir);
}

if (circularMaster) {
  await writeSized(circularMaster, join(boutiqueAssets, "apple-touch-icon.png"), 180);
}

console.log("ok", { svg: readFileSync(srcSvg, "utf8").length });
