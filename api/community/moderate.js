// POST /api/community/moderate — admin approve (tag) / reject (destroy).
import { cloudinary, allowCors, isAdmin, memoryLimit, ipOf } from "../_lib/util.js";

export default async function handler(req, res) {
  allowCors(res, req);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!isAdmin(req)) {
    if (!memoryLimit(`admin401:${ipOf(req)}`, 5, 60_000)) return res.status(429).json({ error: "Trop de tentatives." });
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { id, action } = body;
  const rtype = body.rtype === "image" ? "image" : "video";
  if (!id) return res.status(400).json({ error: "Missing id" });
  try {
    if (action === "approve") {
      // ceinture + bretelles : jamais plus de 16 s en public, même si un dépôt
      // ancien (avant la troncature signée du_16) traînait dans la file
      if (rtype === "video") {
        try {
          const meta = await cloudinary.api.resource(id, { resource_type: "video" });
          if (meta && meta.duration && meta.duration > 16.5) {
            return res.status(422).json({ error: `Vidéo trop longue (${Math.round(meta.duration)}s > 16s) — refuse-la ou redemande un envoi.` });
          }
        } catch { /* métadonnées indisponibles : la validation humaine reste le juge */ }
      }
      await cloudinary.uploader.add_tag("approved", [id], { resource_type: rtype });
      await cloudinary.uploader.remove_tag("pending", [id], { resource_type: rtype });
    } else if (action === "reject") {
      await cloudinary.uploader.destroy(id, { resource_type: rtype });
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }
    res.status(200).json({ ok: true, id, status: action === "approve" ? "approved" : "rejected" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
