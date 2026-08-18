/**
 * « Plus que N places » — la rareté, mais la VRAIE.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI CE COMPTEUR EST BRANCHÉ SUR LES VENTES ET PAS SUR UN GÉNÉRATEUR
 *
 * L'idée de départ était un nombre qui descend tout seul, différent d'une rue
 * à l'autre pour que deux voisins ne voient pas le même. Trois raisons de ne
 * pas le faire, dans l'ordre d'importance :
 *
 *  1. C'est interdit, et lourdement. Annoncer une disponibilité limitée qui
 *     n'existe pas est une pratique commerciale trompeuse (code de la
 *     consommation, art. L.121-2 et L.121-4 ; directive 2005/29/CE). La peine
 *     prévue va jusqu'à deux ans d'emprisonnement et 300 000 € d'amende,
 *     portée à 10 % du chiffre d'affaires moyen. La DGCCRF sanctionne
 *     régulièrement les faux compteurs de stock. Et faire varier le nombre
 *     par micro-zone pour que personne ne puisse recouper, ce n'est pas un
 *     détail technique : c'est ce qui transforme une erreur en intention.
 *
 *  2. Le premier client qui compare deux écrans tient l'histoire. Une capture
 *     d'écran, un avis Google, un concurrent — et le club devient « la salle
 *     qui invente ses places ». Ce que le compteur rapporte en un mois ne paie
 *     pas ce que ça coûte.
 *
 *  3. Techniquement, ça ne tient pas. La géolocalisation par IP ne descend pas
 *     à la rue : une IP grand public pointe la ville ou le nœud régional du
 *     fournisseur, souvent à des dizaines de kilomètres. En 4G, le partage
 *     d'adresses (CGNAT) change la zone d'un instant à l'autre. Le nombre
 *     sauterait en passant du wifi aux données mobiles — exactement
 *     l'incohérence qu'on cherchait à éviter.
 *
 * CE QUI EST FAIT À LA PLACE, ET QUI PRESSE AUTANT
 *
 * Le club a une rareté réelle : le patron décide combien de places il ouvre à
 * 29 €. Le compteur affiche ce quota moins les inscriptions réellement payées
 * (box-plus, /api/offre-rentree/places). Le nombre descend pour de vrai, il est
 * le même pour tout le monde, il se défend devant n'importe qui — et il tient
 * un argument que le faux n'a pas : quand il atteint zéro, il a raison.
 *
 * RÈGLE DE SÉCURITÉ : si la boutique ne répond pas, ou répond qu'elle ne sait
 * pas, on n'affiche RIEN. Pas de valeur de repli, pas de nombre « en
 * attendant ». Un compteur absent ne coûte rien ; un compteur inventé coûte
 * tout.
 * ─────────────────────────────────────────────────────────────────────────
 */

const SOURCE = "https://boutique.boxingcenter.fr/api/offre-rentree/places";

/** Au-delà de ce seuil, le nombre n'impressionne plus personne : on se tait. */
const SEUIL_AFFICHAGE = 25;

type Places = { ok: boolean; quota?: number; vendues?: number; restantes?: number; fin?: string | null };

let promesse: Promise<Places | null> | null = null;

/**
 * Une seule requête à la fois, partagée par tous les emplacements de la page.
 *
 * On ne garde en mémoire QUE les réponses réussies. Mettre un échec en cache
 * ferait disparaître le compteur pour toute la visite à cause d'un seul hoquet
 * réseau — la navigation du site étant douce, la page ne se recharge jamais.
 * Un échec est donc oublié, et la page suivante retente.
 */
function lire(): Promise<Places | null> {
  if (promesse) return promesse;
  promesse = fetch(SOURCE, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((d: Places | null) => {
      if (!d || !d.ok) promesse = null;   // rien de bon à retenir : on retentera
      return d;
    });
  return promesse;
}

const moisFr = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function dateEnClair(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const jour = Number(m[3]);
  return `${jour === 1 ? "1er" : jour} ${moisFr[Number(m[2]) - 1]}`;
}

/**
 * Remplit chaque `[data-places]` de la page. Les éléments arrivent vides et
 * masqués : s'ils le restent, c'est que le nombre n'était pas connu.
 */
export async function initPlaces(): Promise<void> {
  const cibles = document.querySelectorAll<HTMLElement>("[data-places]");
  if (!cibles.length) return;

  const d = await lire();
  if (!d || !d.ok || typeof d.restantes !== "number") return;   // on se tait
  const n = d.restantes;
  if (n <= 0 || n > SEUIL_AFFICHAGE) return;                    // complet, ou trop loin du compte

  const fin = d.fin ? dateEnClair(d.fin) : null;
  cibles.forEach((el) => {
    el.textContent =
      n === 1
        ? "Dernière place à ce prix"
        : `Plus que ${n} places à ce prix${fin ? `, jusqu’au ${fin}` : ""}`;
    el.hidden = false;
    el.setAttribute("role", "status");
  });
}
