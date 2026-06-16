// Shared helpers for the Boxing Center Portet community API (Vercel serverless).
// Cloudinary = storage + treatment (eager transforms) + DB (tags) + moderation.
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({ secure: true }); // reads CLOUDINARY_URL from the environment

export { cloudinary };
export const FOLDER = "bcp-community";

const BADWORDS = [
  "merde", "putain", "connard", "connasse", "salope", "encule", "pute", "bite", "couille", "nique",
  "ntm", "pd", "pede", "tapette", "bougnoule", "negro", "negre", "youpin", "salaud",
  "fuck", "shit", "bitch", "cunt", "nigger", "faggot", "whore", "rape", "nazi", "kys", "porn", "sex",
];

/** Validate + sanitise a user-supplied name. Returns { value, bad }. */
export function cleanName(s, max) {
  const value = String(s || "").trim().slice(0, max).replace(/[=|<>]/g, ""); // strip context/HTML-breaking chars
  const norm = value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ");
  const bad =
    /(.)\1{6,}/.test(norm) ||
    /https?:|www\.|\.[a-z]{2,}\/?/i.test(value) ||
    BADWORDS.some((w) => new RegExp(`\\b${w}`, "i").test(norm));
  return { value, bad };
}

export function ipOf(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "0.0.0.0";
}

export function allowCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
}

export function isAdmin(req) {
  return !!process.env.ADMIN_TOKEN && (req.headers["x-admin-token"] || "") === process.env.ADMIN_TOKEN;
}

/** Map a Cloudinary video resource → the public item shape the site expects. */
export function publicItem(r) {
  const id = r.public_id;
  const ctx = (r.context && (r.context.custom || r.context)) || {};
  const src = cloudinary.url(id, { resource_type: "video", secure: true, transformation: [{ quality: "auto" }] });
  const poster = cloudinary.url(id, { resource_type: "video", format: "jpg", secure: true, transformation: [{ quality: "auto", fetch_format: "auto" }] });
  return { id, title: ctx.title || "", author: ctx.author || "", src, poster, createdAt: r.created_at };
}
