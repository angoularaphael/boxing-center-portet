// POST /api/chat — grounded assistant for Boxing Center Portet.
// Tries a pool of Gemini keys (rotating, skipping dead ones) → Groq → Mistral.
// Grounded on the club's real info; never invents. Les faits éditables via le
// backoffice (tarifs, planning, horaires, coachs…) sont lus dans
// src/content.json (bundlé au déploiement — chaque publication redéploie,
// donc le bot reste synchronisé avec le site). Repli statique complet si la
// lecture échoue : le bot ne casse jamais.
import { readFileSync } from "fs";
import { join } from "path";
import { allowCors } from "./_lib/util.js";

/* Faits non éditables dans le backoffice (procédure d'inscription, réseau…). */
const STATIC_TAIL = `- Séance d'essai : 10€, toutes disciplines, sans engagement (matériel prêté). Réservation page Contact ou sur place.
- Inscription : fiche d'inscription + certificat médical de non contre-indication à la boxe + moyen de paiement (prélèvement, espèces, chèque ou PayPal en ligne) + badge d'accès 34€ à l'inscription (aucun autre frais).
- Équipements : ring olympique, cage MMA, 24 sacs lourds Metal Boxe, 500 m² combat + 400 m² cross training.
- Réseau : plusieurs salles à Toulouse (Minimes, Saint-Cyprien, Ramonville, États-Unis…), accès à toutes avec l'abonnement.
- Boutique : boutique.boxingcenter.fr — Groupe : boxingcenter.fr.`;

/* Repli si content.json est illisible : les mêmes infos, figées. */
const STATIC_INFO = `- Boxing Center Portet : salle phare du groupe Boxing Center, 800 m², à Portet-sur-Garonne (depuis 2016).
- Adresse : 61 route d'Espagne, 31120 Portet-sur-Garonne. Téléphone : 05 62 24 46 82. Email : boxingcenter31@gmail.com.
- Horaires de la salle : du lundi au samedi, 10h00–21h30 ; fermé le dimanche. Accès illimité 7j/7 pour les abonnés.
- Tarifs : Mensuel 36–44€/mois (sans engagement) ; Annuel 250–400€/an ; Enfants 280€/an.
- Disciplines : boxe anglaise, kick-boxing, MMA, grappling & jiu-jitsu brésilien, Lady Boxing (100% femmes), préparation physique, baby boxe, boxe éducative, kick-boxing enfants/ados.
- Coachs diplômés FFBoxe, FFKMDA, FMMAF : Dadi, Mehdi, Valentin, Brice. Du débutant au compétiteur.
- Planning Portet : Lun 18h30 Boxe anglaise / 19h30 Kick-boxing / 20h30 Prépa physique ; Mar 12h30 Prépa physique / 18h30 MMA / 19h30 Lady Boxing ; Mer 14h Boxe éducative / 18h30 Kick-boxing / 19h30 Boxe anglaise ; Jeu 12h30 Prépa physique / 18h30 Kick-boxing / 19h30 Grappling & JJB ; Ven 18h30 Boxe anglaise / 19h30 Sparring / 20h30 MMA ; Sam 10h30 Prépa physique / 11h30 Baby boxe / 12h30 Open mat.`;

/** Bloc d'infos construit depuis le contenu éditable du site (backoffice). */
export function liveInfo() {
  try {
    const c = JSON.parse(readFileSync(join(process.cwd(), "src/content.json"), "utf8"));
    const s = c.site || {};
    const a = s.address || {};
    const L = [];
    if (s.name) L.push(`${s.name} : salle phare du groupe Boxing Center, 800 m², à Portet-sur-Garonne (depuis 2016). ${s.claim || ""}`.trim());
    if (a.street) L.push(`Adresse : ${a.street}, ${a.zip || ""} ${a.city || ""}. Téléphone : ${s.phone || ""}. Email : ${s.email || ""}.`);
    if (s.hours) L.push(`Horaires de la salle : ${s.hours}. Accès illimité 7j/7 pour les abonnés.`);
    if (Array.isArray(c.tarifs) && c.tarifs.length)
      L.push("Tarifs : " + c.tarifs.map((t) => `${t.name} ${t.price} ${t.unit || ""}`.trim()).join(" ; ") + ".");
    if (Array.isArray(c.disciplines) && c.disciplines.length)
      L.push("Disciplines : " + c.disciplines.map((d) => d.name).filter(Boolean).join(", ") + ".");
    if (Array.isArray(c.team) && c.team.length)
      L.push("Coachs diplômés (FFBoxe, FFKMDA, FMMAF) : " + c.team.map((m) => `${m.name}${m.role ? ` (${m.role})` : ""}`).join(", ") + ". Du débutant au compétiteur.");
    if (Array.isArray(c.planning) && c.planning.length)
      L.push("Planning Portet : " + c.planning
        .map((d) => `${d.day} ${(d.items || []).map((i) => `${i[0]} ${i[1]}`).join(" / ")}`.trim())
        .join(" ; ") + ".");
    return L.length >= 4 ? "- " + L.join("\n- ") : null; // contenu trop partiel → repli
  } catch { return null; }
}

const NETWORK = `RÉSEAU BOXING CENTER (salles sœurs, mêmes valeurs, accès partagé avec l'abonnement) :
Portet-sur-Garonne (salle phare), Toulouse Minimes, Toulouse Saint-Cyprien, Ramonville, Toulouse États-Unis.
Groupe : boxingcenter.fr. Pour les infos précises d'une autre salle (horaires, planning), invite à appeler le 05 62 24 46 82 ou à visiter boxingcenter.fr.`;

const SYSTEM = `Tu es l'assistant virtuel du BOXING CENTER PORTET (salle de boxe à Portet-sur-Garonne).
Ton rôle : renseigner chaleureusement les visiteurs et donner envie de venir s'entraîner.

RÈGLES :
- Réponds en FRANÇAIS, de façon concise (2 à 4 phrases), chaleureuse, motivante, tutoiement amical.
- Réponds à partir des infos ci-dessous (club de Portet ET réseau Boxing Center). Si une info précise
  manque, invite à appeler le 05 62 24 46 82 ou à passer au club — n'invente JAMAIS un prix, un horaire
  ou un fait.
- Comprends le langage naturel : questions mal orthographiées, phrases courtes, argot — déduis l'intention.
- Si le visiteur se présente (prénom) ou exprime un intérêt, sois personnel et encourageant. Utilise son
  prénom s'il est connu (voir CONTEXTE).
- Quand c'est pertinent (essai, inscription, cours d'un débutant), encourage la séance d'essai à 10€ et,
  si le visiteur est chaud, propose-lui gentiment de laisser un prénom + un numéro ou un email pour qu'un
  coach le rappelle — sans jamais insister ni bloquer la conversation.

INFOS CLUB (Portet) :
${liveInfo() || STATIC_INFO}
${STATIC_TAIL}

${NETWORK}`;

/** Construit le prompt système, en injectant le contexte visiteur (prénom, salle) si fourni. */
function systemFor(context) {
  const c = String(context || "").slice(0, 300).trim();
  return c ? `${SYSTEM}\n\nCONTEXTE VISITEUR (déjà connu, ne redemande pas) : ${c}` : SYSTEM;
}

async function gemini(key, model, messages, system) {
  const contents = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 450, temperature: 0.4 } }),
  });
  if (!r.ok) throw new Error("gemini " + r.status);
  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim();
  if (!text) throw new Error("gemini empty");
  return text;
}
async function openaiLike(url, key, model, messages, system) {
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 450, temperature: 0.4, messages: [{ role: "system", content: system }, ...messages] }),
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
  const system = systemFor(body.context);

  // 1) Gemini key pool (rotate + skip dead keys)
  const gKeys = Object.keys(process.env).filter((k) => /^GEMINI_API_KEY/.test(k)).map((k) => process.env[k]).filter(Boolean);
  for (let i = gKeys.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [gKeys[i], gKeys[j]] = [gKeys[j], gKeys[i]]; }
  const gModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  for (const key of gKeys) {
    try { return res.status(200).json({ reply: await gemini(key, gModel, messages, system), via: "gemini" }); } catch { /* try next */ }
  }
  // 2) Groq, 3) Mistral
  if (process.env.GROQ_API_KEY) {
    try { return res.status(200).json({ reply: await openaiLike("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, process.env.GROQ_MODEL || "llama-3.3-70b-versatile", messages, system), via: "groq" }); } catch {}
  }
  if (process.env.MISTRAL_API_KEY) {
    try { return res.status(200).json({ reply: await openaiLike("https://api.mistral.ai/v1/chat/completions", process.env.MISTRAL_API_KEY, process.env.MISTRAL_MODEL || "mistral-small-latest", messages, system), via: "mistral" }); } catch {}
  }
  return res.status(503).json({ error: "Assistant momentanément indisponible." });
}
