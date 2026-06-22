/** Client-side knowledge for the chatbot: quick-button canned answers (instant,
 *  no API) + a keyword fallback used when the AI endpoint is unavailable. The
 *  full grounding for the LLM lives server-side in api/chat.js. */
export type Quick = { label: string; q: string; a: string };

export const QUICKS: Quick[] = [
  { label: "Séance d'essai", q: "Comment se passe la séance d'essai ?",
    a: "La séance d'essai est à 10€, toutes disciplines, sans engagement — le matériel peut être prêté. Réserve depuis la page Contact ou passe au club, 61 route d'Espagne." },
  { label: "Tarifs", q: "Quels sont les tarifs ?",
    a: "Essai : 10€. Mensuel : 36–44€/mois, sans engagement. Annuel : 250–400€/an. Enfants : 280€/an. Badge d'accès : 34€ à l'inscription (pas d'autres frais). Détails sur la page Tarifs." },
  { label: "Horaires", q: "Quels sont les horaires ?",
    a: "La salle est ouverte du lundi au samedi, 10h00–21h30 (fermé le dimanche). Accès illimité 7j/7 pour les abonnés." },
  { label: "Adresse & accès", q: "Où êtes-vous situés ?",
    a: "Boxing Center Portet : 61 route d'Espagne, 31120 Portet-sur-Garonne. 800 m², ring olympique, cage MMA et cross training. Tél : 05 62 24 46 82." },
  { label: "Disciplines", q: "Quelles disciplines proposez-vous ?",
    a: "Boxe anglaise, muay thaï, kick / K1, MMA & grappling, cross training, boxing training (cardio), Lady Punch (100% femmes) et boxe éducative (dès 7 ans). Un seul pass, toutes disciplines." },
  { label: "Inscription", q: "Comment s'inscrire ?",
    a: "Il faut : la fiche d'inscription, un certificat médical de non contre-indication à la boxe, un moyen de paiement (prélèvement, espèces, chèque ou PayPal en ligne) et le badge à 34€. En ligne ou sur place." },
  { label: "Coachs", q: "Qui sont les coachs ?",
    a: "Une équipe de coachs diplômés FFBoxe, FFKMDA et FMMAF : Coach Dadi, Coach Mehdi, Coach Valentin et Coach Brice. Du débutant au compétiteur." },
  { label: "Contact", q: "Comment vous contacter ?",
    a: "Téléphone : 05 62 24 46 82. Email : boxingcenter31@gmail.com. Sur place : 61 route d'Espagne, 31120 Portet-sur-Garonne." },
];

const RULES: [RegExp, number][] = [
  [/essai|d[ée]couvr|tester|premi[èe]re|gratuit/i, 0],
  [/tarif|prix|co[ûu]te|combien|abonn|mensuel|annuel|badge/i, 1],
  [/horaire|ouvert|ferm|heure|dimanche/i, 2],
  [/adresse|o[ùu]\b|situ|acc[èe]s|parking|venir|plan|route/i, 3],
  [/discipline|muay|mma|kick|cross|cardio|lady|enfant|grappling|cours|boxe/i, 4],
  [/inscri|adh[ée]r|certificat|m[ée]dical|document|dossier/i, 5],
  [/coach|entra[îi]neur|prof|encadr|[ée]quipe/i, 6],
  [/contact|t[ée]l[ée]phone|email|mail|num[ée]ro|appel/i, 7],
];
export function fallbackAnswer(msg: string): string {
  for (const [re, i] of RULES) if (re.test(msg)) return QUICKS[i].a;
  return "Je peux t'aider sur les horaires, tarifs, disciplines, l'inscription ou la séance d'essai à 10€. Pose ta question, ou appelle le 05 62 24 46 82.";
}
