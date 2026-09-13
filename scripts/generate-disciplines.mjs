/**
 * Écrit une page par discipline : /activites/<slug>/index.html.
 *
 * Tout est cuit dans le HTML — texte, planning, coachs, tarifs, FAQ et
 * données structurées — parce que les robots des moteurs de réponse
 * n'exécutent pas le JavaScript. La tête reprend celle de /activites/ (même
 * thème, mêmes icônes, mêmes polices) ; seuls le titre, la description,
 * l'URL canonique et la vignette changent.
 *
 * Sources : src/content.json (cartes, planning, coachs, tarifs, adresse,
 * géré par l'admin) et src/disciplines.json (le texte long de chaque page).
 * Lancé en tête de « npm run build ».
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT, ORIGIN, contenu, pagesDisciplines, lienDiscipline, creneaux, joursEnMots,
  remplir, bornes, JOUR_SCHEMA, lireJSON, norm,
} from "./disciplines-lib.mjs";

const C = contenu();
const PAGES = pagesDisciplines();
const MANIFESTE = lireJSON("src/img-manifest.json");
const GABARIT = readFileSync(join(ROOT, "activites", "index.html"), "utf8");

const e = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** <img> avec ses variantes WebP quand le manifeste les connaît. */
function img(src, alt, sizes, { eager = false, cls = "" } = {}) {
  const m = MANIFESTE[src];
  const base = "/img/opt/" + src.slice("/img/".length).replace(/\.[a-z]+$/i, "");
  const srcset = m ? ` srcset="${m.w.map((w) => `${base}-${w}.webp ${w}w`).join(", ")}" sizes="${sizes}"` : "";
  const dims = m ? ` width="${m.w[m.w.length - 1]}" height="${Math.round(m.w[m.w.length - 1] / m.ar)}"` : "";
  const charge = eager ? ` loading="eager" fetchpriority="high"` : ` loading="lazy"`;
  return `<img${cls ? ` class="${cls}"` : ""} src="${e(src)}"${srcset}${dims} alt="${e(alt)}"${charge} decoding="async" />`;
}

const carteDe = (slug) => {
  const p = PAGES.find((x) => x.slug === slug);
  if (!p) return null;
  const d = (C.disciplines || []).find((x) => lienDiscipline(x.name, PAGES) === `/activites/${slug}/`);
  return { p, d };
};

function tete(p, url, og) {
  const titre = e(p.titre);
  const desc = e(p.descriptionFinale);
  let h = GABARIT.slice(GABARIT.indexOf("<head>"), GABARIT.indexOf("</head>"));
  const meta = (rx, val) => { h = h.replace(rx, (m0, a, b) => `${a}${val}${b}`); };
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${titre}</title>`);
  meta(/(<meta name="description" content=")[^"]*(")/, desc);
  meta(/(<link rel="canonical" href=")[^"]*(")/, url);
  meta(/(<meta property="og:url" content=")[^"]*(")/, url);
  meta(/(<meta property="og:title" content=")[^"]*(")/, titre);
  meta(/(<meta property="og:description" content=")[^"]*(")/, desc);
  meta(/(<meta property="og:image" content=")[^"]*(")/, og);
  meta(/(<meta property="og:image:url" content=")[^"]*(")/, og);
  meta(/(<meta property="og:image:secure_url" content=")[^"]*(")/, og);
  meta(/(<meta property="og:image:alt" content=")[^"]*(")/, e(`${p.nom} à Portet-sur-Garonne — Boxing Center`));
  meta(/(<meta name="twitter:image" content=")[^"]*(")/, og);
  meta(/(<link rel="image_src" href=")[^"]*(")/, og);
  return h;
}

function donnees(p, url, og, liste) {
  const tarifs = (C.tarifs || []).filter((t) => (p.tarifs || []).includes(t.name));
  const heures = [];
  for (const j of liste) for (const s of j.items) {
    const b = bornes(s.heure);
    if (b && JOUR_SCHEMA[j.jour]) heures.push({ "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${JOUR_SCHEMA[j.jour]}`, opens: b[0], closes: b[1], description: s.nom });
  }
  const service = {
    "@type": "Service",
    "@id": `${url}#service`,
    name: `${p.nom} à Portet-sur-Garonne`,
    serviceType: p.nom,
    description: p.descriptionFinale,
    url,
    image: `${ORIGIN}${p.photo.src}`,
    provider: { "@id": `${ORIGIN}/#localbusiness` },
    areaServed: [
      { "@type": "City", name: "Portet-sur-Garonne" },
      { "@type": "City", name: "Toulouse" },
      { "@type": "AdministrativeArea", name: "Haute-Garonne" },
    ],
  };
  if (heures.length) service.hoursAvailable = heures;
  if (tarifs.length) service.offers = tarifs.map((t) => ({
    "@type": "Offer",
    name: t.name,
    price: String(t.price || "").replace(/\D/g, "") || "0",
    priceCurrency: "EUR",
    description: `${t.price} ${t.unit}`.trim(),
    url: t.href || `${ORIGIN}/tarifs/`,
  }));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: p.titre,
        description: p.descriptionFinale,
        inLanguage: "fr-FR",
        isPartOf: { "@id": `${ORIGIN}/#website` },
        about: { "@id": `${url}#service` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        primaryImageOfPage: { "@type": "ImageObject", url: og.replace(/\?.*$/, ""), width: 1200, height: 630 },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: `${ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: "Activités", item: `${ORIGIN}/activites/` },
          { "@type": "ListItem", position: 3, name: p.nom, item: url },
        ],
      },
      service,
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: p.faqFinale.map((q) => ({ "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: q.r } })),
      },
    ],
  };
}

function corps(p, liste) {
  const site = C.site || {};
  const a = site.address || {};
  const coachs = (C.team || []).filter((m) => (p.coachs || []).some((n) => norm(m.name).startsWith(norm(n))));
  const tarifs = (C.tarifs || []).filter((t) => (p.tarifs || []).includes(t.name));
  const sections = [];

  sections.push(`
  <section class="page-head dp-tete">
    <div class="wrap dp-tete__grille">
      <div class="dp-tete__texte">
        <nav class="dp-fil" aria-label="Fil d’Ariane"><a href="/">Accueil</a><span aria-hidden="true">/</span><a href="/activites/">Activités</a><span aria-hidden="true">/</span><span aria-current="page">${e(p.nom)}</span></nav>
        <span class="eyebrow">${e(p.eyebrow)}</span>
        <h1 class="display"><span class="reveal-line"><span>${e(p.h1)}</span></span><span class="reveal-line"><span>à <span class="tint">Portet-sur-Garonne.</span></span></span></h1>
        <p class="lead">${e(p.leadFinal)}</p>
        <div class="dp-actions">
          <a class="btn btn--primary" href="/premiere-seance/">Ta première séance</a>
          <a class="btn btn--ghost" href="/plannings/">Tout le planning</a>
        </div>
      </div>
      <figure class="dp-photo">
        ${img(p.photo.src, p.photo.alt, "(max-width: 900px) 100vw, 40vw", { eager: true })}
      </figure>
    </div>
  </section>`);

  sections.push(`
  <section class="section band">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">Ce que tu travailles</span>
          <h2 class="display" style="margin-top:1rem">${e(p.travailTitre)}</h2>
        </div>
      </div>
      <div class="values dp-valeurs" data-reveal-group>
        ${p.travail.map((t, i) => `<article class="value" data-reveal><span class="value__n">${String(i + 1).padStart(2, "0")}</span><h3 class="value__title">${e(t.titre)}</h3><p class="value__desc">${e(t.texte)}</p></article>`).join("\n        ")}
      </div>
    </div>
  </section>`);

  sections.push(`
  <section class="section">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">Pour qui</span>
          <h2 class="display" style="margin-top:1rem">Ton point de départ.</h2>
        </div>
      </div>
      <div class="aud-grid dp-publics" data-reveal-group>
        ${p.pourQui.map((x) => `<article class="aud" data-reveal><span class="aud__tag">${e(x.tag)}</span><h3 class="aud__title">${e(x.titre)}</h3><p class="aud__desc">${e(x.texte)}</p></article>`).join("\n        ")}
      </div>
    </div>
  </section>`);

  const planning = liste.length
    ? `<div class="planning dp-planning">${liste.map((j) => `<div class="plan-col" data-reveal><h3 class="plan-col__day">${e(j.jour)}</h3>${j.items.map((s) => `<div class="plan-slot"><span class="plan-slot__t">${e(s.heure)}</span><span class="plan-slot__a">${e(s.nom)}</span></div>`).join("")}</div>`).join("")}</div>`
    : `<p class="dp-vide">${e(p.creneaux?.vide || "Les créneaux de cette discipline s’afficheront ici dès qu’ils seront au planning du club.")}</p>`;
  sections.push(`
  <section class="section band">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">Les créneaux</span>
          <h2 class="display" style="margin-top:1rem">Quand venir.</h2>
        </div>
        <p class="lead">Le planning en vigueur, tel que le club le publie. Pour la plupart des cours, pas besoin de réserver : tu viens, on te guide.</p>
      </div>
      ${planning}
      <p class="dp-lien"><a href="/plannings/">Voir le planning complet du club →</a></p>
    </div>
  </section>`);

  if (coachs.length) sections.push(`
  <section class="section">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">Qui encadre</span>
          <h2 class="display" style="margin-top:1rem">${coachs.length > 1 ? "Tes coachs." : "Ton coach."}</h2>
        </div>
      </div>
      <div class="team-cards dp-coachs">
        ${coachs.map((m) => `<article class="tcard" data-reveal>${img(m.img, `${m.name} — ${m.role}`, "(max-width: 760px) 90vw, 30vw")}<div class="tcard__body"><h3>${e(m.name)}</h3><p class="tcard__role">${e(m.role)}</p><p class="tcard__desc">${e(m.desc)}</p></div></article>`).join("\n        ")}
      </div>
      <p class="dp-lien"><a href="/coachs/">Toute l’équipe du club →</a></p>
    </div>
  </section>`);

  sections.push(`
  <section class="section">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">En images</span>
          <h2 class="display" style="margin-top:1rem">Au club.</h2>
        </div>
      </div>
      <div class="dp-galerie">
        ${p.photos.map((ph) => `<figure class="dp-galerie__item" data-reveal>${img(ph.src, ph.alt, "(max-width: 760px) 100vw, 50vw")}<figcaption>${e(ph.legende)}</figcaption></figure>`).join("\n        ")}
      </div>
    </div>
  </section>`);

  sections.push(`
  <section class="section band">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">Infos pratiques</span>
          <h2 class="display" style="margin-top:1rem">L’essentiel, en un coup d’œil.</h2>
        </div>
      </div>
      <dl class="dp-infos" data-reveal>
        <div><dt>Adresse</dt><dd>${e(site.name || "Boxing Center Portet")}, ${e(a.street || "61 route d’Espagne")}, ${e(a.zip || "31120")} ${e(a.city || "Portet-sur-Garonne")}</dd></div>
        <div><dt>Ouverture</dt><dd>${e(site.hours || "Lun–Sam · 10h00 – 21h30")}</dd></div>
        <div><dt>Accès</dt><dd>Par l’A64, sortie Portet, puis la route d’Espagne. En bus, la ligne 117 Express s’arrête à « Jean Jaurès », sur la route d’Espagne.</dd></div>
        ${tarifs.length ? `<div><dt>Tarifs</dt><dd>${tarifs.map((t) => `${e(t.name)} : ${e(t.price)} ${e(t.unit)}`).join(" · ")}. <a href="/tarifs/">Le détail des formules →</a></dd></div>` : ""}
        <div><dt>Contact</dt><dd><a href="tel:${e(site.phoneHref || "+33687900216")}">${e(site.phone || "06 87 90 02 16")}</a> · <a href="mailto:${e(site.email || "boxingcenterportet@gmail.com")}">${e(site.email || "boxingcenterportet@gmail.com")}</a></dd></div>
      </dl>
    </div>
  </section>`);

  sections.push(`
  <section class="section">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">Questions</span>
          <h2 class="display" style="margin-top:1rem">Ce qu’on nous demande.</h2>
        </div>
      </div>
      <div class="faq-list">
        ${p.faqFinale.map((q) => `<details><summary>${e(q.q)}</summary><p>${e(q.r)}</p></details>`).join("\n        ")}
      </div>
    </div>
  </section>`);

  const voisines = (p.voisines || []).map(carteDe).filter(Boolean);
  if (voisines.length) sections.push(`
  <section class="section">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">Les autres disciplines</span>
          <h2 class="display" style="margin-top:1rem">Et aussi, au club.</h2>
        </div>
      </div>
      <div class="disc-grid dp-voisines">
        ${voisines.map(({ p: v, d }) => `<a class="disc" href="/activites/${v.slug}/" data-reveal><div class="disc__top"><span class="disc__key">${e(d?.key || "")}</span><span class="disc__tag">${e(d?.tag || v.eyebrow.replace(/^Discipline · /, ""))}</span></div><div><h3 class="disc__name">${e(d?.name || v.nom)}</h3><p class="disc__desc">${e(d?.desc || "")}</p><span class="disc__go">Voir la discipline <span aria-hidden="true">→</span></span></div></a>`).join("\n        ")}
      </div>
    </div>
  </section>`);

  sections.push(`
  <section class="section">
    <div class="wrap"><div class="cta-block" data-reveal>
      <h2 class="display" style="margin-bottom:.6rem">Le plus dur, <span class="tint">c’est de pousser la porte.</span></h2>
      <p class="lead" style="margin-inline:auto">La première séance est faite pour découvrir : tu viens avec une tenue de sport, le coach s’occupe du reste.</p>
      <div class="dp-actions dp-actions--centre"><a class="btn btn--primary" href="/premiere-seance/">Ta première séance</a><a class="btn btn--ghost" href="/tarifs/">Les tarifs</a><a class="btn btn--ghost" href="/contact/">Nous écrire</a></div>
    </div></div>
  </section>`);

  return sections.join("\n");
}

let n = 0;
for (const p of PAGES) {
  const liste = creneaux(p, C);
  const jours = joursEnMots(liste);
  p.descriptionFinale = remplir(p.description, jours);
  p.leadFinal = remplir(p.lead, jours);
  p.faqFinale = p.faq.map((q) => ({ q: q.q, r: remplir(q.r, jours) }));
  const url = `${ORIGIN}/activites/${p.slug}/`;
  const og = `${ORIGIN}/og/disciplines/${p.slug}.jpg?v=1`;

  const ld = `<script type="application/ld+json">${JSON.stringify(donnees(p, url, og, liste)).replace(/</g, "\\u003c")}</script>`;
  const html = `<!doctype html>
<html lang="fr" translate="no" data-theme="dark">
${tete(p, url, og)}  ${ld}
</head>
<body data-page="discipline" data-discipline="${e(p.slug)}">
  <div class="curtain" id="curtain" aria-hidden="true"></div>
  <div id="site-nav"></div>
  <main id="page">
${corps(p, liste)}
  </main>
  <div id="site-footer"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
`;
  const dossier = join(ROOT, "activites", p.slug);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, "index.html"), html);
  n += 1;
  const trop = p.descriptionFinale.length > 160 ? "  ✗ DESCRIPTION TROP LONGUE (Google coupe vers 160)" : "";
  const titreTrop = p.titre.length > 60 ? "  ✗ TITRE TROP LONG" : "";
  console.log(`[disciplines] /activites/${p.slug}/ · ${liste.reduce((s, j) => s + j.items.length, 0)} créneau(x) · titre ${p.titre.length} car. · description ${p.descriptionFinale.length} car.${trop}${titreTrop}`);
}
/* La table légère que le JavaScript du site charge pour rendre les cartes
   cliquables : le slug et les noms, sans le texte long des pages. */
writeFileSync(
  join(ROOT, "src", "disciplines-liens.json"),
  JSON.stringify(PAGES.map(({ slug, nom, noms }) => ({ slug, nom, noms })), null, 2) + "\n"
);
console.log(`[disciplines] ${n} pages écrites · table des liens à jour`);
