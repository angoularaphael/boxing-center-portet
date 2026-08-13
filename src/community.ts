/**
 * Community wall — members upload short clips of the club; approved ones appear
 * here. Talks to the BCP community API (see /server). Validates client-side
 * (type / size / duration), shows upload progress, and degrades gracefully to a
 * friendly empty state if the backend isn’t reachable (the static site never
 * breaks). Server-side: every clip is treated + moderated before it’s public.
 */
import { punch, tick, soundOn } from "./audio";

// Same-domain by default: the API is served from the same origin as the site
// (relative /api). Set VITE_COMMUNITY_API (even empty = same origin) to enable;
// leave it unset to disable the wall gracefully (no network, clean console).
const RAW = (import.meta as any).env?.VITE_COMMUNITY_API;
const ENABLED = RAW !== "off"; // on by default (the /api functions ship with the app on Vercel)
const API = RAW && RAW !== "off" ? RAW : ""; // "" → relative same-origin requests (/api/...)

let limits = { maxUploadMb: 80, maxDurationSec: 15 };

// First-line content guard for user-supplied names (server re-checks). FR + EN.
const BADWORDS = [
  "merde", "putain", "connard", "connasse", "salope", "encule", "enculé", "pute", "bite", "couille",
  "nique", "niquer", "ntm", "pd", "pédé", "tapette", "bougnoule", "negro", "nègre", "youpin", "salaud",
  "fuck", "shit", "bitch", "cunt", "nigger", "faggot", "whore", "rape", "nazi", "kys", "porn", "sex",
];
function isInappropriate(s: string) {
  const norm = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ");
  if (/(.)\1{6,}/.test(norm)) return true;          // spam (aaaaaaa)
  if (/https?:|www\.|\.(?:com|fr|net|org|io|co|app|be|ch|eu|uk|us|shop|store|site|xyz|info|biz|link|me|tv)/i.test(s)) return true; // vrais liens seulement
  return BADWORDS.some((w) => new RegExp(`\\b${w}`, "i").test(norm));
}

export function initCommunity() {
  const root = document.getElementById("community");
  if (!root) return;
  const grid = root.querySelector<HTMLElement>("#community-grid");
  const form = root.querySelector<HTMLFormElement>("#community-form");
  const status = root.querySelector<HTMLElement>("#community-status");
  if (!grid || !form || !status) return;

  bindForm(form, status, grid);

  if (!ENABLED) {
    grid.innerHTML = `<p class="community__empty">Le mur de la communauté arrive très bientôt — reviens vite. 🥊</p>`;
    return;
  }

  const hint = form.querySelector<HTMLElement>(".community__hint");
  if (hint) hint.textContent = `Photo ou vidéo · ${limits.maxUploadMb} Mo max · vidéo ${limits.maxDurationSec}s max · validée avant publication`;

  loadItems(grid);
}

async function loadItems(grid: HTMLElement) {
  try {
    const res = await fetch(`${API}/api/community/items`);
    if (!res.ok) throw new Error();
    const { items } = await res.json();
    if (!items?.length) {
      grid.innerHTML = `<p class="community__empty">Sois le premier à poster ta vidéo. Le mur t’attend. 🥊</p>`;
      return;
    }
    const abs = (u: string) => (/^https?:/.test(u) ? u : `${API}${u}`); // Cloudinary URLs are absolute
    grid.innerHTML = items
      .map((it: any) => {
        const cap = `<figcaption class="clip__label">${escapeHtml(it.title || it.caption || "Communauté")}${it.author ? ` · ${escapeHtml(it.author)}` : ""}</figcaption>`;
        const media = it.rtype === "image"
          ? `<img src="${abs(it.src)}" alt="${escapeHtml(it.title || "Communauté")}" loading="lazy" decoding="async" />`
          : `<video src="${abs(it.src)}" poster="${abs(it.poster || "")}" muted loop playsinline preload="none"></video>`;
        return `<figure class="clip community__item">${media}${cap}</figure>`;
      })
      .join("");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) {
          if (v.preload === "none") v.preload = "auto";
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.1, rootMargin: "60px" });

    grid.querySelectorAll<HTMLVideoElement>("video").forEach((v) => {
      io.observe(v);
      const fig = v.closest(".community__item")!;
      fig.addEventListener("pointerenter", () => v.play().catch(() => {}));
      fig.addEventListener("pointerleave", () => v.pause());
    });
  } catch {
    grid.innerHTML = `<p class="community__empty">Le mur de la communauté arrive bientôt — reviens vite. 🥊</p>`;
  }
}

function bindForm(form: HTMLFormElement, status: HTMLElement, grid: HTMLElement) {
  const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const bar = form.querySelector<HTMLElement>(".community__bar > i");

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    const hint = form.querySelector<HTMLElement>('.community__hint');
    if (hint && file) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      hint.textContent = `✓ ${file.name} (${sizeMb} Mo)`;
      hint.style.color = 'var(--accent)';
    } else if (hint) {
      hint.textContent = 'Photo ou vidéo · validée avant publication';
      hint.style.color = '';
    }
  });

  const titleInput = form.querySelector<HTMLInputElement>('input[name="title"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ENABLED) return setStatus(status, "La mise en ligne ouvre très bientôt — reviens vite.", "info");
    const title = (titleInput?.value || "").trim();
    if (title.length < 2) return setStatus(status, "Donne un nom à ta photo ou vidéo.", "err");
    if (isInappropriate(title)) return setStatus(status, "Ce nom n’est pas autorisé. Choisis-en un autre.", "err");
    const author = (form.querySelector<HTMLInputElement>('input[name="author"]')?.value || "").trim();
    if (author && isInappropriate(author)) return setStatus(status, "Ce prénom n’est pas autorisé.", "err");
    const file = fileInput.files?.[0];
    if (!file) return setStatus(status, "Choisis une photo ou une vidéo d’abord.", "err");

    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) return setStatus(status, "Le fichier doit être une photo ou une vidéo.", "err");
    if (file.size > limits.maxUploadMb * 1024 * 1024)
      return setStatus(status, `Trop lourd (max ${limits.maxUploadMb} Mo).`, "err");

    if (file.type.startsWith("video/")) {
      const dur = await videoDuration(file).catch(() => 0);
      if (dur && dur > limits.maxDurationSec + 1)
        return setStatus(status, `Trop longue (max ${limits.maxDurationSec}s) — elle sera coupée à l’envoi.`, "warn");
    }

    submit.disabled = true;
    setStatus(status, "Préparation…", "info");
    try {
      // 0) défi anti-bot : émis par le serveur, résolu ici en un clin d'œil
      const powRes = await fetch(`${API}/api/community/sign`).then((r) => r.json()).catch(() => null);
      const nonce = powRes?.challenge ? await solvePowC(powRes.challenge, powRes.difficulty || 4) : "";
      const website = (form.querySelector<HTMLInputElement>('input[name="website"]')?.value || "");
      const kind = file.type.startsWith("image/") ? "image" : "video";
      const upload = kind === "image" ? await prepareImage(file) : file;

      // 1) ask our function to validate + sign (file bytes never pass through Vercel)
      const signRes = await fetch(`${API}/api/community/sign`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author, website, kind, pow: powRes ? { challenge: powRes.challenge, ts: powRes.ts, sig: powRes.sig, nonce } : {} }),
      });
      /* Un refus doit DIRE pourquoi. L'ancien message générique (« Envoi
         refusé. ») masquait aussi bien un filtre réseau qu'une panne serveur :
         personne, ni le visiteur ni nous, ne pouvait savoir. On lit le message
         du serveur ; à défaut on donne au moins le code HTTP. */
      const sign = await signRes.json().catch(() => ({}));
      if (!signRes.ok) {
        submit.disabled = false;
        const raison = sign.error
          || (signRes.status === 413 ? "Fichier trop lourd."
            : signRes.status === 429 ? "Trop d'envois d'affilée — réessaie dans une minute."
            : signRes.status >= 500 ? `Service momentanément indisponible (erreur ${signRes.status}).`
            : `Envoi refusé (erreur ${signRes.status}).`);
        return setStatus(status, raison, "err");
      }

      // 2) upload the video DIRECTLY to Cloudinary with the signed params
      const fd = new FormData();
      fd.append("file", upload);
      fd.append("api_key", sign.apiKey);
      fd.append("timestamp", String(sign.timestamp));
      fd.append("folder", sign.folder);
      fd.append("tags", sign.tags);
      fd.append("context", sign.context);
      if (sign.allowedFormats) fd.append("allowed_formats", sign.allowedFormats);
      if (sign.transformation) fd.append("transformation", sign.transformation);
      fd.append("signature", sign.signature);

      setStatus(status, "Envoi en cours…", "info");
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType || kind}/upload`);
      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return;
        const pct = Math.round((ev.loaded / ev.total) * 100);
        if (bar) bar.style.width = `${pct}%`;
        setStatus(status, pct < 100 ? `Envoi en cours… ${pct}%` : "Traitement en cours…", "info");
      };
      xhr.onload = () => {
        submit.disabled = false;
        if (bar) bar.style.width = "0%";
        if (xhr.status >= 200 && xhr.status < 300) {
          setStatus(status, "Merci ! Ta publication apparaîtra après validation.", "ok");
          form.reset();
          if (soundOn()) punch();
        } else {
          let msg = "Échec de l’envoi. Réessaie.";
          try { msg = JSON.parse(xhr.responseText)?.error?.message ? `Refusé : ${JSON.parse(xhr.responseText).error.message}` : msg; } catch { /* réponse illisible */ }
          setStatus(status, msg, "err");
        }
      };
      xhr.onerror = () => {
        submit.disabled = false;
        if (bar) bar.style.width = "0%";
        setStatus(status, "Service indisponible pour le moment.", "err");
      };
      if (soundOn()) tick();
      xhr.send(fd);
    } catch {
      submit.disabled = false;
      setStatus(status, "Service indisponible pour le moment.", "err");
    }
  });
}

/* Preuve de travail : trouver un nonce tel que sha256("challenge:nonce")
   commence par N zéros. WebCrypto, ~une fraction de seconde pour un humain. */
async function sha256HexC(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function solvePowC(challenge: string, difficulty: number): Promise<string> {
  const prefix = "0".repeat(difficulty);
  for (let nonce = 0; ; nonce++) {
    if ((await sha256HexC(`${challenge}:${nonce}`)).startsWith(prefix)) return String(nonce);
    if (nonce % 2000 === 1999) await new Promise((r) => setTimeout(r));
  }
}

/* Une photo de téléphone (HEIC, 8 Mo, de travers) devient un WebP léger AVANT
   l'envoi — même recette que le vestiaire : jamais de format refusé par
   Cloudinary, jamais d'upload de 8 Mo sur la 4G de la salle. */
async function prepareImage(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
    const MAX = 2000;
    const s = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * s);
    canvas.height = Math.round(bmp.height * s);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
    if (blob && blob.size < file.size) {
      return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
    }
  } catch { /* format indécodable ici : on tente l'original, Cloudinary convertira */ }
  return file;
}

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
    v.onerror = () => reject();
    v.src = URL.createObjectURL(file);
  });
}

function setStatus(el: HTMLElement, msg: string, kind: "ok" | "err" | "info" | "warn") {
  el.textContent = msg;
  el.dataset.kind = kind;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
