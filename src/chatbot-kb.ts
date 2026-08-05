/** Client-side knowledge for the chatbot: quick-button canned answers (instant,
 *  no API) + a keyword fallback used when the AI endpoint is unavailable. The
 *  full grounding for the LLM lives server-side in api/chat.js.
 *  L'ORDRE VEND : l'offre d'abord, l'essai (offert) en dernier. */
export type Quick = { label: string; q: string; a: string };

export const QUICKS: Quick[] = [
  { label: "L'offre 29€", q: "C'est quoi l'offre de la rentrée ?",
    a: "L'offre de la rentrée : 29 € par personne les 4 premières semaines, sans engagement, accès aux 5 salles et à toutes les disciplines. Viens avec ton binôme — ça se prend en ligne sur box-plus.vercel.app/abonnements. Tu veux qu'un coach te rappelle pour en parler ?" },
  { label: "Tarifs & offres", q: "Quels sont les tarifs ?",
    a: "Les offres du moment : rentrée 29 € par personne (4 semaines) · saison 259 € l'année en 4× sans frais · adulte 44 € / étudiants 36 € par 4 semaines · enfants/ados 295 €/an avec t-shirt du club inclus · baby boxe 250 €/an. Badge d'accès : 34 € à l'inscription. Tout est sur box-plus.vercel.app/abonnements." },
  { label: "Horaires", q: "Quels sont les horaires ?",
    a: "La salle est ouverte du lundi au samedi, 10h00–21h30 (fermé le dimanche)." },
  { label: "Adresse & accès", q: "Où êtes-vous situés ?",
    a: "Boxing Center Portet : 61 route d'Espagne, 31120 Portet-sur-Garonne. 600 m² dédiés aux sports de combat — salle de boxe anglaise avec ring, espace combat avec cage MMA. Tél : 06 87 90 02 16." },
  { label: "Disciplines", q: "Quelles disciplines proposez-vous ?",
    a: "Boxe anglaise, kick-boxing, MMA, grappling & jiu-jitsu brésilien, Lady Boxing (100% femmes), préparation physique, baby boxe, boxe éducative et kick-boxing enfants/ados. Un seul pass, toutes disciplines, 5 salles." },
  { label: "Inscription", q: "Comment s'inscrire ?",
    a: "Il faut : la fiche d'inscription, un certificat médical de non contre-indication à la boxe, un moyen de paiement et le badge à 34 €. Tout se fait en ligne sur box-plus.vercel.app ou directement à l'accueil." },
  { label: "Coachs", q: "Qui sont les coachs ?",
    a: "Six coachs, une même exigence : Valentin Tapia (Head Coach — loisirs, éducative, compétiteurs), Samuel Pinto (kick/K1, boxe française, Lady Boxing, prépa), Enzo Pioppo et Nicolas Tramaçon (grappling & MMA), Mourad (boxe anglaise enfants/ados) et Ingrid (kick enfants/ados)." },
  { label: "Essai offert", q: "Comment se passe la séance d'essai ?",
    a: "Ta première séance est offerte : toutes disciplines, matériel prêté, sans engagement. Tu viens, tu testes, tu décides. Réserve sur box-plus.vercel.app/seance-essai ou passe au club, 61 route d'Espagne." },
  { label: "Privatiser / partenariat", q: "Peut-on privatiser la salle ou devenir partenaire ?",
    a: "Oui ! Événement d'entreprise, team building, partenariat, collaboration : la salle (600 m²) s'ouvre à vos projets — comme pour nos partenaires KFC, O2 et Karting 2 Muret. Remplissez le formulaire sur la page Partenaires (menu « Votre projet ») ou appelez le 06 87 90 02 16." },
];

const RULES: [RegExp, number][] = [
  [/privatis|r[ée]serv.*salle|team ?building|partenair|sponsor|collab|entreprise|tournage|m[ée]dia/i, 8],
  [/offre|rentr[ée]e|promo|duo|bin[ôo]me|29/i, 0],
  [/tarif|prix|co[ûu]te|combien|abonn|mensuel|annuel|saison|badge|259/i, 1],
  [/horaire|ouvert|ferm|heure|dimanche/i, 2],
  [/adresse|o[ùu]\b|situ|acc[èe]s|parking|venir|plan|route/i, 3],
  [/discipline|mma|kick|jjb|jiu|prépa|prepa|cardio|lady|enfant|baby|grappling|cours|boxe/i, 4],
  [/inscri|adh[ée]r|certificat|m[ée]dical|document|dossier/i, 5],
  [/coach|entra[îi]neur|prof|encadr|[ée]quipe|tapia|pinto|pioppo|berraho/i, 6],
  [/essai|d[ée]couvr|tester|premi[èe]re|gratuit|offert/i, 7],
];
export function fallbackAnswer(msg: string): string {
  for (const [re, i] of RULES) if (re.test(msg)) return QUICKS[i].a;
  return "Je peux t'aider sur les offres (rentrée 29 € par personne), les horaires, les disciplines ou l'inscription. Pose ta question, ou appelle le 06 87 90 02 16.";
}
