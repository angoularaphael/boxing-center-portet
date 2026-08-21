/* =====================================================================
   PORTET · LA PLAQUE — le piège permanent.

   POURQUOI. Le patron : « il est censé y avoir le bouton un peu partout,
   il y a la roue qui tourne, toujours dans notre visage ». Portet
   n'avait aucun rappel permanent : on pouvait descendre trente écrans
   sans jamais croiser un prix.

   CE QUE C'EST, ET POURQUOI PAS UNE ROULETTE. Une roulette suppose
   PLUSIEURS offres à faire tourner. Ici il n'y en a plus qu'une à
   vendre — la saison. Faire tourner une seule case, c'est une affiche
   qui clignote. La forme juste, pour un site qui parle de boxe, c'est
   la PLAQUE : celle qu'on grave sur une ceinture. Un chiffre, de l'or,
   et un reflet qui passe dessus de temps en temps — comme la lumière
   sur le métal quand on bouge.

   OÙ. Empilée juste au-dessus du chat, dans le même coin : c'est là que
   l'œil revient déjà. Elle s'efface sur le hero (on ne coupe pas une
   première impression), dans le pied de page (qui porte déjà l'offre)
   et quand le chat s'ouvre (il ne doit rien avoir devant lui).

   CE QUE ÇA NE COÛTE PAS. Le reflet ne passe que si la plaque est
   VISIBLE et l'onglet au premier plan ; en `prefers-reduced-motion` il
   ne passe pas du tout. Le prix vient de TARIFS : rien n'est recopié.
   ===================================================================== */
import { TARIFS } from "./data";

type Tarif = { name?: string; price?: string; old?: string; href?: string };

export function mountPiege(): void {
  if (document.querySelector(".plaque")) return;
  const t = (Array.isArray(TARIFS) ? (TARIFS as Tarif[]) : []).find((x) =>
    String(x?.name || "").startsWith("Saison")
  );
  if (!t?.price || !t?.href) return;

  const el = document.createElement("a");
  el.className = "plaque";
  el.href = t.href;
  el.target = "_blank";
  el.rel = "noopener";
  /* Le nom accessible dit le prix ET ce qu'on achète : « 259€ » seul ne
     veut rien dire pour qui n'a pas l'or sous les yeux. */
  el.setAttribute("aria-label", `L’année complète à ${t.price}${t.old ? ` au lieu de ${t.old}` : ""} — voir l’offre`);
  el.innerHTML = `
    <span class="plaque__l" aria-hidden="true">L’année</span>
    <span class="plaque__p" aria-hidden="true">${t.price}</span>
    <span class="plaque__reflet" aria-hidden="true"></span>`;
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
  const sync = () => el.classList.toggle("is-in", passeHero && !surPied && !chatOuvert);

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
