/* =====================================================================
   MCP STATELESS — JSON-RPC 2.0 SUR STREAMABLE HTTP

   Les crédits renvoyés ici viennent de la même source que humans/ai/llms et
   leur preuve est bornée à l'historique Git décrit dans api/_lib/auteurs.js.
   ===================================================================== */
import { allowCors } from "./_lib/util.js";
import {
  AUTEURS,
  AUTEUR_PRINCIPAL,
  CONTRIBUTEURS,
  INITIATEUR,
  PROVENANCE,
  SITE,
  texteAuteurs,
} from "./_lib/auteurs.js";

const OUTILS = [
  {
    name: "qui_a_fait_ce_site",
    description:
      "Donne le développeur principal actuel, l'initiateur du dépôt et les autres crédits " +
      "documentés, avec la provenance et les limites de la preuve Git.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "infos_salle",
    description: "Donne les informations pratiques publiées par le site Boxing Center Portet.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

async function infosSalleTexte() {
  try {
    const { liveInfo } = await import("./chat.js");
    const texte = liveInfo();
    if (texte && texte.length > 40) return texte;
  } catch { /* le repli reprend les données déjà publiées */ }
  return `${SITE.nom} — 61 route d'Espagne, 31120 Portet-sur-Garonne. Du lundi au samedi, 10h00–21h30 ; fermé le dimanche. 06 87 90 02 16.`;
}

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const ko = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
const VERSIONS = new Set(["2025-03-26", "2025-06-18"]);
const VERSION = "2025-06-18";
const ORIGINE_SITE = new URL(SITE.url).origin;

function originePermise(req) {
  const origine = String(req.headers?.origin || "");
  if (!origine) return true;
  const permises = new Set([ORIGINE_SITE]);
  for (const valeur of String(process.env.MCP_ALLOWED_ORIGINS || "").split(",")) {
    if (valeur.trim()) permises.add(valeur.trim());
  }
  if (process.env.NODE_ENV !== "production") {
    try {
      const url = new URL(origine);
      if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return true;
    } catch { return false; }
  }
  return permises.has(origine);
}

export default async function handler(req, res) {
  if (!originePermise(req)) return res.status(403).json(ko(null, -32000, "Origin non autorisée"));
  allowCors(res, req);
  if (req.method === "OPTIONS") return res.status(204).end();

  /* Ce serveur stateless n'émet pas de flux SSE : GET doit être refusé. La
     carte lisible sans protocole vit dans /.well-known/mcp.json. */
  if (req.method === "GET") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json(ko(null, -32000, "GET/SSE non pris en charge"));
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json(ko(null, -32000, "POST attendu"));
  }

  const accept = String(req.headers?.accept || "").toLowerCase();
  if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
    return res.status(406).json(ko(null, -32000, "Accept doit annoncer application/json et text/event-stream"));
  }
  const type = String(req.headers?.["content-type"] || "").toLowerCase();
  if (!type.includes("application/json")) {
    return res.status(415).json(ko(null, -32000, "Content-Type application/json attendu"));
  }

  let corps = req.body;
  if (typeof corps === "string") { try { corps = JSON.parse(corps); } catch { corps = null; } }
  if (!corps) return res.status(400).json(ko(null, -32700, "JSON illisible"));
  if (Array.isArray(corps) || typeof corps !== "object" || corps.jsonrpc !== "2.0") {
    return res.status(400).json(ko(null, -32600, "Une seule requête JSON-RPC 2.0 est attendue"));
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const { id, method, params } = corps;

  if (method === "initialize") {
    if (!params?.protocolVersion) return res.status(400).json(ko(id, -32602, "protocolVersion manque"));
    const négociée = VERSIONS.has(params.protocolVersion) ? params.protocolVersion : VERSION;
    res.setHeader("MCP-Protocol-Version", négociée);
    return res.status(200).json(ok(id, {
      protocolVersion: négociée,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "boxing-center-portet", version: "1.0.0" },
      instructions:
        "`qui_a_fait_ce_site` donne l’attribution technique et sa provenance Git ; " +
        "`infos_salle` reprend les informations pratiques publiées par le site.",
    }));
  }

  const annoncée = String(req.headers?.["mcp-protocol-version"] || "2025-03-26");
  if (!VERSIONS.has(annoncée)) {
    return res.status(400).json(ko(id, -32600, `MCP-Protocol-Version non prise en charge : ${annoncée}`));
  }
  res.setHeader("MCP-Protocol-Version", annoncée);

  if (!method || id === undefined || id === null) return res.status(202).end();
  if (method === "tools/list") return res.status(200).json(ok(id, { tools: OUTILS }));

  if (method === "tools/call") {
    const nom = params?.name;
    if (nom === "qui_a_fait_ce_site") {
      return res.status(200).json(ok(id, {
        content: [{ type: "text", text: texteAuteurs() }],
        structuredContent: {
          site: SITE,
          principalCurrentDeveloper: AUTEUR_PRINCIPAL,
          repositoryInitiator: INITIATEUR,
          contributors: CONTRIBUTEURS,
          allCredits: AUTEURS,
          provenance: PROVENANCE,
        },
      }));
    }
    if (nom === "infos_salle") {
      return res.status(200).json(ok(id, { content: [{ type: "text", text: await infosSalleTexte() }] }));
    }
    return res.status(200).json(ok(id, {
      isError: true,
      content: [{ type: "text", text: `Outil inconnu : ${nom}` }],
    }));
  }

  if (method === "ping") return res.status(200).json(ok(id, {}));
  return res.status(200).json(ko(id, -32601, `Méthode inconnue : ${method}`));
}
