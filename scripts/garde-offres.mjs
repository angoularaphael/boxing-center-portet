/* =====================================================================
   GARDE DES OFFRES — lancée par `npm run build`, après vite build.

   Depuis le 20/10/2026, Portet présente deux abonnements sans engagement :
   l'Étudiant, puis l'Adulte. Les anciennes pages d'offre de la boutique
   (/offre/29, /offre/259, /offres-speciales) ne doivent plus être liées
   nulle part dans ce qui part en ligne : pages, miroirs markdown, llms,
   scripts compilés, plan du site. Un seul lien retrouvé arrête le build.

   Elle vérifie aussi l'inverse : l'accueil cuit porte bien les deux liens
   d'inscription, Étudiant AVANT Adulte.

       node scripts/garde-offres.mjs
   ===================================================================== */
import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(RACINE, "dist");
const TEXTE = new Set([".html", ".md", ".txt", ".js", ".mjs", ".json", ".xml", ".css", ".webmanifest"]);
const INTERDITS = [
  [/\/offre\/29(?![0-9])/, "/offre/29"],
  [/\/offre\/259(?![0-9])/, "/offre/259"],
  [/\/offres-speciales/, "/offres-speciales"],
  [/product=offre-(?:duo|saison)/, "produit offre-duo / offre-saison"],
];
const ETUDIANT = "inscription?product=etudiants-4-semaines";
const ADULTE = "inscription?product=44-99-4-semaines";

async function fichiers(dir, sortie = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await fichiers(p, sortie);
    else if (TEXTE.has(extname(e.name).toLowerCase())) sortie.push(p);
  }
  return sortie;
}

const fautes = [];
for (const f of await fichiers(DIST)) {
  const t = await readFile(f, "utf8");
  for (const [rx, nom] of INTERDITS) {
    const m = rx.exec(t);
    if (m) fautes.push(`${relative(RACINE, f)} : lien ${nom} (« …${t.slice(Math.max(0, m.index - 40), m.index + 30).replace(/\s+/g, " ")}… »)`);
  }
}

const accueil = await readFile(join(DIST, "index.html"), "utf8");
const iE = accueil.indexOf(ETUDIANT), iA = accueil.indexOf(ADULTE);
if (iE < 0) fautes.push("dist/index.html : le lien d’inscription Étudiant manque");
if (iA < 0) fautes.push("dist/index.html : le lien d’inscription Adulte manque");
if (iE >= 0 && iA >= 0 && iE > iA) fautes.push("dist/index.html : l’offre Adulte passe avant l’offre Étudiant");

if (fautes.length) {
  console.error(`\n[garde-offres] ${fautes.length} faute(s) :\n  - ${fautes.join("\n  - ")}\n`);
  process.exit(1);
}
console.log("[garde-offres] aucun lien vers /offre/29, /offre/259 ou /offres-speciales ; Étudiant puis Adulte sur l’accueil.");
