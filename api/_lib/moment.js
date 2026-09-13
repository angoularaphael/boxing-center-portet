/* =====================================================================
   PORTET · api/_lib/moment.js — le bot sait QUAND on lui parle.

   Eddy, 13/09 : « the bots need to be able to know the current date ».
   Le modèle n’a pas d’horloge : sans ce bloc, « il y a cours ce soir ? »
   se répondait avec une date devinée. Recalculé À CHAQUE MESSAGE, en heure
   de Paris (les serveurs Vercel tournent en UTC).

   LE PLANNING EN VIGUEUR, pas le planning caché : tant que nouvellesSalles
   n’est pas vrai, la page Planning affiche planningProvisoire. Même règle que
   scripts/disciplines-lib.mjs — copiée exprès : la fonction serverless ne
   charge pas les scripts du build.
   ===================================================================== */
import { readFileSync } from "fs";
import { join } from "path";

const JOURS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const OUVRE = 10 * 60, FERME = 21 * 60 + 30;

export function planningEnVigueur(C) {
  if (C.nouvellesSalles === true) {
    const jours = new Map();
    for (const src of [C.planning || [], C.planningMma || []]) {
      for (const j of src) {
        if (!jours.has(j.day)) jours.set(j.day, []);
        jours.get(j.day).push(...(j.items || []));
      }
    }
    return [...jours].map(([day, items]) => ({ day, items }));
  }
  return C.planningProvisoire || [];
}

const mn = (h) => { const m = /(\d{1,2})\s*[:h]\s*(\d{2})?/.exec(h || ""); return m ? +m[1] * 60 + +(m[2] || 0) : null; };
const hh = (m) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

function parisMaintenant(now) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now).map((x) => [x.type, x.value]));
  const index = JOURS_EN.indexOf(p.weekday);
  return {
    index, jour: JOURS[index], mins: +p.hour * 60 + +p.minute,
    date: new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now),
  };
}

function coursDu(C, jour) {
  const d = planningEnVigueur(C).find((x) => x.day === jour);
  return (d?.items || []).map(([h, nom]) => {
    const [a, b] = String(h).split(/[–—-]/);
    return { nom, debut: mn(a), fin: mn(b) };
  }).filter((s) => s.debut != null).sort((x, y) => x.debut - y.debut);
}
const ligne = (s) => `${hh(s.debut)}${s.fin != null ? `–${hh(s.fin)}` : ""} ${s.nom}`;

function tableEnfants(C) {
  const prix = (re) => {
    const t = (C.tarifs || []).find((x) => re.test(x.name || ""));
    return t ? `${String(t.price).replace(/\s*€/, " €")} ${t.unit || ""}`.replace(/\s+/g, " ").trim() : null;
  };
  const groupes = new Map();
  for (const d of planningEnVigueur(C)) {
    for (const [h, nom] of d.items || []) {
      if (!/baby|enfant|\bados?\b|[ée]ducative/i.test(nom)) continue;
      const g = groupes.get(nom) || { nom, creneaux: [] };
      g.creneaux.push(`${d.day.toLowerCase()} ${String(h).replace(/\s+/g, " ")}`);
      groupes.set(nom, g);
    }
  }
  const age = (g) => /(\d+)\s*\/\s*(\d+)/.exec(g.nom);
  const lignes = [...groupes.values()]
    .sort((a, b) => (age(a) ? +age(a)[1] : 99) - (age(b) ? +age(b)[1] : 99))
    .map((g) => {
      const a = age(g);
      // un prix seulement pour un groupe clairement enfant : « Boxe Éducative Confirmés » ne dit pas son public
      const enfant = a || /baby|enfant|\bados?\b/i.test(g.nom);
      const tarif = !enfant ? null : /baby/i.test(g.nom) ? prix(/baby/i) : prix(/enfant|ado/i);
      const tete = a ? `${a[1]} à ${a[2]} ans → ${g.nom}` : `${g.nom} (âge exact non publié : à confirmer avec la salle)`;
      return `- ${tete} : ${g.creneaux.join(" et ")}${tarif ? ` · ${tarif}` : ""}.`;
    });
  if (!lignes.length) return "";
  return `ÉCOLE ENFANTS — LA TABLE, tirée du planning affiché. Quand le visiteur donne l’âge de l’enfant, tu réponds DIRECTEMENT avec la bonne ligne (groupe, jour, heure, prix), sans reposer de question sur l’âge, et tu donnes le lien des abonnements enfants de la boutique.
${lignes.join("\n")}
- Un âge sous la première tranche ou hors de ces tranches : tu dis ce que le planning indique et tu proposes d’appeler la salle pour confirmer — tu n’inventes aucun groupe, aucune tranche d’âge.`;
}

/** Le bloc « maintenant », recalculé à chaque message. Synchrone : systemFor l’est. */
export function contexteDuMoment(now = new Date()) {
  let C;
  try { C = JSON.parse(readFileSync(join(process.cwd(), "src/content.json"), "utf8")); } catch { return ""; }
  const P = parisMaintenant(now);
  const L = [`MAINTENANT — heure de Paris, recalculée à chaque message ; c’est la SEULE date que tu connais : ${P.date}, ${hh(P.mins)}.`];
  const ouverte = P.index !== 0 && P.mins >= OUVRE && P.mins < FERME;
  L.push(ouverte ? `- La salle est OUVERTE en ce moment (${hh(OUVRE)} – ${hh(FERME)}).` : `- La salle est FERMÉE en ce moment (ouverte du lundi au samedi, ${hh(OUVRE)} – ${hh(FERME)}).`);

  const auj = coursDu(C, P.jour);
  const enCours = auj.filter((s) => P.mins >= s.debut && P.mins < (s.fin ?? s.debut + 60));
  const suivant = auj.find((s) => s.debut > P.mins);
  if (enCours.length) L.push(`- En ce moment : ${enCours.map(ligne).join(", ")}.`);
  if (suivant) L.push(`- Prochain cours aujourd’hui : ${ligne(suivant)}.`);
  else if (auj.length) L.push("- Plus aucun cours aujourd’hui.");
  L.push(auj.length ? `- Aujourd’hui (${P.jour.toLowerCase()}) : ${auj.map(ligne).join(", ")}.` : `- Aujourd’hui (${P.jour.toLowerCase()}) : aucun cours.`);
  for (let k = 1; k <= 7; k++) {
    const jour = JOURS[(P.index + k) % 7];
    const l = coursDu(C, jour);
    if (!l.length) { if (k === 1) L.push(`- Demain (${jour.toLowerCase()}) : aucun cours.`); continue; }
    L.push(`- ${k === 1 ? "Demain" : "Prochain jour de cours"} (${jour.toLowerCase()}) : ${l.map(ligne).join(", ")}.`);
    break;
  }
  L.push("Quand on te dit « aujourd’hui », « ce soir », « demain », « là, maintenant », tu réponds avec CE bloc, jamais avec une date devinée.");
  const enfants = tableEnfants(C);
  if (enfants) L.push("", enfants);
  return L.join("\n");
}
