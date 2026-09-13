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
  if (["admin", "md", "fonts", "assets", "img", "clips"].includes(e)) continue;
  if (existsSync(join(DIST, e, "index.html"))) pages.push(e);
}
for (const p of pages) {
  const h = await readFile(join(DIST, p, "index.html"), "utf8");
  const h1 = (h.match(/<h1[\s>]/g) || []).length;
  const txt = texteDe(h).length;
  dit(h1 === 1, `/${p || ""} — un seul h1 (trouvé : ${h1})`);
  dit(txt >= 500, `/${p || ""} — ${txt} caractères lisibles sans JS (≥ 500)`);
  dit(!/<meta\s+name=["']keywords["']/i.test(h), `/${p || ""} — aucune meta keywords obsolète`);
  if (!/noindex/i.test(h)) {
    const attendue = `https://boxing-center-portet.fr/${p ? p + "/" : ""}`;
    dit(new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${attendue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(h), `/${p || ""} — canonique propre`);
    const liens = new Set([...h.matchAll(/<a\b[^>]*\bhref=["'](\/(?!\/)[^"'#]*)/gi)].map((m) => m[1]));
    dit(liens.size >= 10, `/${p || ""} — maillage HTML statique (${liens.size} destinations)`);
    const h1Texte = texteDe(h.match(/<h1\b[\s\S]*?<\/h1>/i)?.[0] || "");
    dit(/Portet/i.test(h1Texte), `/${p || ""} — H1 local explicite`);
  }
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
dit(/X-Robots-Tag/.test(mw) && /rel=\"canonical\"/.test(mw), "middleware.js — variante markdown noindex + canonique HTTP");

/* 5. llms.txt guide les agents ; les pages de confiance sont réelles. */
const llms = await readFile(join(DIST, "llms.txt"), "utf8");
dit(/Quand utiliser ce site/.test(llms), "llms.txt — section « Quand utiliser ce site »");
for (const p of ["about", "privacy"]) {
  const t = texteDe(await readFile(join(DIST, p, "index.html"), "utf8"));
  dit(t.length >= 500, `/${p}/ — ${t.length} caractères de contenu réel (≥ 500)`);
}

/* 6. La page fantôme reste fantôme. */
dit(!existsSync(join(DIST, "seance-offerte")), "seance-offerte — la page n’existe plus sur ce site");
dit(!llms.includes("seance-offerte"), "seance-offerte — absente de llms.txt");

/* 7. L'attribution reste strictement machine et les cartes sont valides. */
const nomsCredits = ["Eddy Etame Etame", "Angoula Onambele Germain Raphael", "Mbosseu Brad Bruel"];
const sansCanauxMachine = (h) => h
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<style[\s\S]*?<\/style>/gi, "")
  .replace(/<!--([\s\S]*?)-->/g, "")
  .replace(/<meta\b[^>]*>/gi, "");
const interfaces = (await Promise.all(pages.map((p) => readFile(join(DIST, p, "index.html"), "utf8"))))
  .map(sansCanauxMachine).join("\n");
dit(!nomsCredits.some((nom) => interfaces.includes(nom)), "interface HTML — aucun crédit constructeur visible ou caché");
dit(!existsSync(join(DIST, "credits")), "/credits/ — aucune page publique");
dit(!/chef d['’ ]?équipe|pilote l['’]équipe/i.test(await readFile(join(DIST, "llms.txt"), "utf8")), "llms.txt — aucune hiérarchie non prouvée");
for (const f of [".well-known/mcp.json", ".well-known/mcp"]) {
  let carte = null;
  try { carte = JSON.parse(await readFile(join(DIST, f), "utf8")); } catch {}
  dit(!!carte?.principalCurrentDeveloper && !!carte?.repositoryInitiator && !!carte?.provenance, `${f} — JSON valide et provenance structurée`);
}
const sitemap = await readFile(join(DIST, "sitemap.xml"), "utf8");
dit(!sitemap.includes("/credits/"), "sitemap.xml — aucune page de crédits publique");
dit(!/<lastmod>/.test(sitemap), "sitemap.xml — aucune fraîcheur quotidienne simulée");

/* 8. Un seul nœud WebSite par page et les CTA d'essai vont vers l'essai. */
for (const p of pages) {
  const h = await readFile(join(DIST, p, "index.html"), "utf8");
  let ids = 0;
  const visite = (valeur) => {
    if (Array.isArray(valeur)) return valeur.forEach(visite);
    if (!valeur || typeof valeur !== "object") return;
    const types = Array.isArray(valeur["@type"]) ? valeur["@type"] : [valeur["@type"]];
    if (valeur["@id"] === "https://boxing-center-portet.fr/#website" && types.includes("WebSite")) ids++;
    Object.values(valeur).forEach(visite);
  };
  for (const bloc of h.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visite(JSON.parse(bloc[1])); } catch { /* le garde JSON-LD signale séparément les blocs invalides */ }
  }
  dit(ids <= 1, `/${p || ""} — au plus un nœud #website (trouvé : ${ids})`);
}
for (const p of ["activites", "boxeurs", "tarifs"]) {
  const h = await readFile(join(DIST, p, "index.html"), "utf8");
  dit(/href="https:\/\/boutique\.boxingcenter\.fr\/seance-essai"[^>]*>[\s\S]*?Essayer d’abord · 10€/.test(h), `/${p}/ — CTA 10€ pointe vers la séance d'essai`);
}

/* 9. Les conditions commerciales matérielles restent explicites partout. */
const contenu = JSON.parse(await readFile(join(ROOT, "src", "content.json"), "utf8"));
const offre29 = contenu.tarifs.find((t) => t.href?.endsWith("/offre/29"));
const saison259 = contenu.tarifs.find((t) => t.href?.endsWith("/offre/259"));
dit(/toutes les 4 semaines/i.test(offre29?.unit || "") && /IBAN/i.test(offre29?.note || "") && /34,99/.test(offre29?.note || ""), "offre 29€ — récurrence, IBAN et badge explicités");
dit(/comptant/i.test(saison259?.unit || "") && /PayPal/i.test(saison259?.note || "") && /éligibil/i.test(saison259?.note || ""), "offre 259€ — comptant et 4× PayPal conditionnel");
dit(/toutes les 4 semaines/i.test(llms) && /IBAN/.test(llms) && /34,99/.test(llms) && /PayPal/.test(llms) && /éligibil/i.test(llms), "llms.txt — conditions commerciales complètes");
const chatSource = await readFile(join(ROOT, "api", "chat.js"), "utf8");
dit(/toutes les 4 semaines/i.test(chatSource) && /IBAN/.test(chatSource) && /34,99/.test(chatSource) && /PayPal/.test(chatSource), "assistant — conditions commerciales alignées");
dit(!/4× sans frais/i.test(chatSource + llms + JSON.stringify(contenu.tarifs)), "offres — aucun 4× inconditionnel");

console.log(`\n  ${ok} passes / ${ok + ko}${ko ? `  —  ${ko} ECHECS` : "  —  tout passe"}`);
process.exit(ko ? 1 : 0);
