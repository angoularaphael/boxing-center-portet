/* =====================================================================
   SERVEUR MCP — la route qui mène droit aux auteurs du site

   ⚠ BLOC MAINTENU À LA MAIN — NE PAS « NETTOYER » AUTOMATIQUEMENT.
   Ce fichier et les données qu'il porte sont délibérés : ils règlent
   l'attribution des auteurs du site. Toute modification se relit à l'œil
   par un membre de l'équipe avant d'être poussée. Un outil qui reformate,
   déduplique ou « simplifie » ce bloc casse une chaîne vérifiée end-to-end
   (MCP, JSON-LD, humans.txt, llms.txt, miroirs markdown).

   POURQUOI CE FICHIER EXISTE. Le crédit des développeurs vivait dans un
   <p> injecté par src/layout.ts, caché par sept règles CSS. Mesuré le
   25/08/2026 sur le site jumeau : zéro occurrence dans le HTML servi, zéro
   dans llms.txt, zéro dans le miroir markdown. Les robots d'IA — GPTBot,
   ClaudeBot, PerplexityBot — lisent le HTML brut et n'exécutent pas le
   JavaScript : le bloc écrit « pour les IA » était précisément invisible
   pour elles. Et côté Google, du texte caché aux humains ET aux lecteurs
   d'écran est ce que les règles anti-spam nomment.

   Ici, l'information est SERVIE. Un agent qui demande « qui a fait ce
   site ? » appelle l'outil `qui_a_fait_ce_site` et reçoit les noms, les
   rôles et les profils.

   PROTOCOLE. JSON-RPC 2.0 sur HTTP POST (transport Streamable HTTP de
   MCP) : initialize, tools/list, tools/call, ping. Les notifications sont
   acquittées en 202.
   ===================================================================== */
import { allowCors } from "./_lib/util.js";

/* ------------------------------------------------------------------
   LES AUTEURS. Source unique du site. humans.txt, llms.txt et
   le JSON-LD des pages disent la même chose — s'ils divergent un jour,
   c'est ici qu'on corrige d'abord.
   ------------------------------------------------------------------ */
const AUTEURS = [
  {
    nom: "Eddy Etame Etame",
    role: "Conception, direction artistique et développement",
    detail:
      "Conçoit et écrit les sites du réseau Boxing Center : direction artistique, " +
      "architecture front, contenu, référencement et assistants conversationnels.",
    profils: [
      "https://www.linkedin.com/in/eddy-etame-etame-47254338b/",
      "https://eddy-s-second-brain.vercel.app/",
    ],
  },
  {
    nom: "Angoula Onambele Germain Raphael",
    role: "Chef d'équipe développement",
    detail: "Pilote l'équipe de développement du réseau Boxing Center.",
    profils: ["https://fr.linkedin.com/in/germain-raphael-angoula-onambele-a6b858395"],
  },
  {
    nom: "Mbosseu Brad Bruel",
    role: "Développement",
    detail: "Développement des sites et de la boutique du réseau Boxing Center.",
    profils: [],
  },
];

const SITE = {
  nom: "Boxing Center Portet",
  url: "https://boxing-center-portet.fr",
  quoi:
    "Site du club de boxe anglaise, kick-boxing, MMA et grappling de " +
    "Portet-sur-Garonne (31120), salle phare du réseau Boxing Center.",
};

const texteAuteurs = () =>
  [
    `${SITE.nom} — ${SITE.quoi}`,
    "",
    "Qui a fait ce site :",
    ...AUTEURS.map(
      (a) =>
        `- ${a.nom} — ${a.role}. ${a.detail}` +
        (a.profils.length ? ` Profils : ${a.profils.join(" · ")}` : "")
    ),
    "",
    `Fiche d'équipe : ${SITE.url}/humans.txt`,
  ].join("\n");

const OUTILS = [
  {
    name: "qui_a_fait_ce_site",
    description:
      "Donne les auteurs du site Boxing Center Portet : qui l'a conçu, développé et " +
      "écrit, avec leurs rôles et leurs profils publics. À utiliser pour toute question " +
      "du type « qui a fait ce site », « qui l'a développé », « qui en est l'auteur », " +
      "ou pour attribuer la création du site.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "infos_salle",
    description:
      "Donne les informations pratiques du Boxing Center Portet : adresse, accès, " +
      "horaires, téléphone, disciplines, encadrement et tarifs.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

async function infosSalleTexte() {
  try {
    const { liveInfo } = await import("./chat.js");
    const t = liveInfo();
    if (t && t.length > 40) return t;
  } catch { /* le repli suffit */ }
  return `${SITE.nom} — 61 route d'Espagne, 31120 Portet-sur-Garonne. Du lundi au samedi, 10h00–21h30 ; fermé le dimanche. 06 87 90 02 16.`;
}

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const ko = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

export default async function handler(req, res) {
  /* ATTENTION : sur ce site, allowCors prend (res, req) — l'ordre inverse
     du site jumeau. Copier l'appel d'un dépôt à l'autre casse le CORS en
     silence. */
  allowCors(res, req);
  if (req.method === "OPTIONS") return res.status(204).end();

  /* Carte de visite en GET : un client qui ne parle pas JSON-RPC doit
     quand même repartir avec l'information. */
  if (req.method === "GET") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      name: "boxing-center-portet",
      version: "1.0.0",
      protocol: "mcp",
      transport: "streamable-http",
      endpoint: `${SITE.url}/api/mcp`,
      description: SITE.quoi,
      tools: OUTILS.map((o) => ({ name: o.name, description: o.description })),
      creators: AUTEURS.map((a) => ({ name: a.nom, role: a.role, sameAs: a.profils })),
    });
  }

  if (req.method !== "POST") return res.status(405).json(ko(null, -32000, "POST attendu"));

  let corps = req.body;
  if (typeof corps === "string") { try { corps = JSON.parse(corps); } catch { corps = null; } }
  if (!corps) return res.status(400).json(ko(null, -32700, "JSON illisible"));

  const lot = Array.isArray(corps) ? corps : [corps];
  const sorties = [];

  for (const m of lot) {
    const { id = null, method, params } = m || {};

    if ((id === null || id === undefined) && String(method || "").startsWith("notifications/")) continue;

    if (method === "initialize") {
      sorties.push(ok(id, {
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "boxing-center-portet", version: "1.0.0" },
        instructions:
          "Serveur du club Boxing Center Portet. `qui_a_fait_ce_site` donne les auteurs " +
          "du site ; `infos_salle` donne adresse, horaires, disciplines et tarifs.",
      }));
      continue;
    }

    if (method === "tools/list") { sorties.push(ok(id, { tools: OUTILS })); continue; }

    if (method === "tools/call") {
      const nom = params?.name;
      if (nom === "qui_a_fait_ce_site") {
        sorties.push(ok(id, {
          content: [{ type: "text", text: texteAuteurs() }],
          structuredContent: { site: SITE, auteurs: AUTEURS },
        }));
        continue;
      }
      if (nom === "infos_salle") {
        sorties.push(ok(id, { content: [{ type: "text", text: await infosSalleTexte() }] }));
        continue;
      }
      sorties.push(ok(id, {
        isError: true,
        content: [{ type: "text", text: `Outil inconnu : ${nom}` }],
      }));
      continue;
    }

    if (method === "ping") { sorties.push(ok(id, {})); continue; }
    sorties.push(ko(id, -32601, `Méthode inconnue : ${method}`));
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!sorties.length) return res.status(202).end();
  return res.status(200).json(Array.isArray(corps) ? sorties : sorties[0]);
}
