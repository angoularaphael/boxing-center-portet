// POST /api/chat — grounded assistant for Boxing Center Portet.
// Tries a pool of Gemini keys (rotating, skipping dead ones) → Groq → Mistral.
// Grounded on the club's real info; never invents.
import { allowCors } from "./_lib/util.js";

const SYSTEM = `Tu es l'assistant virtuel du BOXING CENTER PORTET (salle de boxe à Portet-sur-Garonne).
Règles: réponds en FRANÇAIS, de façon concise (2 à 4 phrases), chaleureuse et motivante. Réponds
UNIQUEMENT à partir des informations ci-dessous. Si l'info n'y est pas, invite poliment à appeler le
05 62 24 46 82 ou à passer au club — n'invente JAMAIS. Quand c'est pertinent, encourage la séance d'essai à 10€.

INFOS CLUB:
- Boxing Center Portet : salle phare du groupe Boxing Center, 800 m², à Portet-sur-Garonne (depuis 2016).
- Adresse : 61 route d'Espagne, 31120 Portet-sur-Garonne. Téléphone : 05 62 24 46 82. Email : boxingcenter31@gmail.com.
- Horaires de la salle : du lundi au samedi, 10h00–21h30 ; fermé le dimanche. Accès illimité 7j/7 pour les abonnés.
- Séance d'essai : 10€, toutes disciplines, sans engagement (matériel prêté). Réservation page Contact ou sur place.
- Tarifs : Mensuel 36–44€/mois (sans engagement) ; Annuel 250–400€/an ; Enfants 280€/an ; Badge d'accès 34€ à l'inscription (aucun autre frais).
- Inscription : fiche d'inscription + certificat médical de non contre-indication à la boxe + moyen de paiement (prélèvement, espèces, chèque ou PayPal en ligne) + badge 34€. En ligne ou sur place.
- Disciplines : boxe anglaise, muay thaï, kick / K1, MMA & grappling, cross training, boxing training (cardio), Lady Punch (100% femmes), boxe éducative (dès 7 ans), savate / boxe française.
- Équipements : ring olympique, cage MMA, 24 sacs lourds Metal Boxe, 500 m² combat + 400 m² cross training.
- Coachs diplômés FFBoxe, FFKMDA, FMMAF : Dadi, Mehdi, Valentin, Brice. Du débutant au compétiteur.
- Planning Portet : Lun 18h30 Boxe anglaise / 19h30 Muay thaï / 20h30 Cross training ; Mar 12h30 Boxing training / 18h30 MMA / 19h30 Lady Punch ; Mer 14h Boxe éducative / 18h30 Kick / 19h30 Boxe anglaise ; Jeu 12h30 Cross / 18h30 Muay thaï / 19h30 Grappling ; Ven 18h30 Boxe anglaise / 19h30 Sparring / 20h30 MMA ; Sam 10h30 Cross / 11h30 Boxing training / 12h30 Open mat.
- Réseau : plusieurs salles à Toulouse (Minimes, Saint-Cyprien, Ramonville, États-Unis…), accès à toutes avec l'abonnement.
- Boutique : boutique.boxingcenter.fr — Groupe : boxingcenter.fr.`;

async function gemini(key, model, messages) {
  const contents = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system_instruction: { parts: [{ text: SYSTEM }] }, contents, generationConfig: { maxOutputTokens: 450, temperature: 0.4 } }),
  });
  if (!r.ok) throw new Error("gemini " + r.status);
  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim();
  if (!text) throw new Error("gemini empty");
  return text;
}
async function openaiLike(url, key, model, messages) {
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 450, temperature: 0.4, messages: [{ role: "system", content: SYSTEM }, ...messages] }),
  });
  if (!r.ok) throw new Error("oai " + r.status);
  const j = await r.json();
  const text = (j?.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("oai empty");
  return text;
}

export default async function handler(req, res) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const message = String(body.message || "").slice(0, 500).trim();
  if (!message) return res.status(400).json({ error: "Message vide." });
  const history = Array.isArray(body.history)
    ? body.history.slice(-6).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 500) }))
    : [];
  const messages = [...history, { role: "user", content: message }];

  // 1) Gemini key pool (rotate + skip dead keys)
  const gKeys = Object.keys(process.env).filter((k) => /^GEMINI_API_KEY/.test(k)).map((k) => process.env[k]).filter(Boolean);
  for (let i = gKeys.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [gKeys[i], gKeys[j]] = [gKeys[j], gKeys[i]]; }
  const gModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  for (const key of gKeys) {
    try { return res.status(200).json({ reply: await gemini(key, gModel, messages), via: "gemini" }); } catch { /* try next */ }
  }
  // 2) Groq, 3) Mistral
  if (process.env.GROQ_API_KEY) {
    try { return res.status(200).json({ reply: await openaiLike("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, process.env.GROQ_MODEL || "llama-3.3-70b-versatile", messages), via: "groq" }); } catch {}
  }
  if (process.env.MISTRAL_API_KEY) {
    try { return res.status(200).json({ reply: await openaiLike("https://api.mistral.ai/v1/chat/completions", process.env.MISTRAL_API_KEY, process.env.MISTRAL_MODEL || "mistral-small-latest", messages), via: "mistral" }); } catch {}
  }
  return res.status(503).json({ error: "Assistant momentanément indisponible." });
}
