// Shared helpers for the Boxing Center Portet community API (Vercel serverless).
// Cloudinary = storage + treatment (eager transforms) + DB (tags) + moderation.
import { v2 as cloudinary } from "cloudinary";
import { createHash, createHmac, timingSafeEqual } from "crypto";

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
    /https?:|www\.|\.(?:com|fr|net|org|io|co|app|be|ch|eu|uk|us|shop|store|site|xyz|info|biz|link|me|tv)/i.test(value) || // vrais domaines seulement — « photo.jpg » n’est pas un lien
    BADWORDS.some((w) => new RegExp(`\\b${w}`, "i").test(norm));
  return { value, bad };
}

export function ipOf(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "0.0.0.0";
}

/* CORS : reflet d'une liste blanche — plus de « * ». Le site vit sur son
   propre domaine ; le préprod Vercel et le dev local restent autorisés. */
const ORIGINS = new Set([
  "https://www.boxing-center-portet.fr",
  "https://boxing-center-portet.fr",
  "http://localhost:5173",
  "http://localhost:4173",
]);
export function allowCors(res, req) {
  const origin = req?.headers?.origin || "";
  const ok =
    ORIGINS.has(origin) ||
    /^https:\/\/boxing-center-portet[a-z0-9-]*\.vercel\.app$/.test(origin) ||
    origin === (process.env.CORS_ORIGIN || "");
  res.setHeader("Access-Control-Allow-Origin", ok ? origin : "https://boxing-center-portet.fr");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
}

export function isAdmin(req) {
  if (!process.env.ADMIN_TOKEN) return false;
  // hash both sides → equal length buffers → constant-time compare
  const given = createHash("sha256").update(String(req.headers["x-admin-token"] || "")).digest();
  const good = createHash("sha256").update(process.env.ADMIN_TOKEN).digest();
  return timingSafeEqual(given, good);
}

/* ---------- Preuve de travail (anti-bot, coût ~un clignement d'œil) ----------
   Le serveur émet un défi signé HMAC (aucun état à stocker) ; le client trouve
   un nonce tel que sha256("challenge:nonce") commence par N zéros ; le serveur
   vérifie la signature, la fraîcheur et la preuve. */
const POW_DIFFICULTY = +(process.env.POW_DIFFICULTY || 4);
const POW_TTL_MS = 10 * 60 * 1000;
const powSecret = () => cloudinary.config().api_secret || process.env.ADMIN_TOKEN || "bcp";

export function issuePow() {
  const ts = Date.now();
  const challenge = createHash("sha256").update(`${ts}:${Math.random()}`).digest("hex").slice(0, 32);
  const sig = createHmac("sha256", powSecret()).update(`${challenge}.${ts}`).digest("hex");
  return { challenge, ts, sig, difficulty: POW_DIFFICULTY };
}

export function verifyPow({ challenge, ts, sig, nonce }) {
  if (!challenge || !ts || !sig || nonce === undefined) return false;
  if (Date.now() - Number(ts) > POW_TTL_MS) return false;
  const expect = createHmac("sha256", powSecret()).update(`${challenge}.${ts}`).digest("hex");
  const a = Buffer.from(String(sig)), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const h = createHash("sha256").update(`${challenge}:${nonce}`).digest("hex");
  return h.startsWith("0".repeat(POW_DIFFICULTY));
}

/* ---------- Limiteur mémoire par instance (complément du comptage Cloudinary).
   Les fonctions serverless ne partagent pas leur mémoire entre instances : ce
   limiteur est un PREMIER barrage (bots insistants sur une instance chaude) ;
   les fenêtres minute/heure/jour font autorité via Cloudinary dans sign.js. */
const buckets = new Map();
export function memoryLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { buckets.set(key, arr); return false; }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 5000) buckets.clear(); // borne mémoire dure
  return true;
}

/** Map a Cloudinary resource (photo OU vidéo) → the public item shape. */
export function publicItem(r) {
  const id = r.public_id;
  const rtype = r.resource_type === "image" ? "image" : "video";
  const ctx = (r.context && (r.context.custom || r.context)) || {};
  const src = cloudinary.url(id, { resource_type: rtype, secure: true, transformation: [{ quality: "auto", fetch_format: "auto" }] });
  const poster = rtype === "video"
    ? cloudinary.url(id, { resource_type: "video", format: "jpg", secure: true, transformation: [{ quality: "auto", fetch_format: "auto" }] })
    : src;
  return { id, rtype, title: ctx.title || "", author: ctx.author || "", src, poster, createdAt: r.created_at, duration: r.duration };
}
