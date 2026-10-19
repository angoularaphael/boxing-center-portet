/** Client-side knowledge for the chatbot: quick-button canned answers (instant,
 *  no API) + a keyword fallback used when the AI endpoint is unavailable. The
 *  full grounding for the LLM lives server-side in api/chat.js.
 *  L’ORDRE VEND : l’étudiant à 36,99 € d’abord, puis l’adulte à 44,99 € ; la séance d’essai à 10 € ne s’affiche
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
 *  boutique lit `#comptant`, `#enfants` (et `#bcp=` du préremplissage) sur le
 *  fragment, un `?utm…` collé après le `#` casserait l’onglet ouvert à l’arrivée.
 *  Un lien qui porte déjà sa requête (`?product=…`) reçoit les UTM après un `&`. */
const SHOP = "https://boutique.boxingcenter.fr";
const UTM = "utm_source=chatbot&utm_medium=bouton&utm_campaign=portet";
const shop = (path: string, hash = "") => `${SHOP}${path}${path.includes("?") ? "&" : "?"}${UTM}${hash}`;
/** Compare deux URL boutique sans leur traçage (voir parseReply). */
export const sansUtm = (u: string) =>
  u.replace(/[?&]utm_[^&#]*/g, "").replace(/^([^?#]*)&/, "$1?").replace(/\/(?=#|$)/, "");

export const ACTIONS: Record<string, ActionDef> = {
  /* Chaque formule va sur SA page d’inscription, pas sur le hub : un
     visiteur convaincu qui tombe sur une grille de formules doit retrouver
     celle dont on venait de lui parler, et une vente se perd exactement là.
     L’étudiant d’abord, l’adulte ensuite : l’ordre de tout le site. */
  etudiant:    { label: "Étudiant · 36,99€ / 4 semaines · carte requise", href: shop("/inscription?product=etudiants-4-semaines") },
  adulte:      { label: "Adulte · 44,99€ / 4 semaines", href: shop("/inscription?product=44-99-4-semaines") },
  comptant:    { label: "Payer comptant · 3, 6 ou 12 mois", href: shop("/abonnements", "#comptant") },
  rappel:      { label: "Être rappelé par un coach", act: "rappel" },
  /* Le 10 € ne s’affiche que sur la page tarifs — et ici, parce que le bot a
     le droit de le proposer pour sauver une vente (ordre du 24/08/2026). */
  essai:       { label: "Je viens essayer · 10€", href: shop("/seance-essai") },
  appeler:     { label: "Appeler le club", href: "tel:+33956653782" },
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
  { label: "Étudiant 36,99€ · Adulte 44,99€", q: "C’est quoi les abonnements sans engagement ?",
    a: "Deux formules sans engagement, réglées toutes les 4 semaines. Étudiant : 36,99 €, carte étudiante requise. Adulte : 44,99 €. Les deux t’ouvrent les 5 salles, tous les cours et la salle en accès libre de 10 h à 21 h 30. La 1re échéance se paie par carte, la suite part en prélèvement sur IBAN, et le badge à 34,99 € est prélevé quelques jours après l’inscription.",
    actions: ["etudiant", "adulte"] },
  { label: "Tarifs & offres", q: "Quels sont les tarifs ?",
    a: "Sans engagement, toutes les 4 semaines : étudiant 36,99 € (carte étudiante requise), adulte 44,99 € — les 5 salles et tous les cours, badge d’accès à 34,99 € prélevé quelques jours après l’inscription. Envie de payer en une fois ? Le comptant, au tarif normal : 3 mois 150 €, 6 mois 250 €, 12 mois 400 €. Enfants/ados 295 € l’année (t-shirt du club inclus), baby boxe 250 €.",
    actions: ["etudiant", "adulte", "comptant"] },
  { label: "Horaires", q: "Quels sont les horaires ?",
    a: "La salle est ouverte du lundi au samedi, 10h00–21h30 (fermé le dimanche).",
    actions: ["planning"] },
  { label: "Adresse & accès", q: "Où êtes-vous situés ?",
    a: "Boxing Center Portet : 61 route d’Espagne, 31120 Portet-sur-Garonne. 600 m² dédiés aux sports de combat — salle de boxe anglaise avec ring, espace combat avec cage MMA. Tél : 09 56 65 37 82.",
    actions: ["contact", "club"] },
  { label: "Disciplines", q: "Quelles disciplines proposez-vous ?",
    a: "Boxe anglaise, kick-boxing, MMA, grappling & jiu-jitsu brésilien, Lady Boxing (100% femmes), préparation physique, baby boxe, boxe éducative et kick-boxing enfants/ados. Un seul pass, toutes disciplines, 5 salles.",
    actions: ["disciplines"] },
  { label: "Inscription", q: "Comment s’inscrire ?",
    a: "Il faut une fiche d’inscription, un certificat médical de non-contre-indication et un moyen de paiement : la carte pour la 1re échéance, puis un IBAN pour les prélèvements. Au tarif étudiant, ta carte étudiante est requise. Le badge à 34,99 € est prélevé quelques jours après l’inscription.",
    actions: ["etudiant", "adulte", "abonnements"] },
  { label: "Coachs", q: "Qui sont les coachs ?",
    a: "Six coachs, une même exigence : Valentin Tapia (Head Coach — loisirs, éducative, compétiteurs), Samuel Pinto (kick/K1, boxe française, Lady Boxing, prépa), Enzo Pioppo et Nicolas Tramaçon (grappling & MMA), Mourad (boxe anglaise enfants/ados) et Ingrid (kick enfants/ados).",
    actions: ["coachs"] },
  { label: "Ma première séance", q: "Comment se passe une première séance ?",
    a: "Tu arrives, tu dis que c’est ta première fois : un coach t’accueille et te fait le tour de la salle. Échauffement avec le groupe, deux gestes techniques à ton rythme, du sac pour finir. Pas de sparring imposé, pas de test. Pour la suite, sans engagement : 36,99 € toutes les 4 semaines si tu es étudiant (carte étudiante requise), 44,99 € sinon.",
    actions: ["premiere", "etudiant", "adulte"] },
  { label: "Privatiser / partenariat", q: "Peut-on privatiser la salle ou devenir partenaire ?",
    a: "Oui ! Événement d’entreprise, team building, partenariat, collaboration : la salle (600 m²) s’ouvre à vos projets — comme pour nos partenaires KFC, O2 et Karting 2 Muret. Décrivez votre projet dans le formulaire dédié, ou appelez le 09 56 65 37 82.",
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
    a: "Une tenue de sport, une bouteille d’eau, une serviette. Tu n’as rien à acheter avant de savoir si ça te plaît — le coach te dira quoi prévoir.",
    actions: ["premiere", "tarifs"] },
];

/* « partenar » et non « partenair » : il faut attraper partenaire(s) ET
   partenariat(s) — le second n'était pas couvert et tombait dans la réponse
   générique. Idem : école/association/b2b routent vers les projets. */
const RULES: [RegExp, number][] = [
  [/privatis|r[ée]serv.*salle|team ?building|partenar|sponsor|collab|entrepri|tournage|m[ée]dia|[ée]cole|associat|b2b|louer|location.*salle/i, 8],
  [/offre|rentr[ée]e|promo|duo|bin[ôo]me|29|sans engagement|[ée]tudiant|adulte/i, 0],
  [/tarif|prix|co[ûu]te|combien|abonn|mensuel|annuel|saison|badge|comptant|paiement|payer/i, 1],
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
    text: "Je peux t’aider sur les abonnements (sans engagement, toutes les 4 semaines : 36,99 € pour un étudiant, carte étudiante requise, 44,99 € pour un adulte), les horaires, les disciplines ou l’inscription. Pose ta question, ou appelle le 09 56 65 37 82.",
    actions: ["etudiant", "adulte", "tarifs"],
  };
}
