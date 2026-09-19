/**
 * /club-de-boxe-portet/ — la page du club pour « club de boxe portet ».
 *
 * Eddy, 17/09 : une page par mot-clé, avec l'histoire du club et beaucoup de
 * liens internes. Sur « salle de boxe portet », le site est 2e derrière le site
 * du groupe ; cette page raconte le club (600 m², depuis 2016), relie CHAQUE
 * discipline et CHAQUE coach à sa page, et porte sa propre FAQ.
 *
 * Rien n'est inventé : les faits viennent de src/content.json (site, disciplines,
 * équipe, tarifs), de src/disciplines.json et src/coachs.json (les liens), et de
 * ce que /about/ et /premiere-seance/ publient déjà (2016, 600 m², le ring, la
 * cage, les tatamis, les 24 sacs). Les phrases sont neuves : aucun paragraphe
 * d'une autre page n'est recopié.
 *
 * Même gabarit que generate-coachs.mjs (tête de /coachs/, classes cp-*, dp-*).
 * Tourne après generate-coachs.mjs, avant sitemap-images.mjs.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { roleHtml } from "../src/role-liens.mjs";
import { ROOT, ORIGIN, contenu, pagesDisciplines, lienDiscipline, lireJSON } from "./disciplines-lib.mjs";

const C = contenu();
const PAGES_D = pagesDisciplines();
const TC = lireJSON("src/coachs.json").pages;
const MANIFESTE = lireJSON("src/img-manifest.json");
/* Les sites de proximité qui désignent Portet comme club : un lien dans le texte,
   en plus de la ligne du pied de page. */
const DEPUIS = [
  ["Muret", "https://www.boxingcenter-muret.fr/"],
  ["Cugnaux", "https://www.boxingcenter-cugnaux.fr/"],
  ["Tournefeuille", "https://www.boxingcenter-tournefeuille.fr/"],
  ["Colomiers", "https://www.boxingcenter-colomiers.fr/"],
];
const GABARIT = readFileSync(join(ROOT, "coachs", "index.html"), "utf8");

const e = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ar = (src) => MANIFESTE[src]?.ar || 1.5;
function img(src, alt, sizes, { eager = false } = {}) {
  const m = MANIFESTE[src];
  const base = "/img/opt/" + src.slice("/img/".length).replace(/\.[a-z]+$/i, "");
  const srcset = m ? ` srcset="${m.w.map((w) => `${base}-${w}.webp ${w}w`).join(", ")}" sizes="${sizes}"` : "";
  const dims = m ? ` width="${m.w[m.w.length - 1]}" height="${Math.round(m.w[m.w.length - 1] / m.ar)}"` : "";
  const charge = eager ? ` loading="eager" fetchpriority="high"` : ` loading="lazy"`;
  return `<img src="${e(src)}"${srcset}${dims} alt="${e(alt)}"${charge} decoding="async" />`;
}
const ancreTarif = (nom) => "tarif-" + String(nom || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const SLUG = "club-de-boxe-portet";
const URL = `${ORIGIN}/${SLUG}/`;
const OG = `${ORIGIN}/og/pages/${SLUG}.jpg?v=1`;
const TITRE = "Club de boxe à Portet-sur-Garonne : 600 m² depuis 2016";
const DESC = "Le club de boxe de Portet-sur-Garonne depuis 2016 : 600 m², un ring, une cage de MMA, neuf disciplines, l’équipe de Valentin Tapia. Histoire, cours, tarifs.";
const PHOTO = { src: "/img/gym-21.jpg", alt: "Le ring de boxe anglaise du Boxing Center Portet, 600 m² dédiés aux sports de combat." };

const site = C.site || {};
const a = site.address || {};
const adresse = `${a.street || "61 route d’Espagne"}, ${a.zip || "31120"} ${a.city || "Portet-sur-Garonne"}`;
const saison = (C.tarifs || []).find((t) => /^saison/i.test(t.name));
const rentree = (C.tarifs || []).find((t) => /rentr/i.test(t.name));
const prix = (t) => String(t?.price || "").replace(/\s*€/, " €");
const disciplines = (C.disciplines || []).map((d) => ({ d, href: lienDiscipline(d.name, PAGES_D) })).filter((x) => x.href);
const equipe = (C.team || []).filter((m) => TC[m.name]);
/* les quatre autres salles et leur site — mêmes adresses que NETWORK_SALLES (src/data.ts) */
const RESEAU = [
  ["Toulouse Minimes", "https://boxe-toulouse.com/"],
  ["Toulouse Saint-Cyprien", "https://club-boxe-toulouse.com/"],
  ["Ramonville", "https://mmatoulouse.com/"],
  ["Toulouse États-Unis", "https://clubmma.fr/"],
];

const FAQ = [
  ["Depuis quand le club de boxe de Portet existe-t-il ?",
   `Depuis 2016, au ${adresse}. C’est la salle phare du groupe Boxing Center, qui compte cinq salles autour de Toulouse.`],
  ["Quelle taille fait la salle ?",
   "600 m² dédiés aux sports de combat : un ring de boxe anglaise, une cage de MMA, des tatamis et 24 sacs de frappe."],
  ["Quels sports de combat peut-on pratiquer au club ?",
   `${(C.disciplines || []).map((d) => d.name).join(", ")}. Chaque discipline a sa page, avec ses créneaux.`],
  ["Le club accueille-t-il les débutants ?",
   "Oui. Aucun niveau n’est demandé, le sparring n’est jamais imposé, et tu montes sur le ring quand tu le demandes."],
  ["Le club prend-il les enfants ?",
   "Oui : la baby boxe pour les petits, la boxe éducative dès 7 ans et le kick-boxing enfants et ados. Les tranches d’âge de la saison sont au planning."],
  ["Combien coûte l’inscription ?",
   `La saison de 12 mois est à ${prix(saison)} au lieu de ${prix({ price: saison?.old })}, payée comptant, et ouvre les cinq salles. Sans engagement, l’offre rentrée est à ${prix(rentree)} par personne toutes les 4 semaines, au lieu de ${prix({ price: rentree?.old })}. Le détail est sur la page des tarifs.`],
];

function tete() {
  let h = GABARIT.slice(GABARIT.indexOf("<head>"), GABARIT.indexOf("</head>"));
  const meta = (rx, val) => { if (!rx.test(h)) throw new Error(`[club] balise absente : ${rx}`); h = h.replace(rx, (m0, x, y) => `${x}${val}${y}`); };
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${e(TITRE)}</title>`);
  meta(/(<meta name="description" content=")[^"]*(")/, e(DESC));
  meta(/(<link rel="canonical" href=")[^"]*(")/, URL);
  meta(/(<meta property="og:url" content=")[^"]*(")/, URL);
  meta(/(<meta property="og:title" content=")[^"]*(")/, e(TITRE));
  meta(/(<meta property="og:description" content=")[^"]*(")/, e(DESC));
  meta(/(<meta property="og:image" content=")[^"]*(")/, OG);
  meta(/(<meta property="og:image:url" content=")[^"]*(")/, OG);
  meta(/(<meta property="og:image:secure_url" content=")[^"]*(")/, OG);
  meta(/(<meta property="og:image:alt" content=")[^"]*(")/, e("Le club de boxe de Portet-sur-Garonne — Boxing Center, 600 m² depuis 2016"));
  meta(/(<meta name="twitter:image" content=")[^"]*(")/, OG);
  meta(/(<link rel="image_src" href=")[^"]*(")/, OG);
  if (/<meta name="twitter:title"/.test(h)) meta(/(<meta name="twitter:title" content=")[^"]*(")/, e(TITRE));
  if (/<meta name="twitter:description"/.test(h)) meta(/(<meta name="twitter:description" content=")[^"]*(")/, e(DESC));
  return h.replace(/\s*<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, "");
}

const ld = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebPage", "@id": `${URL}#webpage`, url: URL, name: TITRE, description: DESC, inLanguage: "fr-FR",
      isPartOf: { "@id": `${ORIGIN}/#website` }, about: { "@id": `${ORIGIN}/#localbusiness` }, mainEntity: { "@id": `${ORIGIN}/#localbusiness` },
      breadcrumb: { "@id": `${URL}#breadcrumb` },
      primaryImageOfPage: { "@type": "ImageObject", url: OG.replace(/\?.*$/, ""), width: 1200, height: 630 } },
    { "@type": "BreadcrumbList", "@id": `${URL}#breadcrumb`, itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: "Le club de boxe de Portet-sur-Garonne", item: URL },
    ] },
    { "@type": "FAQPage", "@id": `${URL}#faq`, isPartOf: { "@id": `${URL}#webpage` },
      mainEntity: FAQ.map(([q, r]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: r } })) },
  ],
};

const tetiere = (eyebrow, titre) => `<div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">${e(eyebrow)}</span>
          <h2 class="display" style="margin-top:1rem">${e(titre)}</h2>
        </div>
      </div>`;

const corps = `
  <section class="page-head dp-tete cp-tete">
    <div class="wrap dp-tete__grille">
      <div class="dp-tete__texte">
        <nav class="dp-fil" aria-label="Fil d’Ariane"><a href="/">Accueil</a><span aria-hidden="true">/</span><span aria-current="page">Le club</span></nav>
        <span class="eyebrow">Portet-sur-Garonne · depuis 2016</span>
        <h1 class="display"><span class="reveal-line"><span>Le club de boxe</span></span><span class="reveal-line"><span><span class="tint">de Portet-sur-Garonne.</span></span></span></h1>
        <p class="lead">Boxing Center Portet : 600 m² dédiés aux sports de combat au sud de Toulouse, la salle phare du groupe, ouverte à celui qui débute comme à celle qui prépare un combat.</p>
        <div class="dp-actions">
          <a class="btn btn--primary" href="/tarifs/#${ancreTarif(saison?.name || "Saison")}">Voir l’offre ${e(saison?.name || "Saison")}</a>
          <a class="btn btn--ghost" href="/premiere-seance/">Ta première séance</a>
          <a class="btn btn--ghost" href="/plannings/">Tout le planning</a>
        </div>
      </div>
      <figure class="dp-photo cp-photo" style="aspect-ratio: ${ar(PHOTO.src).toFixed(4)}">
        ${img(PHOTO.src, PHOTO.alt, "(max-width: 900px) 100vw, 40vw", { eager: true })}
      </figure>
    </div>
  </section>

  <section class="section band cp-reperes" aria-label="Le club en quelques repères">
    <div class="wrap">
      <dl class="cp-faits" data-reveal-group>
        <div class="cp-fait" data-reveal><dt>Ouverture</dt><dd>2016</dd></div>
        <div class="cp-fait" data-reveal><dt>Dédiés au combat</dt><dd>600 m²</dd></div>
        <div class="cp-fait" data-reveal><dt>Disciplines</dt><dd>${(C.disciplines || []).length}</dd></div>
        <div class="cp-fait" data-reveal><dt>Du lundi au samedi</dt><dd>10h00 – 21h30</dd></div>
      </dl>
    </div>
  </section>

  <section class="section">
    <div class="wrap cp-texte">
      ${tetiere("L’histoire", "Un club de boxe au sud de Toulouse.")}
      <div class="cp-paras" data-reveal>
        <p>Boxing Center Portet a ouvert en 2016, au ${e(adresse)}. C’est la salle phare du groupe Boxing Center, qui réunit aujourd’hui cinq salles autour de Toulouse. Depuis le premier jour, la porte est la même pour tout le monde : on y vient pour apprendre la boxe, pour se remettre en forme, ou pour préparer un combat.</p>
        <p>La salle fait 600 m², tous dédiés aux sports de combat : le ring de boxe anglaise d’un côté, la cage de MMA et les tatamis de l’autre, 24 sacs de frappe entre les deux, et un espace de préparation physique. <a href="/salles/">Visiter la salle</a> · <a href="/galerie/">les photos du club</a>.</p>
        <p>L’esprit du club tient en une phrase : une salle, une famille, une passion. Les compétiteurs du club s’entraînent sur le même ring que les débutants — <a href="/boxeurs/">les boxeurs du club</a> en sont la preuve.</p>
      </div>
    </div>
  </section>

  <section class="section band">
    <div class="wrap">
      ${tetiere("Les cours", `${disciplines.length} disciplines, un seul club.`)}
      <div class="disc-grid cp-cartes cp-cartes--3">
        ${disciplines.map(({ d, href }) => `<a class="disc" href="${href}" data-reveal><div class="disc__top"><span class="disc__key">${e(d.key || "")}</span><span class="disc__tag">${e(d.tag || "")}</span></div><div><h3 class="disc__name">${e(d.name)}</h3><span class="disc__go">Voir la discipline <span aria-hidden="true">→</span></span></div></a>`).join("\n        ")}
      </div>
      <p class="dp-lien"><a href="/activites/">Toutes les activités →</a></p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      ${tetiere("L’encadrement", "L’équipe de la saison.")}
      <div class="cp-equipe cp-cartes cp-cartes--${equipe.length === 5 ? 5 : Math.min(equipe.length, 4)}">
        ${equipe.map((x) => `<article class="tcard tcard--lien cp-coach" data-reveal>${img(x.img, `${x.name} — ${x.role}`, "(max-width: 760px) 92vw, 25vw")}<div class="tcard__body"><h3><a class="tcard__tout" href="/coachs/${TC[x.name].slug}/">${e(x.name)}</a></h3><p class="tcard__role">${roleHtml(x.role)}</p><span class="disc__go" aria-hidden="true">${TC[x.name].pluriel ? "Voir leur page" : "Voir sa page"} <span aria-hidden="true">→</span></span></div></article>`).join("\n        ")}
      </div>
      <p class="dp-lien"><a href="/coachs/">Toute l’équipe →</a></p>
    </div>
  </section>

  <section class="section band">
    <div class="wrap cp-texte">
      ${tetiere("Venir au club", "61 route d’Espagne, Portet-sur-Garonne.")}
      <div class="cp-paras" data-reveal>
        <p>Le club est au ${e(adresse)}, au sud de Toulouse. Il est ouvert du lundi au samedi, de 10h00 à 21h30. <a href="/contact/">Adresse, plan et contact</a> · <a href="/plannings/">les horaires de chaque cours</a> · <a href="/premiere-seance/">comment se passe une première séance</a>.</p>
        <p>L’abonnement Saison ouvre aussi les quatre autres salles du groupe : ${RESEAU.map(([n, u]) => `<a href="${u}" rel="noopener">${e(n)}</a>`).join(", ")}. <a href="/salles/#network-grid">Les cinq clubs</a> · <a href="/partenaires/">les partenaires du club</a>.</p>
        <p>Tu pars de Muret, de Cugnaux, de Tournefeuille ou de Colomiers ? Chaque commune a son site, avec le trajet jusqu’au club : ${DEPUIS.map(([v, u]) => `<a href="${u}">Boxing Center près de ${e(v)}</a>`).join(", ")}.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      ${tetiere("Questions", "Ce qu’on demande sur le club.")}
      <div class="faq-list">
        ${FAQ.map(([q, r]) => `<details><summary>${e(q)}</summary><p>${e(r)}</p></details>`).join("\n        ")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap"><div class="cta-block" data-reveal>
      <h2 class="display" style="margin-bottom:.6rem">Pousse la porte <span class="tint">du club.</span></h2>
      <p class="lead" style="margin-inline:auto">La saison complète est à ${e(prix(saison))} au lieu de ${e(prix({ price: saison?.old }))}. Tu viens avec une tenue de sport, l’équipe s’occupe du reste.</p>
      <div class="dp-actions dp-actions--centre"><a class="btn btn--primary" href="/tarifs/#${ancreTarif(saison?.name || "Saison")}">Voir l’offre ${e(saison?.name || "Saison")}</a><a class="btn btn--ghost" href="/tarifs/">Tous les tarifs</a><a class="btn btn--ghost" href="/contact/">Nous écrire</a></div>
    </div></div>
  </section>`;

const html = `<!doctype html>
<html lang="fr" translate="no" data-theme="dark">
${tete()}  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
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
mkdirSync(join(ROOT, SLUG), { recursive: true });
writeFileSync(join(ROOT, SLUG, "index.html"), html);
const liens = (corps.match(/href="\/[^"]*"/g) || []).length;
const trop = (DESC.length > 160 ? "  ✗ DESCRIPTION TROP LONGUE" : "") + (TITRE.length > 60 ? "  ✗ TITRE TROP LONG" : "");
console.log(`[club] /${SLUG}/ · ${disciplines.length} disciplines · ${equipe.length} coachs · ${FAQ.length} questions · ${liens} liens internes · titre ${TITRE.length} · description ${DESC.length}${trop}`);
