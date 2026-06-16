// POST /api/community/moderate — admin approve (tag) / reject (destroy).
import { cloudinary, allowCors, isAdmin } from "../_lib/util.js";

export default async function handler(req, res) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { id, action } = body;
  if (!id) return res.status(400).json({ error: "Missing id" });
  try {
    if (action === "approve") {
      await cloudinary.uploader.add_tag("approved", [id], { resource_type: "video" });
      await cloudinary.uploader.remove_tag("pending", [id], { resource_type: "video" });
    } else if (action === "reject") {
      await cloudinary.uploader.destroy(id, { resource_type: "video" });
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }
    res.status(200).json({ ok: true, id, status: action === "approve" ? "approved" : "rejected" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
