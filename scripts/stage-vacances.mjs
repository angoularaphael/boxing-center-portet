/**
 * Le bandeau du stage enfants des vacances — « Les Vacances des Boxeurs », du 26 au 31 octobre 2026,
 * 8–16 ans, au club. Partagé par les générateurs (disciplines, conseils) ; l'accueil le porte à la
 * main, après la phrase sur les créneaux des enfants. Une phrase propre à chaque page, jamais deux
 * fois la même. Il ne rivalise pas avec le billet de la saison (pas d'or) et layout.ts le retire
 * une fois le stage passé.
 */
const STAGE = "https://stage-boxing.vercel.app";
const FLECHE = '<svg class="arrow" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const BANDEAUX = {
  "activites/boxe-educative": {
    surtitre: "Pendant les vacances · 8–16 ans",
    ligne: "Les vacances aussi se passent au club : six jours de boxe anglaise pour les 8–16 ans, du 26 au 31 octobre, deux séances par jour, avec Valentin Tapia et l’équipe du club, et Anna Boullez, boxeuse professionnelle, le mercredi.",
  },
  "activites/kick-boxing-enfants-ados": {
    surtitre: "Une semaine de boxe · 8–16 ans",
    ligne: "Envie de boxer toute une semaine ? Pour la Toussaint, le club ouvre un stage de boxe anglaise de six jours aux 8–16 ans, du 26 au 31 octobre : technique, assauts à thème, piste, et un interclub pour finir.",
  },
  "conseils/equipement-boxe-enfant": {
    surtitre: "Le sac est prêt ? · 8–16 ans",
    ligne: "Gants, protège-dents, casque : c’est le sac du stage de la Toussaint. Six jours de boxe anglaise au club pour les 8–16 ans, du lundi 26 au samedi 31 octobre.",
  },
};

export function bandeauStage(cle) {
  const b = BANDEAUX[cle];
  if (!b) return "";
  const id = `stage-vacances-${cle.split("/").pop()}`;
  return `
  <aside class="stage-vacances" aria-labelledby="${id}" data-stage-vacances>
    <div class="wrap stage-vacances__in">
      <div>
        <span class="eyebrow">${b.surtitre}</span>
        <h2 class="display stage-vacances__titre" id="${id}">Les Vacances des Boxeurs</h2>
        <p class="stage-vacances__ligne">${b.ligne}</p>
        <ul class="stage-vacances__faits">
          <li>26–31 octobre</li>
          <li>8–16 ans</li>
          <li>Débutants acceptés</li>
          <li>Dès 80 €</li>
        </ul>
      </div>
      <div class="stage-vacances__actions">
        <a class="btn btn--primary" href="${STAGE}/stage-enfants-portet" target="_blank" rel="noopener">Voir le stage ${FLECHE}</a>
        <a class="btn btn--ghost" href="${STAGE}/programme?club=portet" target="_blank" rel="noopener">Le programme heure par heure</a>
      </div>
    </div>
  </aside>`;
}
