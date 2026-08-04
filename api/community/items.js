// GET /api/community/items — the public wall: approved clips only (tag=approved).
import { cloudinary, FOLDER, allowCors, publicItem } from "../_lib/util.js";

export default async function handler(req, res) {
  allowCors(res, req);
  if (req.method === "OPTIONS") return res.status(204).end();
  // le mur public est cachable : 60 s au CDN, resservi 5 min pendant la revalidation
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  try {
    const r = await cloudinary.search
      .expression(`folder:${FOLDER} AND tags=approved`)
      .with_field("context").sort_by("created_at", "desc").max_results(60).execute();
    res.status(200).json({ items: (r.resources || []).map(publicItem) });
  } catch {
    res.status(200).json({ items: [] });
  }
}
