/**
 * Sound design. Real club SFX (punch/bell/whoosh/boom) as Web Audio buffers +
 * a low ambient music bed. Sound is ON by default once the user passes the
 * enter gate (browser autoplay needs that gesture); a MUTE toggle persists.
 */
const MUTE_KEY = "bcp-muted";
let ctx: AudioContext | null = null;
let enabled = false;
const buffers: Record<string, AudioBuffer | null> = {};
const FILES = ["punch", "bell", "whoosh", "boom"];
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
    const res = await fetch(`/sfx/${name}.mp3`);
    buffers[name] = await ensure().decodeAudioData(await res.arrayBuffer());
  } catch {
    buffers[name] = null;
  }
}
function ensureAmbient() {
  if (!ambient) {
    ambient = new Audio("/sfx/ambient.mp3");
    ambient.loop = true;
    ambient.volume = 0;
    ambient.preload = "auto";
  }
  return ambient;
}
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
  enabled = true;
  ensure();
  const a = ensureAmbient();
  a.play().then(() => fadeTo(AMB_GAIN)).catch(() => {});
  sync();
  // warm the SFX buffers AFTER the interaction returns (avoids a long task → INP hit)
  const warm = () => FILES.forEach(load);
  if ("requestIdleCallback" in window) (window as any).requestIdleCallback(warm, { timeout: 1500 });
  else setTimeout(warm, 200);
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
