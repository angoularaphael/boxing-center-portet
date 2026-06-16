// GET /api/community/items — the public wall: approved clips only (tag=approved).
import { cloudinary, FOLDER, allowCors, publicItem } from "../_lib/util.js";

export default async function handler(req, res) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const r = await cloudinary.search
      .expression(`folder:${FOLDER} AND resource_type:video AND tags=approved`)
      .with_field("context").sort_by("created_at", "desc").max_results(60).execute();
    res.status(200).json({ items: (r.resources || []).map(publicItem) });
  } catch {
    res.status(200).json({ items: [] });
  }
}
