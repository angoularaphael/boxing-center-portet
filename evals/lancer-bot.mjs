/* Banc d'essai du bot vendeur — playbook Anthropic, applique a notre prompt.
 *
 *   node evals/lancer-bot.mjs            tous les cas
 *   node evals/lancer-bot.mjs B1 B3      seulement ceux-la
 *
 * Il teste LE VRAI prompt (importe depuis api/chat.js), pas une copie : une
 * copie derive, et un banc d'essai qui derive ment mieux qu'il ne mesure.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, "..");

/* .env — le meme pool de cles que la production. */
for (const ligne of readFileSync(join(RACINE, ".env"), "utf8").split(/\r?\n/)) {
  const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

const { systemFor } = await import("../api/chat.js");

/* Les cles de boutons que l'interface sait REELLEMENT afficher. Le prompt en
   annonce d'autres : c'est precisement ce qu'on veut faire apparaitre. */
const kb = readFileSync(join(RACINE, "src/chatbot-kb.ts"), "utf8");
const d = kb.indexOf("ACTIONS");
const bloc = kb.slice(d, kb.indexOf("\n};", d));
const CLES_UI = new Set([...bloc.matchAll(/^\s{2}([a-z]+):\s*\{/gm)].map((m) => m[1]));

/* ---- Controle statique, sans appel API : les cles annoncees par le prompt
   existent-elles TOUTES dans l interface ? C est ce controle qui manquait le
   jour ou « offre » a ete retiree de chatbot-kb.ts sans etre retiree du prompt :
   le bot posait un bouton que personne ne voyait. ---- */
const sourcePrompt = readFileSync(join(RACINE, "api/chat.js"), "utf8");
const ligneCles = sourcePrompt.split(/[\r\n]+/).find((l) => /Cl[eé]s disponibles/.test(l)) || "";
const clesPrompt = new Set(
  ligneCles.slice(ligneCles.indexOf(":") + 1).split("·")
    .map((seg) => (seg.trim().match(/^[a-z]+/) || [])[0])
    .filter(Boolean)
);
const mortes = [...clesPrompt].filter((k) => !CLES_UI.has(k));
const orphelines = [...CLES_UI].filter((k) => !clesPrompt.has(k));
if (mortes.length) {
  console.log("  ECHEC  D0  [derive  ] Le prompt annonce des boutons que l interface n a pas");
  for (const k of mortes) console.log(`          - « ${k} » : le bot le posera, rien ne s affichera`);
} else {
  console.log("  PASSE  D0  [derive  ] Toutes les cles annoncees au bot existent dans l interface");
}
if (orphelines.length) console.log(`         (note : ${orphelines.length} cles existent dans l interface sans etre annoncees au bot : ${orphelines.join(", ")})`);
const derive = mortes.length ? 1 : 0;

const CAS = JSON.parse(readFileSync(join(ICI, "cas-bot.json"), "utf8")).cas;
const filtre = process.argv.slice(2);
const choisis = filtre.length ? CAS.filter((c) => filtre.includes(c.id)) : CAS;

const cles = Object.keys(process.env).filter((k) => /^GEMINI_API_KEY/.test(k)).map((k) => process.env[k]).filter(Boolean);
const MODELE = process.env.GEMINI_MODEL || "gemini-2.5-flash";
if (!cles.length) { console.error("Aucune cle GEMINI_API_KEY dans .env"); process.exit(2); }

let fournisseur = "gemini";
async function repondre(messages, system) {
  let derniere;
  fournisseur = "gemini";
  for (const cle of cles) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELE}:generateContent?key=${cle}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: 1024, temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
      if (!r.ok) { derniere = "HTTP " + r.status; continue; }
      const j = await r.json();
      const t = j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
      if (t.trim()) { fournisseur = "gemini"; return t.trim(); }
      derniere = "reponse vide";
    } catch (e) { derniere = String(e.message || e); }
  }
  /* Meme repli que la production : Gemini -> Groq -> Mistral. Un banc d essai
     qui tombe des que le quota gratuit sature ne mesure plus rien. */
  for (const [nom, url, cle, modele] of [
    ["groq", "https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, process.env.GROQ_MODEL || "llama-3.3-70b-versatile"],
    ["mistral", "https://api.mistral.ai/v1/chat/completions", process.env.MISTRAL_API_KEY, process.env.MISTRAL_MODEL || "mistral-small-latest"],
  ]) {
    if (!cle) continue;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
        body: JSON.stringify({ model: modele, max_tokens: 1024, temperature: 0.4, messages: [{ role: "system", content: system }, ...messages] }),
      });
      if (!r.ok) { derniere = nom + " HTTP " + r.status; continue; }
      const j = await r.json();
      const t = j?.choices?.[0]?.message?.content || "";
      if (t.trim()) { fournisseur = nom; return t.trim(); }
    } catch (e) { derniere = nom + " " + String(e.message || e); }
  }
  throw new Error("aucun fournisseur n a repondu (" + derniere + ")");
}

const boutonsDe = (t) => {
  const m = t.match(/\[boutons?\s*:([^\]]*)\]/i);
  return m ? m[1].split(",").map((s) => s.trim().split(":")[0].trim()).filter(Boolean) : [];
};
const MOTS_FR = /\b(le|la|les|des|une|vous|tu|est|pour|avec|sans|salle|s[ée]ance|offre|semaine)\b/gi;

let ok = derive ? 0 : 1, ko = derive;
const echecs = [];

for (const cas of choisis) {
  const system = systemFor(null);
  const messages = [];
  const reponses = [];
  let erreur = null;
  try {
    for (const tour of cas.tours) {
      messages.push({ role: "user", content: tour });
      const rep = await repondre(messages, system);
      messages.push({ role: "assistant", content: rep });
      reponses.push(rep);
    }
  } catch (e) { erreur = String(e.message || e); }

  const griefs = [];
  if (erreur) griefs.push("appel impossible : " + erreur);
  else {
    const derniere = reponses[reponses.length - 1];
    const btnDerniers = boutonsDe(derniere);
    for (const p of cas.doit_contenir || []) if (!new RegExp(p, "i").test(derniere)) griefs.push(`ne contient pas /${p}/`);
    for (const p of cas.doit_pas_contenir || []) { const m = derniere.match(new RegExp(p, "i")); if (m) griefs.push(`contient l'interdit /${p}/ -> « ${m[0]} »`); }
    for (const b of cas.boutons_attendus || []) if (!btnDerniers.includes(b)) griefs.push(`bouton « ${b} » attendu, absent (recu : ${btnDerniers.join(", ") || "aucun"})`);
    for (const b of cas.boutons_interdits || []) if (btnDerniers.includes(b)) griefs.push(`bouton « ${b} » interdit, present`);
    if (cas.boutons_valides) for (const rep of reponses) for (const b of boutonsDe(rep)) if (!CLES_UI.has(b)) griefs.push(`bouton « ${b} » n'existe pas dans l'interface — il disparaitra silencieusement`);
    if (cas.langue === "en") { const n = (derniere.match(MOTS_FR) || []).length; if (n >= 3) griefs.push(`repond en francais alors que le visiteur ecrit en anglais (${n} mots francais)`); }
  }

  const passe = griefs.length === 0;
  passe ? ok++ : ko++;
  console.log(`${passe ? "  PASSE " : "  ECHEC "} ${cas.id.padEnd(3)} [${cas.famille.padEnd(8)}] ${cas.titre}`);
  for (const g of [...new Set(griefs)]) console.log(`          - ${g}`);
  if (!passe) echecs.push({ cas, reponses, griefs: [...new Set(griefs)] });
}

console.log(`\n  ${ok} passes / ${ok + ko} cas` + (ko ? `  —  ${ko} ECHECS` : "  —  tout passe"));
if (echecs.length) {
  console.log("\n===== REPONSES FAUTIVES =====");
  for (const e of echecs) {
    console.log(`\n--- ${e.cas.id} : ${e.cas.titre} ---`);
    e.cas.tours.forEach((t, i) => { console.log(`  VISITEUR> ${t}`); console.log(`  BOT     > ${(e.reponses[i] || "(rien)").replace(/\n/g, "\n            ")}`); });
  }
}
process.exit(ko ? 1 : 0);
