import { DISCIPLINES, TARIFS, PLANNING, SITE, NETWORK_SALLES } from "./data";

const el = (id: string) => document.getElementById(id);

export function renderPage(page: string | undefined) {
  if (page === "activites") {
    const g = el("act-grid");
    if (g)
      g.innerHTML = DISCIPLINES.map(
        (d) => `
        <article class="disc disc--img" data-reveal style="--disc-img:url('${d.img}')">
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
        (t) => `
        <div class="tarif ${t.feature ? "tarif--feature" : ""}" data-reveal>
          ${t.feature ? '<span class="tarif__badge">Le plus choisi</span>' : ""}
          <span class="tarif__name">${t.name}</span>
          <span class="tarif__price">${t.price}<small> ${t.unit}</small></span>
          <p class="tarif__note">${t.note}</p>
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

  if (page === "salles") {
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
