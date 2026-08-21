import { enableSound, resumeSound, prefMuted } from "./audio";

/**
 * Cinematic entry — 3D ring preview, spotlight, rush into the site on click.
 */
const KEY = "bcp-entered";

/* Ce que le rideau attend AVANT de laisser entrer. Il n'attendait que ces
   deux images et les polices : on entrait donc sur un site dont la photo du
   hero et le mot-symbole n'étaient pas là. La photo du hero n'est pas dans
   cette liste — on attend l'élément <img> RÉEL de la page, pour attendre la
   variante que le navigateur a lui-même choisie et non une autre. */
/* logo-1100.png plutôt que logo.png : 30 Ko au lieu de 814. Le logo est
   affiché ici à 58 px de haut et échantillonné à 440 px par les particules du
   hero — une source de 3 542 px était 27 fois trop grande. Fidélité mesurée :
   écart moyen 0,55/255 à 58 px, et 0,13 % des pixels basculent du côté du
   seuil d'échantillonnage à 440 px, soit ~4 particules sur 3 200.
   logo.png n'est pas supprimé : il reste la référence du JSON-LD. */
const PRELOAD = ["/logo-1100.png", "/img/opt/ring-reference-480.webp"];

export function initEnterGate() {
  let entered = false;
  try {
    entered = sessionStorage.getItem(KEY) === "1";
  } catch {}

  if (entered) {
    if (!prefMuted()) armGestureResume();
    return;
  }

  const gate = document.createElement("div");
  gate.className = "gate";
  gate.setAttribute("aria-busy", "true");
  gate.innerHTML = `
    <div class="gate__spotlight" aria-hidden="true"></div>
    <div class="gate__vignette" aria-hidden="true"></div>
    <div class="gate__ring-host" aria-hidden="true"></div>
    <div class="gate__flash" aria-hidden="true"></div>
    <div class="gate__inner">
      <div class="gate__logo-wrap"><img class="gate__logo" src="/logo-1100.png" width="1100" height="514" decoding="async" alt="Boxing Center" width="150" height="71" /></div>
      <p class="gate__kicker">Portet-sur-Garonne · 31120</p>
      <div class="gate__loader" aria-hidden="true"><div class="gate__bar"><i></i></div><span class="gate__pct">0%</span></div>
      <p class="gate__phase">Le projecteur s'allume…</p>
      <button class="gate__enter" type="button" disabled>
        <span class="gate__label">Chargement…</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <p class="gate__hint">Expérience sonore · <button class="gate__silent" type="button" disabled>entrer en silence</button></p>
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
  const enterBtn = gate.querySelector<HTMLButtonElement>(".gate__enter")!;
  const silentBtn = gate.querySelector<HTMLButtonElement>(".gate__silent")!;
  const label = gate.querySelector<HTMLElement>(".gate__label")!;
  const phaseEl = gate.querySelector<HTMLElement>(".gate__phase")!;
  const PHASES = [
    "Le projecteur s'allume…",
    "Le ring prend forme…",
    "Réglage des lumières…",
    "Tout est prêt.",
  ];

  /* +1 les polices, +1 la photo du hero, +1 le mot-symbole. */
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
  const ready = () => {
    if (isReady) return;
    isReady = true;
    clearInterval(phaseTimer);
    bar.style.width = "100%";
    pctEl.textContent = "100%";
    gate.classList.add("gate--ready");
    gate.setAttribute("aria-busy", "false");
    phaseEl.textContent = "Monte sur le ring.";
    label.textContent = "Entrer sur le ring";
    enterBtn.disabled = false;
    silentBtn.disabled = false;
    try { enterBtn.focus(); } catch {}
    /* LE RIDEAU EST PRÊT, mais le visiteur n'a pas encore cliqué. Il lit
       « Monte sur le ring » et appuie une à trois secondes plus tard : c'est
       du temps de réseau offert. Le site s'en sert pour charger DERRIÈRE le
       rideau ce qu'on rencontrera en descendant — les photos du tunnel et
       du carrousel. Émis ici et pas dans enter() : attendre le clic, c'est
       jeter ces secondes. Et pas plus tôt non plus — avant d'être prêt, le
       rideau a besoin de toute la bande passante pour lui. */
    try { window.dispatchEvent(new Event("bcp:rideau-pret")); } catch {}
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
     dans le srcset, et on veut attendre CELLE-LÀ, pas en télécharger une
     seconde pour rien. */
  const photo = document.querySelector<HTMLImageElement>(".hero__photo");
  if (photo) {
    if (photo.complete) bump();
    else {
      photo.addEventListener("load", bump, { once: true });
      photo.addEventListener("error", bump, { once: true });
    }
  } else bump();

  /* On N'ATTEND PAS le mot-symbole. Mesuré au navigateur sur 4G bridée :
     l'attendre repoussait l'ouverture de 7,4 à 11,8 s, et à 33 s sur 3G —
     parce qu'il traîne le module 3D et les 814 Ko du logo derrière lui. Or
     la photo du hero, elle, était déjà là dans les deux cas. On attend donc
     ce qui se voit tout de suite, pas ce qui coûte cher. */

  /* LE PLAFOND, compté depuis le DÉBUT DE LA NAVIGATION et non depuis
     l'exécution de ce script. La nuance n'est pas théorique : sur 3G, le
     script lui-même arrive avec plusieurs secondes de retard, et un
     setTimeout(4000) posé à ce moment-là ouvrait en réalité à 16 s. On vise
     8 s après l'arrivée sur la page, avec au moins 1,2 s de scène pour que
     l'entrée reste une entrée et pas un clignotement. */
  const ecoule = typeof performance !== "undefined" ? performance.now() : 0;
  window.setTimeout(ready, Math.max(1200, 8000 - ecoule));

  const enter = (withSound: boolean) => {
    if (!isReady) return;
    try { sessionStorage.setItem(KEY, "1"); } catch {}
    if (withSound) enableSound();
    gate.classList.add("gate--entering");
    /* Le site peut maintenant réchauffer la suite : le rideau ne dispute
       plus la bande passante. Mesuré : lancé PENDANT le rideau, le
       réchauffage repoussait l'ouverture de 7,4 à 8,1 s. */
    try { window.dispatchEvent(new Event("bcp:entre")); } catch {}
    document.documentElement.classList.remove("gated");
    window.setTimeout(() => {
      gate.classList.add("gate--out");
      disposeRing?.();
      window.setTimeout(() => gate.remove(), 1100);
    }, 750);
  };

  enterBtn.addEventListener("click", () => enter(true));
  silentBtn.addEventListener("click", (e) => { e.stopPropagation(); enter(false); });
}

function armGestureResume() {
  const fn = () => {
    resumeSound();
    window.removeEventListener("pointerdown", fn);
    window.removeEventListener("keydown", fn);
  };
  window.addEventListener("pointerdown", fn, { once: true });
  window.addEventListener("keydown", fn, { once: true });
}
