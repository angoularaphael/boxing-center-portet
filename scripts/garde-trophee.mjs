/* =====================================================================
   GARDE DU TROPHY — lancée par `npm run build`, après garde-offres.

   Le Boxing Trophy 19 (gala du 13/11/2026) vit dans src/trophee.mjs, mais
   trois endroits ne peuvent pas l'importer et recopient ses dates : les
   deux scripts en ligne d'index.html (ils jouent avant le premier rendu)
   et api/chat.js (la fonction Vercel n'embarque que ce qu'on lui déclare).
   Une copie qui diverge, et le billet s'éteint un jour trop tôt ou l'IA
   parle d'un gala déjà passé : le build s'arrête.

   Après la date, la garde ne bloque rien — les raccourcis sont revenus aux
   offres d'eux-mêmes — mais elle rappelle de retirer le Trophy du code.

       node scripts/garde-trophee.mjs
   ===================================================================== */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TROPHEE, tropheeActif } from "../src/trophee.mjs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = (p) => readFile(join(RACINE, p), "utf8");
const [source, sortie, chat] = await Promise.all([lire("index.html"), lire("dist/index.html"), lire("api/chat.js")]);

const fautes = [];
for (const [nom, t] of [["index.html", source], ["dist/index.html", sortie]]) {
  if (!t.includes(`Date.parse("${TROPHEE.fin}")`)) fautes.push(`${nom} : l’interrupteur de tête ne porte pas la fin ${TROPHEE.fin}`);
  if (!t.includes(`Date.parse("${TROPHEE.jour}")`)) fautes.push(`${nom} : le compte à rebours du billet ne compte pas jusqu’au ${TROPHEE.jour}`);
  if (!t.includes(`class="trophee-billet" href="${TROPHEE.url}"`)) fautes.push(`${nom} : le billet du héros ne mène pas à ${TROPHEE.url}`);
  if (!t.includes(`"startDate": "${TROPHEE.debut}"`)) fautes.push(`${nom} : l’événement (JSON-LD) ne commence pas à ${TROPHEE.debut}`);
}
if (!chat.includes(`const TROPHEE_FIN = "${TROPHEE.fin}"`)) fautes.push(`api/chat.js : TROPHEE_FIN diffère de ${TROPHEE.fin}`);

/* Les affiches du gala (Round 01, ring, Round 05) : chaque fichier cité par l'accueil cuit doit exister dans
   dist — l'optimiseur d'images les produit à partir de public/img/trophee/ ; une affiche absente serait un
   cadre noir au milieu de la page. */
const { access } = await import("node:fs/promises");
const affiches = [...new Set([...sortie.matchAll(/\/img\/(?:opt\/)?trophee\/[a-z0-9-]+\.(?:jpg|webp)/g)].map((m) => m[0]))];
if (affiches.length < 2) fautes.push(`dist/index.html : les affiches du gala ne sont pas citées (${affiches.length} fichier)`);
for (const f of affiches) {
  try { await access(join(RACINE, "dist", f)); } catch { fautes.push(`dist${f} : fichier absent`); }
}

if (fautes.length) {
  console.error(`\n[garde-trophee] ${fautes.length} faute(s) :\n  - ${fautes.join("\n  - ")}\n`);
  process.exit(1);
}
if (tropheeActif()) console.log(`[garde-trophee] ${TROPHEE.nom} : mêmes dates partout (fin ${TROPHEE.fin}), billet et talon vers ${TROPHEE.url}.`);
else console.warn(`[garde-trophee] ${TROPHEE.nom} passé (${TROPHEE.jour}) : les raccourcis sont revenus aux offres d’eux-mêmes ; retirer le billet, l’événement JSON-LD, le talon et la clé « trophee » au prochain passage.`);
