/**
 * Immersion layer: custom cursor, magnetic buttons, interaction sound.
 * Split into once (persistent across soft-nav) and per-page (re-bound on swap).
 * Page transitions are owned by the router. Degrades on touch / reduced-motion.
 */
import { tick, bell, soundOn } from "./audio";

const fine = window.matchMedia("(pointer: fine)").matches;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Persistent: the custom cursor (delegated, survives page swaps). */
export function initFxOnce() {
  if (fine && !reduced) initCursor();
}

/** Per-page: rebind to the current DOM after a soft swap. */
export function initFxPage() {
  if (fine && !reduced) {
    initMagnetic();
    initGalleryWarp();
  }
  initSound();
}

/** Photos drift toward the cursor (parallax distortion) like the award sites. */
function initGalleryWarp() {
  document.querySelectorAll<HTMLElement>(".shot").forEach((shot) => {
    const img = shot.querySelector<HTMLElement>("img");
    if (!img) return;
    shot.addEventListener("pointermove", (e) => {
      const r = shot.getBoundingClientRect();
      const mx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const my = (e.clientY - (r.top + r.height / 2)) / r.height;
      img.style.transform = `scale(1.08) translate(${mx * -16}px, ${my * -16}px)`;
    });
    shot.addEventListener("pointerleave", () => (img.style.transform = ""));
  });
}

/* ---------- custom cursor with context labels ---------- */
const CURSOR_LABELS: [string, string][] = [
  [".btn--primary", "Réserver"],
  [".reel__frame", "Voir"],
  [".clip", "Jouer"],
  [".shot", "Voir"],
  [".tarif", "Choisir"],
  [".coach", "Découvrir"],
];

function initCursor() {
  const dot = document.createElement("div");
  dot.className = "cursor";
  dot.setAttribute("aria-hidden", "true");
  dot.innerHTML = '<span class="cursor__label"></span>';
  document.body.appendChild(dot);
  const label = dot.querySelector<HTMLElement>(".cursor__label")!;

  let x = innerWidth / 2,
    y = innerHeight / 2,
    cx = x,
    cy = y;
  window.addEventListener("pointermove", (e) => {
    x = e.clientX;
    y = e.clientY;
    dot.style.opacity = "1";
  });
  const loop = () => {
    cx += (x - cx) * 0.18;
    cy += (y - cy) * 0.18;
    dot.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  };
  loop();

  const interactive = "a, button, .disc, .tarif, .shot, .clip, input, .coach, .reel__frame";
  document.addEventListener("pointerover", (e) => {
    const t = (e.target as HTMLElement).closest(interactive);
    if (!t) return;
    dot.classList.add("cursor--grow");
    let txt = "";
    for (const [sel, l] of CURSOR_LABELS) if (t.matches(sel) || t.closest(sel)) { txt = l; break; }
    label.textContent = txt;
    dot.classList.toggle("cursor--label", !!txt);
  });
  document.addEventListener("pointerout", (e) => {
    if ((e.target as HTMLElement).closest(interactive)) {
      dot.classList.remove("cursor--grow", "cursor--label");
      label.textContent = "";
    }
  });
}

/* ---------- magnetic buttons ---------- */
function initMagnetic() {
  document.querySelectorAll<HTMLElement>(".btn, .icon-btn").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const mx = e.clientX - (r.left + r.width / 2);
      const my = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${mx * 0.25}px, ${my * 0.35}px)`;
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  });
}

/* ---------- interaction sound ---------- */
function initSound() {
  // tactile tick on every interactive card + the primary CTA
  document.querySelectorAll(".disc, .tarif, .aud, .coach, .shot, .value, .btn--primary").forEach((el) =>
    el.addEventListener("pointerenter", () => tick())
  );
  // the bell rings ONCE, as the closing call-to-action arrives — the round's end
  const finalCta = document.querySelector(".cta-block, .page-head");
  if (finalCta) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            if (soundOn()) bell();
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    // only the home closing CTA, not every page-head
    const target = document.querySelector(".cta-block");
    if (target) io.observe(target);
  }
}
