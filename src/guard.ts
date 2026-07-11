/**
 * Dissuasion contre la copie manuelle du site : menu contextuel, raccourcis
 * "afficher la source" / DevTools, et glisser-déposer des images. Ce sont des
 * barrières de confort, pas des murs (un navigateur reste un client ouvert) —
 * le vrai blocage des scrapers se joue côté edge (middleware.js). Aucune
 * incidence SEO/GEO : les crawlers ne exécutent pas ces gardes et reçoivent
 * le HTML complet.
 */
export function initGuard(): void {
  // champs de formulaire, liens tel/mail : le clic droit reste naturel
  const interactive = (t: EventTarget | null) =>
    t instanceof Element && !!t.closest("input, textarea, select, a[href^='tel:'], a[href^='mailto:']");

  document.addEventListener("contextmenu", (e) => {
    if (!interactive(e.target)) e.preventDefault();
  });

  document.addEventListener("dragstart", (e) => {
    if (e.target instanceof HTMLImageElement) e.preventDefault();
  });

  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    const blocked =
      e.key === "F12" ||
      (e.ctrlKey && !e.shiftKey && (k === "u" || k === "s")) || // source / enregistrer
      (e.ctrlKey && e.shiftKey && (k === "i" || k === "j" || k === "c")); // devtools
    if (blocked) e.preventDefault();
  });

  console.log(
    "%c🥊 Boxing Center Portet",
    "font-size:16px;font-weight:bold;color:#aebccf",
    "\nCe site et son contenu sont protégés. Envie de construire le tien ? Viens plutôt taper le sac : 05 62 24 46 82."
  );
}
