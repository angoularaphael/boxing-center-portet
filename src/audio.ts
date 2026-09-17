/**
 * Sound design. Real club SFX (punch/bell/whoosh/boom) as Web Audio buffers +
 * a low ambient music bed. Sound is ON by default once the user passes the
 * enter gate (browser autoplay needs that gesture); a MUTE toggle persists.
 */
const MUTE_KEY = "bcp-muted";
let ctx: AudioContext | null = null;
let enabled = false;
const buffers: Record<string, AudioBuffer | null> = {};
const FILES = ["whoosh", "boom", "bell", "punch"];   // ordre du décodage : les coups du mot-symbole d'abord
let ambient: HTMLAudioElement | null = null;
const AMB_GAIN = 0.16;
let fadeTimer: number | undefined;

export function prefMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}
function setPrefMuted(m: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {}
}

function ensure() {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
async function load(name: string) {
  if (name in buffers) return;
  buffers[name] = null;
  try {
    /* déjà en mémoire si le rideau l'a préchargé : pas de réseau */
    const ab = brut[name] || (await (await fetch(`/sfx/${name}.mp3`)).arrayBuffer());
    buffers[name] = await ensure().decodeAudioData(ab.slice(0));
  } catch {
    buffers[name] = null;
  }
}
/* les buffers se décodent au premier moment de repos, jamais dans le geste (INP) */
function chauffer() {
  const warm = () => FILES.forEach(load);
  if ("requestIdleCallback" in window) (window as any).requestIdleCallback(warm, { timeout: 1500 });
  else setTimeout(warm, 200);
}
/* L'ambiance : ambiance.mp3, mono 64 kbit/s (948 Ko). L'ancien fichier
   pesait 3,9 Mo en stéréo 256 kbit/s — pour un fond qu'on met à 16 %. */
const AMBIANCE = "/sfx/ambiance.mp3";
function ensureAmbient(src: string = AMBIANCE) {
  if (!ambient) {
    ambient = new Audio();
    ambient.loop = true;
    ambient.volume = 0;
    ambient.preload = "auto";
    ambient.src = src;
  }
  return ambient;
}

/* PRÉCHARGEMENT SANS GESTE — autorisé par tous les navigateurs : seul le
   JOUER exige un geste, pas le charger. Appelé par le rideau dès qu'il
   apparaît : l'ambiance arrive en mémoire (blob), les coups en brut, et la
   barre du rideau attend l'ambiance. À la levée, tout est prêt à partir
   dans la même image que le mot-symbole. */
let ambiancePrete: Promise<void> | null = null;
const brut: Record<string, ArrayBuffer> = {};
export function preloadSound(): Promise<void> {
  if (ambiancePrete) return ambiancePrete;
  ambiancePrete = fetch(AMBIANCE)
    .then((r) => r.blob())
    .then((b) => { ensureAmbient(URL.createObjectURL(b)).load(); })
    .catch(() => {});
  ["whoosh", "boom", "bell"].forEach((n) =>
    fetch(`/sfx/${n}.mp3`).then((r) => r.arrayBuffer()).then((ab) => { brut[n] = ab; }).catch(() => {})
  );
  return ambiancePrete;
}

/* LA TENTATIVE À LA LEVÉE DU RIDEAU. Il n'y a plus de clic pour entrer, et
   un navigateur refuse un son sans geste… sauf s'il connaît déjà le site
   (Chrome : score d'engagement) ou si la visite vient d'un clic dans la
   session. On essaie : si ça passe, l'ambiance monte pendant que le
   mot-symbole se forme ; sinon on rend `false` et l'appelant arme le
   premier geste. Rien n'est marqué « activé » tant que rien ne joue. */
export async function tryAutoplay(): Promise<boolean> {
  if (enabled) return true;
  if (prefMuted()) return false;
  const a = ensureAmbient();
  try { await a.play(); } catch { return false; }
  enabled = true;
  ensure();
  fadeTo(AMB_GAIN);
  sync();
  chauffer();
  return true;
}

/* LE MOT-SYMBOLE ET LE SON, ENSEMBLE (Eddy, 17/09) : le whoosh quand les
   particules partent, le boom quand le mot se verrouille (hero.ts émet les
   deux). Silencieux si le son n'a pas encore le droit de jouer. */
window.addEventListener("bcp:crest-debut", () => whoosh());
window.addEventListener("bcp:crest", () => boom());
function fadeTo(target: number) {
  const a = ensureAmbient();
  window.clearInterval(fadeTimer);
  fadeTimer = window.setInterval(() => {
    const d = target - a.volume;
    if (Math.abs(d) < 0.01) {
      a.volume = Math.max(0, Math.min(1, target));
      window.clearInterval(fadeTimer);
      if (target === 0) a.pause();
    } else {
      a.volume = Math.max(0, Math.min(1, a.volume + d * 0.12));
    }
  }, 40);
}

function sync() {
  window.dispatchEvent(new CustomEvent("bcp-sound", { detail: enabled }));
}

/** Turn sound on without touching the saved preference (gesture-resume). */
export function resumeSound() {
  if (enabled) return;   // déjà parti à la levée du rideau : rien à refaire
  enabled = true;
  ensure();
  const a = ensureAmbient();
  a.play().then(() => fadeTo(AMB_GAIN)).catch(() => {});
  sync();
  chauffer();
}
/** User explicitly enables sound (enter-with-sound / unmute). */
export function enableSound() {
  setPrefMuted(false);
  resumeSound();
}
export function muteSound() {
  enabled = false;
  setPrefMuted(true);
  fadeTo(0);
  sync();
}
export function setSound(on: boolean) {
  on ? enableSound() : muteSound();
}
export function soundOn() {
  return enabled;
}

function playBuf(name: string, vol: number, rate = 1) {
  const ac = ensure();
  const buf = buffers[name];
  if (!buf) return false;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ac.createGain();
  g.gain.value = vol;
  src.connect(g).connect(ac.destination);
  src.start();
  return true;
}

export function punch() {
  if (!enabled) return;
  if (!playBuf("punch", 0.6, 0.92 + Math.random() * 0.14)) synthThud();
}
export function bell() {
  if (!enabled) return;
  if (!playBuf("bell", 0.4)) synthBell();
}
export function whoosh() {
  if (!enabled) return;
  playBuf("whoosh", 0.32, 1.0 + Math.random() * 0.14);
}
export function boom() {
  if (!enabled) return;
  if (!playBuf("boom", 0.45)) synthThud();
}
export const thud = punch;

/** Tiny tick for hovers (synth — cheap & frequent). */
export function tick() {
  if (!enabled) return;
  const ac = ensure();
  const now = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(440, now);
  o.frequency.exponentialRampToValueAtTime(190, now + 0.05);
  g.gain.setValueAtTime(0.03, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  o.connect(g).connect(ac.destination);
  o.start(now);
  o.stop(now + 0.08);
}

function synthThud() {
  const ac = ensure();
  const now = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(180, now);
  o.frequency.exponentialRampToValueAtTime(46, now + 0.18);
  g.gain.setValueAtTime(0.28, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  o.connect(g).connect(ac.destination);
  o.start(now);
  o.stop(now + 0.34);
}
function synthBell() {
  const ac = ensure();
  const now = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.connect(ac.destination);
  [660, 990, 1320].forEach((f, i) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "triangle";
    o.frequency.value = f;
    g.gain.value = 0.5 / (i + 1);
    o.connect(g).connect(master);
    o.start(now);
    o.stop(now + 1.6);
  });
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.2, now + 0.008);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
}
