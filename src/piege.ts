/* =====================================================================
   PORTET · LA PLAQUE — le piège permanent.

   POURQUOI. Le patron : « il est censé y avoir le bouton un peu partout,
   il y a la roue qui tourne, toujours dans notre visage ». Portet
   n'avait aucun rappel permanent : on pouvait descendre trente écrans
   sans jamais croiser un prix.

   CE QUE C'EST, ET POURQUOI PAS UNE ROULETTE. Deux offres, pas dix :
   l'abonnement Étudiant, puis l'Adulte. Une roue qui tourne sur deux
   cases, c'est une pièce qu'on lance. La forme juste, pour un site qui
   parle de boxe, c'est la PLAQUE : celle qu'on grave sur une ceinture.
   Deux lignes gravées l'une sous l'autre, de l'or, et un reflet qui passe
   dessus de temps en temps — comme la lumière sur le métal quand on bouge.
   Chaque ligne est son propre lien : étudiant vers l'inscription
   étudiante, adulte vers l'inscription adulte.

   OÙ. Empilée juste au-dessus du chat, dans le même coin : c'est là que
   l'œil revient déjà. Elle s'efface sur le hero (on ne coupe pas une
   première impression), dans le pied de page (qui porte déjà l'offre)
   et quand le chat s'ouvre (il ne doit rien avoir devant lui).

   CE QUE ÇA NE COÛTE PAS. Le reflet ne passe que si la plaque est
   VISIBLE et l'onglet au premier plan ; en `prefers-reduced-motion` il
   ne passe pas du tout. Le prix vient de TARIFS : rien n'est recopié.
   ===================================================================== */
import { TARIFS } from "./data";
import { prixLu } from "./prix.mjs";
import { TROPHEE, tropheeActif, compteTrophee } from "./trophee.mjs";

type Tarif = { name?: string; price?: string; href?: string };

/* « 36,99€ » → 36 en grand, €99 en petit (le nom accessible garde le montant exact). */
const grave = (prix: string) => {
  const m = /^(\d+),(\d{2})/.exec(prix);
  return m ? `${m[1]}<i>€${m[2]}</i>` : prix;
};

/* LE TALON DU GALA (3/11 → minuit après le 13/11, src/trophee.mjs).
   Eddy : jusqu'au Boxing Trophy 19, le Trophy prend la place des offres
   dans ce coin. Même place, même taille, mêmes règles d'apparition ; la
   matière change — noir de ring et cuivre, le « 19 » en italique du site
   du gala — et le talon compte les jours. Un seul lien : le site du gala.
   Après la date, la plaque redevient d'elle-même la plaque d'or. */
function talonTrophee(el: HTMLElement): void {
  const lu = "Boxing Trophy 19, vendredi 13 novembre 2026 à 19 h au Boxing Center de Portet-sur-Garonne : "
    + "le gala d’inauguration de la nouvelle salle, entrée 10 €. Ouvre le site du gala.";
  el.className = "plaque plaque--trophee";
  el.innerHTML = `
    <a class="plaque__t" href="${TROPHEE.url}" target="_blank" rel="noopener" aria-label="${lu}" title="Boxing Trophy 19 · ven. 13 nov. · 19 h">
      <span class="plaque__tmot" aria-hidden="true">Trophy</span>
      <span class="plaque__tn" aria-hidden="true">19</span>
      <span class="plaque__tj" aria-hidden="true">${compteTrophee()}</span>
      <span class="plaque__reflet" aria-hidden="true"></span>
    </a>`;
}

/* LE TALON S'EFFACE DEVANT LE GALA. Quand l'affiche, le panneau du ring ou le billet
   du dernier bloc sont à l'écran, la plaque redirait la même chose juste à côté —
   deux objets du Trophy qui se touchent. Elle se retire le temps de les croiser.
   Les blocs changent à chaque page (navigation douce) : observerBlocsTrophee()
   est rejouée par bootPage. */
let surBlocTrophee = false;
let resynchroniser: () => void = () => {};
let veilleBlocs: IntersectionObserver | null = null;
const blocsVus = new Set<Element>();
export function observerBlocsTrophee(): void {
  if (!("IntersectionObserver" in window)) return;
  veilleBlocs?.disconnect();
  blocsVus.clear();
  surBlocTrophee = false;
  veilleBlocs = new IntersectionObserver((entrees) => {
    for (const e of entrees) e.isIntersecting ? blocsVus.add(e.target) : blocsVus.delete(e.target);
    surBlocTrophee = blocsVus.size > 0;
    resynchroniser();
  }, { threshold: 0, rootMargin: "0px 0px -12% 0px" });
  document.querySelectorAll(".trophee-affiche, .ring-trophee, .cta-block .trophee-billet")
    .forEach((b) => veilleBlocs!.observe(b));
  resynchroniser();
}

export function mountPiege(): void {
  if (document.querySelector(".plaque")) return;
  const el = document.createElement("div");
  if (tropheeActif()) talonTrophee(el);
  else {
    const liste = Array.isArray(TARIFS) ? (TARIFS as Tarif[]) : [];
    const trouve = (rx: RegExp) => liste.find((x) => rx.test(String(x?.name || "")));
    /* Toujours dans cet ordre : l'étudiant d'abord, l'adulte ensuite. */
    const offres = [
      { t: trouve(/^[ée]tudiant/i), l: "Étudiant", fin: ", carte étudiante requise" },
      { t: trouve(/^adulte/i), l: "Adulte", fin: "" },
    ].filter((o) => o.t?.price && o.t?.href)
     .map((o) => ({ ...o, lu: `Abonnement ${o.l.toLowerCase()}, ${prixLu(o.t!.price)} toutes les 4 semaines${o.fin}` }));
    if (offres.length !== 2) return;

    el.className = "plaque";
    el.innerHTML = offres.map(({ t, l, lu }) => `
      <a class="plaque__o" href="${t!.href}" target="_blank" rel="noopener" aria-label="${lu}" title="${lu}">
        <span class="plaque__l" aria-hidden="true">${l}</span>
        <span class="plaque__p" aria-hidden="true">${grave(String(t!.price))}</span>
      </a>`).join("") + `
      <span class="plaque__reflet" aria-hidden="true"></span>`;
  }
  document.body.appendChild(el);

  /* Le reflet : un passage lent, espacé. Souvent, ça devient un clignotant
     qu'on apprend à ignorer ; rarement, ça reste un signal. */
  const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let minuteur: number | null = null;
  const brille = () => {
    if (document.hidden || !el.classList.contains("is-in")) return;
    el.classList.add("brille");
    window.setTimeout(() => el.classList.remove("brille"), 1300);
  };
  if (!reduit) minuteur = window.setInterval(brille, 7000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && minuteur) { clearInterval(minuteur); minuteur = null; }
    else if (!document.hidden && !minuteur && !reduit) minuteur = window.setInterval(brille, 7000);
  });

  /* Quand elle se montre. Trois conditions, toutes nécessaires. */
  const hero = document.querySelector(".hero, .page-head, .phero");
  const pied = document.querySelector(".footer, #site-footer");
  let passeHero = !hero, surPied = false, chatOuvert = false;
  const sync = () => el.classList.toggle("is-in", passeHero && !surPied && !chatOuvert && !surBlocTrophee);
  resynchroniser = sync;

  if ("IntersectionObserver" in window) {
    if (hero) new IntersectionObserver(([e]) => { passeHero = !e.isIntersecting; sync(); },
      { threshold: 0, rootMargin: "-40% 0px 0px 0px" }).observe(hero);
    if (pied) new IntersectionObserver(([e]) => { surPied = e.isIntersecting; sync(); },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" }).observe(pied);
  } else { passeHero = true; }

  /* Le chat ouvert passe devant : la plaque s'efface le temps de la
     conversation. On surveille sa classe plutôt que d'écouter un
     événement — le widget n'en émet pas, et une classe ne ment pas. */
  const chat = document.querySelector(".bcp-chat");
  if (chat && "MutationObserver" in window) {
    const maj = () => { chatOuvert = chat.classList.contains("bcp-chat--open"); sync(); };
    new MutationObserver(maj).observe(chat, { attributes: true, attributeFilter: ["class"] });
    maj();
  }
  sync();
}

/* LES COMPTES À REBOURS DES BILLETS DU GALA. Celui du héros est posé par
   le script en ligne d'index.html, avant le premier rendu ; les autres
   (Round 01, ring, dernier bloc) et ceux d'une page arrivée par la
   navigation douce — dont les scripts en ligne ne jouent pas — le sont
   ici, à chaque page. */
export function compteursTrophee(): void {
  if (!tropheeActif()) return;
  const txt = compteTrophee();
  document.querySelectorAll<HTMLElement>("[data-trophee-j]").forEach((e) => {
    e.textContent = txt;
    e.classList.toggle("is-mot", !txt.startsWith("J-"));
  });
}

/* L'AFFICHE QUI ACCROCHE LA LUMIÈRE. À la souris seulement, l'affiche
   s'incline de quelques degrés vers le pointeur et un éclat la traverse
   là où il se pose : c'est un objet qu'on tient, pas une image collée.
   Rien au doigt, rien en mouvement réduit ; une seule écoute par affiche. */
export function animerAffiches(): void {
  const souris = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!souris || reduit) return;
  document.querySelectorAll<HTMLElement>(".trophee-affiche__cadre:not([data-anime])").forEach((el) => {
    el.dataset.anime = "";
    let image = 0;
    el.addEventListener("pointermove", (ev) => {
      const r = el.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      cancelAnimationFrame(image);
      image = requestAnimationFrame(() => {
        el.style.setProperty("--ry", `${((x - 0.5) * 7).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${((0.5 - y) * 6).toFixed(2)}deg`);
        el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
        el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      });
    });
    el.addEventListener("pointerleave", () => {
      cancelAnimationFrame(image);
      el.style.removeProperty("--rx");
      el.style.removeProperty("--ry");
    });
  });
}
