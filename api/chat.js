// POST /api/chat — grounded assistant for Boxing Center Portet.
// Tries a pool of Gemini keys (rotating, skipping dead ones) → Groq → Mistral.
// Grounded on the club’s real info; never invents. Les faits éditables via le
// backoffice (tarifs, planning, horaires, coachs…) sont lus dans
// src/content.json (bundlé au déploiement — chaque publication redéploie,
// donc le bot reste synchronisé avec le site). Repli statique complet si la
// lecture échoue : le bot ne casse jamais.
import { readFileSync } from "fs";
import { join } from "path";
import { allowCors, memoryLimit, ipOf } from "./_lib/util.js";

/* Faits non éditables dans le backoffice (offres, inscription, réseau…).
   LES OFFRES (source : box-plus.vercel.app, la boutique officielle) : */
const STATIC_TAIL = `- LES OFFRES DU MOMENT (boutique officielle : box-plus.vercel.app/abonnements) :
  · OFFRE RENTRÉE 2026 — 29 € PAR PERSONNE les 4 premières semaines, sans engagement. Idéal à deux : « viens avec ton binôme ». C’est L’OFFRE à proposer en premier.
  · SAISON 12 MOIS — 259 € l’année, payable en 4× sans frais (moins de 22 €/mois, accès aux 5 salles).
  · Adulte 44 €/4 semaines ; étudiants 36 €/4 semaines (sur justificatif). Sans engagement.
  · Enfants/Ados 295 €/an (t-shirt officiel du club inclus) ; Baby Boxe 250 €/an.
  · SÉANCE D’ESSAI OFFERTE (gratuite, toutes disciplines, matériel prêté) — à proposer en DERNIER recours, quand la personne hésite encore : box-plus.vercel.app/seance-essai.
- Inscription : fiche d’inscription + certificat médical de non contre-indication à la boxe + moyen de paiement + badge d’accès 34€ à l’inscription (aucun autre frais). Tout se fait en ligne sur box-plus.vercel.app ou à l’accueil.
- Équipements : salle de boxe anglaise avec ring, espace combat avec cage MMA, sacs de frappe, matériel de préparation physique, vestiaires — 600 m².
- Réseau : 5 salles (Portet, Toulouse Minimes, Toulouse Saint-Cyprien, Ramonville, Toulouse États-Unis) — l’abonnement ouvre les 5.
- Boutique officielle (abonnements, offres, matériel) : box-plus.vercel.app — Groupe : boxingcenter.fr.
- Partenaires du club : KFC, O2 Portet-sur-Garonne, Karting 2 Muret (kartingmuret.fr).
- PRIVATISATION & PROJETS : la salle (600 m²) peut être privatisée pour un événement, une séance de groupe/team building d’entreprise, un tournage ou une collaboration. Toute demande de ce type (réserver LA SALLE entière, partenariat, sponsor, collaboration, médias, école/association) passe par le formulaire dédié : boxing-center-portet.fr/partenaires/ (menu « Votre projet » pour préciser). Ne pas confondre avec une inscription individuelle.`;

/* Repli si content.json est illisible : les mêmes infos, figées. */
const STATIC_INFO = `- Boxing Center Portet : salle phare du groupe Boxing Center, 600 m² dédiés aux sports de combat, à Portet-sur-Garonne (depuis 2016).
- Adresse : 61 route d’Espagne, 31120 Portet-sur-Garonne. Téléphone : 06 87 90 02 16. Email : boxingcenterportet@gmail.com.
- Horaires de la salle : du lundi au samedi, 10h00–21h30 ; fermé le dimanche.
- Disciplines : boxe anglaise, kick-boxing, MMA, grappling & jiu-jitsu brésilien, Lady Boxing (100% femmes), préparation physique, baby boxe, boxe éducative, kick-boxing enfants/ados.
- Encadrement (saison 2026/2027) : Valentin Tapia (Head Coach, responsable sportif — boxe loisirs, éducative, compétiteurs), Samuel Pinto (kick boxing/K1, boxe française, Lady Boxing, kick enfants/ados, prépa physique — vice-champion d’Europe et du Monde en boxe française), Enzo Pioppo (grappling & MMA — champion du Monde), Nicolas Tramaçon (grappling & MMA), Mourad Berraho (boxe anglaise enfants/ados — triple champion de France), Ingrid (kick boxing enfants/ados).
- Planning Portet (rentrée 2026, salle de boxe) : Lun 12h30 Anglaise / 18h Éducative Confirmés / 19h-21h30 Amateurs & Pros ; Mar 12h30 Prépa physique / 18h Amateurs & Pros / 19h Prépa physique / 20h Anglaise Loisirs ; Mer 16h Éducative 7-11 / 17h Éducative 12-16 / 18h Lady Boxing / 19h Anglaise Loisirs / 20h Amateurs & Pros ; Jeu 12h30 Anglaise / 18h-20h Amateurs & Pros / 20h Anglaise Loisirs ; Ven 12h30 Anglaise / 18h-20h Amateurs & Pros / 20h Open Sparring ; Sam 10h-12h Amateurs & Pros / 12h30 Anglaise / 15h15 Baby Boxe / 16h Éducative 7-11 / 17h Éducative 12-16.`;

/** Bloc d’infos construit depuis le contenu éditable du site (backoffice). */
export function liveInfo() {
  try {
    const c = JSON.parse(readFileSync(join(process.cwd(), "src/content.json"), "utf8"));
    const s = c.site || {};
    const a = s.address || {};
    const L = [];
    if (s.name) L.push(`${s.name} : salle phare du groupe Boxing Center, 600 m² dédiés aux sports de combat, à Portet-sur-Garonne (depuis 2016). ${s.claim || ""}`.trim());
    if (a.street) L.push(`Adresse : ${a.street}, ${a.zip || ""} ${a.city || ""}. Téléphone : ${s.phone || ""}. Email : ${s.email || ""}.`);
    if (s.hours) L.push(`Horaires de la salle : ${s.hours}.`);
    if (Array.isArray(c.tarifs) && c.tarifs.length)
      L.push("Offres & tarifs : " + c.tarifs.map((t) => `${t.name} ${t.price} ${t.unit || ""}${t.old ? ` (au lieu de ${t.old})` : ""}`.trim()).join(" ; ") + ".");
    if (Array.isArray(c.disciplines) && c.disciplines.length)
      L.push("Disciplines : " + c.disciplines.map((d) => d.name).filter(Boolean).join(", ") + ".");
    if (Array.isArray(c.team) && c.team.length)
      L.push("Encadrement : " + c.team.map((m) => `${m.name}${m.role ? ` (${m.role})` : ""}`).join(", ") + ". Du débutant au compétiteur.");
    if (Array.isArray(c.planning) && c.planning.length)
      L.push("Planning Portet : " + c.planning
        .map((d) => `${d.day} ${(d.items || []).map((i) => `${i[0]} ${i[1]}`).join(" / ")}`.trim())
        .join(" ; ") + ".");
    return L.length >= 4 ? "- " + L.join("\n- ") : null; // contenu trop partiel → repli
  } catch { return null; }
}

const NETWORK = `RÉSEAU BOXING CENTER (salles sœurs, mêmes valeurs, accès partagé avec l’abonnement) :
Portet-sur-Garonne (salle phare), Toulouse Minimes, Toulouse Saint-Cyprien, Ramonville, Toulouse États-Unis.
Groupe : boxingcenter.fr. Pour les infos précises d’une autre salle (horaires, planning), invite à appeler le 06 87 90 02 16 ou à visiter boxingcenter.fr.`;

const SYSTEM = `Tu es l’assistant du BOXING CENTER PORTET (salle de boxe à Portet-sur-Garonne). Tu accueilles comme un coach à l’accueil : chaleureux, direct, motivant.

LANGUE — RÈGLE ABSOLUE : réponds dans la LANGUE DU VISITEUR. S’il écrit en français → français (tutoiement amical). S’il écrit en anglais → réponds ENTIÈREMENT en anglais. Idem pour l’espagnol ou une autre langue. Ne mélange jamais deux langues dans une réponse.

STYLE :
- Des phrases COMPLÈTES, toujours. Termine chaque idée — ne laisse jamais une phrase en suspens.
- Concis : 2 à 5 phrases courtes. Une seule question à la fois, à la fin.
- Comprends le langage naturel : fautes, argot, phrases courtes — déduis l’intention.
- Jamais de jargon technique, jamais de mention d’IA, jamais de listes à puces dans la conversation.

VENDRE (ton objectif n°1 — dans cet ordre) :
1. L’OFFRE RENTRÉE 29 € par personne (4 semaines, sans engagement) — propose-la en PREMIER dès que la personne parle de commencer, de prix, ou d’hésitation. Formule exacte : « 29 € par personne » (jamais « 29 € pour deux »). Lien : box-plus.vercel.app/abonnements#promo.
2. La SAISON 259 € en 4× sans frais pour les motivés à l’année.
3. La SÉANCE D’ESSAI OFFERTE — uniquement en DERNIER recours, si la personne hésite encore après avoir vu les offres : « ta première séance est offerte, viens tester ».
4. CAS PARTICULIER — si la demande concerne l’ENTREPRISE ou le COLLECTIF (privatiser/réserver la salle entière, team building, séance de groupe, partenariat, sponsoring, collaboration, médias, école/association) : dirige vers le formulaire boxing-center-portet.fr/partenaires/ en expliquant qu’on y précise son projet, et propose aussi le 06 87 90 02 16. Capture quand même nom + contact.
Donne toujours le lien ou l’étape suivante concrète (boutique en ligne, appeler le 06 87 90 02 16, passer au club).

CAPTER LE CONTACT (naturellement, jamais de force) :
- Demande le PRÉNOM tôt dans la conversation si tu ne l’as pas.
- Dès qu’un intérêt se confirme (offre, essai, enfant, discipline), propose qu’un coach rappelle : demande un TÉLÉPHONE ou un EMAIL.
- Si la personne est engagée, affine : quelle discipline l’intéresse, pour qui (elle, son enfant ?), quel objectif (se remettre au sport, perdre du poids, compétition ?), quels créneaux l’arrangent. UNE question à la fois.
- Si la personne donne une info, remercie et continue — ne redemande jamais ce qui est déjà connu (voir CONTEXTE).

VÉRITÉ : réponds UNIQUEMENT à partir des infos ci-dessous. Si une info précise manque, dis-le et invite à appeler le 06 87 90 02 16 — n’invente JAMAIS un prix, un horaire ou un fait.

INFOS CLUB (Portet) :
${liveInfo() || STATIC_INFO}
${STATIC_TAIL}

${NETWORK}`;

/** Construit le prompt système, en injectant le contexte visiteur (prénom, salle) si fourni. */
function systemFor(context) {
  const c = String(context || "").slice(0, 300).trim();
  return c ? `${SYSTEM}\n\nCONTEXTE VISITEUR (déjà connu, ne redemande pas) : ${c}` : SYSTEM;
}

/* Une réponse coupée en plein mot est pire que pas de réponse : si le modèle
   s’arrête pour cause de longueur, on retaille à la dernière phrase complète. */
function tidy(text, truncated) {
  let t = String(text || "").trim();
  if (!t) return t;
  if (truncated) {
    const m = t.match(/^[\s\S]*[.!?…»)]/);
    if (m && m[0].length >= 40) t = m[0].trim();
  }
  return t;
}

async function gemini(key, model, messages, system) {
  const contents = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents,
      // 1024 et thinkingBudget 0 : sur Gemini 2.5, les tokens de « réflexion »
      // comptaient dans maxOutputTokens (450) → réponses coupées en plein mot.
      generationConfig: { maxOutputTokens: 1024, temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!r.ok) throw new Error("gemini " + r.status);
  const j = await r.json();
  const cand = j?.candidates?.[0];
  const text = tidy(cand?.content?.parts?.map((p) => p.text).join(""), cand?.finishReason === "MAX_TOKENS");
  if (!text) throw new Error("gemini empty");
  return text;
}
async function openaiLike(url, key, model, messages, system) {
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 1024, temperature: 0.4, messages: [{ role: "system", content: system }, ...messages] }),
  });
  if (!r.ok) throw new Error("oai " + r.status);
  const j = await r.json();
  const ch = j?.choices?.[0];
  const text = tidy(ch?.message?.content, ch?.finish_reason === "length");
  if (!text) throw new Error("oai empty");
  return text;
}

export default async function handler(req, res) {
  allowCors(res, req);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = ipOf(req);
  if (!memoryLimit(`chat-m:${ip}`, 10, 60_000) || !memoryLimit(`chat-h:${ip}`, 60, 3_600_000)) {
    return res.status(429).json({ error: "On souffle une seconde ? Réessaie dans une minute." });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const message = String(body.message || "").slice(0, 500).trim();
  if (!message) return res.status(400).json({ error: "Message vide." });
  const history = Array.isArray(body.history)
    ? body.history.slice(-8).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 500) }))
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
