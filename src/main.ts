import "./styles/main.css";
import { mountLayout } from "./layout";
import { initThemeSwitch } from "./theme";
import { initScroll, initPageScroll } from "./scroll";
import { initFxOnce, initFxPage } from "./fx";
import { renderPage } from "./pages";
import { initEnterGate } from "./enter";
import { initRouter } from "./router";
import { initCommunity } from "./community";
import { initChatbot } from "./chatbot/widget";
import { injectSchema } from "./seo";
import { DISCIPLINES, TARIFS, GALLERY, CLIPS, AUDIENCES, ENTRAINEURS, VALUES } from "./data";

function renderHomeGrids() {
  const reel = document.getElementById("reel-track");
  if (reel) {
    reel.innerHTML = DISCIPLINES.map(
      (d) => `
      <article class="reel__frame">
        <img src="${d.img}" alt="${d.name} — Boxing Center Portet" loading="lazy" decoding="async" />
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
      return `<figure class="shot ${cls}"><img src="${g.src}" alt="${g.label}" loading="lazy" decoding="async" />
        <figcaption class="shot__label">${g.label}</figcaption></figure>`;
    }).join("");
  }
  const clips = document.getElementById("clips");
  if (clips) {
    clips.innerHTML = CLIPS.map(
      (c) => `<div class="clip"><video src="${c.src}" muted loop playsinline preload="none"></video>
        <span class="clip__label">${c.label}</span></div>`
    ).join("");
  }
}

const hasWebGL = "WebGLRenderingContext" in window;

function lazy3D<T>(el: Element | null, loader: () => Promise<T>, init: (m: T) => void) {
  if (!el) return;
  const run = () => loader().then(init).catch(() => {});
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect();
          run();
        }
      },
      { rootMargin: "240px" }
    );
    io.observe(el);
  } else {
    run();
  }
}

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
      import("./three/world").then((m) => m.mountWorld()).catch(() => {});

      const heroHost = document.getElementById("hero-canvas");
      if (heroHost) import("./three/hero").then((m) => m.initHero(heroHost)).catch(() => {});

      lazy3D(document.querySelector(".showcase__frame"), () => import("./three/showcase"), (m) => {
        const el = document.querySelector<HTMLElement>(".showcase__frame");
        if (el) m.initShowcaseGL(el);
      });

      const ringSec = document.querySelector<HTMLElement>(".ring");
      const ringHost = document.getElementById("ring-canvas");
      if (ringSec && ringHost) {
        lazy3D(ringSec, () => import("./three/ring"), (m) => m.initRing(ringSec, ringHost));
      }
    } else {
      import("./three/world").then((m) => m.destroyWorld()).catch(() => {});
    }
    if (document.querySelector(".portal")) {
      lazy3D(document.querySelector(".portal"), () => import("./three/portal"), (m) => m.initPortals());
    }
    document.querySelectorAll<HTMLElement>(".forge").forEach((el) => {
      const crop = el.dataset.crop === "face" ? "face" : "body";
      lazy3D(el, () => import("./three/forge"), (m) => m.mountForge(el, ENTRAINEURS, crop as "face" | "body"));
    });
  }

  initCommunity();
  injectSchema(document.body.dataset.page);
}

/** Persistent shell — created once; survives soft navigation. */
function bootOnce() {
  initEnterGate();
  mountLayout();
  initThemeSwitch();
  initScroll();
  initFxOnce();
  initChatbot();
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
