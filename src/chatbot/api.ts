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
