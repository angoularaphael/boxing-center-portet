import type { FaqItem } from "./api";
import { submitLead, trackEvent, askAi } from "./api";
import { QUICKS, fallbackAnswer } from "../chatbot-kb";
import { BOXING_CENTER_SALLES } from "../data";
import "./chatbot.css";

type Phase =
  | "greeting"
  | "prenom"
  | "nom"
  | "salle"
  | "email"
  | "phone"
  | "ready"
  | "faq"
  | "escalation_topic"
  | "escalation"
  | "done";

type Msg = { role: "bot" | "user"; text: string; html?: boolean };

const BOT_AVATAR = "/logo.png";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SKIP_RE = /^(non|pas maintenant|passer|skip|—|-)$/i;
const ESCALATION_TOPICS = [
  { id: "contact", label: "Contact et essais" },
  { id: "membre", label: "Devenir membre et paiement" },
  { id: "cours", label: "Nos cours et programmes" },
  { id: "resiliation", label: "Modification et résiliation" },
  { id: "abonnement", label: "Inscription et abonnements" },
  { id: "autre", label: "Autre question" },
] as const;

function sessionId(): string {
  const key = "bcp-chat-session";
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function initChatbot() {
  if (document.getElementById("bcp-chat-root")) return;

  const sid = sessionId();
  const profile = { prenom: "", nom: "", email: "", phone: "", salle: "" };
  let phase: Phase = "greeting";
  let faq: FaqItem[] = [];
  let escalationTopic = "";
  let opened = false;
  let typing = false;

  const root = document.createElement("div");
  root.id = "bcp-chat-root";
  root.className = "bcp-chat";
  root.innerHTML = `
    <button type="button" class="bcp-chat__launcher" id="bcp-chat-launcher" aria-label="Ouvrir l'assistant Boxing Center">
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
          <span class="bcp-chat__status">Assistant du club</span>
        </div>
        <button type="button" class="bcp-chat__close" id="bcp-chat-close" aria-label="Fermer">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </header>
      <div class="bcp-chat__body">
        <div class="bcp-chat__messages" id="bcp-chat-messages" role="log" aria-live="polite"></div>
      </div>
      <div class="bcp-chat__footer">
        <div class="bcp-chat__suggestions" id="bcp-chat-suggestions" hidden></div>
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

  function renderMessages() {
    messagesEl.innerHTML = messages
      .map((m) => {
        const avatar =
          m.role === "bot"
            ? `<img class="bcp-chat__msg-avatar" src="${BOT_AVATAR}" alt="" width="26" height="26" decoding="async" />`
            : "";
        return `<div class="bcp-chat__msg bcp-chat__msg--${m.role}">${avatar}<div class="bcp-chat__bubble">${
          m.html ? m.text : escapeHtml(m.text)
        }</div></div>`;
      })
      .join("");
    if (typing) {
      messagesEl.insertAdjacentHTML(
        "beforeend",
        `<div class="bcp-chat__msg bcp-chat__msg--bot bcp-chat__msg--typing">
          <img class="bcp-chat__msg-avatar" src="${BOT_AVATAR}" alt="" width="26" height="26" decoding="async" />
          <div class="bcp-chat__bubble"><span class="bcp-chat__dots"><i></i><i></i><i></i></span></div>
        </div>`
      );
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  }

  async function botSay(text: string, pause = 650) {
    typing = true;
    renderMessages();
    await delay(pause);
    typing = false;
    messages.push({ role: "bot", text });
    renderMessages();
  }

  function userSay(text: string) {
    messages.push({ role: "user", text });
    renderMessages();
  }

  function setPlaceholder(text: string) {
    input.placeholder = text;
  }

  function showSuggestions(items: FaqItem[]) {
    const faqButtons = items
      .slice(0, 4)
      .map(
        (f) =>
          `<button type="button" data-q="${escapeAttr(f.question)}">${escapeHtml(f.question)}</button>`
      )
      .join("");
    const escalationBtn = `<button type="button" class="bcp-chat__suggestion--escalation" data-escalation>Ma question n'apparaît pas ?</button>`;
    if (!faqButtons && phase !== "faq") {
      suggestionsEl.hidden = true;
      return;
    }
    suggestionsEl.hidden = false;
    suggestionsEl.innerHTML =
      phase === "faq" ? `${faqButtons}${escalationBtn}` : faqButtons;
  }

  function showTopicSuggestions() {
    suggestionsEl.hidden = false;
    suggestionsEl.innerHTML = ESCALATION_TOPICS.map(
      (t) =>
        `<button type="button" data-topic="${escapeAttr(t.id)}">${escapeHtml(t.label)}</button>`
    ).join("");
  }

  function hideSuggestions() {
    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = "";
  }

  function showRecontactCheckbox() {
    messages.push({
      role: "bot",
      text: `<label class="bcp-chat__recontact"><input type="checkbox" id="bcp-chat-recontact" checked /> Me tenir au courant par e-mail</label>`,
      html: true,
    });
    renderMessages();
  }

  function escapeAttr(s: string) {
    return s.replace(/"/g, "&quot;");
  }

  function showSalleSuggestions() {
    suggestionsEl.hidden = false;
    suggestionsEl.innerHTML = BOXING_CENTER_SALLES.map(
      (s) =>
        `<button type="button" data-salle="${escapeAttr(s.label)}">${escapeHtml(s.label)}</button>`
    ).join("");
  }

  function profileName() {
    return [profile.prenom, profile.nom].filter(Boolean).join(" ").trim();
  }

  async function finishOnboarding() {
    phase = "ready";
    try {
      await submitLead({
        event: "lead_collected",
        sessionId: sid,
        prenom: profile.prenom,
        nom: profile.nom,
        name: profileName(),
        email: profile.email,
        phone: profile.phone,
        salle: profile.salle,
      });
    } catch (err) {
      console.warn("Failed to submit lead, continuing to FAQ:", err);
    }
    await botSay(
      `Parfait ${profile.prenom} ! Posez-moi vos questions sur le club — horaires, tarifs, disciplines, tout ce qui vous intéresse.`
    );
    phase = "faq";
    showSuggestions(faq);
    setPlaceholder("Votre question…");
  }

  async function openPanel() {
    if (opened) {
      panel.hidden = false;
      panel.classList.add("bcp-chat__panel--open");
      root.classList.add("bcp-chat--open");
      launcher.setAttribute("aria-expanded", "true");
      launcher.setAttribute("aria-label", "Fermer l'assistant Boxing Center");
      input.focus();
      return;
    }
    opened = true;
    panel.hidden = false;
    panel.classList.add("bcp-chat__panel--open");
    root.classList.add("bcp-chat--open");
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Fermer l'assistant Boxing Center");
    faq = QUICKS.map((x, i) => ({ id: `q${i}`, question: x.q, answer: x.a })); // local quick-access (AI handles free-text)
    await botSay(
      "Salut ! Je suis l'assistant du club de Portet. Je peux vous renseigner sur les cours, les horaires ou les tarifs.\n\nQuel est votre prénom ?",
      900
    );
    phase = "prenom";
    setPlaceholder("Votre prénom");
    input.focus();
  }

  function closePanel() {
    panel.hidden = true;
    panel.classList.remove("bcp-chat__panel--open");
    root.classList.remove("bcp-chat--open");
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Ouvrir l'assistant Boxing Center");
  }

  async function runOnboardingAnswer(text: string) {
    const v = text.trim();
    if (!v) return;

    if (phase === "prenom") {
      profile.prenom = v;
      phase = "nom";
      await botSay(`Enchanté ${profile.prenom} ! Et votre nom de famille ?`);
      setPlaceholder("Votre nom");
      return;
    }

    if (phase === "nom") {
      profile.nom = v;
      phase = "salle";
      await botSay(
        "Dans quelle salle Boxing Center souhaitez-vous vous entraîner ?\n\nChoisissez ci-dessous ou tapez le nom de la salle."
      );
      showSalleSuggestions();
      setPlaceholder("Ou tapez le nom de la salle…");
      return;
    }

    if (phase === "salle") {
      profile.salle = v;
      hideSuggestions();
      phase = "email";
      await botSay(
        "Top ! Si vous voulez, je peux faire suivre le planning par l'équipe — une adresse mail ?"
      );
      setPlaceholder("votre@email.com");
      return;
    }

    if (phase === "email") {
      const skip = v.toLowerCase() === "passer" || v.toLowerCase() === "skip";
      if (skip) {
        profile.email = "";
      } else if (!EMAIL_RE.test(v)) {
        await botSay("Hmm, l'adresse ne passe pas… vous pouvez réessayer ? (Ou tapez « passer »)");
        return;
      } else {
        profile.email = v;
      }
      phase = "phone";
      await botSay(
        "Et un numéro pour qu'un coach vous rappelle si vous voulez tester un cours ?\n\n(Sinon tapez « passer ».)"
      );
      setPlaceholder("06 12 34 56 78 ou passer");
      return;
    }

    if (phase === "phone") {
      if (!SKIP_RE.test(v)) profile.phone = v;
      await finishOnboarding();
    }
  }

  async function startEscalation() {
    phase = "escalation_topic";
    hideSuggestions();
    await botSay("Pas de souci ! Choisissez le sujet qui correspond le mieux à votre question :");
    showTopicSuggestions();
    setPlaceholder("Ou écrivez votre sujet…");
  }

  async function handleFaqQuestion(q: string) {
    if (/ma question n.?appara[iî]t pas/i.test(q)) {
      userSay(q);
      await startEscalation();
      return;
    }

    userSay(q);
    hideSuggestions();
    // 1) grounded AI — answers anything about the club (Gemini → Groq → Mistral)
    try {
      const ai = await askAi(q);
      if (ai) { await botSay(ai); showSuggestions(faq); return; }
    } catch { /* fall through to local fallback */ }
    // 2) local keyword fallback (works even fully offline)
    const local = fallbackAnswer(q);
    if (local) { await botSay(local); showSuggestions(faq); return; }
    await startEscalation();
  }

  async function pickEscalationTopic(topicId: string, label: string) {
    escalationTopic = topicId;
    userSay(label);
    phase = "escalation";
    hideSuggestions();
    await botSay("Décrivez votre question en quelques lignes — l'équipe vous répondra par e-mail.");
    showRecontactCheckbox();
    setPlaceholder("Votre message…");
  }

  async function handleEscalation(text: string) {
    const recontact = document.querySelector<HTMLInputElement>("#bcp-chat-recontact")?.checked ?? true;
    userSay(text);
    try {
      await submitLead({
        event: "escalation",
        sessionId: sid,
        prenom: profile.prenom,
        nom: profile.nom,
        name: profileName(),
        email: profile.email,
        phone: profile.phone,
        salle: profile.salle,
        topic: escalationTopic || "autre",
        message: text,
        recontactRequested: recontact,
      });
      await botSay("C'est envoyé, merci ! L'équipe revient vers vous très vite à " + (profile.email || "votre adresse e-mail") + ".");
      phase = "done";
      hideSuggestions();
      setPlaceholder("À bientôt au club");
      input.disabled = true;
    } catch {
      await botSay("L'envoi a échoué — écrivez-nous à boxingcenter31@gmail.com");
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || typing) return;
    input.value = "";

    if (phase === "done") return;

    if (["greeting", "prenom", "nom", "salle", "email", "phone"].includes(phase)) {
      userSay(text);
      await runOnboardingAnswer(text);
      return;
    }

    if (phase === "faq") {
      await handleFaqQuestion(text);
      return;
    }

    if (phase === "escalation_topic") {
      const topic = ESCALATION_TOPICS.find(
        (t) => t.label.toLowerCase() === text.toLowerCase() || t.id === text
      );
      if (topic) {
        await pickEscalationTopic(topic.id, topic.label);
      } else {
        await pickEscalationTopic("autre", text);
      }
      return;
    }

    if (phase === "escalation") {
      await handleEscalation(text);
    }
  });

  suggestionsEl.addEventListener("click", async (e) => {
    const esc = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-escalation]");
    if (esc && phase === "faq") {
      await startEscalation();
      return;
    }

    const salleBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-salle]");
    if (salleBtn && phase === "salle") {
      const label = salleBtn.dataset.salle || salleBtn.textContent || "";
      userSay(label);
      profile.salle = label;
      hideSuggestions();
      phase = "email";
      await botSay(
        "Si vous voulez, je peux faire suivre le planning par l'équipe — une adresse mail ?"
      );
      setPlaceholder("votre@email.com");
      return;
    }

    const topicBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-topic]");
    if (topicBtn && phase === "escalation_topic") {
      const id = topicBtn.dataset.topic || "autre";
      const label =
        ESCALATION_TOPICS.find((t) => t.id === id)?.label || topicBtn.textContent || "Autre question";
      await pickEscalationTopic(id, label);
      return;
    }

    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-q]");
    if (!btn || phase !== "faq") return;
    await handleFaqQuestion(btn.dataset.q || "");
  });

  launcher.addEventListener("click", () => {
    if (root.classList.contains("bcp-chat--open")) closePanel();
    else void openPanel();
  });
  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closePanel();
  });
}
