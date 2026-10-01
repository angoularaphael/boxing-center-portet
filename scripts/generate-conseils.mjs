/**
 * /conseils/ et /conseils/<slug>/ — les conseils du club (1er/10/2026).
 *
 * Eddy : une section d'articles sur chaque site, qui mène à la boutique de
 * matériel. Ici, chaque article part d'une règle que le club publie déjà (pour
 * la première séance, rien à acheter) et répond à une question qu'on pose au
 * bord du ring : quoi acheter, quand, à quelle taille. Les liens sortent du
 * texte, là où la phrase en a besoin — vers Boutique de Boxe (le choix et les
 * guides) et vers la boutique du club (retrait en salle).
 *
 * Le contenu vit dans src/conseils.json ; rien n'est écrit ici. Le script
 * refuse de produire une page dont un lien interne ne mène nulle part, dont le
 * titre ou la description débordent, ou qui cite un prix sans date.
 *
 * Même gabarit que generate-club.mjs (tête de /coachs/, classes cp-*, dp-*).
 * Tourne après generate-club.mjs, avant sitemap-images.mjs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, ORIGIN, lireJSON } from "./disciplines-lib.mjs";

const DATA = lireJSON("src/conseils.json");
const MANIFESTE = lireJSON("src/img-manifest.json");
const GABARIT = readFileSync(join(ROOT, "coachs", "index.html"), "utf8");
const RELEVE = DATA.releve;
const DATE_FR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(RELEVE + "T12:00:00Z")).replace(/^1 /, "1er ");

const e = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nu = (s) => String(s).replace(/<[^>]+>/g, "");
const ar = (src) => MANIFESTE[src]?.ar || 1.5;
function img(src, alt, sizes, { eager = false } = {}) {
  const m = MANIFESTE[src];
  const base = "/img/opt/" + src.slice("/img/".length).replace(/\.[a-z]+$/i, "");
  const srcset = m ? ` srcset="${m.w.map((w) => `${base}-${w}.webp ${w}w`).join(", ")}" sizes="${sizes}"` : "";
  const dims = m ? ` width="${m.w[m.w.length - 1]}" height="${Math.round(m.w[m.w.length - 1] / m.ar)}"` : "";
  const charge = eager ? ` loading="eager" fetchpriority="high"` : ` loading="lazy"`;
  return `<img src="${e(src)}"${srcset}${dims} alt="${e(alt)}"${charge} decoding="async" />`;
}

/* ── Les garde-fous ─────────────────────────────────────────────────────── */
const fautes = [];
const SLUGS = new Set(DATA.articles.map((a) => a.slug));
function verifier(nom, html, titre, desc) {
  if (titre.length > 60) fautes.push(`${nom} : titre de ${titre.length} caractères (60 au plus)`);
  if (desc.length > 160) fautes.push(`${nom} : description de ${desc.length} caractères (160 au plus)`);
  for (const [, href] of html.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)) {
    const m = href.match(/^\/conseils\/(?:([a-z0-9-]+)\/)?$/);
    if (m) { if (m[1] && !SLUGS.has(m[1])) fautes.push(`${nom} : lien vers un conseil inconnu ${href}`); continue; }
    if (!existsSync(join(ROOT, href, "index.html"))) fautes.push(`${nom} : lien interne sans page ${href}`);
  }
}
// Un prix sans sa date vieillit en silence : toute réponse qui cite un prix porte une date.
for (const a of DATA.articles)
  for (const [q, r] of a.faq) if (/\d\s?€/.test(r) && !/\d{4}/.test(r)) fautes.push(`${a.slug} : la réponse « ${q} » cite un prix sans date`);

function tete({ titre, desc, url, og, ogAlt }) {
  let h = GABARIT.slice(GABARIT.indexOf("<head>"), GABARIT.indexOf("</head>"));
  const meta = (rx, val) => { if (!rx.test(h)) throw new Error(`[conseils] balise absente : ${rx}`); h = h.replace(rx, (m0, x, y) => `${x}${val}${y}`); };
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${e(titre)}</title>`);
  meta(/(<meta name="description" content=")[^"]*(")/, e(desc));
  meta(/(<link rel="canonical" href=")[^"]*(")/, url);
  meta(/(<meta property="og:url" content=")[^"]*(")/, url);
  meta(/(<meta property="og:title" content=")[^"]*(")/, e(titre));
  meta(/(<meta property="og:description" content=")[^"]*(")/, e(desc));
  meta(/(<meta property="og:image" content=")[^"]*(")/, og);
  meta(/(<meta property="og:image:url" content=")[^"]*(")/, og);
  meta(/(<meta property="og:image:secure_url" content=")[^"]*(")/, og);
  meta(/(<meta property="og:image:alt" content=")[^"]*(")/, e(ogAlt));
  meta(/(<meta name="twitter:image" content=")[^"]*(")/, og);
  meta(/(<link rel="image_src" href=")[^"]*(")/, og);
  if (/<meta name="twitter:title"/.test(h)) meta(/(<meta name="twitter:title" content=")[^"]*(")/, e(titre));
  if (/<meta name="twitter:description"/.test(h)) meta(/(<meta name="twitter:description" content=")[^"]*(")/, e(desc));
  return h.replace(/\s*<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, "");
}

const tetiere = (eyebrow, titre) => `<div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">${e(eyebrow)}</span>
          <h2 class="display" style="margin-top:1rem">${e(titre)}</h2>
        </div>
      </div>`;

const h1 = (lignes) => `<h1 class="display">${lignes.map((l, i) => `<span class="reveal-line"><span>${i === lignes.length - 1 ? `<span class="tint">${e(l)}</span>` : e(l)}</span></span>`).join("")}</h1>`;

function page({ dossier, tete: t, ld, corps }) {
  const html = `<!doctype html>
<html lang="fr" translate="no" data-theme="dark">
${t}  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</head>
<body data-page="club">
  <div class="curtain" id="curtain" aria-hidden="true"></div>
  <div id="site-nav"></div>
  <main id="page">
${corps}
  </main>
  <div id="site-footer"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
`;
  mkdirSync(join(ROOT, dossier), { recursive: true });
  writeFileSync(join(ROOT, dossier, "index.html"), html);
}

const carte = (a) => `<a class="cs-carte" href="/conseils/${a.slug}/" data-reveal>
          <figure class="cs-carte__photo">${img(a.photo.src, a.photo.alt, "(max-width: 760px) 92vw, 46vw")}</figure>
          <div class="cs-carte__texte"><span class="eyebrow">${e(a.carte)}</span><h3>${e(nu(a.h1.join(" ")))}</h3><p>${e(a.resume)}</p><span class="cs-carte__lire">Lire le conseil →</span></div>
        </a>`;

/* ── Chaque article ─────────────────────────────────────────────────────── */
for (const a of DATA.articles) {
  const url = `${ORIGIN}/conseils/${a.slug}/`;
  const og = `${ORIGIN}/og/conseils/${a.slug}.jpg?v=1`;
  const autres = DATA.articles.filter((x) => x.slug !== a.slug);
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "@id": `${url}#webpage`, url, name: a.titre, description: a.desc, inLanguage: "fr-FR",
        isPartOf: { "@id": `${ORIGIN}/#website` }, breadcrumb: { "@id": `${url}#breadcrumb` },
        primaryImageOfPage: { "@type": "ImageObject", url: og.replace(/\?.*$/, ""), width: 1200, height: 630 } },
      { "@type": "Article", "@id": `${url}#article`, headline: a.titre, description: a.desc, inLanguage: "fr-FR",
        datePublished: RELEVE, dateModified: RELEVE, image: og.replace(/\?.*$/, ""), mainEntityOfPage: { "@id": `${url}#webpage` },
        author: { "@id": `${ORIGIN}/#localbusiness` }, publisher: { "@id": `${ORIGIN}/#localbusiness` } },
      { "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`, itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${ORIGIN}/` },
        { "@type": "ListItem", position: 2, name: "Conseils", item: `${ORIGIN}/conseils/` },
        { "@type": "ListItem", position: 3, name: nu(a.h1.join(" ")), item: url },
      ] },
      { "@type": "FAQPage", "@id": `${url}#faq`, isPartOf: { "@id": `${url}#webpage` },
        mainEntity: a.faq.map(([q, r]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: r } })) },
    ],
  };
  /* Un article se lit d'une traite : le sommaire à gauche (il suit la lecture), le texte à droite. */
  const sections = `
  <section class="section cs-corps">
    <div class="wrap cs-grille">
      <nav class="cs-sommaire" aria-label="Dans ce conseil">
        <span class="eyebrow">Dans ce conseil</span>
        <ol>
          ${a.sections.map((s, i) => `<li><a href="#etape-${i + 1}">${e(s.sur)}</a></li>`).join("\n          ")}${a.tableau ? `\n          <li><a href="#tableau">${e(a.tableau.sur)}</a></li>` : ""}
          <li><a href="#questions">Questions</a></li>
        </ol>
      </nav>
      <div class="cs-article cs-prose">
        ${a.sections.map((s, i) => `<div class="cs-bloc" id="etape-${i + 1}" data-reveal>
          <span class="cs-sur">${e(s.sur)}</span>
          <h2>${e(s.h2)}</h2>
          ${s.paras.map((p) => `<p>${p}</p>`).join("\n          ")}
        </div>`).join("\n        ")}
      </div>
    </div>
  </section>`;
  const tableau = a.tableau ? `
  <section class="section band" id="tableau">
    <div class="wrap">
      ${tetiere(a.tableau.sur, a.tableau.h2)}
      <div class="cs-table" data-reveal>
        <table>
          <thead><tr>${a.tableau.entetes.map((x) => `<th scope="col">${e(x)}</th>`).join("")}</tr></thead>
          <tbody>
            ${a.tableau.lignes.map((l) => `<tr><th scope="row">${l[0]}</th>${l.slice(1).map((c, j) => `<td data-label="${e(a.tableau.entetes[j + 1])}">${c}</td>`).join("")}</tr>`).join("\n            ")}
          </tbody>
        </table>
      </div>
      <p class="cs-note cs-prose">${a.tableau.note}</p>
    </div>
  </section>` : "";
  const corps = `
  <section class="page-head dp-tete cp-tete">
    <div class="wrap dp-tete__grille">
      <div class="dp-tete__texte">
        <nav class="dp-fil" aria-label="Fil d’Ariane"><a href="/">Accueil</a><span aria-hidden="true">/</span><a href="/conseils/">Conseils</a><span aria-hidden="true">/</span><span aria-current="page">${e(a.carte)}</span></nav>
        <span class="eyebrow">${e(a.eyebrow)}</span>
        ${h1(a.h1)}
        <p class="lead">${e(a.lead)}</p>
        <p class="cs-maj">Mis à jour le <time datetime="${RELEVE}">${DATE_FR}</time></p>
      </div>
      <figure class="dp-photo cp-photo" style="aspect-ratio: ${ar(a.photo.src).toFixed(4)}">
        ${img(a.photo.src, a.photo.alt, "(max-width: 900px) 100vw, 40vw", { eager: true })}
      </figure>
    </div>
  </section>
${sections}${tableau}

  <section class="section" id="questions">
    <div class="wrap">
      ${tetiere("Questions", "Ce qu’on nous demande le plus.")}
      <div class="faq-list">
        ${a.faq.map(([q, r]) => `<details><summary>${e(q)}</summary><p>${e(r)}</p></details>`).join("\n        ")}
      </div>
    </div>
  </section>

  <section class="section band">
    <div class="wrap">
      ${tetiere("À lire aussi", autres.length > 1 ? "Les autres conseils du club." : "L’autre conseil du club.")}
      <div class="cs-cartes cs-cartes--${autres.length === 1 ? "large" : 2}">
        ${autres.map(carte).join("\n        ")}
      </div>
      <p class="dp-lien"><a href="/conseils/">Tous les conseils →</a></p>
    </div>
  </section>

  <section class="section">
    <div class="wrap"><div class="cta-block" data-reveal>
      <h2 class="display" style="margin-bottom:.6rem">Le mieux, c’est de <span class="tint">venir essayer.</span></h2>
      <p class="lead" style="margin-inline:auto">Tu arrives en tenue de sport, le coach s’occupe du reste — et il te dira quoi acheter, le moment venu.</p>
      <div class="dp-actions dp-actions--centre"><a class="btn btn--primary" href="/premiere-seance/">Ta première séance</a><a class="btn btn--ghost" href="/plannings/">Tout le planning</a></div>
    </div></div>
  </section>`;
  verifier(a.slug, corps, a.titre, a.desc);
  page({ dossier: join("conseils", a.slug), tete: tete({ titre: a.titre, desc: a.desc, url, og, ogAlt: `${nu(a.h1.join(" "))} — Boxing Center Portet` }), ld, corps });
}

/* ── L'index ────────────────────────────────────────────────────────────── */
{
  const I = DATA.index;
  const url = `${ORIGIN}/conseils/`;
  const og = `${ORIGIN}/og/conseils/index.jpg?v=1`;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${url}#webpage`, url, name: I.titre, description: I.desc, inLanguage: "fr-FR",
        isPartOf: { "@id": `${ORIGIN}/#website` }, breadcrumb: { "@id": `${url}#breadcrumb` }, dateModified: RELEVE,
        primaryImageOfPage: { "@type": "ImageObject", url: og.replace(/\?.*$/, ""), width: 1200, height: 630 },
        mainEntity: { "@type": "ItemList", numberOfItems: DATA.articles.length, itemListElement: DATA.articles.map((a, i) => ({ "@type": "ListItem", position: i + 1, name: a.titre, url: `${ORIGIN}/conseils/${a.slug}/` })) } },
      { "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`, itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${ORIGIN}/` },
        { "@type": "ListItem", position: 2, name: "Conseils", item: url },
      ] },
    ],
  };
  const corps = `
  <section class="page-head dp-tete cp-tete">
    <div class="wrap">
      <nav class="dp-fil" aria-label="Fil d’Ariane"><a href="/">Accueil</a><span aria-hidden="true">/</span><span aria-current="page">Conseils</span></nav>
      <span class="eyebrow">${e(I.eyebrow)}</span>
      ${h1(I.h1)}
      <p class="lead">${e(I.lead)}</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="cs-cartes cs-cartes--2">
        ${DATA.articles.map(carte).join("\n        ")}
      </div>
    </div>
  </section>

  <section class="section band">
    <div class="wrap"><div class="cta-block" data-reveal>
      <h2 class="display" style="margin-bottom:.6rem">Avant le matériel, <span class="tint">la première séance.</span></h2>
      <p class="lead" style="margin-inline:auto">Aucun équipement à acheter avant de venir : tu arrives en tenue de sport, et tu sauras quoi acheter en repartant.</p>
      <div class="dp-actions dp-actions--centre"><a class="btn btn--primary" href="/premiere-seance/">Ta première séance</a><a class="btn btn--ghost" href="/activites/">Les activités du club</a></div>
    </div></div>
  </section>`;
  verifier("index", corps, I.titre, I.desc);
  page({ dossier: "conseils", tete: tete({ titre: I.titre, desc: I.desc, url, og, ogAlt: "Les conseils matériel du Boxing Center Portet" }), ld, corps });
}

if (fautes.length) {
  console.error("[conseils] ✗\n  " + fautes.join("\n  "));
  process.exit(1);
}
/* La table des pages, lue par vite.config.ts (entrées), sitemap-images.mjs et generate-llms.mjs. */
writeFileSync(join(ROOT, "src", "conseils-liens.json"), JSON.stringify(DATA.articles.map((a) => ({ slug: a.slug, titre: a.titre, desc: a.desc, photo: a.photo, resume: a.resume })), null, 2) + "\n");
const sortants = DATA.articles.map((a) => (JSON.stringify(a).match(/https:\/\/(www\.boutique-de-boxe\.com|boutique\.boxingcenter\.fr)/g) || []).length);
console.log(`[conseils] /conseils/ + ${DATA.articles.length} articles · liens vers les boutiques : ${sortants.join(" + ")} · relevé du ${DATE_FR}`);
