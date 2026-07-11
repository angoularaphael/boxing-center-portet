// POST /api/admin/media-sign  [admin]
// Returns signed params so the backoffice can upload an image straight to
// Cloudinary (folder bcp-site, no moderation). The returned secure_url is then
// stored in content.json as the image src.
import { cloudinary, allowCors, isAdmin } from "../_lib/util.js";

export default async function handler(req, res) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const cfg = cloudinary.config();
  const timestamp = Math.round(Date.now() / 1000);
  const folder = "bcp-site";
  const params = { folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(params, cfg.api_secret);
  return res.status(200).json({ cloudName: cfg.cloud_name, apiKey: cfg.api_key, timestamp, folder, signature });
}
