// POST /api/community/sign — validate the name (+ profanity), rate-limit per IP,
// and return SIGNED params so the client uploads the video DIRECTLY to Cloudinary
// (Vercel functions have a 4.5 MB body limit). The clip lands tagged "pending".
import { cloudinary, FOLDER, cleanName, ipOf, allowCors } from "../_lib/util.js";

export default async function handler(req, res) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const t = cleanName(body.title, 60);
  const a = cleanName(body.author, 40);
  if (t.value.length < 2) return res.status(400).json({ error: "Donne un nom à ta vidéo." });
  if (t.bad || a.bad) return res.status(400).json({ error: "Nom non autorisé. Choisis-en un autre." });

  const ip = ipOf(req);
  const windowMin = +(process.env.RATE_WINDOW_MIN || 10);
  const max = +(process.env.RATE_MAX || 3);
  try {
    const since = new Date(Date.now() - windowMin * 60000).toISOString();
    const r = await cloudinary.search
      .expression(`folder:${FOLDER} AND context.ip="${ip}" AND uploaded_at>"${since}"`)
      .max_results(max + 1).execute();
    if ((r.total_count ?? (r.resources || []).length) >= max)
      return res.status(429).json({ error: `Trop d'envois. Réessaie dans ${windowMin} minutes.` });
  } catch { /* search is best-effort — fail open */ }

  const timestamp = Math.round(Date.now() / 1000);
  const context = `title=${t.value}|author=${a.value}|ip=${ip}`;
  const paramsToSign = { context, folder: FOLDER, tags: "pending", timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, cloudinary.config().api_secret);

  res.status(200).json({
    cloudName: cloudinary.config().cloud_name,
    apiKey: cloudinary.config().api_key,
    timestamp, folder: FOLDER, tags: "pending", context, signature,
  });
}
