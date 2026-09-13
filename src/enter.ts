import { resumeSound, prefMuted } from "./audio";

/**
 * L'entrée — un rideau qui charge, puis se lève tout seul.
 *
 * Il n'y a plus de bouton à cliquer : la barre va jusqu'au bout, le rideau
 * glisse vers le haut, la page apparaît, et le mot-symbole du hero se forme
 * APRÈS, une fois le rideau parti (three/hero.ts démarre son horloge quand
 * html.gated disparaît). Quelqu'un qui arrive de Google sur /tarifs/ n'a donc
 * rien à franchir : il attend la barre, et il est dedans.
 *
 * Le son : un navigateur refuse de jouer un son sans geste du visiteur. Il
 * part donc à son premier clic ou à sa première touche, sauf s'il l'a coupé
 * une fois (préférence gardée) ; le bouton son de l'en-tête le coupe à tout
 * moment. Le pointerdown précède le click : cliquer ce bouton pour couper le
 * son le coupe bien.
 */
const KEY = "bcp-entered";

/* Ce que le rideau attend avant de se lever : ces deux images, les polices et
   la photo du hero. La photo du hero n'est pas dans cette liste — on attend
   l'élément <img> RÉEL de la page, pour attendre la variante que le
   navigateur a lui-même choisie et non une autre. */
/* logo-1100.png plutôt que logo.png : 30 Ko au lieu de 814. Le logo est
   affiché ici à 58 px de haut et échantillonné à 440 px par les particules du
   hero — une source de 3 542 px était 27 fois trop grande.
   logo.png n'est pas supprimé : il reste la référence du JSON-LD. */
const PRELOAD = ["/logo-1100.png", "/img/opt/ring-reference-480.webp"];

/* Le temps de voir la barre pleine avant que le rideau parte : sa largeur
   s'anime en 0,35 s, on la laisse arriver puis on la montre un instant. */
const TENUE_PLEINE = 520;
/* Doit rester égal à la transition de .gate--leve dans main.css. */
const DUREE_LEVER = 950;

export function initEnterGate() {
  if (!prefMuted()) armGestureResume();

  let entered = false;
  try {
    entered = sessionStorage.getItem(KEY) === "1";
  } catch {}
  if (entered) return;

  const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const gate = document.createElement("div");
  gate.className = "gate";
  gate.setAttribute("aria-busy", "true");
  gate.setAttribute("role", "status");
  gate.setAttribute("aria-label", "Chargement du site");
  gate.innerHTML = `
    <div class="gate__spotlight" aria-hidden="true"></div>
    <div class="gate__vignette" aria-hidden="true"></div>
    <div class="gate__ring-host" aria-hidden="true"></div>
    <div class="gate__inner">
      <div class="gate__logo-wrap"><img class="gate__logo" src="/logo-1100.png" width="1100" height="514" decoding="async" alt="Boxing Center" /></div>
      <p class="gate__kicker">Portet-sur-Garonne · 31120</p>
      <div class="gate__loader" aria-hidden="true"><div class="gate__bar"><i></i></div><span class="gate__pct">0%</span></div>
      <p class="gate__phase">Le projecteur s'allume…</p>
    </div>`;
  document.body.appendChild(gate);
  document.documentElement.classList.add("gated");

  let disposeRing: (() => void) | null = null;
  const ringHost = gate.querySelector<HTMLElement>(".gate__ring-host")!;
  if ("WebGLRenderingContext" in window) {
    import("./three/gate-ring").then((m) => {
      disposeRing = m.initGateRing(ringHost);
    }).catch(() => {});
  }

  const bar = gate.querySelector<HTMLElement>(".gate__bar i")!;
  const pctEl = gate.querySelector<HTMLElement>(".gate__pct")!;
  const phaseEl = gate.querySelector<HTMLElement>(".gate__phase")!;
  const PHASES = [
    "Le projecteur s'allume…",
    "Le ring prend forme…",
    "Réglage des lumières…",
  ];

  /* +1 les polices, +1 la photo du hero. */
  const total = PRELOAD.length + 2;
  let done = 0, isReady = false, pi = 0;
  const phaseTimer = window.setInterval(() => { if (!isReady) phaseEl.textContent = PHASES[++pi % PHASES.length]; }, 900);
  const bump = () => {
    done = Math.min(total, done + 1);
    const pct = Math.round((done / total) * 100);
    bar.style.width = pct + "%";
    pctEl.textContent = pct + "%";
    if (done >= total) ready();
  };

  let parti = false;
  const lever = () => {
    try { sessionStorage.setItem(KEY, "1"); } catch {}
    gate.classList.add("gate--leve");
    /* Le site peut réchauffer la suite : le rideau ne dispute plus la bande
       passante. Mesuré : lancé PENDANT le chargement, le réchauffage
       repoussait l'ouverture de 7,4 à 8,1 s. */
    try { window.dispatchEvent(new Event("bcp:entre")); } catch {}
    /* Le rideau parti, et seulement là : la page se débloque et le
       mot-symbole commence à se former sous les yeux du visiteur. */
    const fin = () => {
      if (parti) return;
      parti = true;
      document.documentElement.classList.remove("gated");
      disposeRing?.();
      gate.remove();
    };
    gate.addEventListener("transitionend", (ev) => {
      if (ev.target === gate) fin();
    });
    window.setTimeout(fin, (reduit ? 300 : DUREE_LEVER) + 250); // filet, si transitionend ne vient pas
  };

  const ready = () => {
    if (isReady) return;
    isReady = true;
    clearInterval(phaseTimer);
    bar.style.width = "100%";
    pctEl.textContent = "100%";
    gate.classList.add("gate--ready");
    gate.setAttribute("aria-busy", "false");
    phaseEl.textContent = "Tout est prêt.";
    /* Le rideau est prêt : le site charge DERRIÈRE lui ce qu'on rencontrera
       en descendant — les photos du tunnel et du carrousel. */
    try { window.dispatchEvent(new Event("bcp:rideau-pret")); } catch {}
    window.setTimeout(lever, reduit ? 120 : TENUE_PLEINE);
  };

  PRELOAD.forEach((src) => {
    const im = new Image();
    im.onload = im.onerror = bump;
    im.src = src;
  });
  (document.fonts?.ready || Promise.resolve()).then(bump).catch(bump);

  /* LA PHOTO DU HERO. C'est la première chose que l'œil voit une fois le
     rideau levé ; elle ne doit pas arriver APRÈS. On écoute l'élément réel
     plutôt que de reprécharger une URL : le navigateur choisit sa variante
     dans le srcset, et on veut attendre CELLE-LÀ. */
  const photo = document.querySelector<HTMLImageElement>(".hero__photo");
  if (photo) {
    if (photo.complete) bump();
    else {
      photo.addEventListener("load", bump, { once: true });
      photo.addEventListener("error", bump, { once: true });
    }
  } else bump();

  /* On N'ATTEND PAS le mot-symbole. Mesuré au navigateur sur 4G bridée :
     l'attendre repoussait l'ouverture de 7,4 à 11,8 s, et à 33 s sur 3G. */

  /* LE PLAFOND, compté depuis le DÉBUT DE LA NAVIGATION et non depuis
     l'exécution de ce script : sur 3G, le script arrive avec plusieurs
     secondes de retard, et un setTimeout(4000) posé à ce moment-là ouvrait
     en réalité à 16 s. On vise 6 s après l'arrivée sur la page — plus
     personne ne clique pour entrer, le rideau ne doit donc jamais faire
     attendre — avec au moins 1,2 s de scène pour que l'entrée reste une
     entrée et pas un clignotement. */
  const ecoule = typeof performance !== "undefined" ? performance.now() : 0;
  window.setTimeout(ready, Math.max(1200, 6000 - ecoule));
}

function armGestureResume() {
  const fn = () => {
    window.removeEventListener("pointerdown", fn);
    window.removeEventListener("keydown", fn);
    if (!prefMuted()) resumeSound();
  };
  window.addEventListener("pointerdown", fn, { once: true });
  window.addEventListener("keydown", fn, { once: true });
}
