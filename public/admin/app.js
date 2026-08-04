/* ============================================================
   LE VESTIAIRE — application du backoffice.
   Tout le contenu du site vit dans src/content.json ; ce fichier
   génère les formulaires depuis SCHEMA, suit les modifications
   (brouillon local + aperçu), et publie via l'API (commit GitHub
   + rebuild Vercel). La visite guidée vit dans tour.js.
   Sommaire :
     1. état & helpers          5. sections spéciales (planning,
     2. schéma des contenus        galerie, seo, accueil, communauté)
     3. brouillon & aperçu      6. upload d'images (Cloudinary signé)
     4. champs de formulaire    7. charger / publier / naviguer
                                8. démarrage
   ============================================================ */

/* ---------- 1. état & helpers ---------- */
const API = ""; // même origine
let TOKEN = sessionStorage.getItem("bcp_admin") || "";
let DATA = {};           // le modèle : une copie de content.json
let CURRENT = "dashboard"; // section affichée
let DEV_MODE = false;    // vite dev (pas d'API serverless) : contenu réel, publication désactivée

/** Crée un élément. `class`/`html` sont traités à part, `on*` deviennent des listeners. */
const el = (t, a = {}, ...kids) => {
  const n = document.createElement(t);
  for (const k in a) {
    if (k === "class") n.className = a[k];
    else if (k === "html") n.innerHTML = a[k];
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), a[k]);
    else n.setAttribute(k, a[k]);
  }
  for (const c of kids) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};
const setStatus = (msg, cls = "") => {
  const s = document.getElementById("status");
  s.textContent = msg; s.className = "status " + cls;
};

/* icônes de navigation — tracées à la main, trait 1.8, cohérentes avec le site */
const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICONS = {
  dashboard: I('<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>'),
  site: I('<path d="M12 21s-7-5.1-7-11a7 7 0 0 1 14 0c0 5.9-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/>'),
  hero: I('<path d="M10 8H5v5h5v3.5c0 1.5-1 2.5-2.5 2.5"/><path d="M19 8h-5v5h5v3.5c0 1.5-1 2.5-2.5 2.5"/>'),
  stats: I('<path d="M5 20v-7"/><path d="M11 20V5"/><path d="M17 20v-10"/><path d="M2.5 20h19"/>'),
  disciplines: I('<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r=".7"/>'),
  audiences: I('<circle cx="9" cy="8" r="3.1"/><path d="M3.2 19.5c.5-3 2.9-5 5.8-5s5.3 2 5.8 5"/><circle cx="17" cy="9" r="2.3"/><path d="M17.5 14.6c2.1.6 3.3 2.3 3.6 4.4"/>'),
  team: I('<circle cx="12" cy="14.5" r="5"/><path d="M9.4 10.3 6.5 3.5"/><path d="M14.6 10.3l2.9-6.8"/>'),
  values: I('<path d="M12 4.5v15"/><path d="M8.5 19.5h7"/><path d="M4.5 7.5h15"/><path d="m6.5 7.5-2.3 5.2a2.7 2.7 0 0 0 5 0L6.5 7.5Z"/><path d="m17.5 7.5-2.3 5.2a2.7 2.7 0 0 0 5 0l-2.7-5.2Z"/>'),
  tarifs: I('<path d="M3.5 11.5v-8h8l9 9-8 8-9-9Z"/><circle cx="8.2" cy="8.2" r="1.5"/>'),
  planning: I('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>'),
  gallery: I('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4.5 17.5 5-4.5 3.5 3 3-2.5 3.5 3.5"/>'),
  seo: I('<circle cx="11" cy="11" r="6.5"/><path d="m20.5 20.5-4.9-4.9"/>'),
  community: I('<path d="M21 11.5c0 4.1-4 7.5-9 7.5-1 0-2-.1-2.9-.4L4 20l1.2-3.4A6.9 6.9 0 0 1 3 11.5C3 7.4 7 4 12 4s9 3.4 9 7.5Z"/>'),
  text: I('<path d="M4 6V4h16v2"/><path d="M12 4v16"/><path d="M9 20h6"/>'),
  play: I('<circle cx="12" cy="12" r="8.5"/><path d="m10 8.5 5 3.5-5 3.5v-7Z"/>'),
};

/* ---------- 2. schéma : chaque entrée pilote la génération d'un formulaire ---------- */
const SCHEMA = {
  dashboard: { label:"Accueil", type:"dashboard" },
  site: { label:"Coordonnées & club", intro:"Nom, contact, horaires et chiffres de la salle.", type:"object", fields:[
    {k:"name",label:"Nom du club"},
    {k:"baseline",label:"Accroche courte"},
    {k:"claim",label:"Phrase clé",ml:true},
    {k:"phone",label:"Téléphone (affiché)"},
    {k:"phoneHref",label:"Téléphone (lien, ex +33562244682)"},
    {k:"email",label:"Email"},
    {k:"hours",label:"Horaires (texte affiché)"},
    {k:"address",label:"Adresse",type:"object",fields:[{k:"street",label:"Rue"},{k:"zip",label:"Code postal"},{k:"city",label:"Ville"}]},
    {k:"hoursData",label:"Horaires détaillés",type:"list",singular:"créneau",item:[{k:"d",label:"Jour(s)"},{k:"h",label:"Heures"}]},
    {k:"federations",label:"Fédérations",type:"strlist"},
    {k:"surfaces",label:"Chiffres / surfaces",type:"list",singular:"chiffre",item:[{k:"label",label:"Libellé"},{k:"value",label:"Valeur"}]},
    {k:"social",label:"Réseaux sociaux",type:"object",fields:[{k:"facebook",label:"Facebook (URL)"},{k:"instagram",label:"Instagram (URL)"},{k:"parent",label:"Site du groupe (URL)"}]},
  ]},
  hero: { label:"Phrase d'accueil", intro:"Les deux lignes de la phrase d'accroche en haut de la page d'accueil.", type:"object", fields:[
    {k:"hookLine1",label:"Ligne 1"},{k:"hookLine2",label:"Ligne 2"},
  ]},
  stats: { label:"Chiffres clés", intro:"Les compteurs animés (accueil).", type:"list", singular:"chiffre", item:[
    {k:"value",label:"Valeur"},{k:"suffix",label:"Suffixe"},{k:"label",label:"Légende"},
  ]},
  disciplines: { label:"Disciplines", intro:"Les disciplines affichées partout (reel, page Activités).", type:"list", singular:"discipline", item:[
    {k:"key",label:"N°"},{k:"name",label:"Nom"},{k:"tag",label:"Tag"},{k:"desc",label:"Description",ml:true},
    {k:"img",label:"Image",img:true,hint:"N'importe quelle photo convient : elle est optimisée et recadrée automatiquement (le sujet reste dans le cadre). Idéal : une photo d'action nette."},
  ]},
  audiences: { label:"Publics", intro:"« Pour qui » — enfants, femmes, débutants, compétiteurs.", type:"list", singular:"public", item:[
    {k:"tag",label:"Tag"},{k:"title",label:"Titre"},{k:"desc",label:"Description",ml:true},
  ]},
  team: { label:"Coachs", intro:"L'équipe affichée dans la forge et la page Coachs.", type:"list", singular:"coach", item:[
    {k:"name",label:"Nom"},{k:"role",label:"Rôle"},{k:"kind",label:"Catégorie"},{k:"initials",label:"Initiales"},{k:"desc",label:"Description",ml:true},
    {k:"img",label:"Photo",img:true,hint:"Idéal : photo en pied sur fond transparent (PNG détouré) — c'est ce qui donne l'effet « forge ». Une photo classique marche aussi, elle s'affichera telle quelle."},
  ]},
  values: { label:"Valeurs", intro:"Les valeurs du club.", type:"list", singular:"valeur", item:[
    {k:"n",label:"N°"},{k:"title",label:"Titre"},{k:"desc",label:"Description",ml:true},
  ]},
  tarifs: { label:"Tarifs", intro:"Les offres affichées sur la page Tarifs (et le schéma SEO).", type:"list", singular:"tarif", item:[
    {k:"name",label:"Nom"},{k:"price",label:"Prix"},{k:"unit",label:"Unité"},{k:"note",label:"Note",ml:true},{k:"feature",label:"Mettre en avant",bool:true},
  ]},
  planning: { label:"Planning", intro:"Le planning de la semaine. Glisse les créneaux avec la poignée ⠿ pour les réordonner — même d'un jour à l'autre.", type:"planning" },
  gallery: { label:"Galerie", intro:"Les photos du site. Glisse une vignette pour changer l'ordre, dépose des images depuis ton ordinateur pour en ajouter. Aucune taille à respecter : chaque photo est compressée et recadrée automatiquement selon son format.", type:"gallery" },
  seo: { label:"Référencement Google", intro:"Le titre et la petite description de chaque page telle qu'elle apparaît sur Google.", type:"seo" },
};
const PAGE_LABELS = {home:"Accueil",activites:"Activités",salles:"Le club",coachs:"Coachs",galerie:"Galerie",plannings:"Planning",tarifs:"Tarifs",contact:"Contact"};

/* ---------- 3. brouillon local, état "modifié", aperçu ---------- */
const DRAFT_KEY = "bcp:draft";
let DIRTY = false, draftT;

/* le brouillon est réécrit (débouncé) à chaque frappe : rien ne se perd jamais */
function saveDraft(){ clearTimeout(draftT); draftT = setTimeout(() => { try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(DATA)); }catch(e){} }, 400); }
function markDirty(){ DIRTY = true; saveDraft(); updateDirtyUI(); }
function clearDirty(){ DIRTY = false; try{ localStorage.removeItem(DRAFT_KEY); }catch(e){} updateDirtyUI(); }
function updateDirtyUI(){
  document.getElementById("publish").classList.toggle("attn", DIRTY);
  if (DIRTY) setStatus("Modifications non publiées");
  if (CURRENT === "dashboard") renderSection("dashboard"); // la lampe de l'accueil suit l'état
}
window.addEventListener("beforeunload", (e) => { if (DIRTY){ e.preventDefault(); e.returnValue = ""; } });

/* aperçu instantané : le site lit ce brouillon via /?apercu=1 — rien n'est publié */
function openPreview(){
  try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(DATA)); }catch(e){}
  window.open("/?apercu=1", "bcp-apercu");
}

/* réordonner un tableau par glisser-déposer (SortableJS) */
function makeSortable(container, arr, redraw, opts = {}){
  if (!window.Sortable) return;
  new Sortable(container, { handle:".handle", animation:150, ghostClass:"drag-ghost", chosenClass:"drag-chosen", ...opts,
    onEnd: (e) => {
      if (e.oldIndex === e.newIndex) return;
      const [m] = arr.splice(e.oldIndex, 1); arr.splice(e.newIndex, 0, m);
      markDirty(); redraw();
    }});
}

/* ---------- 4. champs de formulaire ---------- */
function textField(label, val, ml, onInput){
  const inp = ml ? el("textarea") : el("input", { type:"text" });
  inp.value = val == null ? "" : val;
  inp.addEventListener("input", () => onInput(inp.value));
  return el("div", { class:"field" }, el("label", {}, label), inp);
}
function boolField(label, val, onInput){
  const cb = el("input", { type:"checkbox" });
  cb.checked = !!val;
  cb.addEventListener("change", () => onInput(cb.checked));
  return el("div", { class:"field" }, el("label", { class:"chk" }, cb, label));
}

/** Vignette réduite d'une image (transform Cloudinary ou variante WebP locale, avec repli). */
function thumbOf(src){
  if (!src) return "";
  const c = src.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
  if (c) return `url("${c[1]}f_auto,q_auto,c_limit,w_480/${c[2]}")`;
  if (/^\/img\//.test(src)) return `url("/img/opt/${src.slice(5).replace(/\.[a-z]+$/i, "")}-480.webp"), url("${src}")`;
  return `url("${src}")`;
}
function imageField(label, val, onInput, hint){
  const thumb = el("div", { class:"thumb", title:"Dépose une image ici" });
  if (val) thumb.style.backgroundImage = thumbOf(val);
  const urlInp = el("input", { type:"text" });
  urlInp.value = val || ""; urlInp.placeholder = "/img/… ou URL";
  urlInp.addEventListener("input", () => { onInput(urlInp.value); thumb.style.backgroundImage = thumbOf(urlInp.value); });
  const set = (u) => { urlInp.value = u; onInput(u); thumb.style.backgroundImage = thumbOf(u); markDirty(); };
  const up = el("button", { class:"btn ghost sm", type:"button" }, "Choisir une image…");
  up.addEventListener("click", () => pickAndUpload(set));
  // dépôt direct d'un fichier sur la vignette
  ["dragover","dragleave","drop"].forEach((ev) => thumb.addEventListener(ev, async (e) => {
    e.preventDefault(); thumb.classList.toggle("dropzone-on", ev === "dragover");
    if (ev !== "drop") return;
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith("image/")); if (!f) return;
    setStatus("Téléversement de l'image…");
    try{ set(await uploadFile(f)); setStatus("Image ajoutée ✓" + (uploadFile.lastNote || ""), "ok"); }
    catch(err){ if (err.message !== "dev-mode") setStatus("Échec du téléversement.","bad"); }
  }));
  return el("div", { class:"field" }, el("label", {}, label),
    el("div", { class:"imgfield" }, thumb,
      el("div", { class:"grow" }, urlInp,
        el("div", { style:"margin-top:8px" }, up),
        hint ? el("p", { class:"img-hint" }, hint) : null)));
}
function strListField(label, arr, onChange){
  const wrap = el("div", { class:"field strlist" }, el("label", {}, label));
  const row = el("div", { class:"chiprow" });
  const draw = () => { row.innerHTML = ""; arr.forEach((v, i) => {
    row.append(el("span", { class:"chip" }, v, el("button", { type:"button", onclick:() => { arr.splice(i,1); onChange(arr); markDirty(); draw(); } }, "×")));
  }); };
  const add = el("input", { type:"text", class:"no-dirty", placeholder:"Ajouter puis Entrée…" });
  add.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const v = add.value.trim();
    if (v){ arr.push(v); add.value = ""; onChange(arr); markDirty(); draw(); }
  });
  draw(); wrap.append(row, add); return wrap;
}

/* rend les champs d'un objet dans `parent`, en mutant `obj` en place */
function renderObjectFields(parent, fields, obj){
  fields.forEach((f) => {
    if (f.type === "object"){
      obj[f.k] = obj[f.k] || {};
      parent.append(el("div", { class:"card" }, el("div", { class:"card-head" }, el("span", { class:"t" }, f.label)),
        (() => { const box = el("div"); renderObjectFields(box, f.fields, obj[f.k]); return box; })()));
    } else if (f.type === "list"){
      obj[f.k] = Array.isArray(obj[f.k]) ? obj[f.k] : [];
      parent.append(listCard(f.label, f.singular || "élément", f.item, obj[f.k]));
    } else if (f.type === "strlist"){
      obj[f.k] = Array.isArray(obj[f.k]) ? obj[f.k] : [];
      parent.append(strListField(f.label, obj[f.k], () => {}));
    } else if (f.img){ parent.append(imageField(f.label, obj[f.k], (v) => obj[f.k] = v, f.hint));
    } else if (f.bool){ parent.append(boolField(f.label, obj[f.k], (v) => obj[f.k] = v));
    } else { parent.append(textField(f.label, obj[f.k], f.ml, (v) => obj[f.k] = v)); }
  });
}

/* liste répétable d'objets : ajouter / supprimer / glisser pour réordonner */
function listCard(label, singular, itemSchema, arr){
  const host = el("div");
  const draw = () => {
    host.innerHTML = "";
    const box = el("div");
    arr.forEach((it, i) => {
      const body = el("div");
      renderObjectFields(body, itemSchema, it);
      const ctrls = el("div", { class:"ctrls" },
        el("span", { class:"handle", title:"Glisser pour changer l'ordre" }, "⠿"));
      if (!window.Sortable){ // repli clavier si le drag n'est pas disponible
        ctrls.append(
          el("button", { class:"iconbtn", type:"button", title:"Monter", onclick:() => { if (i > 0){ [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; markDirty(); draw(); } } }, "↑"),
          el("button", { class:"iconbtn", type:"button", title:"Descendre", onclick:() => { if (i < arr.length-1){ [arr[i+1], arr[i]] = [arr[i], arr[i+1]]; markDirty(); draw(); } } }, "↓"));
      }
      ctrls.append(el("button", { class:"iconbtn", type:"button", title:"Supprimer", onclick:() => { if (confirm("Supprimer cet élément ?")){ arr.splice(i,1); markDirty(); draw(); } } }, "🗑"));
      box.append(el("div", { class:"card" },
        el("div", { class:"card-head" },
          el("span", { class:"t" }, `${singular.charAt(0).toUpperCase() + singular.slice(1)} ${i+1}`),
          ctrls),
        body));
    });
    host.append(box);
    host.append(el("div", { class:"add-row" },
      el("button", { class:"btn ghost sm", type:"button", onclick:() => { const o = {}; itemSchema.forEach((f) => o[f.k] = f.bool ? false : ""); arr.push(o); markDirty(); draw(); } }, `+ Ajouter un(e) ${singular}`)));
    makeSortable(box, arr, draw);
  };
  draw();
  return el("div", {}, el("div", { style:"display:flex;justify-content:space-between;align-items:baseline" }, el("h3", { style:"margin:6px 0 10px;font-size:15px" }, label)), host);
}

/* ---------- 5. sections spéciales ---------- */

/* planning : jour -> [ [heure, cours], ... ] — jours ET créneaux réordonnables
   par glisser-déposer ; un créneau peut même changer de jour. */
function renderPlanning(parent, arr){
  const host = el("div");
  const draw = () => {
    host.innerHTML = "";
    const daysBox = el("div");
    arr.forEach((day, di) => {
      day.items = Array.isArray(day.items) ? day.items : [];
      const slots = el("div", { class:"slotsbox", "data-di":String(di) });
      day.items.forEach((pair, pi) => {
        if (!Array.isArray(pair)){ pair = ["",""]; day.items[pi] = pair; }
        const t = el("input", { type:"text" }); t.value = pair[0] || ""; t.placeholder = "18:30"; t.addEventListener("input", () => pair[0] = t.value);
        const c = el("input", { type:"text" }); c.value = pair[1] || ""; c.placeholder = "Boxe Anglaise"; c.addEventListener("input", () => pair[1] = c.value);
        slots.append(el("div", { class:"slot" },
          el("span", { class:"handle slot-h", title:"Glisser (même vers un autre jour)" }, "⠿"),
          t, c,
          el("button", { class:"iconbtn", type:"button", title:"Supprimer le créneau", onclick:() => { day.items.splice(pi,1); markDirty(); draw(); } }, "×")));
      });
      if (window.Sortable) new Sortable(slots, { handle:".slot-h", group:"bcp-slots", animation:150, ghostClass:"drag-ghost", chosenClass:"drag-chosen",
        onEnd: (e) => {
          const from = +e.from.dataset.di, to = +e.to.dataset.di;
          if (from === to && e.oldIndex === e.newIndex) return;
          const [m] = arr[from].items.splice(e.oldIndex, 1);
          arr[to].items.splice(e.newIndex, 0, m);
          markDirty(); draw();
        }});
      const dayName = el("input", { type:"text" }); dayName.value = day.day || ""; dayName.addEventListener("input", () => day.day = dayName.value);
      daysBox.append(el("div", { class:"card" },
        el("div", { class:"card-head" },
          el("span", { class:"t" }, day.day || "Jour"),
          el("div", { class:"ctrls" },
            el("span", { class:"handle day-h", title:"Glisser pour déplacer le jour" }, "⠿"),
            el("button", { class:"iconbtn", type:"button", title:"Supprimer le jour", onclick:() => { if (confirm("Supprimer ce jour ?")){ arr.splice(di,1); markDirty(); draw(); } } }, "🗑"))),
        el("div", { class:"field" }, el("label", {}, "Nom du jour"), dayName),
        el("label", {}, "Créneaux (heure · cours)"), slots,
        el("button", { class:"btn ghost sm", type:"button", onclick:() => { day.items.push(["",""]); markDirty(); draw(); } }, "+ Créneau")));
    });
    host.append(daysBox);
    host.append(el("div", { class:"add-row" }, el("button", { class:"btn ghost sm", type:"button", onclick:() => { arr.push({ day:"", items:[] }); markDirty(); draw(); } }, "+ Ajouter un jour")));
    makeSortable(daysBox, arr, draw, { handle:".day-h" });
  };
  draw(); parent.append(host);
}

/* galerie : grille de vignettes drag & drop + dépôt de fichiers, façon médiathèque */
function renderGallery(parent, arr){
  const host = el("div");
  const draw = () => {
    host.innerHTML = "";
    const grid = el("div", { class:"galgrid" });
    arr.forEach((g, i) => {
      const img = el("div", { class:"gimg" });
      if (g.src) img.style.backgroundImage = thumbOf(g.src);
      img.append(el("button", { class:"gdel", type:"button", title:"Supprimer cette photo", onclick:() => { if (confirm("Supprimer cette photo ?")){ arr.splice(i,1); markDirty(); draw(); } } }, "×"));
      const cap = el("input", { type:"text", placeholder:"Légende…" });
      cap.value = g.label || ""; cap.addEventListener("input", () => g.label = cap.value);
      const fmt = el("select");
      [["","Format : normal"],["wide","Format : large (2 colonnes)"],["tall","Format : haut (2 rangées)"]]
        .forEach(([v, l]) => fmt.append(el("option", { value:v }, l)));
      fmt.value = g.span || ""; fmt.addEventListener("change", () => g.span = fmt.value);
      grid.append(el("div", { class:"gitem" }, img, el("div", { class:"gbody" }, cap, fmt)));
    });
    grid.append(el("button", { class:"gadd", type:"button",
      onclick:() => pickAndUpload((u) => { arr.push({ src:u, label:"", span:"" }); markDirty(); draw(); }) },
      "+ Ajouter une photo\n(ou dépose des images ici)"));
    host.append(grid);
    if (window.Sortable) new Sortable(grid, { animation:150, draggable:".gitem", filter:"input,select,button", preventOnFilter:false,
      ghostClass:"drag-ghost", chosenClass:"drag-chosen",
      onEnd: (e) => {
        if (e.oldIndex === e.newIndex) return;
        const [m] = arr.splice(e.oldIndex, 1); arr.splice(e.newIndex, 0, m);
        markDirty(); draw();
      }});
    // dépôt de fichiers depuis le bureau (multi)
    ["dragover","dragleave","drop"].forEach((ev) => grid.addEventListener(ev, async (e) => {
      if (!e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return;
      e.preventDefault(); grid.classList.toggle("dropping", ev === "dragover");
      if (ev !== "drop") return;
      const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      let ok = 0;
      for (let i = 0; i < files.length; i++){
        setStatus(`Envoi ${i + 1} / ${files.length}…`);
        try{ arr.push({ src:await uploadFile(files[i]), label:"", span:"" }); ok++; markDirty(); }
        catch(err){ if (err.message === "dev-mode") return; }
      }
      setStatus(ok ? `${ok} image(s) ajoutée(s) ✓` : "Échec du téléversement.", ok ? "ok" : "bad");
      draw();
    }));
  };
  draw(); parent.append(host);
}

/* seo : titre + description par page */
function renderSeo(parent, obj){
  Object.keys(PAGE_LABELS).forEach((pg) => {
    obj[pg] = obj[pg] || { title:"", description:"" };
    const o = obj[pg];
    const card = el("div", { class:"card" }, el("div", { class:"card-head" }, el("span", { class:"t" }, PAGE_LABELS[pg])));
    card.append(textField("Titre (balise <title>)", o.title, false, (v) => o.title = v));
    card.append(textField("Description (meta description)", o.description, true, (v) => o.description = v));
    parent.append(card);
  });
}

/* accueil : état du site + assistants pas-à-pas (les FLOWS vivent dans tour.js) */
function renderDashboard(pane){
  const hour = new Date().getHours();
  pane.append(el("div", { class:"dash-hero" },
    el("span", { class:"dash-kick" }, "Boxing Center · Portet-sur-Garonne"),
    el("h3", {}, hour < 18 ? "Bonjour coach." : "Bonsoir coach."),
    el("p", {}, "Qu'est-ce qu'on améliore aujourd'hui ?")));

  const st = el("div", { class:"dash-status" + (DIRTY ? " dirty" : "") },
    el("span", { class:"lamp" }),
    el("p", {}, DIRTY
      ? "Des modifications attendent d'être publiées. Elles sont enregistrées ici, mais pas encore en ligne."
      : "Tout est en ligne. Le site affiche la dernière version publiée."),
    el("button", { class:"btn ghost sm", type:"button", onclick:openPreview }, "Aperçu"),
    DIRTY ? el("button", { class:"btn sm", type:"button", onclick:publish }, "Publier") : null);
  pane.append(st);

  pane.append(el("p", { class:"dash-title" }, "Assistants — guidé pas à pas"));
  const wiz = (flow, icon, title, desc) =>
    el("button", { class:"wiz", type:"button", onclick:() => runFlow(FLOWS[flow]) },
      el("span", { class:"nico", html:icon }), el("b", {}, title), el("span", {}, desc));
  pane.append(el("div", { class:"wizgrid" },
    wiz("addPhoto", ICONS.gallery, "Ajouter une photo", "De ton ordinateur jusqu'à la galerie du site, guidé à chaque clic."),
    wiz("editTarif", ICONS.tarifs, "Changer un tarif", "Modifier un prix ou une offre, et le mettre en ligne."),
    wiz("editPlanning", ICONS.planning, "Modifier le planning", "Ajouter, déplacer ou supprimer un créneau de cours."),
    wiz("editText", ICONS.text, "Changer un texte", "N'importe quel texte du site, section par section."),
    el("button", { class:"wiz", type:"button", onclick:() => startTour() },
      el("span", { class:"nico", html:ICONS.play }), el("b", {}, "Revoir la visite"), el("span", {}, "Le tour complet du vestiaire, en 2 minutes."))));
}

/* modération communauté */
async function renderCommunity(pane){
  pane.append(el("p", { class:"sec-intro" }, "Valide ou refuse les photos et vidéos envoyées par les membres avant qu'elles n'apparaissent sur le site."));
  if (DEV_MODE){ pane.append(el("div", { class:"empty" }, "Mode local — la modération ne marche qu'en ligne.")); return; }
  const list = el("div"); pane.append(list);
  list.append(el("p", { class:"status" }, "Chargement…"));
  try{
    const r = await fetch(`${API}/api/community/pending`, { headers:{ "x-admin-token":TOKEN } });
    if (r.status === 401) return logout();
    const j = await r.json(); const items = j.items || [];
    list.innerHTML = "";
    if (!items.length){ list.append(el("div", { class:"empty" }, "Rien en attente. Tout est à jour.")); return; }
    items.forEach((it) => {
      const when = it.createdAt ? new Date(it.createdAt).toLocaleDateString("fr-FR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }) : "";
      const dur = it.duration ? ` · ${Math.round(it.duration)}s` : "";
      const busy = (row, on) => row.querySelectorAll("button").forEach((b) => { b.disabled = on; });
      const media = it.rtype === "image"
        ? el("img", { src:it.src, alt:it.title || "", loading:"lazy", style:"max-width:220px;border-radius:8px" })
        : el("video", { src:it.src, controls:"", preload:"metadata" });
      const row = el("div", { class:"mod-item" },
        media,
        el("div", { class:"meta" }, el("div", { style:"font-weight:700" }, it.title || "(sans titre)"),
          el("div", { class:"status" }, [it.author ? ("par " + it.author) : "", when + dur].filter(Boolean).join(" · "))),
        el("div", { style:"display:flex;gap:8px" },
          el("button", { class:"btn sm", onclick:async (e) => { busy(row, true); e.target.textContent = "…"; try { const r = await moderate(it.id, "approve", it.rtype); if (r && r.error) alert(r.error); } finally { renderSection("community"); } } }, "Approuver"),
          el("button", { class:"btn danger sm", onclick:async () => { if (confirm("Refuser et supprimer ?")){ busy(row, true); await moderate(it.id, "reject", it.rtype); renderSection("community"); } } }, "Refuser")));
      list.append(row);
    });
  }catch(e){ list.innerHTML = ""; list.append(el("div", { class:"empty" }, "Erreur de chargement.")); }
}
async function moderate(id, action, rtype){
  const r = await fetch(`${API}/api/community/moderate`, { method:"POST", headers:{ "Content-Type":"application/json", "x-admin-token":TOKEN }, body:JSON.stringify({ id, action, rtype }) });
  return r.json().catch(() => ({}));
}

/* ---------- 6. upload d'images (Cloudinary, signé côté serveur) ----------
   Le patron uploade N'IMPORTE quelle photo (8 Mo, verticale, de travers…) :
   1. prepareImage la redresse (EXIF), la réduit à 2000 px max et la compresse
      en WebP AVANT l'envoi → upload rapide même sur le wifi de la salle ;
   2. le site la recadre ensuite par slot (ratio + cadrage IA, voir src/img.ts).
   Il n'y a donc AUCUNE taille à respecter — c'est nous qui convertissons. */
const MAX_PX = 2000;      // plus grand côté après réduction (le site n'affiche jamais plus de 1440)
const SMALL_PX = 800;     // en-dessous : risque de flou sur grand écran → on prévient
const fmtMo = (b) => (b / 1048576).toFixed(1).replace(".", ",") + " Mo";

async function prepareImage(file){
  let bmp;
  // HEIC/format exotique : le navigateur ne sait pas le décoder → on envoie
  // l'original, Cloudinary le convertit côté serveur.
  try{ bmp = await createImageBitmap(file, { imageOrientation:"from-image" }); }
  catch(e){ return { blob:file, note:"", small:false }; }
  const w = bmp.width, h = bmp.height;
  const small = Math.max(w, h) < SMALL_PX;
  if (Math.max(w, h) <= MAX_PX && file.size <= 900_000){ bmp.close(); return { blob:file, note:"", small }; }
  const s = Math.min(1, MAX_PX / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * s); canvas.height = Math.round(h * s);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const out = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.85));
  if (!out || out.size >= file.size) return { blob:file, note:"", small };
  return {
    blob: new File([out], file.name.replace(/\.\w+$/, "") + ".webp", { type:"image/webp" }),
    note: ` (optimisée : ${fmtMo(file.size)} → ${fmtMo(out.size)})`,
    small,
  };
}

async function uploadFile(file){
  if (DEV_MODE){ setStatus("Mode local : l'envoi d'images ne marche qu'en ligne.","bad"); throw new Error("dev-mode"); }
  const prep = await prepareImage(file);
  const sr = await fetch(`${API}/api/admin/media-sign`, { method:"POST", headers:{ "x-admin-token":TOKEN } });
  if (sr.status === 401){ logout(); throw new Error("auth"); }
  const s = await sr.json();
  const fd = new FormData();
  fd.append("file", prep.blob); fd.append("api_key", s.apiKey); fd.append("timestamp", s.timestamp);
  fd.append("folder", s.folder); fd.append("signature", s.signature);
  const up = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, { method:"POST", body:fd });
  const u = await up.json();
  if (!u.secure_url) throw new Error("upload");
  uploadFile.lastNote = prep.small
    ? " — ⚠ image petite (moins de 800 px) : elle risque d'être floue sur grand écran"
    : (prep.note || "");
  return u.secure_url;
}
function pickAndUpload(done){
  const inp = el("input", { type:"file", accept:"image/*" });
  inp.addEventListener("change", async () => {
    const file = inp.files[0]; if (!file) return;
    setStatus("Téléversement de l'image…");
    try{ done(await uploadFile(file)); markDirty(); setStatus("Image ajoutée ✓" + (uploadFile.lastNote || ""), "ok"); }
    catch(e){ if (e.message !== "dev-mode") setStatus("Échec du téléversement.","bad"); }
  });
  inp.click();
}

/* ---------- 7. charger / publier / naviguer ---------- */
function renderSection(key){
  CURRENT = key;
  document.querySelectorAll(".navbtn[data-k]").forEach((b) => b.classList.toggle("active", b.dataset.k === key));
  const pane = document.getElementById("pane"); pane.innerHTML = "";
  const title = document.getElementById("paneTitle");
  if (key === "community"){ title.textContent = "Communauté · modération"; return renderCommunity(pane); }
  const sc = SCHEMA[key]; title.textContent = sc.label;
  if (sc.type === "dashboard") return renderDashboard(pane);
  if (sc.intro) pane.append(el("p", { class:"sec-intro" }, sc.intro));
  if (sc.type === "object"){ DATA[key] = DATA[key] || {}; renderObjectFields(pane, sc.fields, DATA[key]); }
  else if (sc.type === "list"){ DATA[key] = Array.isArray(DATA[key]) ? DATA[key] : []; pane.append(listCard(sc.label, sc.singular, sc.item, DATA[key])); }
  else if (sc.type === "planning"){ DATA[key] = Array.isArray(DATA[key]) ? DATA[key] : []; renderPlanning(pane, DATA[key]); }
  else if (sc.type === "gallery"){ DATA[key] = Array.isArray(DATA[key]) ? DATA[key] : []; renderGallery(pane, DATA[key]); }
  else if (sc.type === "seo"){ DATA[key] = DATA[key] || {}; renderSeo(pane, DATA[key]); }
}

function removeDraftBar(){ document.getElementById("draftbar")?.remove(); }
function showDraftBar(draft){
  removeDraftBar();
  const bar = el("div", { class:"draftbar", id:"draftbar" },
    el("span", {}, "Un brouillon non publié a été retrouvé sur cet ordinateur."),
    el("button", { class:"btn sm", type:"button", onclick:() => { DATA = draft; DIRTY = true; updateDirtyUI(); removeDraftBar(); renderSection(CURRENT); } }, "Reprendre le brouillon"),
    el("button", { class:"btn ghost sm", type:"button", onclick:() => { try{ localStorage.removeItem(DRAFT_KEY); }catch(e){} removeDraftBar(); } }, "L'ignorer"));
  const content = document.getElementById("pane");
  content.parentElement.insertBefore(bar, content);
}

async function load(){
  setStatus("Chargement…");
  try{
    const r = await fetch(`${API}/api/admin/content`, { headers:{ "x-admin-token":TOKEN } });
    if (r.status === 401) return logout();
    if (!r.ok){ setStatus("Erreur de chargement (" + r.status + ")","bad"); return; }
    if ((r.headers.get("content-type") || "").includes("application/json")){
      const j = await r.json(); DATA = j.content || {};
    } else {
      // vite dev sert /api/* en fichiers statiques : pas d'API → mode local complet
      DEV_MODE = true;
      DATA = await fetch("/src/content.json").then((x) => x.json());
    }
    let draft = null; try{ draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); }catch(e){}
    if (draft && typeof draft === "object" && JSON.stringify(draft) !== JSON.stringify(DATA)) showDraftBar(draft);
    setStatus(DEV_MODE ? "Mode local — publication désactivée" : "Chargé ✓", DEV_MODE ? "" : "ok");
    renderSection(CURRENT);
  }catch(e){ setStatus("Erreur réseau.","bad"); }
}
async function publish(){
  if (DEV_MODE) return setStatus("Mode local : la publication ne marche qu'en ligne.","bad");
  if (!confirm("Publier les modifications ? Le site se met à jour automatiquement (~1 minute).")) return;
  setStatus("Publication…");
  try{
    const r = await fetch(`${API}/api/admin/content`, { method:"POST", headers:{ "Content-Type":"application/json", "x-admin-token":TOKEN }, body:JSON.stringify({ content:DATA }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok){ clearDirty(); removeDraftBar(); setStatus(j.rebuild ? "Publié ✓ — le site se met à jour (~1 min)" : "Publié ✓ (pense à reconstruire)","ok"); }
    else setStatus("Échec : " + (j.error || r.status),"bad");
  }catch(e){ setStatus("Erreur réseau.","bad"); }
}

function buildNav(){
  const nav = document.getElementById("nav"); nav.innerHTML = "";
  Object.keys(SCHEMA).forEach((k) => nav.append(el("button", { class:"navbtn", "data-k":k, onclick:() => renderSection(k),
    html:`<span class="nico">${ICONS[k] || ""}</span><span>${SCHEMA[k].label}</span>` })));
  nav.append(el("div", { style:"height:1px;background:var(--line);margin:10px 8px" }));
  nav.append(el("button", { class:"navbtn", "data-k":"community", onclick:() => renderSection("community"),
    html:`<span class="nico">${ICONS.community}</span><span>Communauté</span>` }));
}
function showApp(){
  document.getElementById("login").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  buildNav();
  load().then(() => { try{ if (!localStorage.getItem(TOUR_KEY)) setTimeout(startTour, 500); }catch(e){} });
}
function logout(){ sessionStorage.removeItem("bcp_admin"); TOKEN = ""; DIRTY = false; location.reload(); }

/* ---------- 8. démarrage ---------- */
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = document.getElementById("token").value.trim(); if (!t) return;
  const errEl = document.getElementById("loginErr");
  errEl.textContent = "";
  const r = await fetch(`${API}/api/admin/content`, { headers:{ "x-admin-token":t } }).catch(() => null);
  if (r && r.ok){ TOKEN = t; sessionStorage.setItem("bcp_admin", t); showApp(); return; }
  // diagnostic précis : le patron doit savoir EXACTEMENT quoi corriger
  let msg;
  if (!r) msg = "Serveur injoignable. Vérifie ta connexion internet.";
  else if (r.status === 401) msg = "Mot de passe incorrect.";
  else {
    const body = await r.json().catch(() => ({}));
    const detail = (body.error || "").toString();
    if (/GITHUB_TOKEN/i.test(detail))
      msg = "Mot de passe correct ✓ — mais la variable GITHUB_TOKEN manque sur Vercel (Settings → Environment Variables), puis redéploie.";
    else if (r.status === 502 || /GitHub/i.test(detail))
      msg = "Mot de passe correct ✓ — connexion à GitHub impossible : vérifie GITHUB_TOKEN et GITHUB_REPO sur Vercel.";
    else msg = detail ? `Erreur serveur : ${detail}` : `Connexion impossible (erreur ${r.status}).`;
  }
  errEl.textContent = msg;
  const f = document.getElementById("loginForm");
  f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake");
});
document.getElementById("publish").addEventListener("click", publish);
document.getElementById("preview").addEventListener("click", openPreview);
document.getElementById("reload").addEventListener("click", () => {
  if (DIRTY && !confirm("Annuler toutes les modifications non publiées et revenir à la version en ligne ?")) return;
  clearDirty(); removeDraftBar(); load();
});
document.getElementById("logout").addEventListener("click", logout);
document.getElementById("tourBtn").addEventListener("click", () => startTour());

/* toute saisie dans les formulaires = modifications non publiées */
const paneEl = document.getElementById("pane");
paneEl.addEventListener("input", (e) => { if (!e.target.closest(".no-dirty")) markDirty(); });
paneEl.addEventListener("change", (e) => { if (!e.target.closest(".no-dirty")) markDirty(); });

if (TOKEN) showApp();
