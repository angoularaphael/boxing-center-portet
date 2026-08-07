/**
 * Assistant du Boxing Center Portet — conversationnel, IA d’abord.
 *
 * Philosophie (≠ formulaire) : dès le premier message, on RÉPOND. Le bot
 * comprend le langage naturel (via /api/chat, grounded), répond à toute
 * question sur le club ou une salle sœur, et capte AU VOL les coordonnées
 * (prénom, email, téléphone, salle) quand le visiteur les donne — sans
 * jamais l’interroger de force. Chaque coordonnée récupérée part vers le
 * CRM (submitLead) pour nourrir la liste de contacts.
 */
import { submitLead, askAi } from "./api";
import { QUICKS, fallbackAnswer, ACTIONS, sansUtm, type ActionDef } from "../chatbot-kb";
import { BOXING_CENTER_SALLES } from "../data";
import "./chatbot.css";

type Msg = { role: "bot" | "user"; text: string; html?: boolean; actions?: ActionDef[] };

/** Clés → boutons (labels personnalisables : « clé:Label » pour les réponses non-FR). */
function resolveActions(keys: string[]): ActionDef[] {
  const out: ActionDef[] = [];
  for (const k of keys) {
    const [key, ...rest] = k.split(":");
    const def = ACTIONS[key.trim()];
    if (!def) continue; // clé inconnue = lien halluciné → ignoré
    const label = rest.join(":").trim();
    if (!out.some((a) => a.href === def.href)) out.push(label ? { ...def, label } : def);
    if (out.length >= 3) break;
  }
  return out;
}

/** Extrait le marqueur [boutons: …] de la réponse IA, et convertit en boutons
 *  toute URL connue restée en clair (filet pour les réponses hors protocole). */
function parseReply(raw: string): { text: string; actions: ActionDef[] } {
  let text = raw;
  const keys: string[] = [];
  text = text.replace(/\[\s*(?:boutons|buttons)\s*:\s*([^\]]+)\]/gi, (_, list: string) => {
    keys.push(...list.split(",").map((s) => s.trim()).filter(Boolean));
    return "";
  });
  // URLs connues écrites en clair → bouton correspondant, URL retirée du texte
  const byHref = Object.entries(ACTIONS);
  text = text.replace(/(?:https?:\/\/)?box-plus\.vercel\.app[\w\/#-]*/gi, (u) => {
    const href = (u.startsWith("http") ? u : `https://${u}`).replace(/\/$/, "");
    // le catalogue porte ses UTM ; l’IA écrit l’URL nue → on compare sans traçage
    const hit = byHref.find(([, d]) => sansUtm(d.href || "") === href);
    if (hit && !keys.some((k) => k.split(":")[0] === hit[0])) keys.push(hit[0]);
    return hit ? "la boutique en ligne" : u;
  });
  text = text.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
  return { text, actions: resolveActions(keys) };
}

const BOT_AVATAR = "/logo.png";
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// numéro FR : +33 ou 0, puis 9 chiffres groupés librement (espaces, points, tirets)
const PHONE_RE = /(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/;
// « je m’appelle X », « moi c’est X », « mon prénom est X »… (déclencheurs
// SPÉCIFIQUES à un prénom — pas de « c’est » nu qui capterait « c’est ouvert »)
const NAME_RE = /(?:je m['’ ]?appelle|moi c['’ ]?est|mon nom est|mon pr[ée]nom (?:est|c['’ ]?est)|je me nomme)\s+([a-zà-öø-ÿ][a-zà-öø-ÿ'’-]+)/i;
const STOP_NAMES = /^(bonjour|salut|coucou|hello|merci|oui|non|ok|d['’]accord|bien|super|cool|pas|ouvert|ferm|combien|quoi|rien|voir|bof)$/i;

function sessionId(): string {
  const key = "bcp-chat-session";
  try {
    let id = sessionStorage.getItem(key);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id); }
    return id;
  } catch { return crypto.randomUUID(); }
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const titleCase = (s: string) =>
  s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

export function initChatbot() {
  if (document.getElementById("bcp-chat-root")) return;

  const sid = sessionId();
  const profile = { prenom: "", nom: "", email: "", phone: "", salle: "" };
  // le profil survit à la navigation (même session) : jamais redemander, et
  // les formulaires du site se préremplissent avec (voir initPartnerForm)
  try { Object.assign(profile, JSON.parse(sessionStorage.getItem("bcp-chat-profile") || "{}")); } catch { /* profil vierge */ }
  const saveProfile = () => { try { sessionStorage.setItem("bcp-chat-profile", JSON.stringify(profile)); } catch { /* stockage indispo */ } };
  const aiHistory: { role: string; content: string }[] = [];
  let opened = false;
  let typing = false;
  let exchanges = 0;      // nombre de réponses IA données
  let nudged = false;     // l’invitation douce à laisser un contact a-t-elle été faite ?
  let expectName = false; // le bot vient de demander le prénom
  let leadSig = "";       // signature du dernier lead envoyé (anti-doublon)
  let callbackAsked = false;

  const root = document.createElement("div");
  root.id = "bcp-chat-root";
  root.className = "bcp-chat";
  root.innerHTML = `
    <button type="button" class="bcp-chat__launcher" id="bcp-chat-launcher" aria-label="Ouvrir l’assistant Boxing Center">
      <span class="bcp-chat__launcher-icon" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H17.5A2.5 2.5 0 0 1 20 5.5V14a2.5 2.5 0 0 1-2.5 2.5H9l-4.2 3.15A.8.8 0 0 1 3.5 19.2V16.5A2.5 2.5 0 0 1 5.5 14H6.5A2.5 2.5 0 0 1 4 11.5V5.5Z" stroke="currentColor" stroke-width="1.6"/></svg>
      </span>
      <span class="bcp-chat__launcher-pulse" aria-hidden="true"></span>
    </button>
    <section class="bcp-chat__panel" id="bcp-chat-panel" aria-label="Assistant Boxing Center" hidden>
      <header class="bcp-chat__head">
        <img class="bcp-chat__head-avatar" src="${BOT_AVATAR}" alt="" width="40" height="40" decoding="async" />
        <div class="bcp-chat__head-text">
          <strong>Boxing Center Portet</strong>
          <span class="bcp-chat__status">Assistant du club · en ligne</span>
        </div>
        <button type="button" class="bcp-chat__close" id="bcp-chat-close" aria-label="Fermer">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </header>
      <div class="bcp-chat__body">
        <div class="bcp-chat__messages" id="bcp-chat-messages" role="log" aria-live="polite" data-lenis-prevent></div>
      </div>
      <div class="bcp-chat__footer">
        <div class="bcp-chat__suggestions" id="bcp-chat-suggestions" hidden data-lenis-prevent></div>
        <form class="bcp-chat__form" id="bcp-chat-form">
          <input class="bcp-chat__input" id="bcp-chat-input" type="text" autocomplete="off" placeholder="Écrivez votre message…" />
          <button class="bcp-chat__send" type="submit" aria-label="Envoyer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 12h14M14 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </form>
      </div>
    </section>`;
  document.body.appendChild(root);

  const panel = root.querySelector<HTMLElement>("#bcp-chat-panel")!;
  const launcher = root.querySelector<HTMLButtonElement>("#bcp-chat-launcher")!;
  const closeBtn = root.querySelector<HTMLButtonElement>("#bcp-chat-close")!;
  const messagesEl = root.querySelector<HTMLElement>("#bcp-chat-messages")!;
  const suggestionsEl = root.querySelector<HTMLElement>("#bcp-chat-suggestions")!;
  const form = root.querySelector<HTMLFormElement>("#bcp-chat-form")!;
  const input = root.querySelector<HTMLInputElement>("#bcp-chat-input")!;

  const messages: Msg[] = [];

  function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  }
  function escapeAttr(s: string) { return s.replace(/"/g, "&quot;"); }

  function withPrefill(href: string): string {
    if (!/box-plus\.vercel\.app/.test(href)) return href;
    const p: Record<string, string> = {};
    if (profile.prenom) p.first_name = profile.prenom;
    if (profile.nom) p.last_name = profile.nom;
    if (profile.email) p.email = profile.email;
    if (profile.phone) p.phone = profile.phone;
    if (!Object.keys(p).length) return href;
    try {
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(p))))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      return href + (href.includes("#") ? "&" : "#") + "bcp=" + b64;
    } catch { return href; }
  }

  function renderMessages() {
    messagesEl.innerHTML = messages
      .map((m) => {
        const avatar = m.role === "bot"
          ? `<img class="bcp-chat__msg-avatar" src="${BOT_AVATAR}" alt="" width="26" height="26" decoding="async" />`
          : "";
        const bubble = `<div class="bcp-chat__bubble">${m.html ? m.text : escapeHtml(m.text)}</div>`;
        const actions = m.actions?.length
          ? `<div class="bcp-chat__actions">${m.actions
              .map((a) => {
                if (a.act)
                  return `<button type="button" class="bcp-chat__action bcp-chat__action--act" data-act="${escapeAttr(a.act)}"><span>${escapeHtml(a.label)}</span></button>`;
                const href = withPrefill(a.href || "");
                const ext = /^https?:/i.test(href);
                const tel = href.startsWith("tel:");
                return `<a class="bcp-chat__action${ext ? " bcp-chat__action--ext" : ""}" href="${escapeAttr(href)}"${
                  ext ? ` target="_blank" rel="noopener"` : tel ? "" : ` data-nav`
                }><span>${escapeHtml(a.label)}</span>${ext ? `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 9 9 3M4.5 3H9v4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ""}</a>`;
              })
              .join("")}</div>`
          : "";
        return `<div class="bcp-chat__msg bcp-chat__msg--${m.role}">${avatar}<div class="bcp-chat__stack">${bubble}${actions}</div></div>`;
      })
      .join("");
    if (typing) {
      messagesEl.insertAdjacentHTML("beforeend",
        `<div class="bcp-chat__msg bcp-chat__msg--bot bcp-chat__msg--typing">
          <img class="bcp-chat__msg-avatar" src="${BOT_AVATAR}" alt="" width="26" height="26" decoding="async" />
          <div class="bcp-chat__bubble"><span class="bcp-chat__dots"><i></i><i></i><i></i></span></div>
        </div>`);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function botSay(text: string, pause = 600, actions?: ActionDef[]) {
    typing = true; renderMessages();
    await delay(pause);
    typing = false;
    messages.push({ role: "bot", text, actions });
    renderMessages();
  }
  function userSay(text: string) { messages.push({ role: "user", text }); renderMessages(); }
  const setPlaceholder = (t: string) => (input.placeholder = t);

  // ---------- suggestions (chips) ----------
  function showChips() {
    const qs = QUICKS.slice(0, 5)
      .map((f) => `<button type="button" data-q="${escapeAttr(f.q)}">${escapeHtml(f.label)}</button>`)
      .join("");
    const callback = `<button type="button" class="bcp-chat__suggestion--escalation" data-callback>📞 Être rappelé</button>`;
    suggestionsEl.hidden = false;
    suggestionsEl.innerHTML = qs + callback;
  }
  function hideChips() { suggestionsEl.hidden = true; suggestionsEl.innerHTML = ""; }

  // ---------- capture de coordonnées au fil de l’eau ----------
  function contextString() {
    const bits: string[] = [];
    if (profile.prenom) bits.push(`Prénom : ${profile.prenom}`);
    if (profile.salle) bits.push(`Salle souhaitée : ${profile.salle}`);
    if (profile.email) bits.push(`Email connu`);
    if (profile.phone) bits.push(`Téléphone connu`);
    return bits.join(". ");
  }
  function maybeSubmitLead(event: string) {
    // on n’envoie que si on a un moyen de recontact, et une seule fois par état
    if (!profile.email && !profile.phone) return;
    const sig = JSON.stringify(profile);
    if (sig === leadSig) return;
    leadSig = sig;
    submitLead({
      event, sessionId: sid,
      prenom: profile.prenom, nom: profile.nom,
      name: [profile.prenom, profile.nom].filter(Boolean).join(" ").trim(),
      email: profile.email, phone: profile.phone, salle: profile.salle,
    }).catch(() => { /* silencieux : ne bloque jamais la conversation */ });
  }
  /** Extrait prénom/email/téléphone/salle du message. Renvoie true si du neuf a été capté. */
  function extract(text: string): boolean {
    let found = false;
    const email = text.match(EMAIL_RE);
    if (email && !profile.email) { profile.email = email[0]; found = true; }
    const phone = text.match(PHONE_RE);
    if (phone && !profile.phone) { profile.phone = phone[0].replace(/\s+/g, " ").trim(); found = true; }
    const salle = BOXING_CENTER_SALLES.find((s) => new RegExp(`\\b${s.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
    if (salle && !profile.salle) { profile.salle = salle.label; found = true; }
    if (!profile.prenom) {
      const m = text.match(NAME_RE);
      let name = m?.[1]?.trim();
      // le bot vient de demander le prénom : un mot simple suffit
      if (!name && expectName) {
        const w = text.trim().split(/\s+/)[0];
        if (w && !EMAIL_RE.test(w) && !/\d/.test(w) && !STOP_NAMES.test(w)) name = w;
      }
      if (name && !STOP_NAMES.test(name)) { profile.prenom = titleCase(name.split(/\s+/)[0]); found = true; }
    }
    expectName = false;
    return found;
  }

  // ---------- conversation ----------
  async function answer(text: string) {
    const gotNew = extract(text);
    if (gotNew) maybeSubmitLead(callbackAsked ? "callback_request" : "lead_collected");

    hideChips();
    let reply = "";
    let actions: ActionDef[] = [];
    try {
      const raw = await askAi(text, aiHistory.slice(-6), contextString());
      const parsed = parseReply(raw);
      reply = parsed.text;
      actions = parsed.actions;
    } catch {
      const fb = fallbackAnswer(text); // hors-ligne / dev : repli mots-clés
      reply = fb.text;
      actions = resolveActions(fb.actions);
    }
    aiHistory.push({ role: "user", content: text }, { role: "assistant", content: reply });
    await botSay(reply, 600, actions);
    exchanges++;

    // remerciement discret quand on vient de récupérer un contact
    if (gotNew && (profile.email || profile.phone) && callbackAsked) {
      callbackAsked = false;
      await botSay(`C’est noté${profile.prenom ? `, ${profile.prenom}` : ""} — un coach te recontacte très vite. 💪`, 500, resolveActions(["offre", "planning"]));
    }
    // invitation douce (une seule fois) à laisser un contact
    else if (!nudged && exchanges >= 2 && !profile.email && !profile.phone) {
      nudged = true;
      await botSay("Au fait — si tu veux qu’un coach te rappelle ou t’envoie le planning, laisse-moi ton prénom et un numéro ou un email, quand tu veux. 😉", 500, resolveActions(["rappel"]));
    }
    showChips();
  }

  async function startCallback() {
    callbackAsked = true;
    hideChips();
    if (profile.email || profile.phone) {
      // on a déjà de quoi le joindre
      maybeSubmitLead("callback_request");
      await botSay(`Parfait${profile.prenom ? `, ${profile.prenom}` : ""} ! Je transmets ta demande — un coach te rappelle très vite. En attendant, une question sur le club ?`);
      callbackAsked = false;
      showChips();
      return;
    }
    expectName = !profile.prenom;
    await botSay(profile.prenom
      ? `Avec plaisir ${profile.prenom} ! Laisse-moi un numéro ou un email et un coach te rappelle.`
      : "Avec plaisir ! Dis-moi ton prénom et un numéro (ou un email) et un coach te rappelle.");
    setPlaceholder("Ton prénom et ton numéro…");
  }

  async function openPanel() {
    panel.hidden = false;
    panel.classList.add("bcp-chat__panel--open");
    root.classList.add("bcp-chat--open");
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Fermer l’assistant Boxing Center");
    if (!opened) {
      opened = true;
      const page = document.body.dataset.page || "";
      const WELCOMES: Record<string, [string, string[]]> = {
        tarifs: ["Tu regardes les offres 👀 La rentrée est à 29 € par personne, 4 semaines, sans engagement — la meilleure porte d’entrée. Une question sur une formule ?", ["offre", "tarifs"]],
        activites: ["Tu cherches ta discipline ? Dis-moi ce qui t’attire — boxe, MMA, grappling, pour toi ou pour ton enfant — et je te guide vers le bon cours.", ["planning", "offre"]],
        plannings: ["Besoin d’aide pour choisir un créneau ? Dis-moi ta discipline et tes dispos, je te dis exactement où aller. 🗓️", ["offre", "disciplines"]],
        coachs: ["Tu veux savoir avec qui tu vas t’entraîner ? Demande-moi — Tapia, Pinto, Pioppo, Tramaçon, Mourad & Ingrid. Et l’offre de la rentrée est à 29 € par personne. 🥊", ["offre", "boxeurs"]],
        boxeurs: ["Eux, ils ont commencé exactement comme toi — un premier cours. L’offre de la rentrée est à 29 € par personne si tu veux écrire la suite.", ["offre", "coachs"]],
        partenaires: ["Un projet d’entreprise, une privatisation, un partenariat ? Décris-le-moi ici — et si on a déjà discuté, le formulaire juste en dessous est même prérempli. 😉", ["appeler", "contact"]],
        contact: ["Le plus simple : appelle-nous — ou laisse-moi ton numéro et un coach te rappelle dans la journée.", ["appeler", "rappel"]],
        "premiere-seance": ["Tu prépares ton premier cours ? Dis-moi ton âge, ce qui t’attire et tes dispos — je te dis quel créneau prendre, et un coach t’attend à l’entrée. 🥊", ["offre", "essai"]],
        galerie: ["Bienvenue dans la galerie ! Si une image te donne envie de pousser la porte : l’offre de la rentrée est à 29 € par personne. 🥊", ["offre", "disciplines"]],
      };
      const [wTxt, wKeys] = WELCOMES[page] || [
        "Salut ! 👋 Je suis l’assistant du Boxing Center Portet. L’offre de la rentrée est à 29 € par personne — et je peux tout te dire : horaires, offres, disciplines… Dis-moi ce que tu cherches (FR/EN), je te guide.",
        ["offre", "tarifs"],
      ];
      await botSay(wTxt, 800, resolveActions(wKeys));
      showChips();
    }
    input.focus();
  }
  function closePanel() {
    panel.hidden = true;
    panel.classList.remove("bcp-chat__panel--open");
    root.classList.remove("bcp-chat--open");
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Ouvrir l’assistant Boxing Center");
  }

  // ---------- événements ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || typing) return;
    input.value = "";
    userSay(text);
    await answer(text);
  });

  // bouton d'action INTERNE : le routeur fait la navigation douce (capture),
  // nous on referme le panneau pour laisser la page se montrer
  messagesEl.addEventListener("click", (e) => {
    const act = (e.target as Element).closest<HTMLElement>("button[data-act]");
    if (act) {
      if (act.dataset.act === "rappel") void startCallback();
      return;
    }
    const lien = (e.target as Element).closest<HTMLAnchorElement>("a[data-nav]");
    if (!lien) return;
    /* Le laissez-passer de la seance offerte : le bot OUVRE la porte, la page
       la referme derriere lui — sans ce jeton, l'URL rend une 404. */
    if ((lien.getAttribute("href") || "").startsWith("/seance-offerte")) {
      try { sessionStorage.setItem("bcp-offert-pass", String(Date.now())); } catch { /* stockage indispo */ }
    }
    closePanel();
  });

  suggestionsEl.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    if (target.closest("button[data-callback]")) { await startCallback(); return; }
    const q = target.closest<HTMLButtonElement>("button[data-q]");
    if (q) { const text = q.dataset.q || ""; userSay(text); await answer(text); }
  });

  launcher.addEventListener("click", () => {
    if (root.classList.contains("bcp-chat--open")) closePanel();
    else void openPanel();
  });
  closeBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); closePanel(); });
}
