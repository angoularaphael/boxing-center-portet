/**
 * La navigation du site, écrite une seule fois.
 *
 * Lue par src/data.ts (la barre, le tiroir et le pied de page que monte le
 * JavaScript) ET par vite.config.ts (les mêmes liens, cuits dans le HTML pour
 * les robots et les visiteurs sans JavaScript). Jusqu'au 12/10, vite.config.ts
 * tenait sa propre copie : elle avait perdu « Le club, son histoire » et
 * « Conseils matériel ». Sans JavaScript, /club-de-boxe-portet/ ne recevait que
 * deux liens du site, /conseils/ et ses articles aucun hors de leur propre
 * section, /about/ et /privacy/ aucun (audit du 12/10). Une seule table : les
 * deux pieds de page ne peuvent plus diverger.
 */

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
  /* Eddy, 13/09 : « Nos clubs » dans la navigation de chaque site — ici, la grille du réseau de /salles/, chaque carte vers le vrai site du club */
  { href: "/salles/#network-grid", label: "Nos clubs", top: false },
  /* 17/09 : la page du club pour « club de boxe portet » — pied de page et tiroir, pas la barre */
  { href: "/club-de-boxe-portet/", label: "Le club, son histoire", top: false },
  /* 1er/10 : les conseils du club (matériel) — pied de page et tiroir, pas la barre */
  { href: "/conseils/", label: "Conseils matériel", top: false },
  { href: "/coachs/", label: "Coachs" },
  { href: "/boxeurs/", label: "Nos Boxeurs", top: false },
  { href: "/partenaires/", label: "Partenaires", top: false },
  { href: "/galerie/", label: "Galerie", top: false },
  { href: "/plannings/", label: "Planning" },
  { href: "/tarifs/", label: "Tarifs" },
  { href: "/contact/", label: "Contact" },
];

/* Les deux pages de confiance (celles qu'un agent vérifie avant de recommander
   un commerce) : au bas du pied de page, sur toutes les pages. */
export const PIED_INFOS = [
  { href: "/about/", label: "À propos du site" },
  { href: "/privacy/", label: "Confidentialité" },
];
