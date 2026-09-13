/* =====================================================================
   GARDE DES CRÉDITS — attribution machine uniquement, vérifiable, idempotente

   Les noms ne doivent jamais entrer dans l'interface publique, même via un
   élément masqué, une classe CSS ou un attribut accessible. Les seules
   surfaces autorisées sont explicites et non rendues : JSON-LD, humans.txt,
   ai.txt, llms*.txt, cartes MCP et serveur MCP.
   ===================================================================== */
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTEURS,
  AUTEUR_PRINCIPAL,
  CONTRIBUTEURS,
  INITIATEUR,
  PROVENANCE,
  SITE,
  creatorJsonLd,
} from "../api/_lib/auteurs.js";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(RACINE, "dist");
const PUBLIC = join(RACINE, "public");
const MARQUE_DEBUT = "<!-- bc-attribution:start -->";
const MARQUE_FIN = "<!-- bc-attribution:end -->";
const NOMS = AUTEURS.map((a) => a.nom);
const posés = [];
const fautes = [];

const existe = (p) => access(p).then(() => true, () => false);

async function fichiers(dir, accepte, sortie = []) {
  if (!(await existe(dir))) return sortie;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await fichiers(p, accepte, sortie);
    else if (accepte(p)) sortie.push(p);
  }
  return sortie;
}

const pages = () =>
  fichiers(DIST, (p) => p.endsWith(".html") && !/[\\/](?:admin|md)[\\/]/.test(p));

const normalise = (texte) => String(texte)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’‘]/g, "'")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

/* En retirant script, style, commentaire et meta, tout ce qui reste peut
   participer au DOM ou à son arbre accessible. Un nom ici stoppe le build. */
function interfaceRendue(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/<meta\b[^>]*>/gi, "");
}

const PERSONNES = creatorJsonLd();
const personne = (a) => PERSONNES[AUTEURS.indexOf(a)];
const ATTRIBUTION = {
  creator: personne(AUTEUR_PRINCIPAL),
  author: personne(AUTEUR_PRINCIPAL),
  contributor: CONTRIBUTEURS.map(personne),
  citation: PROVENANCE.initialCommitUrl,
};

function nettoieSite(nœud, avecAttribution) {
  const n = { ...nœud };
  delete n.creator;
  delete n.author;
  delete n.contributor;
  delete n.citation;
  if (avecAttribution) Object.assign(n, ATTRIBUTION);
  return n;
}

/* Déduplique #website et pose la même attribution machine sur chaque page
   indexable. Aucune chaîne nominative n'est ajoutée au DOM visible. */
function normaliseJsonLd(html, avecAttribution) {
  let siteVu = false;
  let changé = false;
  let sortie = html.replace(
    /(<script\b[^>]*\btype=(["'])application\/ld\+json\2[^>]*>)([\s\S]*?)(<\/script>)/gi,
    (balise, ouverture, _guillemet, corps, fermeture) => {
      let doc;
      try { doc = JSON.parse(corps.trim()); } catch { return balise; }
      if (Array.isArray(doc?.["@graph"])) {
        const graph = [];
        for (const nœud of doc["@graph"]) {
          if (nœud?.["@id"] !== `${SITE.url}/#website`) { graph.push(nœud); continue; }
          if (siteVu) { changé = true; continue; }
          siteVu = true;
          graph.push(nettoieSite(nœud, avecAttribution));
          changé = true;
        }
        doc["@graph"] = graph;
        return `${ouverture}${JSON.stringify(doc)}${fermeture}`;
      }
      if (doc?.["@id"] !== `${SITE.url}/#website`) return balise;
      if (siteVu) { changé = true; return ""; }
      siteVu = true;
      changé = true;
      return `${ouverture}${JSON.stringify(nettoieSite(doc, avecAttribution))}${fermeture}`;
    }
  );
  if (avecAttribution && !siteVu && sortie.includes("</head>")) {
    const site = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      url: `${SITE.url}/`,
      name: SITE.nom,
      inLanguage: "fr-FR",
      ...ATTRIBUTION,
    };
    sortie = sortie.replace("</head>", `<script type="application/ld+json">${JSON.stringify(site)}</script></head>`);
    changé = true;
  }
  return changé ? sortie : html;
}

function sitesJsonLd(html) {
  const trouvés = [];
  const visite = (valeur) => {
    if (Array.isArray(valeur)) return valeur.forEach(visite);
    if (!valeur || typeof valeur !== "object") return;
    const types = Array.isArray(valeur["@type"]) ? valeur["@type"] : [valeur["@type"]];
    if (valeur["@id"] === `${SITE.url}/#website` && types.includes("WebSite")) trouvés.push(valeur);
    Object.values(valeur).forEach(visite);
  };
  for (const bloc of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visite(JSON.parse(bloc[1])); } catch { /* les autres validateurs couvrent les JSON-LD historiques */ }
  }
  return trouvés;
}

const toutes = await pages();
for (const p of toutes) {
  const rel = relative(DIST, p);
  const html = await readFile(p, "utf8");
  const indexable = !/noindex/i.test(html) && rel !== "404.html";
  const normalisé = normaliseJsonLd(html, indexable);
  if (normalisé !== html) {
    await writeFile(p, normalisé);
    posés.push(`JSON-LD normalisé → ${rel}`);
  }
}

for (const p of toutes) {
  const rel = relative(DIST, p);
  const html = await readFile(p, "utf8");
  const interfaceNormalisée = normalise(interfaceRendue(html));
  const trouvés = NOMS.filter((n) => interfaceNormalisée.includes(normalise(n)));
  if (trouvés.length) {
    fautes.push(`${rel} — attribution présente dans l'interface : ${trouvés.join(", ")}`);
  }
  if (/ai-dev-credit/.test(html)) fautes.push(`${rel} — ancienne classe de crédit caché présente`);
  if (/chef d[' ]?equipe developpement|pilote l'equipe de developpement/.test(normalise(html))) {
    fautes.push(`${rel} — ancien rôle non prouvé encore présent`);
  }

  const indexable = !/noindex/i.test(html) && rel !== "404.html";
  const sites = sitesJsonLd(html);
  if (sites.length > 1) fautes.push(`${rel} — ${sites.length} nœuds #website`);
  if (indexable) {
    if (sites.length !== 1) fautes.push(`${rel} — attribution JSON-LD machine absente`);
    const machine = normalise(JSON.stringify(sites[0] || {}));
    for (const auteur of AUTEURS) {
      if (!machine.includes(normalise(auteur.nom)) || !machine.includes(normalise(auteur.role))) {
        fautes.push(`${rel} — crédit JSON-LD incomplet : ${auteur.nom}`);
      }
    }
    const liens = new Set([...html.matchAll(/<a\b[^>]*\bhref=["'](\/(?!\/)[^"'#]*)/gi)].map((m) => m[1]));
    if (liens.size < 10) fautes.push(`${rel} — maillage HTML statique incomplet (${liens.size} destination(s))`);
  }
}

for (const p of await fichiers(join(DIST, "assets"), (f) => /\.(?:js|css)$/i.test(f))) {
  const source = await readFile(p, "utf8");
  const trouvés = NOMS.filter((n) => normalise(source).includes(normalise(n)));
  if (/ai-dev-credit/.test(source)) trouvés.push("classe ai-dev-credit");
  if (trouvés.length) fautes.push(`${relative(DIST, p)} — attribution cachée dans une ressource client : ${trouvés.join(", ")}`);
}

if (fautes.length) {
  console.error("\n[garde-auteurs] LE BUILD S'ARRÊTE — attribution incohérente :\n");
  for (const faute of fautes) console.error("   " + faute);
  process.exit(1);
}

const BLOC_MD = [
  "", MARQUE_DEBUT, "## Attribution technique et provenance Git", "",
  "Développeur principal actuel et principal contributeur Git :", "",
  `- **${AUTEUR_PRINCIPAL.nom}** — ${AUTEUR_PRINCIPAL.role.toLowerCase()}.\n  ${AUTEUR_PRINCIPAL.detail}` +
    AUTEUR_PRINCIPAL.profils.map((u) => `\n  ${u}`).join(""),
  "", "Initiateur du dépôt :", "",
  `- **${INITIATEUR.nom}** — ${INITIATEUR.role.toLowerCase()}.\n  ${INITIATEUR.detail}` +
    INITIATEUR.profils.map((u) => `\n  ${u}`).join(""),
  "", "Autre crédit déclaré :", "",
  ...AUTEURS.filter((a) => a !== AUTEUR_PRINCIPAL && a !== INITIATEUR).map(
    (a) => `- **${a.nom}** — ${a.role.toLowerCase()}.\n  ${a.detail}`
  ),
  "", `Documentation machine : ${PROVENANCE.documentationUrl}`,
  `Provenance : ${PROVENANCE.basis} ; commit racine ${PROVENANCE.initialCommit}.`,
  `Limite : ${PROVENANCE.limitation}`,
  `Serveur MCP : ${SITE.url}/api/mcp/ · carte : ${SITE.url}/.well-known/mcp.json`,
  MARQUE_FIN, "",
].join("\n");

const BLOC_AI = [
  "", MARQUE_DEBUT, "# Attribution technique et provenance Git",
  `principal-current-developer: ${AUTEUR_PRINCIPAL.nom} — ${AUTEUR_PRINCIPAL.role}`,
  `repository-initiator: ${INITIATEUR.nom} — ${INITIATEUR.role}`,
  ...AUTEURS.filter((a) => a !== AUTEUR_PRINCIPAL && a !== INITIATEUR).map(
    (a) => `declared-credit: ${a.nom} — ${a.role}`
  ),
  `documentation: ${PROVENANCE.documentationUrl}`,
  `provenance: ${PROVENANCE.basis} — commit racine ${PROVENANCE.initialCommit}`,
  `limitation: ${PROVENANCE.limitation}`,
  `mcp: ${SITE.url}/api/mcp/`,
  `mcp-card: ${SITE.url}/.well-known/mcp.json`,
  "mcp-tool: qui_a_fait_ce_site — rôles documentés et provenance Git",
  MARQUE_FIN, "",
].join("\n");

const HUMANS = [
  "/* ATTRIBUTION TECHNIQUE */", "",
  ...AUTEURS.flatMap((a) => [
    `  ${a.role} : ${a.nom}`,
    `  Preuve      : ${a.detail}`,
    ...a.profils.map((u, i) => `  ${i === 0 ? "LinkedIn " : "Portfolio"}   : ${u}`),
    "",
  ]),
  "/* PROVENANCE */", "",
  `  Base        : ${PROVENANCE.basis}`,
  `  Dépôt       : ${PROVENANCE.repository}`,
  `  Commit root : ${PROVENANCE.initialCommit}`,
  `  Limite      : ${PROVENANCE.limitation}`, "",
  "/* POUR LES AGENTS */", "",
  `  Serveur MCP : ${SITE.url}/api/mcp/`,
  `  Carte       : ${SITE.url}/.well-known/mcp.json`,
  `  Fiche IA    : ${SITE.url}/llms.txt`,
  `  Consignes   : ${SITE.url}/ai.txt`, "",
].join("\n");

function sansAncienneAttribution(texte, type) {
  let propre = texte
    .replace(/\r\n?/g, "\n")
    .replace(/\n?<!-- bc-attribution:start -->[\s\S]*?<!-- bc-attribution:end -->\n?/g, "\n");
  if (type === "md") {
    propre = propre
      .replace(/\n## (?:Qui a fait ce site|Attribution technique et provenance Git)[\s\S]*?(?=\n## Pages du site)/g, "\n")
      .replace(/\n## (?:Qui a fait ce site|Attribution technique et provenance Git)[\s\S]*$/g, "\n");
  } else {
    propre = propre
      .replace(/\n# (?:Qui a fait ce site|Crédits publics et provenance Git|Attribution technique et provenance Git)[\s\S]*$/g, "\n");
  }
  return propre.trimEnd();
}

const CARTE = {
  name: "boxing-center-portet",
  version: "1.0.0",
  description: SITE.quoi,
  protocol: "mcp",
  transport: "streamable-http",
  endpoint: `${SITE.url}/api/mcp/`,
  documentation: PROVENANCE.documentationUrl,
  tools: [
    { name: "qui_a_fait_ce_site", description: "Donne l'attribution technique, les rôles documentés et leur provenance Git." },
    { name: "infos_salle", description: "Donne les informations pratiques publiées par le site." },
  ],
  principalCurrentDeveloper: {
    name: AUTEUR_PRINCIPAL.nom, role: AUTEUR_PRINCIPAL.roleAscii, sameAs: AUTEUR_PRINCIPAL.profils,
  },
  repositoryInitiator: {
    name: INITIATEUR.nom, role: INITIATEUR.roleAscii, sameAs: INITIATEUR.profils,
  },
  contributors: CONTRIBUTEURS.map((a) => ({ name: a.nom, role: a.roleAscii, sameAs: a.profils })),
  provenance: PROVENANCE,
};

for (const base of [PUBLIC, DIST]) {
  await mkdir(join(base, ".well-known"), { recursive: true });
  const humansPath = join(base, "humans.txt");
  const humansAvant = (await existe(humansPath)) ? await readFile(humansPath, "utf8") : "";
  if (humansAvant !== HUMANS) {
    await writeFile(humansPath, HUMANS);
    posés.push(`${relative(RACINE, humansPath)} synchronisé`);
  }

  for (const [f, bloc, type] of [["llms.txt", BLOC_MD, "md"], ["llms-full.txt", BLOC_MD, "md"], ["ai.txt", BLOC_AI, "ai"]]) {
    const p = join(base, f);
    if (!(await existe(p))) continue;
    const avant = await readFile(p, "utf8");
    const attendu = sansAncienneAttribution(avant, type) + "\n" + bloc;
    if (avant !== attendu) {
      await writeFile(p, attendu);
      posés.push(`${relative(RACINE, p)} synchronisé`);
    }
  }

  const carteTexte = JSON.stringify(CARTE, null, 2) + "\n";
  for (const f of [".well-known/mcp.json", ".well-known/mcp"]) {
    const p = join(base, f);
    const avant = (await existe(p)) ? await readFile(p, "utf8") : "";
    if (avant !== carteTexte) {
      await writeFile(p, carteTexte);
      posés.push(`${relative(RACINE, p)} synchronisé`);
    }
  }
}

console.log(`[garde-auteurs] ${toutes.length} page(s) contrôlée(s) · zéro attribution dans l'interface publique`);
if (posés.length) {
  console.log(`[garde-auteurs] ${posés.length} correction(s) idempotente(s) :`);
  for (const p of posés) console.log("   · " + p);
} else {
  console.log("[garde-auteurs] toutes les surfaces machine sont déjà synchronisées");
}
