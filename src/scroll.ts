import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { whoosh, soundOn } from "./audio";

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---- persistent scroll engine (created once; survives soft navigation) ---- */
let lenis: Lenis | null = null;
let started = false;
const pageScrollCbs: ((y: number) => void)[] = []; // per-page scroll handlers, cleared on swap
const pageObservers: IntersectionObserver[] = []; // per-page IOs, disconnected on swap
const pageTweens: gsap.core.Tween[] = []; // per-page infinite tweens, killed on swap

const onScroll = (cb: (y: number) => void) => pageScrollCbs.push(cb);
const track = (io: IntersectionObserver) => (pageObservers.push(io), io);
const scrollY = () => (lenis ? (lenis as any).scroll : window.scrollY);

/** Boot the engine once. Returns the persistent Lenis (or null when reduced). */
export function initScroll() {
  if (started) return lenis;
  started = true;
  if (!reduced) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true, lerp: 0.1 });
    lenis.on("scroll", (e: any) => {
      ScrollTrigger.update();
      const y = e.scroll;
      for (const cb of pageScrollCbs) cb(y);
    });
    gsap.ticker.add((t) => lenis!.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.documentElement.classList.add("lenis");
  } else {
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      for (const cb of pageScrollCbs) cb(y);
    }, { passive: true });
  }
  return lenis;
}

/** Wire everything bound to the CURRENT page's DOM. Re-run after a soft swap. */
export function initPageScroll() {
  initNav();
  initLineReveals();
  initHeroIntro();
  initReveals();
  initMarquee();
  initMediaReveal();
  initScrubVideo();
  initParallax();
  initRounds();
  initReel();
  initBgVideos();
  initColorJourney();
  ScrollTrigger.refresh();
  if ((document as any).fonts?.ready) (document as any).fonts.ready.then(() => ScrollTrigger.refresh());
}

/** Tear down everything bound to the outgoing page before a soft swap. */
export function teardownPageScroll() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  pageScrollCbs.length = 0;
  pageObservers.forEach((io) => io.disconnect());
  pageObservers.length = 0;
  pageTweens.forEach((t) => t.kill());
  pageTweens.length = 0;
}

/** All line-by-line headline reveals via a CSS class (no animation-lib
 *  dependency — gsap's yPercent tween proved unreliable on these nodes). */
function initLineReveals() {
  const lines = document.querySelectorAll<HTMLElement>(".reveal-line");
  if (!lines.length) return;
  const io = track(new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.05, rootMargin: "0px 0px -4% 0px" }
  ));
  lines.forEach((l) => io.observe(l));
}

/** Hero supporting text fade-in (line reveals handled by initLineReveals). */
function initHeroIntro() {
  if (reduced) return;
  gsap.fromTo(
    ".hero [data-reveal]",
    { opacity: 0, y: 24 },
    { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08, delay: 0.55 }
  );
}

function initNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  let last = 0;
  onScroll((y) => {
    nav.classList.toggle("scrolled", y > 40);
    nav.classList.toggle("hidden", y > last && y > 400);
    last = y;
  });
}

function initReveals() {
  if (reduced) return;

  // generic fade-up, with optional stagger via [data-reveal-group]
  gsap.utils.toArray<HTMLElement>("[data-reveal-group]").forEach((group) => {
    gsap.to(group.querySelectorAll("[data-reveal]"), {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.08,
      scrollTrigger: { trigger: group, start: "top 82%" },
    });
  });
  gsap.utils
    .toArray<HTMLElement>("[data-reveal]:not([data-reveal-group] [data-reveal])")
    .filter((el) => !el.closest(".hero"))
    .forEach((el) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%" },
      });
    });

  // count-up stats
  gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
    const target = parseFloat(el.dataset.count || "0");
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 1.6,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 90%" },
      onUpdate: () => (el.firstChild!.textContent = Math.round(obj.v).toString()),
    });
  });
}

/** The fight journey: round-cards reveal + whoosh, and a scorecard HUD that
 *  tracks which round you're in as you descend. */
function initRounds() {
  const cards = document.querySelectorAll<HTMLElement>(".round-card");
  const io = track(new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          if (soundOn()) whoosh();
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.45 }
  ));
  cards.forEach((c) => io.observe(c));

  const hud = document.getElementById("hud");
  if (!hud) return;
  const num = hud.querySelector<HTMLElement>(".hud__round");
  const name = hud.querySelector<HTMLElement>(".hud__name");
  const ticks = hud.querySelectorAll<HTMLElement>(".hud__ticks i");
  const sections = document.querySelectorAll<HTMLElement>("[data-round]");
  const io2 = track(new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const r = parseInt((e.target as HTMLElement).dataset.round || "0", 10);
        const shown = Math.min(6, Math.max(0, r));
        if (num) num.textContent = String(shown).padStart(2, "0");
        if (name) name.textContent = (e.target as HTMLElement).dataset.roundName || "";
        ticks.forEach((t, i) => t.classList.toggle("on", i < shown));
        hud.classList.toggle("hud--hidden", r === 0);
      });
    },
    { threshold: 0.5 }
  ));
  sections.forEach((s) => io2.observe(s));
}

/** Continuous scroll parallax — elements drift at different depths so the
 *  page reads like a moving camera, not a stack of static blocks. */
function initParallax() {
  if (reduced) return;
  const items: { el: HTMLElement; amt: number }[] = [];
  const add = (sel: string, amt: number) =>
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => items.push({ el, amt }));
  // NOTE: never parallax elements that also carry [data-reveal] — the reveal
  // tween and the parallax both write transform and fight (shaky entry).
  add(".sec-head .display", 22);
  add(".showcase__frame", 70);
  if (!items.length) return;

  let ticking = false;
  const apply = () => {
    ticking = false;
    const vh = window.innerHeight;
    for (const { el, amt } of items) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const prog = (r.top + r.height / 2 - vh / 2) / vh; // ~ -1..1
      el.style.transform = `translate3d(0, ${(-prog * amt).toFixed(1)}px, 0)`;
    }
  };
  onScroll(() => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(apply);
    }
  });
  apply();
}

/** Photos load grayscale and bleed into colour as they enter the viewport. */
function initMediaReveal() {
  const items = document.querySelectorAll<HTMLElement>(".shot, .feature-img");
  if (!items.length) return;
  const io = track(new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -4% 0px" }
  ));
  items.forEach((el) => io.observe(el));
}

/** Progressive colour journey — the accent travels bronze → gold → red as you
 *  descend (the three theme accents used sequentially). bg/typography stay; only
 *  the accent shifts, so it's stylish, not jarring. WebGL picks it up via a
 *  throttled themechange. Home only — subpages use a single waypoint. */
function initColorJourney() {
  const root = document.documentElement;
  if (document.body.dataset.page !== "home") {
    // subpages use the theme's own (red) accent — clear any home override
    root.style.removeProperty("--accent");
    root.style.removeProperty("--glow");
    window.dispatchEvent(new Event("themechange"));
    return;
  }
  const stops = [
    [226, 35, 26], // red — start (le combat)
    [176, 121, 63], // bronze — a brief warm dip
    [226, 35, 26], // red — end + final CTA
  ];
  let last = 0;
  const apply = (y: number) => {
    const max = root.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    const seg = p * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(seg));
    const t = seg - i;
    const c = [0, 1, 2].map((k) => Math.round(stops[i][k] + (stops[i + 1][k] - stops[i][k]) * t));
    root.style.setProperty("--accent", `rgb(${c[0]},${c[1]},${c[2]})`);
    root.style.setProperty("--glow", `rgba(${c[0]},${c[1]},${c[2]},0.5)`);
    const now = performance.now();
    if (now - last > 140) {
      last = now;
      window.dispatchEvent(new Event("themechange"));
    }
  };
  onScroll(apply);
  apply(scrollY());
}

/** Ambient background videos: only play while on screen (perf + battery). */
function initBgVideos() {
  const vids = document.querySelectorAll<HTMLVideoElement>(".vid-bg video");
  if (!vids.length) return;
  const io = track(new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) {
          if (v.preload === "none") v.preload = "auto";
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      });
    },
    { threshold: 0.05 }
  ));
  vids.forEach((v) => io.observe(v));
}

/** Pinned horizontal disciplines reel — vertical scroll drives the track
 *  sideways (the award-site "horizontal section" inside a sticky pin). */
function initReel() {
  const reel = document.querySelector<HTMLElement>(".reel");
  const trackEl = document.getElementById("reel-track");
  if (!reel || !trackEl) return;
  const update = () => {
    const total = reel.offsetHeight - window.innerHeight;
    if (total <= 0) return;
    const p = Math.min(1, Math.max(0, -reel.getBoundingClientRect().top / total));
    const max = trackEl.scrollWidth - window.innerWidth + 2 * 24;
    trackEl.style.transform = `translate3d(${(-p * Math.max(0, max)).toFixed(1)}px, 0, 0)`;
  };
  onScroll(update);
  window.addEventListener("resize", update);
  setTimeout(update, 600);
  update();
}

/** Scroll-scrubbed footage (Zentry's ScrollyVideo technique): the clip's
 *  playhead is driven by scroll progress through a sticky section — cinematic
 *  slow-motion. Touch/reduced-motion fall back to an autoplay loop. */
function initScrubVideo() {
  const sec = document.querySelector<HTMLElement>(".scrub");
  const v = sec?.querySelector<HTMLVideoElement>("video");
  if (!sec || !v) return;

  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (reduced || touch) {
    v.loop = true;
    v.muted = true;
    v.autoplay = true;
    v.play().catch(() => {});
    return;
  }

  v.pause();
  let dur = 0;
  const setDur = () => (dur = v.duration || 0);
  v.addEventListener("loadedmetadata", setDur);
  setDur();

  onScroll(() => {
    const total = sec.offsetHeight - window.innerHeight;
    const p = Math.min(1, Math.max(0, -sec.getBoundingClientRect().top / total));
    sec.style.setProperty("--p", p.toFixed(3));
    if (dur) {
      try {
        v.currentTime = p * (dur - 0.05);
      } catch {}
    }
  });
}

function initMarquee() {
  gsap.utils.toArray<HTMLElement>(".marquee__track").forEach((el) => {
    const dir = el.dataset.dir === "rev" ? 1 : -1;
    pageTweens.push(gsap.to(el, { xPercent: 50 * dir, duration: 24, ease: "none", repeat: -1 }));
  });
}
