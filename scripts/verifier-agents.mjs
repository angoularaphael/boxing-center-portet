/* =====================================================================
   Banc d'essai « lisible par les agents » — audit Ora du 25/08 rejoué.

   Chaque assertion correspond à un point de l'audit. Si le build casse une
   de ces garanties, ce banc le dit AVANT le déploiement — pas un score
   externe trois semaines plus tard.

       node scripts/verifier-agents.mjs
   ===================================================================== */
import { readFile, readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
let ok = 0, ko = 0;
const dit = (etat, msg) => { etat ? ok++ : ko++; console.log(`  ${etat ? "PASSE" : "ECHEC"}  ${msg}`); };

const texteDe = (h) => h
  .replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/* 1. Chaque page publique a UN h1 et du texte sans JavaScript. */
const pages = [""];
for (const e of await readdir(DIST)) {
  if (["admin", "seance-offerte", "md", "fonts", "assets", "img", "clips"].includes(e)) continue;
  if (existsSync(join(DIST, e, "index.html"))) pages.push(e);
}
for (const p of pages) {
  const h = await readFile(join(DIST, p, "index.html"), "utf8");
  const h1 = (h.match(/<h1[\s>]/g) || []).length;
  const txt = texteDe(h).length;
  dit(h1 === 1, `/${p || ""} — un seul h1 (trouvé : ${h1})`);
  dit(txt >= 500, `/${p || ""} — ${txt} caractères lisibles sans JS (≥ 500)`);
}

/* 2. Le 404 : de vrais liens dans le HTML, et un corps markdown. */
const q = await readFile(join(DIST, "404.html"), "utf8");
dit(/href="\/sitemap\.xml"/.test(q) && /href="\/llms\.txt"/.test(q), "404 — liens statiques vers sitemap.xml et llms.txt");
dit(existsSync(join(DIST, "404.md")), "404.md — corps markdown présent");

/* 3. Le miroir markdown : une entrée par page, non vide, avec un titre. */
for (const p of pages) {
  const f = join(DIST, "md", p, "index.md");
  if (!existsSync(f)) { dit(false, `md/${p || "(accueil)"} — MANQUANT`); continue; }
  const md = await readFile(f, "utf8");
  dit(md.length > 300 && md.startsWith("# "), `md/${p || "(accueil)"} — ${md.length} car., commence par un titre`);
}

/* 4. Le middleware et la configuration de cache existent et se répondent. */
const mw = await readFile(join(ROOT, "middleware.js"), "utf8");
dit(/text\\\/markdown/.test(mw) && /x-middleware-rewrite/.test(mw), "middleware.js — négociation Accept: text/markdown");
const vc = JSON.parse(await readFile(join(ROOT, "vercel.json"), "utf8"));
/* PAS .find() : plusieurs blocs peuvent viser /(.*) — securite d'un cote,
   cache de l'autre. Il suffit qu'UN bloc porte le Vary. */
dit(vc.headers.some((h) => h.source === "/(.*)" && h.headers.some((x) => x.key === "Vary" && /Accept/.test(x.value))), "vercel.json — Vary: Accept sur toutes les réponses");
const md_ = vc.headers.find((h) => h.source === "/md/(.*)");
dit(!!md_ && md_.headers.some((x) => x.key === "Content-Type" && /text\/markdown/.test(x.value)), "vercel.json — /md/ servi en text/markdown");

/* 5. llms.txt guide les agents ; les pages de confiance sont réelles. */
const llms = await readFile(join(DIST, "llms.txt"), "utf8");
dit(/Quand utiliser ce site/.test(llms), "llms.txt — section « Quand utiliser ce site »");
for (const p of ["about", "privacy"]) {
  const t = texteDe(await readFile(join(DIST, p, "index.html"), "utf8"));
  dit(t.length >= 500, `/${p}/ — ${t.length} caractères de contenu réel (≥ 500)`);
}

/* 6. La page fantôme reste fantôme. */
dit(!existsSync(join(DIST, "md", "seance-offerte")), "seance-offerte — AUCUN miroir markdown (hors circuit)");
dit(!llms.includes("seance-offerte"), "seance-offerte — absente de llms.txt");

console.log(`\n  ${ok} passes / ${ok + ko}${ko ? `  —  ${ko} ECHECS` : "  —  tout passe"}`);
process.exit(ko ? 1 : 0);
