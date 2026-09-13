/**
 * Le socle commun des pages de discipline : lire le planning EN VIGUEUR
 * (celui que la page Planning affiche), en extraire les créneaux d'une
 * discipline, et relier une carte de l'admin à sa page.
 *
 * Utilisé par generate-disciplines.mjs, sitemap-images.mjs, generate-llms.mjs
 * et vite.config.ts : une seule vérité pour les quatre.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ORIGIN = "https://boxing-center-portet.fr";

export const lireJSON = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
export const contenu = () => lireJSON("src/content.json");
export const pagesDisciplines = () => lireJSON("src/disciplines.json").pages;

/** Normalise un nom de discipline : minuscules, sans accents, sans ponctuation. */
export const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Nom d'une carte de l'admin → chemin de sa page, ou "" si aucune page ne la porte. */
export function lienDiscipline(nom, pages = pagesDisciplines()) {
  const n = norm(nom);
  const p = pages.find((x) => [x.nom, ...(x.noms || [])].some((a) => norm(a) === n));
  return p ? `/activites/${p.slug}/` : "";
}

/** Le planning que la page Planning affiche : le double planning seulement si les nouvelles salles sont ouvertes. */
export function planningEnVigueur(C = contenu()) {
  if (C.nouvellesSalles === true) {
    const jours = new Map();
    for (const src of [C.planning || [], C.planningMma || []]) {
      for (const j of src) {
        if (!jours.has(j.day)) jours.set(j.day, []);
        jours.get(j.day).push(...(j.items || []));
      }
    }
    return [...jours].map(([day, items]) => ({ day, items }));
  }
  return C.planningProvisoire || [];
}

const ORDRE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const JOUR_SCHEMA = {
  Lundi: "Monday", Mardi: "Tuesday", Mercredi: "Wednesday", Jeudi: "Thursday",
  Vendredi: "Friday", Samedi: "Saturday", Dimanche: "Sunday",
};

/** Les créneaux d'une discipline dans le planning en vigueur, jour par jour. */
export function creneaux(page, C = contenu()) {
  const motif = new RegExp(page.creneaux?.motif || "^$", "i");
  const exclure = page.creneaux?.exclure ? new RegExp(page.creneaux.exclure, "i") : null;
  const out = [];
  for (const j of planningEnVigueur(C)) {
    const items = (j.items || [])
      .filter(([, nom]) => motif.test(nom) && !(exclure && exclure.test(nom)))
      .map(([heure, nom]) => ({ heure, nom }));
    if (items.length) out.push({ jour: j.day, items });
  }
  return out.sort((a, b) => ORDRE.indexOf(a.jour) - ORDRE.indexOf(b.jour));
}

/** « le mardi, le mercredi et le jeudi » — ou « » s'il n'y a aucun créneau. */
export function joursEnMots(liste) {
  const j = liste.map((x) => "le " + x.jour.toLowerCase());
  if (!j.length) return "";
  if (j.length === 1) return j[0];
  return j.slice(0, -1).join(", ") + " et " + j[j.length - 1];
}

/** Remplace {jours} ; une phrase qui ne peut pas être remplie perd sa fin proprement. */
export function remplir(texte, jours) {
  if (!texte.includes("{jours}")) return texte;
  if (jours) return texte.replace(/\{jours\}/g, jours);
  return texte.replace(/,?\s*\{jours\}/g, "").replace(/\s+\./g, ".");
}

/** « 12:30 – 13:30 » → ["12:30", "13:30"] */
export const bornes = (heure) => {
  const m = String(heure).match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  return m ? [m[1], m[2]] : null;
};
