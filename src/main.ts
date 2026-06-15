import "./styles/main.css";
import { mountLayout } from "./layout";
import { initThemeSwitch } from "./theme";
import { initScroll, initPageScroll } from "./scroll";
import { initFxOnce, initFxPage } from "./fx";
import { renderPage } from "./pages";
import { initEnterGate } from "./enter";
import { initRouter } from "./router";
import { initCommunity } from "./community";
import { DISCIPLINES, TARIFS, GALLERY, CLIPS, AUDIENCES, CHAMPIONS, COACHS, VALUES } from "./data";

function renderHomeGrids() {
  const reel = document.getElementById("reel-track");
  if (reel) {
    reel.innerHTML = DISCIPLINES.map(
      (d) => `
      <article class="reel__frame">
        <img src="${d.img}" alt="${d.name} — Boxing Center Portet" loading="lazy" />
        <span class="reel__num">${d.key} / 08</span>
        <span class="reel__tag">${d.tag}</span>
        <div class="reel__body">
          <h3 class="reel__name">${d.name}</h3>
          <p class="reel__desc">${d.desc}</p>
        </div>
      </article>`
    ).join("");
  }

  const disc = document.getElementById("disc-grid");
  if (disc) {
    disc.innerHTML = DISCIPLINES.slice(0, 8)
      .map(
        (d) => `
      <article class="disc" data-reveal>
        <div class="disc__top"><span class="disc__key">${d.key}</span><span class="disc__tag">${d.tag}</span></div>
        <div>
          <h3 class="disc__name">${d.name}</h3>
          <p class="disc__desc">${d.desc}</p>
        </div>
      </article>`
      )
      .join("");
  }

  const tarifs = document.getElementById("tarifs-grid");
  if (tarifs) {
    tarifs.innerHTML = TARIFS.map(
      (t) => `
      <div class="tarif ${t.feature ? "tarif--feature" : ""}" data-reveal>
        ${t.feature ? '<span class="tarif__badge">Le plus choisi</span>' : ""}
        <span class="tarif__name">${t.name}</span>
        <span class="tarif__price">${t.price}<small> ${t.unit}</small></span>
        <p class="tarif__note">${t.note}</p>
      </div>`
    ).join("");
  }

  const aud = document.getElementById("aud-grid");
  if (aud) {
    aud.innerHTML = AUDIENCES.map(
      (a) => `
      <article class="aud" data-reveal>
        <span class="aud__tag">${a.tag}</span>
        <h3 class="aud__title">${a.title}</h3>
        <p class="aud__desc">${a.desc}</p>
      </article>`
    ).join("");
  }

  const values = document.getElementById("values-grid");
  if (values) {
    values.innerHTML = VALUES.map(
      (v) => `
      <article class="value" data-reveal>
        <span class="value__n">${v.n}</span>
        <h3 class="value__title">${v.title}</h3>
        <p class="value__desc">${v.desc}</p>
      </article>`
    ).join("");
  }
}

function renderMedia() {
  const gal = document.getElementById("gallery");
  if (gal) {
    gal.innerHTML = GALLERY.map((g) => {
      const cls = g.span === "wide" ? "shot--wide" : g.span === "tall" ? "shot--tall" : "";
      return `<figure class="shot ${cls}"><img src="${g.src}" alt="${g.label}" loading="lazy" />
        <figcaption class="shot__label">${g.label}</figcaption></figure>`;
    }).join("");
  }
  const clips = document.getElementById("clips");
  if (clips) {
    clips.innerHTML = CLIPS.map(
      (c) => `<div class="clip"><video src="${c.src}" autoplay muted loop playsinline preload="metadata"></video>
        <span class="clip__label">${c.label}</span></div>`
    ).join("");
  }
}

const hasWebGL = "WebGLRenderingContext" in window;

/** Everything bound to the current page's DOM. Re-run after a soft swap. */
function bootPage() {
  const page = document.body.dataset.page;
  if (page === "home") renderHomeGrids();
  else renderPage(page);
  if (page === "galerie") renderMedia();

  initPageScroll();
  initFxPage();

  if (hasWebGL) {
    if (page === "home") {
      const host = document.getElementById("hero-canvas");
      if (host) import("./three/hero").then((m) => m.initHero(host)).catch(() => {});
      const showcase = document.querySelector<HTMLElement>(".showcase__frame");
      if (showcase) import("./three/showcase").then((m) => m.initShowcaseGL(showcase)).catch(() => {});
      const ringSec = document.querySelector<HTMLElement>(".ring");
      const ringHost = document.getElementById("ring-canvas");
      if (ringSec && ringHost) import("./three/ring").then((m) => m.initRing(ringSec, ringHost)).catch(() => {});
    }
    // portals + forge sequences exist on home (champions) and the coachs page (coaches)
    if (document.querySelector(".portal")) import("./three/portal").then((m) => m.initPortals()).catch(() => {});
    document.querySelectorAll<HTMLElement>(".forge").forEach((el) => {
      const crop = el.dataset.crop === "face" ? "face" : "body";
      const members = el.id === "forge-coachs" ? COACHS : CHAMPIONS;
      import("./three/forge").then((m) => m.mountForge(el, members, crop as "face" | "body")).catch(() => {});
    });
  }

  initCommunity();
}

/** Persistent shell — created once; survives soft navigation. */
function bootOnce() {
  initEnterGate();
  mountLayout();
  initThemeSwitch();
  initScroll();
  initFxOnce();
  if (hasWebGL) import("./three/world").then((m) => m.initWorld()).catch(() => {});
}

function boot() {
  bootOnce();
  bootPage();
  initRouter(bootPage);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
