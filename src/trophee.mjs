/* =====================================================================
   BOXING TROPHY 19 — UNE SEULE SOURCE (3 novembre 2026).

   Le vendredi 13 novembre 2026, le Boxing Trophy 19 inaugure la nouvelle
   salle de Portet : gala de boxe anglaise et, première au Trophy, de
   pied-poing ; portes à 19 h, entrée public 10 €. Faits relevés sur le site
   du gala (boxing-trophy-19.vercel.app) le 3 novembre.

   Eddy (3/11) : jusqu'au gala, le Trophy prend la place des offres dans les
   trois raccourcis du site — le billet du héros, la plaque posée au-dessus
   du chat et les boutons de l'assistant. Les cartes tarifs et le bouton de
   la barre ne bougent pas.

   Tout ce qui parle du Trophy lit ICI : piege.ts, l'assistant, api/chat.js,
   et les deux scripts en ligne d'index.html (même date, contrôlée au build
   par scripts/garde-trophee.mjs). À minuit après le gala, chaque raccourci
   revient seul aux offres — sans déploiement.
   ===================================================================== */
export const TROPHEE = {
  nom: "Boxing Trophy 19",
  url: "https://boxing-trophy-19.vercel.app/",
  /** Le jour du gala, au calendrier de Paris. */
  jour: "2026-11-13",
  /** Ouverture des portes. */
  debut: "2026-11-13T19:00:00+01:00",
  /** Minuit après le gala : les offres reprennent leur place. */
  fin: "2026-11-14T00:00:00+01:00",
  entree: "10 €",
};

/** Le Trophy est-il encore à venir (ou en cours, ce soir-là) ? */
export const tropheeActif = (t = Date.now()) => t < Date.parse(TROPHEE.fin);

/** Jours du calendrier de Paris d'ici au gala : 0 le jour même. */
export const joursAvantTrophee = (t = new Date()) => {
  const aujourdhui = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(t);
  return Math.round((Date.parse(TROPHEE.jour) - Date.parse(aujourdhui)) / 864e5);
};

/** Ce que lit le visiteur : « J-10 », puis « Demain », puis « Ce soir ». */
export const compteTrophee = (t = new Date()) => {
  const j = joursAvantTrophee(t);
  return j > 1 ? `J-${j}` : j === 1 ? "Demain" : "Ce soir";
};

/** La phrase de l'assistant : des faits du site du gala, rien d'autre. */
export const REPONSE_TROPHEE =
  "Le Boxing Trophy 19, c’est le gala qui inaugure la nouvelle salle du Boxing Center à Portet-sur-Garonne : " +
  "vendredi 13 novembre 2026, ouverture des portes à 19 h. Combats de boxe anglaise et, pour la première fois au Trophy, " +
  "de pied-poing ; entrée public 10 €. Les combattants débutants et intermédiaires peuvent encore s’inscrire sur le site du gala.";
