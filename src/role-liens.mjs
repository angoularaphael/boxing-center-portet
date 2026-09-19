/**
 * Le rôle d'un coach (« Grappling & MMA », « Kick Boxing / K1 · Lady Boxing ») est
 * un texte libre, tenu par l'admin. Ici, on n'en change pas une lettre : on le
 * découpe sur ses séparateurs ( · — & , ) et chaque morceau qui nomme une
 * discipline devient un lien vers la page de la discipline.
 *
 * Un seul module pour tout le monde : vite.config.ts (cartes cuites), la forge 3D
 * (src/three/forge.ts) et les générateurs de pages (scripts/*.mjs).
 */

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* L'ordre fait la priorité : « Kick Enfants/Ados » avant « Kick ». */
const REGLES = [
  [/kick.*(enfant|ados)/, "kick-boxing-enfants-ados"],
  [/baby/, "baby-boxe"],
  [/educative/, "boxe-educative"],
  [/lady/, "lady-boxing"],
  [/grappling|jiu|jjb/, "grappling-jiu-jitsu-bresilien"],
  [/\bmma\b/, "mma"],
  [/prepa|physique/, "preparation-physique"],
  [/kick|\bk-?1\b|boxe francaise/, "kick-boxing"],
  [/boxe (anglaise|loisirs?)|competiteurs?/, "boxe-anglaise"],
];

/* « Boxe Anglaise & Kick Boxing — Enfants / Ados » : le rôle parle des enfants,
   chaque discipline mène donc à sa page enfants. */
const ENFANTS = { "boxe-anglaise": "boxe-educative", "kick-boxing": "kick-boxing-enfants-ados" };

const slugDe = (morceau) => {
  const n = norm(morceau);
  const r = REGLES.find(([rx]) => rx.test(n));
  return r ? r[1] : "";
};

/** Le rôle en morceaux, dans l'ordre, séparateurs compris : [{ t, href? }]. */
export function morceauxRole(role) {
  const parts = String(role || "").split(/(\s+[·—–&]\s+|\s*,\s+)/);
  const slugs = parts.map((p, i) => (i % 2 ? "" : slugDe(p)));
  const enfants = parts.some((p, i) => !(i % 2) && !slugs[i] && /enfant|ados/.test(norm(p)));
  return parts.map((t, i) => {
    let slug = slugs[i] || "";
    if (slug && enfants && ENFANTS[slug]) slug = ENFANTS[slug];
    return slug ? { t, href: `/activites/${slug}/` } : { t };
  }).filter((m) => m.t !== "");
}

const ech = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Le rôle en HTML : même texte, disciplines en liens (classe `role-lien`). */
export function roleHtml(role, sauf = "") {
  return morceauxRole(role)
    .map((m) => (m.href && m.href !== sauf ? `<a class="role-lien" href="${m.href}">${ech(m.t)}</a>` : ech(m.t)))
    .join("");
}
