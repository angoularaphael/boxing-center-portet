// GET /api/community/pending — moderation queue (admin only; tag=pending).
import { cloudinary, FOLDER, allowCors, isAdmin, publicItem, memoryLimit, ipOf } from "../_lib/util.js";

export default async function handler(req, res) {
  allowCors(res, req);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!isAdmin(req)) {
    // anti force-brute sur le jeton admin : 5 tentatives ratées / minute / IP
    if (!memoryLimit(`admin401:${ipOf(req)}`, 5, 60_000)) return res.status(429).json({ error: "Trop de tentatives." });
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const r = await cloudinary.search
      .expression(`folder:${FOLDER} AND tags=pending`)
      .with_field("context").sort_by("created_at", "asc").max_results(60).execute();
    res.status(200).json({ items: (r.resources || []).map(publicItem) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
