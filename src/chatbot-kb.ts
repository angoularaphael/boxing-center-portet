/** Client-side knowledge for the chatbot: quick-button canned answers (instant,
 *  no API) + a keyword fallback used when the AI endpoint is unavailable. The
 *  full grounding for the LLM lives server-side in api/chat.js.
 *  L’ORDRE VEND : l’offre d’abord, l’essai (offert) en dernier. */
export type Quick = { label: string; q: string; a: string; actions?: string[] };

/** Destinations que le bot propose en BOUTONS sous ses messages.
 *  L’IA ne fournit que des CLÉS de ce catalogue — jamais d’URL libre :
 *  une clé inconnue est ignorée, un lien halluciné est impossible. */
export type ActionDef = { label: string; href: string };
export const ACTIONS: Record<string, ActionDef> = {
  offre:       { label: "Je profite de l’offre · 29€", href: "https://box-plus.vercel.app/abonnements#promo" },
  saison:      { label: "Je prends ma saison · 259€", href: "https://box-plus.vercel.app/abonnements#promo" },
  essai:       { label: "Je réserve mon essai offert", href: "https://box-plus.vercel.app/seance-essai" },
  abonnements: { label: "Voir les abonnements", href: "https://box-plus.vercel.app/abonnements" },
  enfants:     { label: "J’inscris mon enfant", href: "https://box-plus.vercel.app/abonnements#enfants" },
  boutique:    { label: "La boutique du club", href: "https://box-plus.vercel.app/" },
  tarifs:      { label: "Les tarifs en détail", href: "/tarifs/" },
  planning:    { label: "Voir le planning", href: "/plannings/" },
  disciplines: { label: "Découvrir les disciplines", href: "/activites/" },
  coachs:      { label: "Rencontrer les coachs", href: "/coachs/" },
  club:        { label: "Visiter le club", href: "/salles/" },
  galerie:     { label: "Voir la galerie", href: "/galerie/" },
  boxeurs:     { label: "Nos boxeurs", href: "/boxeurs/" },
  partenaires: { label: "Présenter mon projet", href: "/partenaires/" },
  contact:     { label: "Adresse & contact", href: "/contact/" },
};

export const QUICKS: Quick[] = [
  { label: "L’offre 29€", q: "C’est quoi l’offre de la rentrée ?",
    a: "L’offre de la rentrée : 29 € par personne les 4 premières semaines, sans engagement, accès aux 5 salles et à toutes les disciplines. Viens avec ton binôme — ça se prend en ligne en deux minutes. Tu veux qu’un coach te rappelle pour en parler ?",
    actions: ["offre", "tarifs"] },
  { label: "Tarifs & offres", q: "Quels sont les tarifs ?",
    a: "Les offres du moment : rentrée 29 € par personne (4 semaines) · saison 259 € l’année en 4× sans frais · adulte 44 € / étudiants 36 € par 4 semaines · enfants/ados 295 €/an avec t-shirt du club inclus · baby boxe 250 €/an. Badge d’accès : 34 € à l’inscription.",
    actions: ["offre", "abonnements", "tarifs"] },
  { label: "Horaires", q: "Quels sont les horaires ?",
    a: "La salle est ouverte du lundi au samedi, 10h00–21h30 (fermé le dimanche).",
    actions: ["planning"] },
  { label: "Adresse & accès", q: "Où êtes-vous situés ?",
    a: "Boxing Center Portet : 61 route d’Espagne, 31120 Portet-sur-Garonne. 600 m² dédiés aux sports de combat — salle de boxe anglaise avec ring, espace combat avec cage MMA. Tél : 06 87 90 02 16.",
    actions: ["contact", "club"] },
  { label: "Disciplines", q: "Quelles disciplines proposez-vous ?",
    a: "Boxe anglaise, kick-boxing, MMA, grappling & jiu-jitsu brésilien, Lady Boxing (100% femmes), préparation physique, baby boxe, boxe éducative et kick-boxing enfants/ados. Un seul pass, toutes disciplines, 5 salles.",
    actions: ["disciplines", "offre"] },
  { label: "Inscription", q: "Comment s’inscrire ?",
    a: "Il faut : la fiche d’inscription, un certificat médical de non contre-indication à la boxe, un moyen de paiement et le badge à 34 €. Tout se fait en ligne — ou directement à l’accueil.",
    actions: ["abonnements", "offre"] },
  { label: "Coachs", q: "Qui sont les coachs ?",
    a: "Six coachs, une même exigence : Valentin Tapia (Head Coach — loisirs, éducative, compétiteurs), Samuel Pinto (kick/K1, boxe française, Lady Boxing, prépa), Enzo Pioppo et Nicolas Tramaçon (grappling & MMA), Mourad (boxe anglaise enfants/ados) et Ingrid (kick enfants/ados).",
    actions: ["coachs"] },
  { label: "Essai offert", q: "Comment se passe la séance d’essai ?",
    a: "Ta première séance est offerte : toutes disciplines, matériel prêté, sans engagement. Tu viens, tu testes, tu décides. Réserve en un clic — ou passe directement au club, 61 route d’Espagne.",
    actions: ["essai"] },
  { label: "Privatiser / partenariat", q: "Peut-on privatiser la salle ou devenir partenaire ?",
    a: "Oui ! Événement d’entreprise, team building, partenariat, collaboration : la salle (600 m²) s’ouvre à vos projets — comme pour nos partenaires KFC, O2 et Karting 2 Muret. Décrivez votre projet dans le formulaire dédié, ou appelez le 06 87 90 02 16.",
    actions: ["partenaires"] },
];

/* « partenar » et non « partenair » : il faut attraper partenaire(s) ET
   partenariat(s) — le second n'était pas couvert et tombait dans la réponse
   générique. Idem : école/association/b2b routent vers les projets. */
const RULES: [RegExp, number][] = [
  [/privatis|r[ée]serv.*salle|team ?building|partenar|sponsor|collab|entrepri|tournage|m[ée]dia|[ée]cole|associat|b2b|louer|location.*salle/i, 8],
  [/offre|rentr[ée]e|promo|duo|bin[ôo]me|29/i, 0],
  [/tarif|prix|co[ûu]te|combien|abonn|mensuel|annuel|saison|badge|259|paiement|payer/i, 1],
  [/horaire|ouvert|ferm|heure|dimanche|quand/i, 2],
  [/adresse|o[ùu]\b|situ|acc[èe]s|parking|venir|plan\b|route|m[ée]tro|bus/i, 3],
  [/discipline|mma|kick|jjb|jiu|prépa|prepa|cardio|lady|enfant|gamin|fil(le|s)\b|baby|grappling|cours|boxe|sport/i, 4],
  [/inscri|adh[ée]r|certificat|m[ée]dical|document|dossier/i, 5],
  [/coach|entra[îi]neur|prof\b|encadr|[ée]quipe|tapia|pinto|pioppo|trama[çc]on|mourad|ingrid/i, 6],
  [/essai|d[ée]couvr|tester|premi[èe]re|gratuit|offert/i, 7],
];

export function fallbackAnswer(msg: string): { text: string; actions: string[] } {
  for (const [re, i] of RULES) if (re.test(msg)) return { text: QUICKS[i].a, actions: QUICKS[i].actions || [] };
  return {
    text: "Je peux t’aider sur les offres (rentrée 29 € par personne), les horaires, les disciplines ou l’inscription. Pose ta question, ou appelle le 06 87 90 02 16.",
    actions: ["offre", "tarifs"],
  };
}
