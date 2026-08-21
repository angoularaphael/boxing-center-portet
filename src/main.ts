import "./styles/main.css";
import { mountLayout } from "./layout";
import { initThemeSwitch } from "./theme";
import { initScroll, initPageScroll } from "./scroll";
import { initFxOnce, initFxPage } from "./fx";
import { renderPage } from "./pages";
import { initEnterGate } from "./enter";
import { initRouter } from "./router";
import { initCommunity } from "./community";
import { initPlaces } from "./places";
import { mountEmbersOnPageHead } from "./three/embers";
import { initChatbot } from "./chatbot/widget";
import { injectSchema } from "./seo";
import { imgAttrs, initLazyBackgrounds, optUrl } from "./img";
import { liteMode } from "./net";
import { initGuard } from "./guard";
import { DISCIPLINES, TARIFS, GALLERY, AUDIENCES, ENTRAINEURS, VALUES, HERO } from "./data";

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Hero hook lines come from the backoffice; the last word keeps the accent tint. */
function renderHeroHook() {
  const hook = document.querySelector(".hero__hook");
  if (!hook || !HERO.hookLine1) return;
  const words = String(HERO.hookLine2 || "").trim().split(" ");
  const last = words.pop() || "";
  hook.innerHTML = `${escHtml(HERO.hookLine1)}<br>${escHtml(words.join(" "))} <span class="tint">${escHtml(last)}</span>`;
}

function renderHomeGrids() {
  renderHeroHook();
  const reel = document.getElementById("reel-track");
  if (reel) {
    reel.innerHTML = DISCIPLINES.map(
      (d) => `
      <article class="reel__frame">
        <img ${imgAttrs(d.img, "(max-width: 760px) 80vw, 42vw", "4:5")} alt="${d.name} — Boxing Center Portet" loading="lazy" decoding="async" />
        <span class="reel__num">${d.key} / ${String(DISCIPLINES.length).padStart(2, "0")}</span>
        <span class="reel__tag">${d.tag}</span>
        <div class="reel__body">
          <h3 class="reel__name">${d.name}</h3>
          <p class="reel__desc">${d.desc}</p>
        </div>
      </article>`
    ).join("");
    /* LE CARROUSEL EST UN TUNNEL HORIZONTAL. Ses huit cartes sont posées
       côte à côte de 20 à 2 642 px : les quatre dernières sont TRÈS loin hors
       écran. Avec loading="lazy", le navigateur ne les demande donc jamais à
       temps, et la carte qui arrive au centre s'affiche vide — c'est la carte
       « KICK / K1 » sans image que le patron a vue le 21/08.

       On ne les rend pas éagres pour autant : elles pèseraient sur le premier
       chargement. On les déclenche quand la section APPROCHE — une bonne
       hauteur d'écran à l'avance — en repassant loading à eager, ce qui force
       la demande immédiatement. Le tunnel arrive donc plein. */
    const imgs = [...reel.querySelectorAll<HTMLImageElement>("img")];
    const section = reel.closest("section") || reel;
    const charger = () => imgs.forEach((im) => { im.loading = "eager"; im.fetchPriority = "high"; });
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); charger(); } },
        { rootMargin: "900px 0px" });
      io.observe(section);
    } else charger();

    /* ET SURTOUT : on réchauffe pendant le rideau. Le visiteur regarde
       l'entrée pendant une à huit secondes selon sa connexion ; c'est du
       temps de réseau offert. On demande les huit images en priorité BASSE,
       une fois le navigateur au repos : elles ne disputent rien au premier
       écran, mais elles sont en cache quand le visiteur arrive sur le
       carrousel. C'est ce qui rend le défilement fluide au lieu de le faire
       attendre à chaque section. */
    const rechauffer = () => imgs.forEach((im) => {
      if (!im.src) return;
      const p = new Image();
      (p as any).fetchPriority = "low";
      p.decoding = "async";
      /* On recopie srcset ET sizes AVANT src : sans eux, le navigateur
         prendrait le src de repli, c'est-à-dire le JPEG plein format. Mesuré :
         276 Ko au lieu de 44 pour la même image sur un téléphone. L'ordre
         compte — src posé en premier déclencherait la mauvaise requête. */
      if (im.srcset) p.srcset = im.srcset;
      if (im.sizes) p.sizes = im.sizes;
      p.src = im.src;
    });

    /* Les photos des trois tunnels, elles aussi. Ce sont les PREMIÈRES
       qu'on rencontre en descendant — avant le carrousel. Elles sont
       chargées par three.js au moment où la scène se monte ; les demander
       ici les met en cache pour ce moment-là. Même priorité basse. */
    const rechaufferTunnel = () => {
      const p = document.querySelector<HTMLElement>(".portal");
      const liste = p?.dataset.pool
        ? p.dataset.pool.split(",").map((s) => s.trim()).filter(Boolean)
        : ["/img/gym-13.jpg", "/img/gym-12.jpg", "/img/gym-16.jpg", "/img/gym-20.jpg",
           "/img/gym-15.jpg", "/img/gym-09.jpg", "/img/gym-24.jpg", "/img/gym-21.jpg"];
      /* MEMES URL et MEME crossOrigin que three.js, sinon on ne réchauffe
         rien : THREE.TextureLoader pose crossOrigin par défaut, ce qui crée
         une entrée de cache séparée. Constaté en mesure : le fichier partait
         DEUX fois, 221 Ko chacun. Et on vise la même variante que la scène
         (480 sous 760 px), pas le JPEG plein format. */
      const cible = window.innerWidth < 760 ? 480 : 960;
      liste.forEach((u) => {
        const im = new Image();
        im.crossOrigin = "anonymous";
        (im as any).fetchPriority = "low";
        im.decoding = "async";
        im.src = optUrl(u, cible);
      });
    };
    /* On attend que le rideau soit LEVÉ. Lancé pendant, le réchauffage lui
       disputait la bande passante et repoussait l'ouverture. Le visiteur qui
       revient dans la session n'a pas de rideau : pour lui, on part au
       premier moment de repos du navigateur. */
    const lancer = () => {
      rechaufferTunnel();
      const auRepos = (window as any).requestIdleCallback;
      if (typeof auRepos === "function") auRepos(rechauffer, { timeout: 3000 });
      else window.setTimeout(rechauffer, 600);
    };
    /* On part dès que le rideau est PRÊT — pas au clic. Entre les deux, le
       visiteur lit et hésite : une à trois secondes de réseau libre. Avant
       qu'il soit prêt, en revanche, on ne touche à rien : le rechauffage lui
       disputerait la bande passante (mesuré : 7,4 → 8,1 s). */
    if (document.querySelector(".gate")) {
      window.addEventListener("bcp:rideau-pret", lancer, { once: true });
      window.addEventListener("bcp:entre", lancer, { once: true }); // filet, si le rideau saute
    } else lancer();
  }

  const disc = document.getElementById("disc-grid");
  if (disc) {
    disc.innerHTML = DISCIPLINES
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
      (t: any) => `
      <div class="tarif ${t.feature ? "tarif--feature" : ""}" data-reveal>
        ${t.badge ? `<span class="tarif__badge">${t.badge}</span>` : t.feature ? '<span class="tarif__badge">Le plus choisi</span>' : ""}
        <span class="tarif__name">${t.name}</span>
        <span class="tarif__price">${t.old ? `<s class="tarif__old">${t.old}</s> ` : ""}${t.price}<small> ${t.unit}</small></span>
        <p class="tarif__note">${t.note}</p>
        ${t.href ? `<a class="btn ${t.feature ? "btn--primary" : "btn--ghost"} tarif__cta" href="${t.href}" target="_blank" rel="noopener">${t.cta || "Je choisis cette formule"}</a>` : ""}
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
    gal.innerHTML = GALLERY.map((g, i) => {
      const cls = g.span === "wide" ? "shot--wide" : g.span === "tall" ? "shot--tall" : "";
      const sizes = g.span === "wide" ? "(max-width: 760px) 100vw, 66vw" : "(max-width: 760px) 100vw, 33vw";
      // ratio ≈ celui de la cellule (12 col × rangées fixes) → crop serveur intelligent
      const ar = g.span === "wide" ? "16:9" : g.span === "tall" ? "4:5" : "3:2";
      // the first shots are the page’s LCP — fetch them eagerly and first
      const prio = i < 2 ? `loading="eager" fetchpriority="high"` : `loading="lazy"`;
      return `<figure class="shot ${cls}" data-gal-idx="${i}"><img ${imgAttrs(g.src, sizes, ar)} alt="${g.label}" ${prio} decoding="async" />
        <figcaption class="shot__label">${g.label}</figcaption></figure>`;
    }).join("");

    // ── Lightbox ──
    initLightbox(gal);
  }
}

function initLightbox(gal: HTMLElement) {
  let current = 0;
  let overlay: HTMLElement | null = null;
  let touchStartX = 0;
  let touchStartY = 0;

  const open = (idx: number) => {
    current = idx;
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "lightbox";
      overlay.innerHTML = `
        <button class="lightbox__close" aria-label="Fermer" type="button">&times;</button>
        <button class="lightbox__prev" aria-label="Précédent" type="button">&#8249;</button>
        <button class="lightbox__next" aria-label="Suivant" type="button">&#8250;</button>
        <figure class="lightbox__fig">
          <img class="lightbox__img" draggable="false" />
          <figcaption class="lightbox__cap"></figcaption>
        </figure>
        <span class="lightbox__counter"></span>`;
      document.body.appendChild(overlay);

      overlay.querySelector(".lightbox__close")!.addEventListener("click", close);
      overlay.querySelector(".lightbox__prev")!.addEventListener("click", () => go(-1));
      overlay.querySelector(".lightbox__next")!.addEventListener("click", () => go(1));
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });
      // Swipe gestures (mobile)
      overlay.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].clientX;
        touchStartY = e.changedTouches[0].clientY;
      }, { passive: true });
      overlay.addEventListener("touchend", (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
          go(dx < 0 ? 1 : -1);
        }
      }, { passive: true });
    }
    show();
    overlay.classList.add("lightbox--open");
    document.body.style.overflow = "hidden";
  };

  const close = () => {
    if (!overlay) return;
    overlay.classList.remove("lightbox--open");
    document.body.style.overflow = "";
  };

  const go = (dir: number) => {
    current = (current + dir + GALLERY.length) % GALLERY.length;
    show();
  };

  const show = () => {
    if (!overlay) return;
    const g = GALLERY[current];
    const img = overlay.querySelector<HTMLImageElement>(".lightbox__img")!;
    const cap = overlay.querySelector<HTMLElement>(".lightbox__cap")!;
    const counter = overlay.querySelector<HTMLElement>(".lightbox__counter")!;
    img.src = optUrl(g.src, 1440); // variante WebP 1440 — jamais l’original de plusieurs Mo
    img.alt = g.label;
    cap.textContent = g.label;
    counter.textContent = `${current + 1} / ${GALLERY.length}`;
  };

  // Keyboard nav — UNE seule inscription globale, même après navigation douce
  const w = window as any;
  if (w.__bcpLightboxKeys) window.removeEventListener("keydown", w.__bcpLightboxKeys);
  w.__bcpLightboxKeys = (e: KeyboardEvent) => {
    if (!overlay?.classList.contains("lightbox--open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "ArrowRight") go(1);
  };
  window.addEventListener("keydown", w.__bcpLightboxKeys);

  // Click handlers on gallery shots
  gal.addEventListener("click", (e) => {
    const shot = (e.target as Element).closest<HTMLElement>("[data-gal-idx]");
    if (shot) open(Number(shot.dataset.galIdx));
  });
}

// no WebGL scenes on constrained networks (Save-Data / 2G) — the design keeps
// its photo fallbacks; the visitor keeps their data plan.
const hasWebGL = "WebGLRenderingContext" in window && !liteMode;

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

/** Everything bound to the current page’s DOM. Re-run after a soft swap. */
function bootPage() {
  const page = document.body.dataset.page;
  if (page === "home") renderHomeGrids();
  else renderPage(page);
  if (page === "galerie") renderMedia();

  initLazyBackgrounds();
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
      lazy3D(el, () => import("./three/forge"), (m) => {
        m.mountForge(el, ENTRAINEURS, crop as "face" | "body");
        /* La séquence tourne : les cartes de repli peuvent s'effacer. Posé
           ICI et pas plus tôt — sans WebGL, ou si le module échoue, elles
           restent affichées et personne ne voit un trou à la place des
           coachs. C'est exactement ce qui était arrivé. */
        document.documentElement.classList.add("forge-live");
      });
    });
  }

  /* Les braises de l'accueil, posees sur l'en-tete de CHAQUE page.
     Rejoue a chaque changement de page : la navigation douce echange
     `#page`, donc l'ancienne couche part avec et une neuve la remplace. */
  if (hasWebGL) mountEmbersOnPageHead();
  initCommunity();
  /* « Plus que N places » — relancé à chaque page parce que les emplacements
     changent avec le contenu. Le module ne parle que s'il connaît le VRAI
     nombre restant ; sinon il se tait (voir places.ts). */
  void initPlaces();
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
  if (import.meta.env.PROD) initGuard(); // anti-copie (jamais en dev)

  // offline / repeat-visit cache — registered after load so it never competes
  // with the first paint for bandwidth
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
