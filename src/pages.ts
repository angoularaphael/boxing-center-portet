import { DISCIPLINES, TARIFS, PLANNING, SITE, NETWORK_SALLES } from "./data";
import { optUrl } from "./img";

const el = (id: string) => document.getElementById(id);

/* ---------- Formulaire partenaires (Inlett) ----------
   Contrat du service (inlett.vercel.app/docs) : GET /api/challenge →
   résoudre la preuve de travail (sha256("challenge:nonce") commençant par
   N zéros) → POST /api/submit/{FORM_ID} avec les champs + pow_* + _gotcha
   (pot de miel, vide pour un humain). Coût humain : un clignement d'œil. */
const INLETT_URL = "https://inlett.vercel.app";
const INLETT_FORM_ID = "612111d6-abe5-45a7-bee7-e524d1d870d9";

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function solvePow(challenge: string, difficulty: number): Promise<string> {
  const prefix = "0".repeat(difficulty);
  for (let nonce = 0; ; nonce++) {
    if ((await sha256Hex(`${challenge}:${nonce}`)).startsWith(prefix)) return String(nonce);
    if (nonce % 2000 === 1999) await new Promise((r) => setTimeout(r)); // ne fige jamais l'UI
  }
}
function initPartnerForm() {
  const form = document.getElementById("partner-form") as HTMLFormElement | null;
  const status = document.getElementById("pform-status");
  if (!form || !status) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const btn = form.querySelector<HTMLButtonElement>(".pform__submit");
    if (btn) btn.disabled = true;
    status.textContent = "Envoi en cours…";
    try {
      const ch = await (await fetch(`${INLETT_URL}/api/challenge`)).json();
      const nonce = await solvePow(ch.challenge, ch.difficulty);
      const fd = new FormData(form);
      const payload: Record<string, string> = { _lang: "fr" };
      fd.forEach((v, k) => (payload[k] = String(v)));
      payload.pow_challenge = ch.challenge;
      payload.pow_timestamp = String(ch.timestamp);
      payload.pow_nonce = nonce;
      const r = await fetch(`${INLETT_URL}/api/submit/${INLETT_FORM_ID}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as any).error || "envoi refusé");
      form.reset();
      status.textContent = "C'est envoyé ! On vous répond très vite — merci pour votre confiance. 🥊";
    } catch {
      status.textContent = "L'envoi n'est pas passé. Réessayez dans un instant, ou appelez-nous au 05 62 24 46 82.";
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

export function renderPage(page: string | undefined) {
  if (page === "activites") {
    const g = el("act-grid");
    if (g)
      g.innerHTML = DISCIPLINES.map(
        (d) => `
        <article class="disc disc--img" data-reveal style="--disc-img:url('${optUrl(d.img, 960, "2:1")}')">
          <div class="disc__media" aria-hidden="true"></div>
          <div class="disc__top"><span class="disc__key">${d.key}</span><span class="disc__tag">${d.tag}</span></div>
          <div><h3 class="disc__name">${d.name}</h3><p class="disc__desc">${d.desc}</p></div>
        </article>`
      ).join("");
  }

  if (page === "tarifs") {
    const g = el("tarifs-grid");
    if (g)
      g.innerHTML = TARIFS.map(
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

  if (page === "plannings") {
    const g = el("planning-grid");
    if (g)
      g.innerHTML = PLANNING.map(
        (col) => `
        <div class="plan-col" data-reveal>
          <h3 class="plan-col__day">${col.day}</h3>
          ${col.items
            .map(
              ([time, name]) =>
                `<div class="plan-slot"><span class="plan-slot__t">${time}</span><span class="plan-slot__n">${name}</span></div>`
            )
            .join("")}
        </div>`
      ).join("");
  }

  // /coachs/ is a WebGL "forge" sequence (see src/three/forge.ts) — no grid to render.

  if (page === "partenaires") initPartnerForm();

  if (page === "salles") {
    // Slider « Le terrain » : flèches ← → sur la piste scroll-snap.
    // Le snap mandatory casse les défilements programmés (Chromium les
    // renvoie au point de départ) → on coupe le snap le temps d'un tween
    // rAF vers la diapo cible, puis on le rétablit. Le doigt garde le snap.
    const track = el("terrain-track");
    if (track) {
      const slides = Array.from(track.querySelectorAll<HTMLElement>(".terrain__slide"));
      const go = (dir: number) => {
        if (!slides.length) return;
        const tr = track.getBoundingClientRect();
        let idx = 0, best = Infinity;
        slides.forEach((s, i) => {
          const d = Math.abs(s.getBoundingClientRect().left + s.offsetWidth / 2 - (tr.left + tr.width / 2));
          if (d < best) { best = d; idx = i; }
        });
        const next = slides[Math.min(slides.length - 1, Math.max(0, idx + dir))];
        const nr = next.getBoundingClientRect();
        const target = track.scrollLeft + (nr.left - tr.left) - (tr.width - nr.width) / 2;
        track.style.scrollSnapType = "none";
        const from = track.scrollLeft, delta = target - from, t0 = performance.now();
        const ease = (t: number) => 1 - Math.pow(1 - t, 3);
        const tick = (now: number) => {
          const k = Math.min(1, (now - t0) / 380);
          track.scrollLeft = from + delta * ease(k);
          if (k < 1) requestAnimationFrame(tick);
          else track.style.scrollSnapType = "";
        };
        requestAnimationFrame(tick);
      };
      document.querySelector(".terrain__prev")?.addEventListener("click", () => go(-1));
      document.querySelector(".terrain__next")?.addEventListener("click", () => go(1));
    }

    const g = el("specs");
    if (g)
      g.innerHTML = SITE.surfaces
        .map((s) => `<div class="spec"><span class="spec__l">${s.label}</span><span class="spec__v">${s.value}</span></div>`)
        .join("");

    const net = el("network-grid");
    if (net) {
      net.innerHTML = NETWORK_SALLES.filter(s => s.id !== "portet").map(
        (s) => `
        <article class="network-card" data-reveal>
          <h3 class="network-card__name">${s.name}</h3>
          <p class="network-card__address">${s.address}</p>
          <div class="network-card__meta">
            <a class="network-card__phone" href="tel:${s.phoneHref}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              ${s.phone}
            </a>
            <a class="network-card__maps" href="${s.mapsUrl}" target="_blank" rel="noopener">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Voir sur Google Maps
            </a>
          </div>
          <div class="network-card__features">
            ${s.features.map((f) => `<span class="network-card__tag">${f}</span>`).join("")}
          </div>
        </article>`
      ).join("");
    }
  }
}
