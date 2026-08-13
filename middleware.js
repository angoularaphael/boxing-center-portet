// Edge Middleware — bouclier anti-scraping du Boxing Center Portet.
//
// Règle d'or : ce filtre ne doit JAMAIS pouvoir casser un usage légitime. Il
// bloque les outils de scraping identifiés et les POST venus d'un autre site,
// sans toucher aux moteurs de recherche ni aux crawlers IA (Googlebot, GPTBot,
// ClaudeBot… passent librement — le SEO/GEO repose sur eux).
//
// Leçon d'un incident réel : la version précédente renvoyait un 403 en texte
// brut et refusait tout POST dont l'en-tête Origin n'était pas lisible. Un
// envoi du mur communauté (même origine) pouvait donc être refusé, et le site
// n'affichait qu'un « Envoi refusé. » incompréhensible. D'où deux garde-fous :
//   1. en cas de doute sur la provenance, on LAISSE PASSER (les fonctions ont
//      déjà preuve de travail, anti-injures et limites par IP) ;
//   2. sous /api, la réponse est toujours du JSON avec un champ `error`, pour
//      que l'interface puisse dire ce qui s'est passé.

export const config = {
  // tout le site sauf les assets statiques (déjà en cache immuable)
  matcher: ["/((?!assets/|fonts/|img/|media/|favicon|logo|og\\.|sw\\.js).*)"],
};

// Outils de scraping / requêtes programmatiques. Aucun UA de moteur de
// recherche ni de crawler IA ne correspond à ces motifs.
const SCRAPER_UA =
  /curl|wget|python-requests|python-urllib|aiohttp|httpx|scrapy|go-http-client|libwww|winhttp|httrack|nikto|sqlmap|masscan|zgrab|node-fetch|undici|axios\/|phantomjs|puppeteer|playwright|selenium/i;

/** boxing-center-portet.fr et www.boxing-center-portet.fr sont le même site. */
const sameSite = (a, b) => !!a && !!b && a.replace(/^www\./, "") === b.replace(/^www\./, "");

/** Origines de travail explicitement autorisées (dev local, prévisualisations). */
const devOrigin = (host) =>
  /^localhost(:\d+)?$/.test(host) ||
  /^127\.0\.0\.1(:\d+)?$/.test(host) ||
  /\.vercel\.app$/.test(host);

const refuse = (isApi, message) =>
  new Response(isApi ? JSON.stringify({ error: message }) : message, {
    status: 403,
    headers: { "content-type": isApi ? "application/json" : "text/plain; charset=utf-8" },
  });

export default function middleware(request) {
  const ua = request.headers.get("user-agent") || "";
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith("/api/");

  // 1. Outils de scraping identifiés. (Un UA vide n'est PAS bloqué : certains
  //    navigateurs respectueux de la vie privée le suppriment.)
  if (SCRAPER_UA.test(ua)) return refuse(isApi, "Accès refusé.");

  // 2. POST vers l'API : refuser seulement ce qui vient CLAIREMENT d'un autre
  //    site. Origin absent ou illisible (« null ») → on tente le Referer ;
  //    toujours rien d'exploitable → on laisse passer.
  if (isApi && request.method === "POST") {
    const source = request.headers.get("origin") || request.headers.get("referer") || "";
    let host = "";
    try { host = new URL(source).host; } catch { /* en-tête absent ou "null" */ }
    if (host && !sameSite(host, url.host) && !devOrigin(host)) {
      return refuse(true, "Origine non autorisée.");
    }
  }
}
