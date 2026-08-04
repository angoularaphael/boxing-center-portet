// Generates responsive WebP variants of the site's images into public/img/opt/
// and a manifest (src/img-manifest.json) the front-end uses to build srcsets.
// Run whenever images change: node scripts/optimize-images.mjs
import sharp from "sharp";
import { readdir, mkdir, writeFile, stat } from "node:fs/promises";
import { join, relative, extname, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC_DIR = join(ROOT, "public", "img");
const OUT_DIR = join(ROOT, "public", "img", "opt");
const MANIFEST = join(ROOT, "src", "img-manifest.json");

const WIDTHS = [480, 960, 1440];
const QUALITY = 84; // 78 laissait des artefacts sur les aplats navy — 84 est visuellement transparent
// cutouts/ are WebGL textures (alpha PNG used by the 3D forge) — leave untouched.
const SKIP_DIRS = new Set(["opt", "cutouts"]);
const EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(join(dir, e.name));
    } else if (EXTS.has(extname(e.name).toLowerCase())) {
      yield join(dir, e.name);
    }
  }
}

const manifest = {};
let generated = 0, reused = 0;

for await (const file of walk(SRC_DIR)) {
  const rel = relative(SRC_DIR, file).split("\\").join("/"); // e.g. "gym-01.jpg" or "disc/kick.webp"
  const meta = await sharp(file).metadata();
  const widths = WIDTHS.filter((w) => w < (meta.width || 0));
  if (!widths.length && (meta.width || 0) > 0) widths.push(Math.min(meta.width, WIDTHS[0]));
  const base = rel.replace(/\.[a-z]+$/i, "");
  const done = [];
  for (const w of widths) {
    const outRel = `${base}-${w}.webp`;
    const outAbs = join(OUT_DIR, outRel);
    await mkdir(dirname(outAbs), { recursive: true });
    try {
      const [s, d] = await Promise.all([stat(file), stat(outAbs)]);
      if (d.mtimeMs > s.mtimeMs) { done.push(w); reused++; continue; } // up to date
    } catch {}
    await sharp(file).resize({ width: w, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(outAbs);
    done.push(w);
    generated++;
  }
  if (done.length) {
    manifest[`/img/${rel}`] = { w: done, ar: meta.width && meta.height ? +(meta.width / meta.height).toFixed(4) : 0 };
  }
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
console.log(`opt: ${generated} generated, ${reused} up-to-date, ${Object.keys(manifest).length} sources → ${posix.normalize("public/img/opt")}`);
