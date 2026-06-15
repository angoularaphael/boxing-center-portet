import { enableSound, resumeSound, prefMuted } from "./audio";

/**
 * « ENTRER DANS L'ARÈNE » — cinematic gate with 3D ring preview.
 * Preloads assets, then the user walks through the ropes into the site.
 */
const KEY = "bcp-entered";

const PRELOAD = [
  "/logo.png",
  "/img/ring-reference.png",
  "/img/gym-01.jpg",
  "/img/gym-12.jpg",
  "/img/gym-21.jpg",
  "/img/disc/boxe-anglaise.webp",
  "/img/disc/muay-thai.webp",
];

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
    <div class="gate__ropes" aria-hidden="true">
      <span class="gate__rope gate__rope--1"></span>
      <span class="gate__rope gate__rope--2"></span>
      <span class="gate__rope gate__rope--3"></span>
      <span class="gate__rope gate__rope--4"></span>
    </div>
    <div class="gate__ring-host" aria-hidden="true"></div>
    <div class="gate__inner">
      <div class="gate__logo-wrap"><img class="gate__logo" src="/logo.png" alt="Boxing Center" width="150" height="71" /></div>
      <p class="gate__kicker">Portet-sur-Garonne · 31120</p>
      <div class="gate__loader" aria-hidden="true"><div class="gate__bar"><i></i></div><span class="gate__pct">0%</span></div>
      <p class="gate__phase">Installation du ring officiel…</p>
      <button class="gate__enter" type="button" disabled>
        <span class="gate__label">Chargement…</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <p class="gate__hint">Expérience sonore · <button class="gate__silent" type="button" disabled>entrer en silence</button></p>
    </div>`;
  document.body.appendChild(gate);
  document.documentElement.classList.add("gated");

  // 3D ring preview
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
    "Installation du ring officiel…",
    "Tension des cordes navy & blanc…",
    "Réglage des projecteurs…",
    "Les gants sont sur le banc…",
    "Le gong va sonner…",
  ];

  const total = PRELOAD.length + 1;
  let done = 0, isReady = false, pi = 0;
  const phaseTimer = window.setInterval(() => { if (!isReady) phaseEl.textContent = PHASES[++pi % PHASES.length]; }, 1000);
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
    phaseEl.textContent = "Prêt. Franchis les cordes.";
    label.textContent = "Entrer sur le ring";
    enterBtn.disabled = false;
    silentBtn.disabled = false;
    try { enterBtn.focus(); } catch {}
  };

  PRELOAD.forEach((src) => {
    const im = new Image();
    im.onload = im.onerror = bump;
    im.src = src;
  });
  (document.fonts?.ready || Promise.resolve()).then(bump).catch(bump);
  window.setTimeout(ready, 7000);

  const enter = (withSound: boolean) => {
    if (!isReady) return;
    try { sessionStorage.setItem(KEY, "1"); } catch {}
    if (withSound) enableSound();
    gate.classList.add("gate--entering");
    document.documentElement.classList.remove("gated");
    window.setTimeout(() => {
      gate.classList.add("gate--out");
      disposeRing?.();
      window.setTimeout(() => gate.remove(), 1200);
    }, 900);
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
