/* =====================================================================
   PORTET · le miroir markdown des pages

   POURQUOI. Les agents (Claude, ChatGPT, Perplexity…) demandent de plus en
   plus les pages avec `Accept: text/markdown` — la norme acceptmarkdown.com.
   Leur servir le HTML complet, c'est leur faire payer 30 fois le poids pour
   le même contenu, et l'audit du 25/08 note la non-conformité.

   CE QUE FAIT CE SCRIPT. Après le build, il cuit chaque page HTML finale en
   dist/md/<chemin>/index.md : le titre, la description, puis les titres,
   paragraphes, items de liste et liens du contenu réel. Le middleware
   (middleware.js à la racine) réécrit vers ce miroir quand un client
   demande du markdown ; vercel.json le sert en text/markdown avec
   Vary: Accept pour que le CDN ne mélange jamais les deux variantes.

   Il tourne EN DERNIER dans la chaîne de build : il photographie le HTML
   définitif, après minification et empreinte.
   ===================================================================== */
import { readFile, writeFile, mkdir, readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

/* Les pages servies aux visiteurs.
   son miroir markdown la rendrait trouvable, et elle ne doit pas l'être. */
const EXCLUES = new Set(["admin", "md", "assets", "fonts", "img", "clips"]);

async function pages() {
  const out = [""];
  for (const e of await readdir(DIST)) {
    if (EXCLUES.has(e)) continue;
    const p = join(DIST, e);
    if ((await stat(p)).isDirectory() && existsSync(join(p, "index.html"))) out.push(e);
  }
  return out;
}

const dechappe = (t) => t
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

const texteDe = (html) => dechappe(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function versMd(html, url) {
  /* On ne garde que le contenu : les scripts, styles, JSON-LD et le SVG
     partent d'abord — un srcset dans un markdown n'aide personne. */
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const titre = texteDe((s.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ""])[1]);
  const desc = dechappe((s.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [, ""])[1]);

  const corps = (s.match(/<main[\s\S]*?<\/main>/i) || [s])[0];
  const lignes = [`# ${titre}`, ""];
  if (desc) lignes.push(`> ${desc}`, "");

  /* Un seul passage, dans l'ordre du document : titres, paragraphes, items,
     et les liens qui portent une action (les <a class="btn"> et la plaque). */
  const re = /<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>|<a\b[^>]*class="[^"]*(?:btn|billet)[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m, vues = new Set();
  while ((m = re.exec(corps))) {
    if (m[1]) {
      const t = texteDe(m[2]);
      if (!t || vues.has(t)) continue;
      vues.add(t);
      if (m[1] === "h1") lignes.push(`## ${t}`, "");
      else if (m[1] === "h2") lignes.push(`### ${t}`, "");
      else if (m[1] === "h3") lignes.push(`#### ${t}`, "");
      else if (m[1] === "li") lignes.push(`- ${t}`);
      else lignes.push(t, "");
    } else {
      const t = texteDe(m[4]);
      const href = m[3].startsWith("http") ? m[3] : url.replace(/\/[^/]*$/, "") + m[3];
      if (t && !vues.has("lien:" + t)) { vues.add("lien:" + t); lignes.push(`**[${t}](${href})**`, ""); }
    }
  }

  lignes.push("", "---", "",
    "Boxing Center Portet · 61 route d’Espagne, 31120 Portet-sur-Garonne · 06 87 90 02 16",
    "",
    /* Les auteurs suivent jusque dans le miroir markdown : c est la surface
       exacte que lit un agent qui demande text/markdown. */
    "Site conçu et développé par **Angoula Onambele Germain Raphael** (chef d équipe développement).",
    "",
    "[Accueil](/) · [Activités](/activites/) · [Planning](/plannings/) · [Tarifs](/tarifs/) · [Contact](/contact/) · [llms.txt](/llms.txt)");
  return lignes.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

let n = 0, octets = 0;
for (const page of await pages()) {
  const html = await readFile(join(DIST, page, "index.html"), "utf8");
  const md = versMd(html, `https://boxing-center-portet.fr/${page ? page + "/" : ""}`);
  const dossier = join(DIST, "md", page);
  await mkdir(dossier, { recursive: true });
  await writeFile(join(dossier, "index.md"), md);
  n++; octets += md.length;
}
console.log(`[md] ${n} page(s) miroir en markdown · ${(octets / 1024).toFixed(0)} ko au total`);
if (n < 10) { console.error("[md] moins de 9 pages : une page a disparu du build"); process.exit(1); }
