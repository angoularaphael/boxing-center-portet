/**
 * Content source of truth. Editable values live in content.json (managed by the
 * /admin backoffice). This module merges content.json OVER hardcoded defaults,
 * so a missing/partial field always falls back and the site never breaks.
 */
import content from "./content.json";

/**
 * Aperçu instantané du backoffice : ouvert avec ?apercu=1 (même origine que
 * /admin/), le brouillon non publié stocké en localStorage remplace
 * content.json — aucune reconstruction, aucun backend.
 */
export const PREVIEW = (() => {
  try { return new URLSearchParams(location.search).has("apercu"); } catch { return false; }
})();

let C = content as any;
if (PREVIEW) {
  try {
    const draft = JSON.parse(localStorage.getItem("bcp:draft") || "null");
    if (draft && typeof draft === "object" && !Array.isArray(draft)) C = { ...C, ...draft };
  } catch {}
}

export const IMG = "https://boxing-center-portet.fr";

/* ----------------------------- SITE ----------------------------- */
const DEF_SITE = {
  name: "Boxing Center Portet",
  group: "Boxing Center",
  city: "Portet-sur-Garonne",
  baseline: "Boxes pieds, poings, projections.",
  claim: "La salle phare du groupe. 600 m² dédiés aux sports de combat.",
  since: 2016,
  address: { street: "61 route d'Espagne", zip: "31120", city: "Portet-sur-Garonne", country: "FR", lat: 43.5236, lng: 1.4053 },
  phone: "06 87 90 02 16",
  phoneHref: "+33687900216",
  email: "boxingcenterportet@gmail.com",
  hours: "Lun–Sam · 10h00 – 21h30",
  hoursData: [
    { d: "Lundi – Vendredi", h: "10:00 – 21:30" },
    { d: "Samedi", h: "10:00 – 21:30" },
    { d: "Dimanche", h: "Fermé" },
  ],
  federations: ["FFBoxe", "FFKMDA", "FMMAF"],
  surfaces: [
    { label: "Salle de boxe anglaise", value: "1 ring" },
    { label: "Espace combat", value: "1 cage MMA" },
    { label: "Sacs de frappe", value: "24" },
    { label: "Surface totale", value: "600 m²" },
  ],
  social: {
    facebook: "https://www.facebook.com/BoxingCenterToulouse/",
    instagram: "https://www.instagram.com/boxingcenter_toulouse/",
    parent: "https://boxingcenter.fr/",
  },
};
const s = C.site || {};
export const SITE: typeof DEF_SITE = {
  ...DEF_SITE,
  ...s,
  address: { ...DEF_SITE.address, ...(s.address || {}) },
  social: { ...DEF_SITE.social, ...(s.social || {}) },
  hoursData: s.hoursData || DEF_SITE.hoursData,
  federations: s.federations || DEF_SITE.federations,
  surfaces: s.surfaces || DEF_SITE.surfaces,
};

/** Hero copy + per-page SEO (also baked into static HTML by the Vite plugin). */
export const HERO = { hookLine1: "Ici, le sport devient une passion.", hookLine2: "La passion devient un mode de vie.", ...(C.hero || {}) };
export const SEO = C.seo || {};

/* `top: false` = la page reste dans le MENU (et dans le pied de page), mais
   quitte la barre du haut. Onze entrées ne tiennent sur aucun écran : les
   libellés se cassaient en deux lignes et la barre devenait illisible. On
   garde en haut les sept qui portent la décision — découvrir, se rassurer,
   choisir un créneau, voir le prix, venir. */
export const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/premiere-seance/", label: "1re séance" },
  { href: "/activites/", label: "Activités" },
  { href: "/salles/", label: "Le club", top: false },
  { href: "/coachs/", label: "Coachs" },
  { href: "/boxeurs/", label: "Nos Boxeurs", top: false },
  { href: "/partenaires/", label: "Partenaires", top: false },
  { href: "/galerie/", label: "Galerie", top: false },
  { href: "/plannings/", label: "Planning" },
  { href: "/tarifs/", label: "Tarifs" },
  { href: "/contact/", label: "Contact" },
];

export type Discipline = { key: string; name: string; tag: string; desc: string; img: string };
export const DISCIPLINES: Discipline[] = C.disciplines || [];

export type Stat = { value: string; suffix: string; label: string };
export const STATS: Stat[] = C.stats || [];

export type Audience = { tag: string; title: string; desc: string };
export const AUDIENCES: Audience[] = C.audiences || [];

export type Member = { name: string; role: string; kind: string; img: string; initials: string; desc: string };
export const TEAM: Member[] = C.team || [];
export const ENTRAINEURS = TEAM;
export const COACHS = TEAM;

export type Value = { n: string; title: string; desc: string };
export const VALUES: Value[] = C.values || [];

export type Tarif = { name: string; price: string; unit: string; note: string; feature?: boolean };
export const TARIFS: Tarif[] = C.tarifs || [];

export type PlanningDay = { day: string; items: [string, string][] };
export const PLANNING: PlanningDay[] = C.planning || [];
export const PLANNING_MMA: PlanningDay[] = C.planningMma || [];
export const PLANNING_PROVISOIRE: PlanningDay[] = C.planningProvisoire || [];
/* L'interrupteur du patron : false tant que le materiel des nouvelles
   salles n'est pas arrive (livraison par bateau, sans date). Le jour J,
   on passe a true et le double planning remplace le provisoire. */
export const NOUVELLES_SALLES: boolean = C.nouvellesSalles === true;

export type GalleryItem = { src: string; label: string; span?: string };
export const GALLERY: GalleryItem[] = C.gallery || [];

export const CLIPS = [
  { src: "/media/clip-cross.mp4", label: "La préparation physique" },
  { src: "/media/clip-mats.mp4", label: "L'aire de combat" },
  { src: "/media/clip-exterior.mp4", label: "Notre salle · 61 route d'Espagne" },
  { src: "/media/clip-entrance.mp4", label: "L'entrée" },
];

/** Salles du réseau Boxing Center (chatbot salle picker). */
export const BOXING_CENTER_SALLES = [
  { id: "minimes", label: "Les Minimes" },
  { id: "ramonville", label: "Ramonville" },
  { id: "saint-cyprien", label: "Saint-Cyprien" },
  { id: "portet", label: "Portet-sur-Garonne" },
  { id: "etats-unis", label: "États-Unis" },
] as const;

export interface NetworkSalle {
  id: string;
  name: string;
  isFlagship?: boolean;
  address: string;
  phone: string;
  phoneHref: string;
  mapsUrl: string;
  features: string[];
}

export const NETWORK_SALLES: NetworkSalle[] = [
  { id: "portet", name: "Boxing Center Portet-sur-Garonne", isFlagship: true, address: "61 route d'Espagne, 31120 Portet-sur-Garonne", phone: "06 87 90 02 16", phoneHref: "+33687900216", mapsUrl: "https://maps.google.com/?q=61%20route%20d'Espagne%2031120%20Portet-sur-Garonne", features: ["Le club phare", "600 m² dédiés au combat", "Ring de boxe anglaise", "Cage MMA & prépa physique"] },
  { id: "saint-cyprien", name: "Boxing Center Saint-Cyprien", address: "11 rue Sainte-Lucie, 31300 Toulouse", phone: "05 62 24 46 82", phoneHref: "+33562244682", mapsUrl: "https://maps.google.com/?q=11%20rue%20Sainte-Lucie%2031300%20Toulouse", features: ["Proche métro République", "Espace combat complet", "Sacs de frappe", "Cardio training"] },
  { id: "minimes", name: "Boxing Center Minimes", address: "12 rue de Fenouillet, 31200 Toulouse", phone: "05 62 24 46 82", phoneHref: "+33562244682", mapsUrl: "https://maps.google.com/?q=12%20rue%20de%20Fenouillet%2031200%20Toulouse", features: ["Barrière de Paris", "Ring de boxe & cage MMA", "Tatamis de combat", "Préparation physique"] },
  { id: "ramonville", name: "Boxing Center Ramonville", address: "33 rue des Ormes, 31520 Ramonville-Saint-Agne", phone: "05 62 24 46 82", phoneHref: "+33562244682", mapsUrl: "https://maps.google.com/?q=33%20rue%20des%20Ormes%2031520%20Ramonville-Saint-Agne", features: ["Ring de boxe", "Zone sacs de frappe", "Cardio training", "Musculation libre"] },
  { id: "etats-unis", name: "Boxing Center États-Unis", address: "388 avenue des États-Unis, 31200 Toulouse", phone: "05 62 24 46 82", phoneHref: "+33562244682", mapsUrl: "https://maps.google.com/?q=388%20avenue%20des%20%C3%89tats-Unis%2031200%20Toulouse", features: ["1 200 m² (3 zones)", "Grand ring de boxe", "Cage MMA complète", "Sacs de frappe"] },
];

export type ThemeId = "dark" | "light";
