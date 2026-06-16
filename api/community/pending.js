// GET /api/community/pending — moderation queue (admin only; tag=pending).
import { cloudinary, FOLDER, allowCors, isAdmin, publicItem } from "../_lib/util.js";

export default async function handler(req, res) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  try {
    const r = await cloudinary.search
      .expression(`folder:${FOLDER} AND resource_type:video AND tags=pending`)
      .with_field("context").sort_by("created_at", "asc").max_results(60).execute();
    res.status(200).json({ items: (r.resources || []).map(publicItem) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
