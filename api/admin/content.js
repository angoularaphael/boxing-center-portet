// Admin content API (backoffice).
//  GET  /api/admin/content  -> current content.json (+ sha)   [admin]
//  POST /api/admin/content  -> validate, commit content.json to GitHub,
//                              trigger a Vercel rebuild (publish)            [admin]
// Env: ADMIN_TOKEN, GITHUB_TOKEN, GITHUB_REPO (default angoularaphael/boxing-center-portet),
//      GITHUB_BRANCH (default main), VERCEL_DEPLOY_HOOK (optional but recommended).
import { allowCors, isAdmin } from "../_lib/util.js";

const REPO = process.env.GITHUB_REPO || "angoularaphael/boxing-center-portet";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const PATH = "src/content.json";
const TOP_KEYS = ["site", "hero", "stats", "disciplines", "audiences", "team", "values", "tarifs", "planning", "gallery", "seo"];

function gh(path, init = {}) {
  return fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "bcp-admin",
      ...(init.headers || {}),
    },
  });
}

export default async function handler(req, res) {
  allowCors(res, req);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!process.env.GITHUB_TOKEN) return res.status(500).json({ error: "GITHUB_TOKEN non configuré." });

  if (req.method === "GET") {
    const r = await gh(`contents/${PATH}?ref=${BRANCH}`);
    if (!r.ok) return res.status(502).json({ error: "Lecture GitHub échouée (" + r.status + ")" });
    const j = await r.json();
    const content = JSON.parse(Buffer.from(j.content, "base64").toString("utf8"));
    return res.status(200).json({ content, sha: j.sha });
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const content = body.content;
    if (!content || typeof content !== "object" || Array.isArray(content))
      return res.status(400).json({ error: "Contenu invalide." });
    if (!TOP_KEYS.some((k) => k in content))
      return res.status(400).json({ error: "Structure de contenu inattendue." });
    const json = JSON.stringify(content, null, 2);
    if (json.length > 400_000) return res.status(413).json({ error: "Contenu trop volumineux." });

    // current sha (required for update)
    const cur = await gh(`contents/${PATH}?ref=${BRANCH}`);
    const sha = cur.ok ? (await cur.json()).sha : undefined;

    const put = await gh(`contents/${PATH}`, {
      method: "PUT",
      body: JSON.stringify({
        message: "admin: mise à jour du contenu du site",
        content: Buffer.from(json + "\n", "utf8").toString("base64"),
        branch: BRANCH,
        sha,
      }),
    });
    if (!put.ok) return res.status(502).json({ error: "Écriture GitHub échouée (" + put.status + ")" });

    let rebuild = false;
    if (process.env.VERCEL_DEPLOY_HOOK) {
      try { await fetch(process.env.VERCEL_DEPLOY_HOOK, { method: "POST" }); rebuild = true; } catch {}
    }
    return res.status(200).json({ ok: true, rebuild });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
