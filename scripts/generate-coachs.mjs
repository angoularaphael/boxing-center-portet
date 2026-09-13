/**
 * Écrit une page par coach : /coachs/<slug>/index.html.
 *
 * Tout est cuit dans le HTML — parcours, palmarès, boxeurs formés,
 * disciplines, FAQ et données structurées ProfilePage + Person — parce que
 * les robots des moteurs de réponse n'exécutent pas le JavaScript. La tête
 * reprend celle de /coachs/ (même thème, mêmes icônes, mêmes polices) ; seuls
 * le titre, la description, l'URL canonique et la vignette changent.
 *
 * Sources : src/content.json (l'équipe, les cartes, les tarifs, l'adresse,
 * géré par l'admin) et src/coachs.json (le texte long de chaque page).
 * Lancé dans « npm run build », après generate-disciplines.mjs.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, ORIGIN, contenu, pagesDisciplines, lienDiscipline, lireJSON, norm } from "./disciplines-lib.mjs";

const C = contenu();
const PAGES_D = pagesDisciplines();
const TC = lireJSON("src/coachs.json").pages;
const MANIFESTE = lireJSON("src/img-manifest.json");
const GABARIT = readFileSync(join(ROOT, "coachs", "index.html"), "utf8");

const e = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ar = (src) => MANIFESTE[src]?.ar || 1.5;

/** <img> avec ses variantes WebP quand le manifeste les connaît. */
function img(src, alt, sizes, { eager = false } = {}) {
  const m = MANIFESTE[src];
  const base = "/img/opt/" + src.slice("/img/".length).replace(/\.[a-z]+$/i, "");
  const srcset = m ? ` srcset="${m.w.map((w) => `${base}-${w}.webp ${w}w`).join(", ")}" sizes="${sizes}"` : "";
  const dims = m ? ` width="${m.w[m.w.length - 1]}" height="${Math.round(m.w[m.w.length - 1] / m.ar)}"` : "";
  const charge = eager ? ` loading="eager" fetchpriority="high"` : ` loading="lazy"`;
  return `<img src="${e(src)}"${srcset}${dims} alt="${e(alt)}"${charge} decoding="async" />`;
}

/* L'ancre d'une formule sur /tarifs/ — même règle que src/liens-disciplines.ts. */
const ancreTarif = (nom) => "tarif-" + String(nom || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const voirTarif = (t) => (/^offre\b/i.test(t.name) ? `Voir l’${t.name}` : /^saison\b/i.test(t.name) ? `Voir l’offre ${t.name}` : `Voir le tarif ${t.name}`);
const boutonTarif = (t) => (t
  ? `<a class="btn btn--primary" href="/tarifs/#${ancreTarif(t.name)}">${e(voirTarif(t))}</a>`
  : `<a class="btn btn--primary" href="/tarifs/">Les tarifs</a>`);

/* Les pages de discipline où ce coach est nommé (« Mourad » vaut pour « Mourad & Ingrid »). */
const disciplinesDe = (m) => PAGES_D.filter((pd) => (pd.coachs || []).some((n) => norm(m.name).startsWith(norm(n))));
const carteDe = (pd) => (C.disciplines || []).find((x) => lienDiscipline(x.name, PAGES_D) === `/activites/${pd.slug}/`);

function tete(p, url, og) {
  const titre = e(p.titre);
  const desc = e(p.description);
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
  meta(/(<meta property="og:image:alt" content=")[^"]*(")/, e(`${p.nom}, ${p.poste.charAt(0).toLowerCase()}${p.poste.slice(1)} — Boxing Center Portet`));
  meta(/(<meta name="twitter:image" content=")[^"]*(")/, og);
  meta(/(<meta name="twitter:title" content=")[^"]*(")/, titre);
  meta(/(<meta name="twitter:description" content=")[^"]*(")/, desc);
  meta(/(<link rel="image_src" href=")[^"]*(")/, og);
  /* Le JSON-LD de /coachs/ (liste des coachs) ne vaut pas pour la page d'un coach. */
  h = h.replace(/\s*<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, "");
  return h;
}

function donnees(p, m, url, og, discs) {
  const personnes = (p.personnes || [{ nom: m.name, poste: p.poste, titres: p.titres }]).map((x, i) => {
    const personne = {
      "@type": "Person",
      "@id": `${url}#personne${i ? `-${i + 1}` : ""}`,
      name: x.nom,
      jobTitle: x.poste || p.poste,
      image: `${ORIGIN}${p.photo.src}`,
      url,
      worksFor: { "@id": `${ORIGIN}/#localbusiness` },
      knowsAbout: discs.map((pd) => pd.nom),
    };
    if (!p.personnes) personne.description = p.description;
    if (!p.personnes && p.diplomes?.length) personne.hasCredential = p.diplomes.map((d) => ({ "@type": "EducationalOccupationalCredential", name: d, credentialCategory: "Diplôme" }));
    if (x.titres?.length) personne.award = x.titres;
    return personne;
  });
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": `${url}#webpage`,
        url,
        name: p.titre,
        description: p.description,
        inLanguage: "fr-FR",
        isPartOf: { "@id": `${ORIGIN}/#website` },
        mainEntity: { "@id": personnes[0]["@id"] },
        ...(personnes.length > 1 ? { about: personnes.map((x) => ({ "@id": x["@id"] })) } : {}),
        breadcrumb: { "@id": `${url}#breadcrumb` },
        primaryImageOfPage: { "@type": "ImageObject", url: og.replace(/\?.*$/, ""), width: 1200, height: 630 },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: `${ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: "Coachs", item: `${ORIGIN}/coachs/` },
          { "@type": "ListItem", position: 3, name: p.nom, item: url },
        ],
      },
      ...personnes,
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: p.faq.map((q) => ({ "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: q.r } })),
      },
    ],
  };
}

function corps(p, m, discs) {
  const site = C.site || {};
  const a = site.address || {};
  const tarif = (C.tarifs || []).find((t) => t.name === p.tarif) || (C.tarifs || []).find((t) => /rentr/i.test(t.name));
  const sections = [];

  sections.push(`
  <section class="page-head dp-tete cp-tete">
    <div class="wrap dp-tete__grille">
      <div class="dp-tete__texte">
        <nav class="dp-fil" aria-label="Fil d’Ariane"><a href="/">Accueil</a><span aria-hidden="true">/</span><a href="/coachs/">Coachs</a><span aria-hidden="true">/</span><span aria-current="page">${e(p.nom)}</span></nav>
        <span class="eyebrow">${e(p.eyebrow)}</span>
        <h1 class="display"><span class="reveal-line"><span>${e(p.h1)}</span></span><span class="reveal-line"><span><span class="tint">${e(p.h1Tint)}</span></span></span></h1>
        <p class="lead">${e(p.lead)}</p>
        <div class="dp-actions">
          ${boutonTarif(tarif)}
          <a class="btn btn--ghost" href="/premiere-seance/">Ta première séance</a>
          <a class="btn btn--ghost" href="/plannings/">Tout le planning</a>
        </div>
      </div>
      <figure class="dp-photo cp-photo" style="aspect-ratio: ${ar(p.photo.src).toFixed(4)}">
        ${img(p.photo.src, p.photo.alt, "(max-width: 900px) 100vw, 40vw", { eager: true })}
      </figure>
    </div>
  </section>`);

  sections.push(`
  <section class="section band cp-reperes" aria-label="${e(p.nom)} en quelques repères">
    <div class="wrap">
      <dl class="cp-faits" data-reveal-group>
        ${p.faits.map(([v, l]) => `<div class="cp-fait" data-reveal><dt>${e(l)}</dt><dd>${e(v)}</dd></div>`).join("\n        ")}
      </dl>
    </div>
  </section>`);

  p.sections.forEach((s, i) => sections.push(`
  <section class="section${i % 2 ? " band" : ""}">
    <div class="wrap cp-texte">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">${e(s.eyebrow)}</span>
          <h2 class="display" style="margin-top:1rem">${e(s.titre)}</h2>
        </div>
      </div>
      <div class="cp-paras" data-reveal>${s.textes.map((t) => `<p>${e(t)}</p>`).join("")}</div>
    </div>
  </section>`));

  if (p.boxeurs?.length) sections.push(`
  <section class="section band">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">Ses boxeurs</span>
          <h2 class="display" style="margin-top:1rem">${e(p.boxeursTitre || "Ses boxeurs.")}</h2>
        </div>
      </div>
      <div class="cp-boxeurs">
        ${p.boxeurs.map((b) => `<a class="cp-boxeur" href="/boxeurs/" data-reveal>${img(b.src, b.alt, "(max-width: 760px) 92vw, 30vw")}<span class="cp-boxeur__nom">${e(b.nom)}</span><span class="cp-boxeur__fait">${e(b.fait)}</span></a>`).join("\n        ")}
      </div>
      <p class="dp-lien"><a href="/boxeurs/">Tous les boxeurs du club →</a></p>
    </div>
  </section>`);

  if (p.photos?.length) sections.push(`
  <section class="section">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">En images</span>
          <h2 class="display" style="margin-top:1rem">Au club.</h2>
        </div>
      </div>
      <div class="dp-galerie${p.photos.length === 1 ? " cp-galerie--seule" : ""}" style="--cols: ${p.photos.map((ph) => `minmax(0, ${ar(ph.src).toFixed(3)}fr)`).join(" ")}">
        ${p.photos.map((ph) => `<figure class="dp-galerie__item" data-reveal>${img(ph.src, ph.alt, "(max-width: 760px) 100vw, 50vw")}<figcaption>${e(ph.legende)}</figcaption></figure>`).join("\n        ")}
      </div>
    </div>
  </section>`);

  sections.push(`
  <section class="section band">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">En bref</span>
          <h2 class="display" style="margin-top:1rem">${p.pluriel ? "Leur profil." : "Son profil."}</h2>
        </div>
      </div>
      <dl class="dp-infos" data-reveal>
        <div><dt>Rôle</dt><dd>${e(p.poste)}</dd></div>
        ${p.diplomes?.length ? `<div><dt>Formation</dt><dd>${e(p.diplomes.join(" · "))}</dd></div>` : ""}
        <div><dt>Salle</dt><dd>${e(site.name || "Boxing Center Portet")}, ${e(a.street || "61 route d’Espagne")}, ${e(a.zip || "31120")} ${e(a.city || "Portet-sur-Garonne")}</dd></div>
      </dl>
      ${p.devise ? `<blockquote class="cp-devise" data-reveal><p>« ${e(p.devise)} »</p><cite>${e(p.nom)}</cite></blockquote>` : ""}
    </div>
  </section>`);

  if (discs.length) sections.push(`
  <section class="section">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">${p.pluriel ? "Leurs disciplines" : "Ses disciplines"}</span>
          <h2 class="display" style="margin-top:1rem">${p.pluriel ? "Où les retrouver." : "Où le retrouver."}</h2>
        </div>
      </div>
      <div class="disc-grid cp-cartes cp-cartes--${Math.min(discs.length, 4)}">
        ${discs.map((pd) => { const d = carteDe(pd); return `<a class="disc" href="/activites/${pd.slug}/" data-reveal><div class="disc__top"><span class="disc__key">${e(d?.key || "")}</span><span class="disc__tag">${e(d?.tag || "")}</span></div><div><h3 class="disc__name">${e(d?.name || pd.nom)}</h3><p class="disc__desc">${e(d?.desc || "")}</p><span class="disc__go">Voir la discipline <span aria-hidden="true">→</span></span></div></a>`; }).join("\n        ")}
      </div>
    </div>
  </section>`);

  sections.push(`
  <section class="section band">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">Questions</span>
          <h2 class="display" style="margin-top:1rem">Ce qu’on nous demande.</h2>
        </div>
      </div>
      <div class="faq-list">
        ${p.faq.map((q) => `<details><summary>${e(q.q)}</summary><p>${e(q.r)}</p></details>`).join("\n        ")}
      </div>
    </div>
  </section>`);

  const autres = (C.team || []).filter((x) => x.name !== m.name && TC[x.name]);
  if (autres.length) sections.push(`
  <section class="section">
    <div class="wrap">
      <div class="sec-head" data-reveal>
        <div>
          <span class="eyebrow">L’équipe</span>
          <h2 class="display" style="margin-top:1rem">Les autres coachs.</h2>
        </div>
      </div>
      <div class="cp-equipe cp-cartes cp-cartes--${Math.min(autres.length, 4)}">
        ${autres.map((x) => `<a class="tcard cp-coach" href="/coachs/${TC[x.name].slug}/" data-reveal>${img(x.img, `${x.name} — ${x.role}`, "(max-width: 760px) 92vw, 25vw")}<div class="tcard__body"><h3>${e(x.name)}</h3><p class="tcard__role">${e(x.role)}</p><span class="disc__go">${TC[x.name].pluriel ? "Voir leur page" : "Voir sa page"} <span aria-hidden="true">→</span></span></div></a>`).join("\n        ")}
      </div>
      <p class="dp-lien"><a href="/coachs/">Toute l’équipe →</a></p>
    </div>
  </section>`);

  sections.push(`
  <section class="section">
    <div class="wrap"><div class="cta-block" data-reveal>
      <h2 class="display" style="margin-bottom:.6rem">Viens t’entraîner <span class="tint">avec ${e(p.avec)}.</span></h2>
      <p class="lead" style="margin-inline:auto">La première séance est faite pour découvrir : tu viens avec une tenue de sport, ${p.pluriel ? "les coachs s’occupent" : "le coach s’occupe"} du reste.</p>
      <div class="dp-actions dp-actions--centre">${boutonTarif(tarif)}<a class="btn btn--ghost" href="/premiere-seance/">Ta première séance</a><a class="btn btn--ghost" href="/contact/">Nous écrire</a></div>
    </div></div>
  </section>`);

  return sections.join("\n");
}

let n = 0;
for (const m of C.team || []) {
  const p = TC[m.name];
  if (!p) { console.log(`[coachs] ${m.name} : pas de texte, pas de page`); continue; }
  const discs = disciplinesDe(m);
  const url = `${ORIGIN}/coachs/${p.slug}/`;
  const og = `${ORIGIN}/og/coachs/${p.slug}.jpg?v=1`;
  const ld = `<script type="application/ld+json">${JSON.stringify(donnees(p, m, url, og, discs)).replace(/</g, "\\u003c")}</script>`;
  const html = `<!doctype html>
<html lang="fr" translate="no" data-theme="dark">
${tete(p, url, og)}  ${ld}
</head>
<body data-page="coach" data-coach="${e(p.slug)}">
  <div class="curtain" id="curtain" aria-hidden="true"></div>
  <div id="site-nav"></div>
  <main id="page">
${corps(p, m, discs)}
  </main>
  <div id="site-footer"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
`;
  const dossier = join(ROOT, "coachs", p.slug);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, "index.html"), html);
  n += 1;
  const trop = p.description.length > 160 ? "  ✗ DESCRIPTION TROP LONGUE" : "";
  const titreTrop = p.titre.length > 60 ? "  ✗ TITRE TROP LONG" : "";
  console.log(`[coachs] /coachs/${p.slug}/ · ${discs.length} discipline(s) · titre ${p.titre.length} car. · description ${p.description.length} car.${trop}${titreTrop}`);
}
/* La table légère que la cuisson (vite.config) lit pour relier chaque carte à sa page. */
writeFileSync(join(ROOT, "src", "coachs-liens.json"),
  JSON.stringify((C.team || []).filter((m) => TC[m.name]).map((m) => ({ nom: m.name, slug: TC[m.name].slug })), null, 2) + "\n");
console.log(`[coachs] ${n} pages écrites · table des liens à jour`);
