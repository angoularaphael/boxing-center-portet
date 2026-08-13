// /api/community/sign — la porte blindée du mur communauté.
// GET  → émet un défi de preuve de travail (signé HMAC, sans état serveur).
// POST → vérifie TOUT (honeypot, preuve de travail, nom + injures, limites
//        minute/heure/jour par IP) puis renvoie des paramètres SIGNÉS pour
//        que le client téléverse DIRECTEMENT chez Cloudinary (les fonctions
//        Vercel plafonnent le corps à 4,5 Mo). La signature CONTRAINT le
//        dépôt côté serveur : formats vidéo autorisés uniquement, durée
//        TRONQUÉE à 16 s par Cloudinary (du_16), tag "pending" — rien n'est
//        public avant validation au vestiaire.
import { cloudinary, FOLDER, cleanName, ipOf, allowCors, issuePow, verifyPow, memoryLimit } from "../_lib/util.js";

const LIMITS = [
  { max: +(process.env.RATE_PER_MIN || 2), windowMs: 60_000, label: "une minute" }, // 2 et non 1 : un premier envoi raté mérite un second essai immédiat
  { max: +(process.env.RATE_PER_HOUR || 3), windowMs: 3_600_000, label: "une heure" },
  { max: +(process.env.RATE_PER_DAY || 6), windowMs: 86_400_000, label: "24 heures" },
];

export default async function handler(req, res) {
  allowCors(res, req);
  if (req.method === "OPTIONS") return res.status(204).end();

  // GET : le défi anti-bot (coût humain ≈ un clignement d'œil)
  if (req.method === "GET") return res.status(200).json(issuePow());

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Sans identifiants Cloudinary, la signature lèverait une exception et Vercel
  // renverrait une page d'erreur HTML : le visiteur ne voyait qu'un « Envoi
  // refusé. » muet, impossible à diagnostiquer. On le dit franchement.
  if (!cloudinary.config().api_secret) {
    return res.status(503).json({ error: "Service d'envoi non configuré côté serveur (CLOUDINARY_URL). Préviens le club." });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const ip = ipOf(req);

  // Pot de miel : un humain ne voit pas ce champ. Un bot qui le remplit reçoit
  // une signature FACTICE — son upload échouera chez Cloudinary, en silence.
  if (String(body.website || "").length > 0) {
    return res.status(200).json({
      cloudName: "denied", apiKey: "0", timestamp: 0,
      folder: FOLDER, tags: "pending", context: "", signature: "0",
    });
  }

  // Preuve de travail obligatoire
  if (!verifyPow(body.pow || {})) {
    return res.status(400).json({ error: "Vérification expirée — réessaie, ça prend une seconde." });
  }

  // Premier barrage (instance chaude) : 3 requêtes de signature / minute / IP
  if (!memoryLimit(`sign:${ip}`, 3, 60_000)) {
    return res.status(429).json({ error: "Doucement — réessaie dans une minute." });
  }

  const t = cleanName(body.title, 60);
  const a = cleanName(body.author, 40);
  if (t.value.length < 2) return res.status(400).json({ error: "Donne un nom à ta vidéo." });
  if (t.bad || a.bad) return res.status(400).json({ error: "Nom non autorisé. Choisis-en un autre." });

  // Limites minute / heure / jour — comptées sur la vérité Cloudinary (partagée
  // entre toutes les instances), en UNE recherche sur 24 h.
  try {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const r = await cloudinary.search
      .expression(`folder:${FOLDER} AND context.ip="${ip}" AND uploaded_at>"${since}"`)
      .sort_by("uploaded_at", "desc").max_results(50).execute();
    const times = (r.resources || []).map((x) => new Date(x.uploaded_at || x.created_at).getTime());
    const now = Date.now();
    for (const { max, windowMs, label } of LIMITS) {
      if (times.filter((ts) => now - ts < windowMs).length >= max) {
        return res.status(429).json({ error: `Tu as atteint la limite d'envois sur ${label}. Reviens un peu plus tard — ta vidéo n'ira nulle part sans toi.` });
      }
    }
  } catch { /* recherche best-effort — le limiteur mémoire reste en place */ }

  const timestamp = Math.round(Date.now() / 1000);
  const context = `title=${t.value}|author=${a.value}|ip=${ip}`;
  // Photo OU vidéo : chaque type a ses formats autorisés, signés — et la
  // vidéo reste TRONQUÉE à 16 s par Cloudinary (indépendant du client).
  const isImage = body.kind === "image";
  const allowed = isImage ? "jpg,jpeg,png,webp" : "mp4,mov,webm";
  const paramsToSign = { allowed_formats: allowed, context, folder: FOLDER, tags: "pending", timestamp };
  if (!isImage) paramsToSign.transformation = "du_16";
  const signature = cloudinary.utils.api_sign_request(paramsToSign, cloudinary.config().api_secret);

  res.status(200).json({
    cloudName: cloudinary.config().cloud_name,
    apiKey: cloudinary.config().api_key,
    timestamp, folder: FOLDER, tags: "pending", context, signature,
    allowedFormats: allowed, transformation: isImage ? "" : "du_16",
    resourceType: isImage ? "image" : "video",
  });
}
