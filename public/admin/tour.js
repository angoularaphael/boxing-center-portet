/* ============================================================
   LE VESTIAIRE — visites interactives & assistants.
   Le moteur assombrit tout l'écran SAUF la cible (4 panneaux
   autour d'un trou : la cible reste cliquable, le reste est
   bloqué). Deux types d'étapes :
     - info   : bouton « Compris » pour avancer ;
     - action : PAS de bouton — l'utilisateur fait le geste
                demandé (clic, saisie) et la visite avance seule.
   `runFlow(steps)` exécute n'importe quel parcours : la grande
   visite du premier login comme les assistants de l'accueil.
   ============================================================ */

const TOUR_KEY = "bcp:tour:v2";
let FLOW = null; // { steps, i, spot, card, blockers[4], off() }

/* ---------- moteur ---------- */
function runFlow(steps, opts = {}){
  endFlow();
  const blockers = [0,1,2,3].map(() => { const d = el("div", { class:"tour-block" }); document.body.append(d); return d; });
  const spot = el("div", { class:"tour-spot" }), card = el("div", { class:"tour-card" });
  document.body.append(spot, card);
  FLOW = { steps, i:0, spot, card, blockers, opts, off:null };
  window.addEventListener("resize", placeFlow);
  window.addEventListener("scroll", placeFlow, true);
  document.addEventListener("keydown", flowKey);
  showStep();
}
function endFlow(){
  if (!FLOW) return;
  FLOW.off?.();
  FLOW.spot.remove(); FLOW.card.remove(); FLOW.blockers.forEach((b) => b.remove());
  window.removeEventListener("resize", placeFlow);
  window.removeEventListener("scroll", placeFlow, true);
  document.removeEventListener("keydown", flowKey);
  const done = FLOW.opts.onEnd; FLOW = null; done?.();
}
function flowKey(e){ if (e.key === "Escape") endFlow(); }
function nextStep(){
  FLOW.off?.(); FLOW.off = null;
  if (FLOW.i >= FLOW.steps.length - 1) return endFlow();
  FLOW.i++; showStep();
}

function targetOf(step){ return step.sel ? document.querySelector(step.sel) : null; }

function showStep(){
  const step = FLOW.steps[FLOW.i];
  step.do?.(); // prépare l'écran (changer de section, etc.)

  const { card } = FLOW;
  card.innerHTML = "";
  card.append(el("h3", {}, step.t), el("p", {}, step.b));
  const acts = el("div", { class:"acts" });
  if (step.advanceOn){
    // étape action : on attend le geste de l'utilisateur, pas un clic « Suivant »
    card.append(el("span", { class:"tour-hint" }, step.hint || "À toi de jouer"));
    acts.append(el("button", { class:"tour-skip", type:"button", onclick:nextStep }, "Passer cette étape"));
    const h = (e) => {
      if (!e.target.closest(step.advanceOn.sel)) return;
      // petit délai : on laisse l'interface réagir au geste avant d'enchaîner
      FLOW.off?.(); FLOW.off = null;
      setTimeout(nextStep, step.advanceOn.delay ?? 400);
    };
    document.addEventListener(step.advanceOn.ev, h, true);
    FLOW.off = () => document.removeEventListener(step.advanceOn.ev, h, true);
  } else {
    acts.append(el("button", { class:"tour-skip", type:"button", onclick:endFlow }, "Quitter"));
    acts.append(el("button", { class:"btn sm", type:"button", onclick:nextStep },
      FLOW.i >= FLOW.steps.length - 1 ? "Terminer" : (step.ok || "Compris")));
  }
  card.append(el("div", { class:"foot" },
    el("span", { class:"dots" }, `${FLOW.i + 1} / ${FLOW.steps.length}`), acts));

  targetOf(step)?.scrollIntoView({ block:"center" });
  placeFlow();
  requestAnimationFrame(placeFlow); // correction après layout (polices, images)
}

/* positionne le projecteur, les 4 panneaux sombres et la carte */
function placeFlow(){
  if (!FLOW) return;
  const step = FLOW.steps[FLOW.i];
  const target = targetOf(step);
  const { spot, card, blockers:[top, bottom, left, right] } = FLOW;
  const put = (b, x, y, w, h) => Object.assign(b.style, { left:x+"px", top:y+"px", width:Math.max(0,w)+"px", height:Math.max(0,h)+"px" });
  const cw = card.offsetWidth || 360, ch = card.offsetHeight || 210;

  if (target){
    const r = target.getBoundingClientRect(), p = 8;
    const hl = r.left - p, ht = r.top - p, hw = r.width + 2*p, hh = r.height + 2*p;
    Object.assign(spot.style, { opacity:1, left:hl+"px", top:ht+"px", width:hw+"px", height:hh+"px" });
    put(top, 0, 0, innerWidth, ht);
    put(bottom, 0, ht+hh, innerWidth, innerHeight-(ht+hh));
    put(left, 0, ht, hl, hh);
    put(right, hl+hw, ht, innerWidth-(hl+hw), hh);
    let cy = r.bottom + 16;
    if (cy + ch > innerHeight - 12) cy = Math.max(12, r.top - ch - 16);
    const cx = Math.min(Math.max(12, r.left), Math.max(12, innerWidth - cw - 12));
    Object.assign(card.style, { top:cy+"px", left:cx+"px" });
  } else {
    // pas de cible : plein écran sombre, carte centrée
    Object.assign(spot.style, { opacity:0, width:"0px", height:"0px" });
    put(top, 0, 0, innerWidth, innerHeight); put(bottom, 0, 0, 0, 0); put(left, 0, 0, 0, 0); put(right, 0, 0, 0, 0);
    Object.assign(card.style, { top:Math.max(12,(innerHeight-ch)/2)+"px", left:Math.max(12,(innerWidth-cw)/2)+"px" });
  }
}

/* ---------- la grande visite (premier login) ---------- */
const FLOW_MAIN = [
  { sel:null, t:"Bienvenue dans le vestiaire", ok:"C'est parti",
    b:"Ici tu modifies TOUT le site : textes, photos, tarifs, planning… Pas besoin de connaissances techniques — et c'est toi qui pilotes cette visite : tu vas faire les gestes toi-même." },
  { sel:'#nav .navbtn[data-k="gallery"]', t:"1 · Le menu",
    b:"Chaque bouton du menu correspond à une partie du site. À toi : clique sur « Galerie ».",
    hint:"Clique sur « Galerie »", advanceOn:{ ev:"click", sel:'#nav .navbtn[data-k="gallery"]' } },
  { sel:"#pane .galgrid", t:"2 · Les photos",
    b:"Chaque vignette est une photo du site. Tu peux les glisser pour changer l'ordre, déposer des images depuis ton ordinateur pour en ajouter, et la croix (au survol) les supprime." },
  { sel:"#pane .field", t:"3 · Modifier, c'est écrire",
    do:() => renderSection("hero"),
    b:"Un texte se change en écrivant dans sa case, comme dans un document. Essaie : ajoute une lettre dans la phrase d'accueil.",
    hint:"Écris dans une case", advanceOn:{ ev:"input", sel:"#pane input, #pane textarea" } },
  { sel:"#status", t:"4 · Rien n'est en ligne",
    b:"Tu vois « Modifications non publiées » ? Tes essais sont gardés ici, mais le vrai site n'a pas bougé. « Annuler tout » ramène à la version publiée quand tu veux." },
  { sel:"#preview", t:"5 · Vérifier d'abord",
    b:"« Aperçu » ouvre le site avec TES modifications — visible par toi seul, dans un autre onglet." },
  { sel:"#publish", t:"6 · Publier",
    b:"Quand tout te plaît : « Publier ». Le site se met à jour tout seul en une minute environ. (Pas maintenant !)" },
  { sel:'#nav .navbtn[data-k="dashboard"]', t:"Besoin d'être guidé ?",
    b:"L'Accueil propose des assistants pas à pas pour chaque tâche courante : ajouter une photo, changer un tarif, modifier le planning… Bon entraînement !" },
];

/** Lance la grande visite ; sa fin (même quittée) vaut « vue ». */
function startTour(){
  runFlow(FLOW_MAIN, { onEnd:() => { try{ localStorage.setItem(TOUR_KEY, "1"); }catch(e){} } });
}

/* ---------- les assistants de l'accueil : des mains qui guident ---------- */
const FLOWS = {
  addPhoto: [
    { sel:".gadd", t:"Ajouter une photo",
      do:() => renderSection("gallery"),
      b:"Clique sur « + Ajouter une photo », puis choisis une image sur ton ordinateur.",
      hint:"Clique sur la case en pointillés", advanceOn:{ ev:"click", sel:".gadd", delay:600 } },
    { sel:null, t:"Choisis ton image", ok:"Elle est là !",
      b:"Sélectionne la photo dans la fenêtre qui s'est ouverte. Dès que l'envoi est terminé, elle apparaît au bout de la grille." },
    { sel:".galgrid .gitem:last-of-type", t:"Donne-lui une légende",
      b:"Écris une courte légende sous ta photo — elle s'affichera sur le site.",
      hint:"Écris la légende", advanceOn:{ ev:"input", sel:".gitem input" } },
    { sel:"#publish", t:"Et pour la mettre en ligne ?",
      b:"« Aperçu » pour vérifier le rendu, puis « Publier » quand tu es content. C'est tout !" },
  ],
  editTarif: [
    { sel:"#pane .card", t:"Changer un tarif",
      do:() => renderSection("tarifs"),
      b:"Chaque carte est une offre de la page Tarifs. Change un prix, un nom ou une note directement dans les cases.",
      hint:"Modifie une case", advanceOn:{ ev:"input", sel:"#pane input, #pane textarea" } },
    { sel:"#preview", t:"Vérifie le rendu",
      b:"« Aperçu » te montre la page Tarifs avec ton nouveau prix, sans rien publier." },
    { sel:"#publish", t:"Mets-le en ligne",
      b:"Quand c'est bon : « Publier ». Le site est à jour en une minute." },
  ],
  editPlanning: [
    { sel:"#pane .card", t:"Le planning",
      do:() => renderSection("planning"),
      b:"Chaque carte est un jour ; chaque ligne un créneau (heure · cours)." },
    { sel:"#pane .slot-h", t:"Déplacer un créneau",
      b:"La poignée ⠿ déplace un créneau en le glissant — même vers un autre jour. La croix le supprime." },
    { sel:"#pane .card .btn.ghost", t:"Ajouter un créneau",
      b:"À toi : clique sur « + Créneau » pour en ajouter un au premier jour.",
      hint:"Clique sur « + Créneau »", advanceOn:{ ev:"click", sel:"#pane .card .btn.ghost" } },
    { sel:"#pane .slot:last-of-type", t:"Remplis-le",
      b:"Écris l'heure (ex. 18:30) et le nom du cours. Puis « Publier » quand le planning te plaît." },
  ],
  editText: [
    { sel:"#nav", t:"Changer un texte",
      b:"Choisis dans le menu la partie du site à modifier — par exemple « Coordonnées & club » ou « Phrase d'accueil ».",
      hint:"Clique une section du menu", advanceOn:{ ev:"click", sel:"#nav .navbtn" } },
    { sel:"#pane", t:"Écris, c'est tout",
      b:"Modifie le texte directement dans les cases. Ce que tu écris ici est ce que les visiteurs liront.",
      hint:"Modifie une case", advanceOn:{ ev:"input", sel:"#pane input, #pane textarea" } },
    { sel:"#publish", t:"En ligne en une minute",
      b:"« Aperçu » pour relire sur le vrai site, « Publier » pour mettre en ligne, « Annuler tout » pour jeter tes essais." },
  ],
};
