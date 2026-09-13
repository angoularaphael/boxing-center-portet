/**
 * Relie une carte de discipline (gérée dans l'admin) à sa page dédiée.
 * La table vient de src/disciplines-liens.json, écrite par
 * scripts/generate-disciplines.mjs : le slug et les noms, rien de plus.
 * Une carte sans page reste une <article>, jamais un lien mort.
 */
import TABLE from "./disciplines-liens.json";

type Lien = { slug: string; nom: string; noms?: string[] };
export const PAGES_DISCIPLINES = TABLE as Lien[];

const norm = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function lienDiscipline(nom: string): string {
  const n = norm(nom);
  const p = PAGES_DISCIPLINES.find((x) => [x.nom, ...(x.noms || [])].some((a) => norm(a) === n));
  return p ? `/activites/${p.slug}/` : "";
}

/** Balise ouvrante d'une carte : un lien quand la page existe. */
export const ouvreCarte = (nom: string) => {
  const h = lienDiscipline(nom);
  return h ? `a href="${h}"` : "article";
};
export const fermeCarte = (nom: string) => (lienDiscipline(nom) ? "a" : "article");
export const voirCarte = (nom: string, cls: string) =>
  lienDiscipline(nom) ? `<span class="${cls}">Voir la discipline <span aria-hidden="true">→</span></span>` : "";
