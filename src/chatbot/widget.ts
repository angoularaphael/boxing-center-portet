import type { FaqItem } from "./api";
import { fetchFaqList, searchFaq, submitLead, trackEvent } from "./api";
import "./chatbot.css";

type Phase =
  | "greeting"
  | "name"
  | "email"
  | "phone"
  | "metier"
  | "ready"
  | "faq"
  | "escalation"
  | "done";

type Msg = { role: "bot" | "user"; text: string; html?: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const profile = { name: "", email: "", phone: "", metier: "" };
  let phase: Phase = "greeting";
  let faq: FaqItem[] = [];
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
        <div>
          <strong>Boxing Center Portet</strong>
          <span class="bcp-chat__status">En ligne</span>
        </div>
        <button type="button" class="bcp-chat__close" id="bcp-chat-close" aria-label="Fermer">×</button>
      </header>
      <div class="bcp-chat__messages" id="bcp-chat-messages" role="log" aria-live="polite"></div>
      <div class="bcp-chat__suggestions" id="bcp-chat-suggestions" hidden></div>
      <form class="bcp-chat__form" id="bcp-chat-form">
        <input class="bcp-chat__input" id="bcp-chat-input" type="text" autocomplete="off" placeholder="Écrivez votre message…" />
        <button class="bcp-chat__send" type="submit" aria-label="Envoyer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 12h14M14 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </form>
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
      .map(
        (m) =>
          `<div class="bcp-chat__msg bcp-chat__msg--${m.role}"><div class="bcp-chat__bubble">${
            m.html ? m.text : escapeHtml(m.text)
          }</div></div>`
      )
      .join("");
    if (typing) {
      messagesEl.insertAdjacentHTML(
        "beforeend",
        `<div class="bcp-chat__msg bcp-chat__msg--bot bcp-chat__msg--typing"><div class="bcp-chat__bubble"><span class="bcp-chat__dots"><i></i><i></i><i></i></span></div></div>`
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
    if (!items.length) {
      suggestionsEl.hidden = true;
      return;
    }
    suggestionsEl.hidden = false;
    suggestionsEl.innerHTML = items
      .slice(0, 4)
      .map((f) => `<button type="button" data-q="${escapeAttr(f.question)}">${escapeHtml(f.question)}</button>`)
      .join("");
  }

  function escapeAttr(s: string) {
    return s.replace(/"/g, "&quot;");
  }

  async function openPanel() {
    if (opened) {
      panel.hidden = false;
      root.classList.add("bcp-chat--open");
      input.focus();
      return;
    }
    opened = true;
    panel.hidden = false;
    root.classList.add("bcp-chat--open");
    await trackEvent("chat_started", sid);
    try {
      faq = await fetchFaqList();
    } catch {
      faq = [];
    }
    await botSay("Bonjour… Comment je vous appelle ?", 900);
    phase = "name";
    setPlaceholder("Votre prénom ou nom");
    input.focus();
  }

  function closePanel() {
    panel.hidden = true;
    root.classList.remove("bcp-chat--open");
  }

  async function runOnboardingAnswer(text: string) {
    const v = text.trim();
    if (!v) return;

    if (phase === "name") {
      profile.name = v;
      phase = "email";
      await botSay(`Enchanté ${profile.name} ! Quelle est votre adresse e-mail ?`);
      setPlaceholder("exemple@email.com");
      return;
    }

    if (phase === "email") {
      if (!EMAIL_RE.test(v)) {
        await botSay("Cette adresse ne semble pas valide. Pouvez-vous la vérifier ?");
        return;
      }
      profile.email = v;
      phase = "phone";
      await botSay("Merci ! Et votre numéro de téléphone ?");
      setPlaceholder("06 12 34 56 78");
      return;
    }

    if (phase === "phone") {
      profile.phone = v;
      phase = "metier";
      await botSay(
        "Aidez-nous à personnaliser votre expérience avec le bot — quel est votre métier ou votre activité ?"
      );
      setPlaceholder("Ex. étudiant, entrepreneur, sportif…");
      return;
    }

    if (phase === "metier") {
      profile.metier = v;
      phase = "ready";
      await submitLead({
        event: "lead_collected",
        sessionId: sid,
        ...profile,
      });
      await botSay(
        `Parfait ${profile.name} ! Je suis prêt à répondre à vos questions sur Boxing Center Portet.`
      );
      phase = "faq";
      showSuggestions(faq);
      setPlaceholder("Posez votre question…");
      return;
    }
  }

  async function handleFaqQuestion(q: string) {
    userSay(q);
    showSuggestions([]);
    try {
      const result = await searchFaq(q, sid);
      if (result.match && result.answer) {
        await botSay(result.answer);
      } else {
        phase = "escalation";
        await botSay(
          "Je n'ai pas trouvé de réponse précise à votre question. Souhaitez-vous nous laisser un message ? L'équipe pourra vous recontacter par e-mail."
        );
        messages.push({
          role: "bot",
          text: `<label class="bcp-chat__recontact"><input type="checkbox" id="bcp-chat-recontact" checked /> Oui, je souhaite être recontacté(e) par e-mail</label>`,
          html: true,
        });
        renderMessages();
        setPlaceholder("Votre message…");
      }
    } catch {
      phase = "escalation";
      await botSay("Un souci technique est survenu. Laissez-nous votre message, nous vous répondrons par e-mail.");
      setPlaceholder("Votre message…");
    }
    if (phase === "faq") showSuggestions(faq);
  }

  async function handleEscalation(text: string) {
    const recontact = document.querySelector<HTMLInputElement>("#bcp-chat-recontact")?.checked ?? true;
    userSay(text);
    try {
      await submitLead({
        event: "escalation",
        sessionId: sid,
        ...profile,
        message: text,
        recontactRequested: recontact,
      });
      await botSay("Merci ! Votre message a bien été transmis à l'équipe Boxing Center.");
      phase = "done";
      setPlaceholder("Conversation terminée");
      input.disabled = true;
    } catch {
      await botSay("L'envoi a échoué. Réessayez dans un instant ou contactez-nous à boxingcenter31@gmail.com");
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || typing) return;
    input.value = "";

    if (phase === "done") return;

    if (["greeting", "name", "email", "phone", "metier"].includes(phase)) {
      userSay(text);
      await runOnboardingAnswer(text);
      return;
    }

    if (phase === "faq") {
      await handleFaqQuestion(text);
      return;
    }

    if (phase === "escalation") {
      await handleEscalation(text);
    }
  });

  suggestionsEl.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-q]");
    if (!btn || phase !== "faq") return;
    await handleFaqQuestion(btn.dataset.q || "");
  });

  launcher.addEventListener("click", () => openPanel());
  closeBtn.addEventListener("click", () => closePanel());
}
