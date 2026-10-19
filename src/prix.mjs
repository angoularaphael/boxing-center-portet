/* =====================================================================
   UN PRIX DE LA GRILLE, TROIS LECTURES (19/10/2026).

   Les abonnements sans engagement coûtent 36,99 € et 44,99 €. Eddy veut
   que l'œil lise « 36 » et « 44 » : l'euro entier en grand, « €99 » en
   petit, collé — exactement comme le billet. Mais le lecteur d'écran, le
   JSON-LD et la prose disent le montant exact. Une seule règle, lue par
   le navigateur (main.ts, pages.ts, seo.ts), par vite.config.ts et par les
   générateurs (scripts/*.mjs) : le même prix ne peut plus s'écrire de
   deux façons selon la page.

   Le prix s'écrit dans content.json « 36,99€ » ; un prix rond (« 295€ »)
   reste tel quel.
   ===================================================================== */
const RX = /^(\d+)(?:,(\d{2}))?\s*€$/;

const decoupe = (p) => {
  const m = RX.exec(String(p ?? "").trim());
  return m ? { euros: m[1], cts: m[2] || "" } : null;
};

/** « 36,99 € » — ce que disent la prose, la FAQ et le lecteur d'écran. */
export const prixLu = (p) => {
  const d = decoupe(p);
  return d ? `${d.euros}${d.cts ? `,${d.cts}` : ""} €` : String(p ?? "");
};

/** « 36.99 » — la valeur du JSON-LD (schema.org attend un point). */
export const prixSchema = (p) => {
  const d = decoupe(p);
  return d ? (d.cts ? `${d.euros}.${d.cts}` : d.euros) : "0";
};

/** Le chiffre de la carte : 36 en grand, €99 en petit, le montant exact pour qui écoute. */
export const prixHtml = (p, esc = (s) => String(s ?? "")) => {
  const d = decoupe(p);
  if (!d || !d.cts) return esc(p);
  return `<span class="sr-only">${prixLu(p)}</span><span aria-hidden="true">${d.euros}<i class="tarif__cts">€${d.cts}</i></span>`;
};
