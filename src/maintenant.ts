/**
 * LE PLANNING EN DIRECT (Eddy, 13/09 : « the lesson that's going on right now
 * should be highlighted », l'heure réelle sur la page Planning).
 *
 * Heure de PARIS (Intl), pas celle du téléphone : un visiteur réglé sur un
 * autre fuseau verrait sinon le mauvais cours s'allumer. La colonne du jour
 * est mise en avant, le cours en cours et le suivant sont marqués, et une
 * ligne d'horloge au-dessus de la grille dit où on en est. Relu toutes les
 * 30 s ; le minuteur part avec la page (pageTeardowns, navigation douce).
 *
 * Tout est lu dans la grille PEINTE (plan-col__day, plan-slot__t
 * « 12:30 – 13:30 », plan-slot__n) : aucune heure recopiée ici, le planning
 * que l'admin publie reste la seule source.
 */
import { pageTeardowns } from "./scroll";

const JOURS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

type Creneau = { el: HTMLElement; debut: number; fin: number; nom: string };

const minutes = (t: string): number | null => {
  const m = /(\d{1,2})\s*[:h]\s*(\d{2})/.exec(t);
  return m ? +m[1] * 60 + +m[2] : null;
};
const hh = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
const plat = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const x = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

function paris() {
  const p = Object.fromEntries(PARTS.formatToParts(new Date()).map((v) => [v.type, v.value]));
  const i = JOURS_EN.indexOf(p.weekday);
  return { i, jour: JOURS[i], mins: (+p.hour % 24) * 60 + +p.minute };
}

function lireColonne(col: Element): Creneau[] {
  const out: Creneau[] = [];
  col.querySelectorAll<HTMLElement>(".plan-slot").forEach((el) => {
    const [a = "", b = ""] = (el.querySelector(".plan-slot__t")?.textContent || "").split(/[–—-]/);
    const debut = minutes(a);
    if (debut == null) return;
    out.push({ el, debut, fin: minutes(b) ?? debut + 60, nom: (el.querySelector(".plan-slot__n")?.textContent || "").trim() });
  });
  return out.sort((p, q) => p.debut - q.debut);
}

const colonneDu = (grille: Element, jour: string) =>
  [...grille.querySelectorAll(".plan-col")].find((c) => plat(c.querySelector(".plan-col__day")?.textContent || "") === plat(jour)) || null;

export function marquerPlanning() {
  const grilles = [...document.querySelectorAll<HTMLElement>(".planning")].filter((g) => !g.closest("[hidden]") && g.querySelector(".plan-col"));
  if (!grilles.length) return;
  const n = paris();
  const enCours: Creneau[] = [];
  let suivant = null as Creneau | null;

  for (const g of grilles) {
    g.querySelectorAll(".is-today, .is-now, .is-next").forEach((el) => {
      el.classList.remove("is-today", "is-now", "is-next");
      el.removeAttribute("aria-current");
    });
    const col = colonneDu(g, n.jour);
    if (!col) continue;
    col.classList.add("is-today");
    const cr = lireColonne(col);
    for (const c of cr) {
      if (n.mins >= c.debut && n.mins < c.fin) {
        c.el.classList.add("is-now");
        c.el.setAttribute("aria-current", "time");
        enCours.push(c);
      }
    }
    const s = cr.find((c) => c.debut > n.mins);
    if (s) {
      cr.filter((c) => c.debut === s.debut).forEach((c) => c.el.classList.add("is-next"));
      if (!suivant || s.debut < suivant.debut) suivant = s;
    }
  }

  /* Rien en cours, rien après aujourd'hui : le prochain jour qui a des cours. */
  let prochain = null as { jour: string; c: Creneau } | null;
  if (!enCours.length && !suivant) {
    for (let k = 1; k <= 7 && !prochain; k++) {
      const jour = JOURS[(n.i + k) % 7];
      for (const g of grilles) {
        const col = colonneDu(g, jour);
        const cr = col ? lireColonne(col) : [];
        if (cr.length) { prochain = { jour, c: cr[0] }; break; }
      }
    }
  }

  const premiere = grilles[0];
  let h = document.getElementById("plan-horloge");
  if (!h) {
    h = document.createElement("p");
    h.id = "plan-horloge";
    h.className = "plan-horloge";
    h.setAttribute("aria-live", "polite");
    premiere.parentElement?.insertBefore(h, premiere);
  }
  const morceaux = [`<b>${hh(n.mins)}</b> <span class="plan-horloge__jour">${n.jour}</span>`];
  if (enCours.length) morceaux.push(`<span class="plan-horloge__now">En cours : ${x(enCours.map((c) => c.nom).join(" · "))}</span>`);
  if (suivant) morceaux.push(`Ensuite, ${hh(suivant.debut)} : ${x(suivant.nom)}`);
  else if (prochain) morceaux.push(`Prochain cours ${prochain.jour}, ${hh(prochain.c.debut)} : ${x(prochain.c.nom)}`);
  h.innerHTML = morceaux.join('<span class="plan-horloge__sep" aria-hidden="true">·</span>');
}

let minuteur = 0;
export function demarrerPlanningVivant() {
  if (!document.querySelector(".planning .plan-col")) return;
  marquerPlanning();
  window.clearInterval(minuteur);
  minuteur = window.setInterval(marquerPlanning, 30_000);
  const revenir = () => { if (!document.hidden) marquerPlanning(); };
  document.addEventListener("visibilitychange", revenir);
  pageTeardowns.push(() => {
    window.clearInterval(minuteur);
    document.removeEventListener("visibilitychange", revenir);
    document.getElementById("plan-horloge")?.remove();
  });
}
