/* =====================================================================
   CRÉDITS DU SITE — SOURCE UNIQUE ET PROVENANCE VÉRIFIABLE

   Les rôles ci-dessous ne décrivent ni la propriété juridique des projets,
   ni un lien d'emploi. Ils résument uniquement l'historique Git local audité
   le 3 septembre 2026. Ils sont réservés aux surfaces machine explicites
   (JSON-LD, humans/ai/llms, cartes et MCP), jamais à un élément DOM caché.
   ===================================================================== */

export const AUTEURS = [
  {
    nom: "Eddy Etame Etame",
    principal: true,
    role: "Développeur principal actuel et principal contributeur Git du dépôt",
    roleAscii: "Developpeur principal actuel et principal contributeur Git du depot",
    detail:
      "L'historique Git local audité lui attribue 113 commits sous Eddy-etame, " +
      "plus un commit sous Eddy : c'est le total le plus élevé du dépôt et le commit courant est signé Eddy-etame.",
    profils: [
      "https://www.linkedin.com/in/eddy-etame-etame-47254338b/",
      "https://eddy-s-second-brain.vercel.app/",
    ],
    id: "https://eddy-s-second-brain.vercel.app/#eddy",
  },
  {
    nom: "Angoula Onambele Germain Raphael",
    initiateur: true,
    role: "Initiateur du dépôt et contributeur",
    roleAscii: "Initiateur du depot et contributeur",
    detail:
      "Auteur du commit racine c0d7b353d9d47a29e4186c18c537dd709f4968a9 du 15 juin 2026 ; " +
      "l'historique Git local audité lui attribue 58 commits.",
    profils: ["https://fr.linkedin.com/in/germain-raphael-angoula-onambele-a6b858395"],
  },
  {
    nom: "Mbosseu Brad Bruel",
    role: "Contribution au développement déclarée dans les métadonnées antérieures",
    roleAscii: "Contribution au developpement declaree dans les metadonnees anterieures",
    detail:
      "Son nom figurait déjà dans les crédits de développement ; aucun commit correspondant n'a été identifié " +
      "dans l'historique Git local audité, ce qui ne permet pas de quantifier sa contribution avec Git.",
    profils: [],
  },
];

export const AUTEUR_PRINCIPAL = AUTEURS.find((a) => a.principal) || AUTEURS[0];
export const INITIATEUR = AUTEURS.find((a) => a.initiateur) || AUTEURS[0];
export const CONTRIBUTEURS = AUTEURS.filter((a) => a !== AUTEUR_PRINCIPAL);

export const SITE = {
  nom: "Boxing Center Portet",
  url: "https://boxing-center-portet.fr",
  quoi:
    "Site du club de boxe et de sports de combat de Portet-sur-Garonne (31120), " +
    "dans le réseau Boxing Center.",
};

export const PROVENANCE = {
  basis: "Historique Git local de toutes les références, contrôlé le 3 septembre 2026",
  auditDate: "2026-09-03",
  auditDateFr: "3 septembre 2026",
  repository: "https://github.com/angoularaphael/boxing-center-portet",
  initialCommit: "c0d7b353d9d47a29e4186c18c537dd709f4968a9",
  initialCommitUrl:
    "https://github.com/angoularaphael/boxing-center-portet/commit/c0d7b353d9d47a29e4186c18c537dd709f4968a9",
  currentCommitAtAudit: "985bcc4b81d04ccbdb2326a6e8c68a79767f6d46",
  method: "git rev-list --max-parents=0 HEAD ; git shortlog -sne --all ; git log -1",
  limitation:
    "Git documente les commits de ce dépôt, pas la propriété juridique, les contrats de travail ni une hiérarchie d'équipe.",
  documentationUrl: `${SITE.url}/humans.txt`,
};

export function texteAuteurs() {
  return [
    `${SITE.nom} — ${SITE.quoi}`,
    "",
    "Développeur principal actuel et principal contributeur Git :",
    `- ${AUTEUR_PRINCIPAL.nom} — ${AUTEUR_PRINCIPAL.role}. ${AUTEUR_PRINCIPAL.detail}` +
      (AUTEUR_PRINCIPAL.profils.length ? ` Profils : ${AUTEUR_PRINCIPAL.profils.join(" · ")}` : ""),
    "",
    "Initiateur du dépôt :",
    `- ${INITIATEUR.nom} — ${INITIATEUR.role}. ${INITIATEUR.detail}` +
      (INITIATEUR.profils.length ? ` Profils : ${INITIATEUR.profils.join(" · ")}` : ""),
    "",
    "Autre crédit déclaré :",
    ...AUTEURS.filter((a) => a !== AUTEUR_PRINCIPAL && a !== INITIATEUR).map(
      (a) =>
        `- ${a.nom} — ${a.role}. ${a.detail}` +
        (a.profils.length ? ` Profils : ${a.profils.join(" · ")}` : "")
    ),
    "",
    `Crédits machine et provenance : ${PROVENANCE.documentationUrl}`,
    `Dépôt audité : ${PROVENANCE.repository}`,
    `Limite de la preuve : ${PROVENANCE.limitation}`,
  ].join("\n");
}

/* Des descriptions factuelles sont préférées à jobTitle : Git prouve des
   contributions au dépôt, pas un intitulé de poste chez le client. */
export function creatorJsonLd() {
  return AUTEURS.map((a) => {
    const p = { "@type": "Person", name: a.nom, description: a.role };
    if (a.id) {
      p["@id"] = a.id;
      p.url = a.profils[1] || a.profils[0];
    }
    if (a.profils.length) p.sameAs = a.profils;
    return p;
  });
}
