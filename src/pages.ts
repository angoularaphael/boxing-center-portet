import { DISCIPLINES, TARIFS, PLANNING, SITE } from "./data";

const el = (id: string) => document.getElementById(id);

export function renderPage(page: string | undefined) {
  if (page === "activites") {
    const g = el("act-grid");
    if (g)
      g.innerHTML = DISCIPLINES.map(
        (d) => `
        <article class="disc" data-reveal>
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
  }
}
