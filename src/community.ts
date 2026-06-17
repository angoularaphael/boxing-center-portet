/**
 * Community wall — members upload short clips of the club; approved ones appear
 * here. Talks to the BCP community API (see /server). Validates client-side
 * (type / size / duration), shows upload progress, and degrades gracefully to a
 * friendly empty state if the backend isn't reachable (the static site never
 * breaks). Server-side: every clip is treated + moderated before it's public.
 */
import { punch, tick, soundOn } from "./audio";

// Same-domain by default: the API is served from the same origin as the site
// (relative /api). Set VITE_COMMUNITY_API (even empty = same origin) to enable;
// leave it unset to disable the wall gracefully (no network, clean console).
const RAW = (import.meta as any).env?.VITE_COMMUNITY_API;
const ENABLED = RAW !== "off"; // on by default (the /api functions ship with the app on Vercel)
const API = RAW && RAW !== "off" ? RAW : ""; // "" → relative same-origin requests (/api/...)

let limits = { maxUploadMb: 80, maxDurationSec: 30 };

// First-line content guard for user-supplied names (server re-checks). FR + EN.
const BADWORDS = [
  "merde", "putain", "connard", "connasse", "salope", "encule", "enculé", "pute", "bite", "couille",
  "nique", "niquer", "ntm", "pd", "pédé", "tapette", "bougnoule", "negro", "nègre", "youpin", "salaud",
  "fuck", "shit", "bitch", "cunt", "nigger", "faggot", "whore", "rape", "nazi", "kys", "porn", "sex",
];
function isInappropriate(s: string) {
  const norm = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ");
  if (/(.)\1{6,}/.test(norm)) return true;          // spam (aaaaaaa)
  if (/https?:|www\.|\.[a-z]{2,}\/?/i.test(s)) return true; // links
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
  if (hint) hint.textContent = `Vidéo (mp4/mov) · ${limits.maxUploadMb} Mo max · ${limits.maxDurationSec}s max · validée avant publication`;

  loadItems(grid);
}

async function loadItems(grid: HTMLElement) {
  try {
    const res = await fetch(`${API}/api/community/items`);
    if (!res.ok) throw new Error();
    const { items } = await res.json();
    if (!items?.length) {
      grid.innerHTML = `<p class="community__empty">Sois le premier à poster ta vidéo. Le mur t'attend. 🥊</p>`;
      return;
    }
    const abs = (u: string) => (/^https?:/.test(u) ? u : `${API}${u}`); // Cloudinary URLs are absolute
    grid.innerHTML = items
      .map(
        (it: any) => `
        <figure class="clip community__item">
          <video src="${abs(it.src)}" poster="${abs(it.poster || "")}" muted loop playsinline preload="none"></video>
          <figcaption class="clip__label">${escapeHtml(it.title || it.caption || "Communauté")}${it.author ? ` · ${escapeHtml(it.author)}` : ""}</figcaption>
        </figure>`
      )
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

  const titleInput = form.querySelector<HTMLInputElement>('input[name="title"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ENABLED) return setStatus(status, "La mise en ligne ouvre très bientôt — reviens vite.", "info");
    const title = (titleInput?.value || "").trim();
    if (title.length < 2) return setStatus(status, "Donne un nom à ta vidéo.", "err");
    if (isInappropriate(title)) return setStatus(status, "Ce nom n'est pas autorisé. Choisis-en un autre.", "err");
    const author = (form.querySelector<HTMLInputElement>('input[name="author"]')?.value || "").trim();
    if (author && isInappropriate(author)) return setStatus(status, "Ce prénom n'est pas autorisé.", "err");
    const file = fileInput.files?.[0];
    if (!file) return setStatus(status, "Choisis une vidéo d'abord.", "err");

    if (!file.type.startsWith("video/")) return setStatus(status, "Le fichier doit être une vidéo.", "err");
    if (file.size > limits.maxUploadMb * 1024 * 1024)
      return setStatus(status, `Trop lourd (max ${limits.maxUploadMb} Mo).`, "err");

    const dur = await videoDuration(file).catch(() => 0);
    if (dur && dur > limits.maxDurationSec + 1)
      return setStatus(status, `Trop longue (max ${limits.maxDurationSec}s) — elle sera coupée à l'envoi.`, "warn");

    submit.disabled = true;
    setStatus(status, "Préparation…", "info");
    try {
      // 1) ask our function to validate + sign (file bytes never pass through Vercel)
      const signRes = await fetch(`${API}/api/community/sign`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author }),
      });
      const sign = await signRes.json().catch(() => ({}));
      if (!signRes.ok) { submit.disabled = false; return setStatus(status, sign.error || "Envoi refusé.", "err"); }

      // 2) upload the video DIRECTLY to Cloudinary with the signed params
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sign.apiKey);
      fd.append("timestamp", String(sign.timestamp));
      fd.append("folder", sign.folder);
      fd.append("tags", sign.tags);
      fd.append("context", sign.context);
      fd.append("signature", sign.signature);

      setStatus(status, "Envoi en cours…", "info");
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloudName}/video/upload`);
      xhr.upload.onprogress = (ev) => {
        if (bar && ev.lengthComputable) bar.style.width = `${Math.round((ev.loaded / ev.total) * 100)}%`;
      };
      xhr.onload = () => {
        submit.disabled = false;
        if (bar) bar.style.width = "0%";
        if (xhr.status >= 200 && xhr.status < 300) {
          setStatus(status, "Merci ! Ta vidéo sera publiée après validation.", "ok");
          form.reset();
          if (soundOn()) punch();
        } else {
          setStatus(status, "Échec de l'envoi. Réessaie.", "err");
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
