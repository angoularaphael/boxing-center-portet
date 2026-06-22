export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  keywords?: string[];
};

const API_BASE =
  (import.meta.env.VITE_CHATBOT_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://gestion-manager.vercel.app';

function endpoints() {
  return {
    faq: `${API_BASE}/api/chatbot/faq`,
    lead: `${API_BASE}/api/chatbot/lead`,
  };
}

export async function fetchFaqList(): Promise<FaqItem[]> {
  const res = await fetch(endpoints().faq, { cache: 'no-store' });
  if (!res.ok) throw new Error('FAQ indisponible');
  const data = await res.json();
  return data.faq || [];
}

export async function searchFaq(
  query: string,
  sessionId: string
): Promise<{ match: boolean; question?: string; answer?: string }> {
  const url = new URL(endpoints().faq);
  url.searchParams.set('q', query);
  url.searchParams.set('sessionId', sessionId);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Recherche FAQ échouée');
  return res.json();
}

export async function trackEvent(
  event: string,
  sessionId: string,
  extra: Record<string, unknown> = {}
) {
  try {
    await fetch(endpoints().lead, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, sessionId, source: 'portet', ...extra }),
    });
  } catch {
    /* silencieux — ne bloque pas l'UX */
  }
}

/** Grounded AI answer (Gemini pool → Groq → Mistral) served from this site's own
 *  /api/chat function. Same origin, so it works once deployed on Vercel. */
export async function askAi(message: string, history: { role: string; content: string }[] = []): Promise<string> {
  const base = (import.meta.env.VITE_COMMUNITY_API as string | undefined) ?? "";
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error("AI indisponible");
  const data = await res.json();
  if (!data.reply) throw new Error("AI vide");
  return data.reply as string;
}

export async function submitLead(payload: Record<string, unknown>) {
  const res = await fetch(endpoints().lead, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'portet', ...payload }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Envoi échoué');
  }
}
