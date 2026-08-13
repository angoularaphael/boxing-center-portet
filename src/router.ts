/**
 * Soft client-side navigation. Internal links fetch the target, swap only
 * #page + the relevant <head> tags, and re-init the page — WITHOUT a full
 * reload. The persistent shell (nav, footer, #world, .grain, cursor, and the
 * ambient <audio>) is never destroyed, so sound plays endlessly across pages.
 * Any failure falls back to a normal navigation, so links can never break.
 */
import { teardownPageScroll, scrollToTop } from "./scroll";
import { thud, soundOn } from "./audio";
import { applyTheme, systemTheme } from "./theme";
import { PREVIEW } from "./data";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let navigating = false;

/**
 * Le chemin RÉELLEMENT affiché à l'écran — qui n'est pas toujours
 * `location.pathname`.
 *
 * C'est la correction du bouton « page précédente » (et d'Alt + ←). Au retour
 * arrière, le navigateur met `location` à jour AVANT d'émettre `popstate` :
 * quand notre écouteur se réveille, `location.pathname` vaut déjà la page
 * demandée. La garde « on ne rejoue pas la page courante » comparait donc
 * l'URL à elle-même, sortait à tous les coups, et rien ne changeait — la barre
 * d'adresse reculait, le contenu restait. Le site paraissait bloqué.
 *
 * On garde donc notre propre repère : ce qui est monté dans le DOM. Il ne
 * bouge qu'après un échange réussi.
 */
let cheminAffiche = location.pathname;

export function initRouter(renderPage: () => void) {
  // Le navigateur restaure la position de défilement au retour arrière et au
  // rechargement : sur un site à navigation douce, ça rouvre une page en plein
  // milieu (souvent le pied de page). On garde la main.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        a.getAttribute("target") === "_blank" ||
        a.hasAttribute("download")
      )
        return;
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return;
      if (PREVIEW) url.searchParams.set("apercu", "1"); // keep the draft preview alive across pages
      e.preventDefault();
      
      if (url.pathname === cheminAffiche) {
        scrollToTop(true);
        return;
      }
      
      go(url, renderPage, true);
    },
    true
  );

  window.addEventListener("popstate", () => go(new URL(location.href), renderPage, false));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function go(url: URL, renderPage: () => void, push: boolean) {
  if (navigating) return;
  if (url.pathname === cheminAffiche) return;   // et NON location.pathname : voir plus haut
  navigating = true;
  const curtain = document.getElementById("curtain");
  if (soundOn()) thud();
  try {
    if (curtain && !reduced) {
      curtain.classList.remove("curtain--out");
      curtain.classList.add("curtain--in");
    }
    const res = await fetch(url.href, { headers: { "X-Soft-Nav": "1" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const next = doc.querySelector("#page");
    const cur = document.getElementById("page");
    if (!next || !cur) throw new Error("missing #page");

    await wait(reduced ? 0 : 520); // let the curtain cover

    teardownPageScroll();
    syncHead(doc);
    cur.replaceWith(next);
    document.body.dataset.page = doc.body.dataset.page || "";
    updateNavActive(url.pathname);
    if (push) history.pushState({}, "", url.href);
    cheminAffiche = url.pathname;   // le DOM porte enfin cette page
    scrollToTop(false);

    renderPage(); // re-render + re-bind everything for the new content
    applyTheme(systemTheme(), false);

    /* On réaffirme le haut de page APRÈS le rendu. Sans ça, un clic depuis le
       pied de page ouvrait la nouvelle page… au pied de page : le contenu et
       les épingles (ScrollTrigger.refresh) ne sont mesurés qu'ici, et cette
       mesure restaure la position précédente. Deux passes suffisent : une après
       le rendu, une après la frame de mise en page. */
    scrollToTop(false);
    requestAnimationFrame(() => scrollToTop(false));

    if (curtain && !reduced) {
      curtain.classList.remove("curtain--in");
      curtain.classList.add("curtain--out");
    }
  } catch {
    window.location.href = url.href; // bullet-proof fallback
    return;
  } finally {
    navigating = false;
  }
}

/** Copy the head tags that matter for SEO/GEO from the fetched document. */
function syncHead(doc: Document) {
  document.title = doc.title;
  const copy = (sel: string, attr: string) => {
    const from = doc.querySelector(sel);
    const to = document.querySelector(sel);
    if (from && to) to.setAttribute(attr, from.getAttribute(attr) || "");
  };
  copy('meta[name="description"]', "content");
  copy('link[rel="canonical"]', "href");
  copy('meta[name="theme-color"]', "content");
  copy('meta[property="og:title"]', "content");
  copy('meta[property="og:description"]', "content");
  copy('meta[property="og:url"]', "content");
  // Données structurées : on échange TOUTES les balises statiques de la page
  // (l'accueil et /premiere-seance/ en ont deux — LocalBusiness + FAQ). On ne
  // touche pas à celles posées par seo.ts (data-seo), qu'injectSchema gère :
  // l'ancien code n'échangeait que la première et faisait disparaître la FAQ.
  document.head
    .querySelectorAll('script[type="application/ld+json"]:not([data-seo])')
    .forEach((s) => s.remove());
  doc.head
    .querySelectorAll('script[type="application/ld+json"]')
    .forEach((s) => document.head.appendChild(s.cloneNode(true)));
}

function updateNavActive(path: string) {
  document.querySelectorAll<HTMLAnchorElement>(".nav__links a, .menu a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    const match = href === path || (href !== "/" && path.startsWith(href));
    if (match) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}
