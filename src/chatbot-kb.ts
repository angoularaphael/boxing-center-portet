/** Client-side knowledge for the chatbot: quick-button canned answers (instant,
 *  no API) + a keyword fallback used when the AI endpoint is unavailable. The
 *  full grounding for the LLM lives server-side in api/chat.js.
 *  L’ORDRE VEND : la saison à 259 € d’abord ; la séance d’essai à 10 € ne s’affiche
 *  que sur la page tarifs ; le bot peut la proposer pour sauver une vente. */
export type Quick = { label: string; q: string; a: string; actions?: string[] };

/** Destinations et ACTIONS que le bot propose en BOUTONS sous ses messages.
 *  L’IA ne fournit que des CLÉS de ce catalogue — jamais d’URL libre :
 *  une clé inconnue est ignorée, un lien halluciné est impossible.
 *  `act` = le bot FAIT la tâche dans le chat (rappel d’un coach)
 *  au lieu de renvoyer vers un formulaire — zéro re-saisie pour le visiteur. */
export type ActionDef = { label: string; href?: string; act?: "rappel" };

/** MESURE — chaque lien boutique sortant de l’assistant est tracé, sinon on ne
 *  peut pas prouver que le bot vend. Les UTM se posent AVANT l’ancre : la
 *  boutique lit `#promo` (et `#bcp=` du préremplissage) sur le fragment, un
 *  `?utm…` collé après le `#` casserait l’onglet ouvert à l’arrivée. */
const SHOP = "https://boutique.boxingcenter.fr";
const UTM = "utm_source=chatbot&utm_medium=bouton&utm_campaign=portet";
const shop = (path: string, hash = "") => `${SHOP}${path}?${UTM}${hash}`;
/** Compare deux URL boutique sans leur traçage (voir parseReply). */
export const sansUtm = (u: string) => u.replace(/\?[^#]*/, "").replace(/\/(?=#|$)/, "");

export const ACTIONS: Record<string, ActionDef> = {
  /* Chaque offre va sur SA page, pas sur le hub. Les deux clés pointaient
     sur /abonnements#promo : un visiteur convaincu par la saison arrivait
     devant une grille de sept formules et devait retrouver celle dont on
     venait de lui parler. Une vente se perd exactement là. */
  saison:      { label: "Je profite de l’offre · 259€", href: shop("/offre/259") },
  rappel:      { label: "Être rappelé par un coach", act: "rappel" },
  /* Le 10 € ne s’affiche que sur la page tarifs — et ici, parce que le bot a
     le droit de le proposer pour sauver une vente (ordre du 24/08/2026). */
  essai:       { label: "Je viens essayer · 10€", href: shop("/seance-essai") },
  appeler:     { label: "Appeler le club", href: "tel:+33687900216" },
  abonnements: { label: "Voir les abonnements", href: shop("/abonnements") },
  enfants:     { label: "J’inscris mon enfant", href: shop("/abonnements", "#enfants") },
  boutique:    { label: "La boutique du club", href: shop("/") },
  premiere:    { label: "Comment se passe la 1re séance", href: "/premiere-seance/" },
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
  { label: "L’année · 259€", q: "C’est quoi l’offre de la rentrée ?",
    a: "L’offre de la rentrée : 29 € par personne les 4 premières semaines, sans engagement, accès aux 5 salles et à toutes les disciplines. Tu peux venir accompagné — chacun prend son abonnement à 29 €. Ça se fait en ligne en deux minutes. Tu veux qu’un coach te rappelle pour en parler ?",
    actions: ["saison", "tarifs"] },
  { label: "Tarifs & offres", q: "Quels sont les tarifs ?",
    a: "Les offres du moment : rentrée 29 € par personne (4 semaines) · saison 259 € l’année en 4× sans frais · adulte 44 € / étudiants 36 € par 4 semaines · enfants/ados 295 €/an avec t-shirt du club inclus · baby boxe 250 €/an. Badge d’accès : 34 € à l’inscription.",
    actions: ["saison", "tarifs"] },
  { label: "Horaires", q: "Quels sont les horaires ?",
    a: "La salle est ouverte du lundi au samedi, 10h00–21h30 (fermé le dimanche).",
    actions: ["planning"] },
  { label: "Adresse & accès", q: "Où êtes-vous situés ?",
    a: "Boxing Center Portet : 61 route d’Espagne, 31120 Portet-sur-Garonne. 600 m² dédiés aux sports de combat — salle de boxe anglaise avec ring, espace combat avec cage MMA. Tél : 06 87 90 02 16.",
    actions: ["contact", "club"] },
  { label: "Disciplines", q: "Quelles disciplines proposez-vous ?",
    a: "Boxe anglaise, kick-boxing, MMA, grappling & jiu-jitsu brésilien, Lady Boxing (100% femmes), préparation physique, baby boxe, boxe éducative et kick-boxing enfants/ados. Un seul pass, toutes disciplines, 5 salles.",
    actions: ["disciplines"] },
  { label: "Inscription", q: "Comment s’inscrire ?",
    a: "Il faut : la fiche d’inscription, un certificat médical de non contre-indication à la boxe, un moyen de paiement et le badge à 34 €. Tout se fait en ligne — ou directement à l’accueil.",
    actions: ["abonnements"] },
  { label: "Coachs", q: "Qui sont les coachs ?",
    a: "Six coachs, une même exigence : Valentin Tapia (Head Coach — loisirs, éducative, compétiteurs), Samuel Pinto (kick/K1, boxe française, Lady Boxing, prépa), Enzo Pioppo et Nicolas Tramaçon (grappling & MMA), Mourad (boxe anglaise enfants/ados) et Ingrid (kick enfants/ados).",
    actions: ["coachs"] },
  { label: "Ma première séance", q: "Comment se passe une première séance ?",
    a: "Tu arrives, tu dis que c’est ta première fois : un coach t’accueille, te prête les gants et te fait le tour de la salle. Échauffement avec le groupe, deux gestes techniques à ton rythme, du sac pour finir. Pas de sparring imposé, pas de test. Tenue : t-shirt, short ou legging, baskets propres, bouteille d’eau. Pour t’installer sur l’année, la saison est à 259 € en 4× sans frais.",
    actions: ["premiere", "saison"] },
  { label: "Privatiser / partenariat", q: "Peut-on privatiser la salle ou devenir partenaire ?",
    a: "Oui ! Événement d’entreprise, team building, partenariat, collaboration : la salle (600 m²) s’ouvre à vos projets — comme pour nos partenaires KFC, O2 et Karting 2 Muret. Décrivez votre projet dans le formulaire dédié, ou appelez le 06 87 90 02 16.",
    actions: ["partenaires"] },
  /* AJOUTES LE 24/08/2026. Vu en production : « est-ce qu'il y a la clim ? »
     recevait le message passe-partout, parce qu'aucune regle ne couvrait la
     question. Un repli qui ne repond qu'a neuf questions n'est pas un repli. */
  { label: "Climatisation", q: "Il y a la clim ?",
    a: "Non — aucune de nos salles n’est climatisée, ni chauffée. Elles sont en revanche correctement isolées. On te dit les choses comme elles sont : tu viens en tenue légère l’été, tu t’échauffes moins longtemps l’hiver.",
    actions: ["premiere"] },
  { label: "Douches & vestiaires", q: "Il y a des douches ?",
    a: "Oui : douches individuelles, vestiaires hommes et femmes, et des casiers. Les sanitaires et les vestiaires sont rénovés chaque saison.",
    actions: ["premiere"] },
  { label: "Quoi apporter", q: "Je dois apporter quoi le premier jour ?",
    a: "Une tenue de sport, une bouteille d’eau, une serviette. Les gants et les bandes sont prêtés pour la première séance — tu n’achètes rien avant de savoir si ça te plaît.",
    actions: ["premiere", "tarifs"] },
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
  /* La clim d'abord : « il fait chaud » ne doit pas partir sur « horaires ».
     Le mot « clim » seul est la facon dont les gens l'ecrivent — le declencheur
     de la boutique ne l'avait pas, et le bot a invente une climatisation qui
     n'existe pas. On ne refait pas l'erreur ici. */
  [/\bclim\b|climatis|ventil|il fait (chaud|froid)|temp[ée]rature|chauff[ée]?e?\b/i, 9],
  [/douche|vestiaire|casier|sanitaire/i, 10],
  [/apporter|amener|mat[ée]riel|[ée]quipement|gants?\b|bandes?\b|tenue|affaires|serviette/i, 11],
];

export function fallbackAnswer(msg: string): { text: string; actions: string[] } {
  for (const [re, i] of RULES) if (re.test(msg)) return { text: QUICKS[i].a, actions: QUICKS[i].actions || [] };
  return {
    text: "Je peux t’aider sur les offres (rentrée 29 € par personne), les horaires, les disciplines ou l’inscription. Pose ta question, ou appelle le 06 87 90 02 16.",
    actions: ["saison", "tarifs"],
  };
}
