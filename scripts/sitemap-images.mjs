/**
 * Le sitemap d'images, reconstruit depuis le contenu éditable.
 *
 * Pourquoi ce script existe : les photos du site vivent en fonds CSS et en
 * grilles rendues par JavaScript. Google Images n'indexe QUE ce qu'il voit —
 * une image de fond ne rapporte aucun jus. Le sitemap d'images est le seul
 * moyen officiel de déclarer ces photos, avec leur titre et leur légende.
 * Portet n'en déclarait que 4 alors qu'il en a plus de soixante.
 *
 * Lancé avant chaque build (npm run build) : le jour où le patron ajoute une
 * photo au vestiaire, elle entre dans le sitemap toute seule.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://boxing-center-portet.fr";
const C = JSON.parse(readFileSync(join(ROOT, "src/content.json"), "utf8"));
const jour = new Date().toISOString().slice(0, 10);

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Une image déclarée : l'URL absolue, un titre court, une légende qui situe. */
const img = (src, titre, legende) =>
  `    <image:image>\n      <image:loc>${SITE}${esc(src)}</image:loc>\n` +
  `      <image:title>${esc(titre)}</image:title>\n` +
  (legende ? `      <image:caption>${esc(legende)}</image:caption>\n` : "") +
  `    </image:image>`;

const LIEU = "Boxing Center Portet-sur-Garonne, Toulouse sud";

// Les disciplines illustrées (page d'accueil + page activités)
const disciplines = (C.disciplines || [])
  .filter((d) => d.img)
  .map((d) => img(d.img, `${d.name} — ${LIEU}`, `${d.name} : ${String(d.desc || "").slice(0, 150)}`));

// L'équipe : les cartes officielles de la saison
const equipe = (C.team || [])
  .filter((m) => m.img)
  .map((m) => img(m.img, `${m.name} — ${m.role || "coach"} au ${LIEU}`, `${String(m.desc || "").slice(0, 150)}`));

// La galerie : chaque photo porte déjà sa légende dans le backoffice
const galerie = (C.gallery || [])
  .filter((g) => g.src)
  .map((g) => img(g.src, `${g.label} — ${LIEU}`, `${g.label}, photographié au Boxing Center Portet, 61 route d'Espagne.`));

/** Vidéos réellement présentes dans le HTML (comme BOXPLUS). Fichier absent = rien. */
const vid = (file, poster, name, description, seconds, uploadDate) => {
  if (!existsSync(join(ROOT, "public", "media", file))) return "";
  return [
    "    <video:video>",
    `      <video:thumbnail_loc>${SITE}${esc(poster)}</video:thumbnail_loc>`,
    `      <video:title>${esc(name.slice(0, 100))}</video:title>`,
    `      <video:description>${esc(description.slice(0, 2048))}</video:description>`,
    `      <video:content_loc>${SITE}/media/${esc(file)}</video:content_loc>`,
    `      <video:duration>${Math.max(1, Math.round(seconds))}</video:duration>`,
    `      <video:publication_date>${uploadDate}</video:publication_date>`,
    "      <video:family_friendly>yes</video:family_friendly>",
    "      <video:live>no</video:live>",
    "    </video:video>",
  ].join("\n");
};

const homeVideos = [
  vid(
    "clip-floor.mp4",
    "/img/gym-04.jpg",
    "Préparation physique — Boxing Center Portet",
    "L’espace de préparation physique du Boxing Center Portet, 61 route d’Espagne à Portet-sur-Garonne (31120), Toulouse sud.",
    8,
    "2026-08-07"
  ),
  vid(
    "clip-bags.mp4",
    "/img/gym-03.jpg",
    "Sacs de frappe — salle de boxe Portet-sur-Garonne",
    "Les sacs de frappe du Boxing Center Portet : 600 m², ring de boxe anglaise et cage MMA, à 10 min de Toulouse sud.",
    10,
    "2026-08-07"
  ),
].filter(Boolean);

const PAGES = [
  /* Les fiches destinees aux IA. Un robot ne les decouvre autrement que
     par robots.txt : les declarer ici les met au meme rang que les pages. */
  { url: "/llms.txt", freq: "weekly", prio: "0.4", images: [] },
  { url: "/llms-full.txt", freq: "weekly", prio: "0.3", images: [] },
  { url: "/ai.txt", freq: "monthly", prio: "0.3", images: [] },
  { url: "/", freq: "weekly", prio: "1.0", images: [
      img("/og.jpg", "Salle Boxing Center Portet-sur-Garonne", "Espace cross-training du Boxing Center Portet : cages, rameurs et mur rouge."),
      img("/img/gym-04.jpg", `Préparation physique | Boxing Center Portet`, "L’espace de préparation physique du Boxing Center Portet, 61 route d’Espagne."),
      img("/img/gym-21.jpg", `Le ring de boxe anglaise | ${LIEU}`, "Le ring de boxe anglaise du Boxing Center Portet, 600 m² dédiés aux sports de combat."),
      ...disciplines.slice(0, 4)], videos: homeVideos },
  { url: "/premiere-seance/", freq: "monthly", prio: "0.9", images: [
      img("/img/gym-01.jpg", `L'entrée du club — ${LIEU}`, "Ce que tu vois en poussant la porte du Boxing Center Portet.")] },
  { url: "/activites/", freq: "monthly", prio: "0.9", images: disciplines },
  { url: "/salles/", freq: "monthly", prio: "0.8", images: [
      img("/img/gym-21.jpg", `Le ring — ${LIEU}`, "La salle de boxe anglaise et son ring."),
      img("/img/gym-24.jpg", `La cage MMA — ${LIEU}`, "L'espace combat et sa cage de MMA."),
      img("/img/gym-03.jpg", `Les sacs de frappe — ${LIEU}`, "Les 24 sacs de frappe du Boxing Center Portet.")],
    videos: [
      vid(
        "clip-exterior.mp4",
        "/img/gym-01.jpg",
        "Visite du Boxing Center Portet — 61 route d’Espagne",
        "Visite vidéo de la salle phare Boxing Center à Portet-sur-Garonne (31120) : 600 m², ring de boxe anglaise et cage MMA, à 10 minutes de Toulouse sud.",
        16,
        "2026-08-07"
      ),
    ].filter(Boolean) },
  { url: "/coachs/", freq: "monthly", prio: "0.8", images: equipe },
  { url: "/boxeurs/", freq: "monthly", prio: "0.7", images: [
      img("/img/team/podium-ffboxe.jpg", `Champions de France — la Team Tapia du ${LIEU}`, "Les boxeurs formés au Boxing Center Portet sur le podium."),
      img("/img/team/walkout-gala.jpg", `Soir de gala — ${LIEU}`, "Le walk-out d'un boxeur de la Team Tapia.")] },
  { url: "/galerie/", freq: "weekly", prio: "0.8", images: galerie },
  { url: "/plannings/", freq: "weekly", prio: "0.8", images: [] },
  { url: "/tarifs/", freq: "monthly", prio: "0.9", images: [] },
  { url: "/partenaires/", freq: "monthly", prio: "0.6", images: [
      img("/img/partners/kfc.jpg", "KFC — partenaire du Boxing Center Portet", "KFC, partenaire du club de boxe de Portet-sur-Garonne."),
      img("/img/partners/o2.jpg", "O2 Portet-sur-Garonne — partenaire du club", "O2 Portet-sur-Garonne accompagne le Boxing Center."),
      img("/img/partners/karting-muret.png", "Karting 2 Muret — partenaire du club", "Karting 2 Muret, dont le logo est peint sur la toile du ring.")] },
  { url: "/contact/", freq: "monthly", prio: "0.7", images: [] },
];

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
  `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n` +
  `        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n` +
  PAGES.map((p) =>
    `  <url>\n    <loc>${SITE}${p.url}</loc>\n    <lastmod>${jour}</lastmod>\n` +
    `    <changefreq>${p.freq}</changefreq>\n    <priority>${p.prio}</priority>\n` +
    (p.images.length ? p.images.join("\n") + "\n" : "") +
    ((p.videos || []).length ? p.videos.join("\n") + "\n" : "") +
    `  </url>`
  ).join("\n") +
  `\n</urlset>\n`;

writeFileSync(join(ROOT, "public/sitemap.xml"), xml, "utf8");
const total = PAGES.reduce((n, p) => n + p.images.length, 0);
const vids = PAGES.reduce((n, p) => n + (p.videos || []).length, 0);
console.log(`[sitemap] ${PAGES.length} pages · ${total} images · ${vids} vidéos`);
