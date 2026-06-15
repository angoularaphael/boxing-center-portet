/**
 * Soft client-side navigation. Internal links fetch the target, swap only
 * #page + the relevant <head> tags, and re-init the page — WITHOUT a full
 * reload. The persistent shell (nav, footer, #world, .grain, cursor, and the
 * ambient <audio>) is never destroyed, so sound plays endlessly across pages.
 * Any failure falls back to a normal navigation, so links can never break.
 */
import { teardownPageScroll } from "./scroll";
import { thud, soundOn } from "./audio";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let navigating = false;

export function initRouter(renderPage: () => void) {
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
      e.preventDefault();
      go(url, renderPage, true);
    },
    true
  );

  window.addEventListener("popstate", () => go(new URL(location.href), renderPage, false));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function go(url: URL, renderPage: () => void, push: boolean) {
  if (navigating) return;
  if (url.pathname === location.pathname) return;
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
    window.scrollTo(0, 0);

    renderPage(); // re-render + re-bind everything for the new content

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
  // replace JSON-LD structured data
  const newLd = doc.querySelector('script[type="application/ld+json"]');
  const curLd = document.querySelector('script[type="application/ld+json"]');
  if (newLd && curLd) curLd.textContent = newLd.textContent;
  else if (newLd) document.head.appendChild(newLd.cloneNode(true));
}

function updateNavActive(path: string) {
  document.querySelectorAll<HTMLAnchorElement>(".nav__links a, .menu a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    const match = href === path || (href !== "/" && path.startsWith(href));
    if (match) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}
