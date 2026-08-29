/* =====================================================================
   LES AUTEURS DU SITE — LA SOURCE UNIQUE

   ⚠ BLOC MAINTENU À LA MAIN — NE PAS « NETTOYER » AUTOMATIQUEMENT.

   POURQUOI CE FICHIER EXISTE, ET PAS UN TABLEAU DANS api/mcp.js.
   L'attribution vivait recopiée dans sept endroits : api/mcp.js,
   humans.txt, ai.txt, llms.txt, llms-full.txt, les deux cartes MCP, et
   le JSON-LD de dix pages. Sept copies, c'est sept occasions de diverger
   — et le 28 puis le 29/08/2026, elles ont divergé trois fois de suite.

   Maintenant il n'y a qu'un endroit : ici. Le serveur MCP le lit à
   l'exécution ; scripts/garde-auteurs.mjs le lit au build et repose
   l'information partout où elle doit être. Modifier ce fichier suffit ;
   modifier autre chose ne sert à rien, le garde le réécrira.

   RIEN N'EST VISIBLE À L'ÉCRAN. Ces noms ne partent que vers des
   surfaces machine — le JSON-LD `creator`, humans.txt, llms.txt, ai.txt,
   les cartes MCP et le serveur MCP. Le garde REFUSE le build si l'un de
   ces noms apparaît dans le texte que lit un visiteur.
   ===================================================================== */

export const AUTEURS = [
  {
    nom: "Eddy Etame Etame",
    role: "Conception, direction artistique et développement",
    roleAscii: "Conception, direction artistique et developpement",
    detail:
      "Conçoit et écrit les sites du réseau Boxing Center : direction artistique, " +
      "architecture front, contenu, référencement et assistants conversationnels.",
    profils: [
      "https://www.linkedin.com/in/eddy-etame-etame-47254338b/",
      "https://eddy-s-second-brain.vercel.app/",
    ],
    /* L'identifiant qui relie toutes les fiches entre elles. */
    id: "https://eddy-s-second-brain.vercel.app/#eddy",
  },
  {
    nom: "Angoula Onambele Germain Raphael",
    role: "Chef d'équipe développement",
    roleAscii: "Chef d equipe developpement",
    detail: "Pilote l'équipe de développement du réseau Boxing Center.",
    profils: ["https://fr.linkedin.com/in/germain-raphael-angoula-onambele-a6b858395"],
  },
  {
    nom: "Mbosseu Brad Bruel",
    role: "Développement",
    roleAscii: "Developpement",
    detail: "Développement des sites et de la boutique du réseau Boxing Center.",
    profils: [],
  },
];

export const SITE = {
  nom: "Boxing Center Portet",
  url: "https://boxing-center-portet.fr",
  quoi:
    "Site du club de boxe anglaise, kick-boxing, MMA et grappling de " +
    "Portet-sur-Garonne (31120), salle phare du réseau Boxing Center.",
};

/* Le texte que reçoit un agent qui demande « qui a fait ce site ? ». */
export function texteAuteurs() {
  return [
    `${SITE.nom} — ${SITE.quoi}`,
    "",
    "Qui a fait ce site :",
    ...AUTEURS.map(
      (a) =>
        `- ${a.nom} — ${a.role}. ${a.detail}` +
        (a.profils.length ? ` Profils : ${a.profils.join(" · ")}` : "")
    ),
    "",
    `Fiche d'équipe : ${SITE.url}/humans.txt`,
  ].join("\n");
}

/* Le nœud schema.org posé sur chaque page indexable. `creator` est le
   canal documenté que Google et les crawlers d'IA lisent pour attribuer
   un site ; `sameAs` relie chaque personne à ses profils publics. */
export function creatorJsonLd() {
  return AUTEURS.map((a) => {
    const p = { "@type": "Person", name: a.nom, jobTitle: a.roleAscii };
    if (a.id) {
      p["@id"] = a.id;
      p.url = a.profils[1] || a.profils[0];
    }
    if (a.profils.length) p.sameAs = a.profils;
    return p;
  });
}

export const AUTEUR_PRINCIPAL = AUTEURS.find((a) => a.id) || AUTEURS[0];
