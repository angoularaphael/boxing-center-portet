// Edge Middleware — bouclier anti-scraping du Boxing Center Portet.
// Bloque les outils de scraping (curl, python, scrapy…) et les POST cross-site
// sur l'API, SANS toucher aux moteurs de recherche ni aux crawlers IA
// (Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot… passent librement —
// le SEO/GEO repose sur eux). Un vrai navigateur n'est jamais affecté.

export const config = {
  // tout le site sauf les assets statiques lourds (déjà en cache immutable)
  matcher: ["/((?!assets/|fonts/|img/|favicon|logo|og\\.|sw\\.js).*)"],
};

// Outils de scraping / requêtes programmatiques. Les UA des moteurs de
// recherche et crawlers IA ne matchent aucun de ces motifs.
const SCRAPER_UA =
  /curl|wget|python-requests|python-urllib|aiohttp|httpx|scrapy|go-http-client|libwww|winhttp|httrack|nikto|sqlmap|masscan|zgrab|node-fetch|undici|axios\/|okhttp|java\/|phantomjs|headlesschrome|puppeteer|playwright|selenium/i;

export default function middleware(request) {
  const ua = request.headers.get("user-agent") || "";
  const url = new URL(request.url);

  // 1. Outils de scraping identifiés → 403 sec.
  if (!ua || SCRAPER_UA.test(ua)) {
    return new Response("Accès refusé.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // 2. API : un POST légitime vient toujours d'un navigateur sur NOTRE site
  //    (le header Origin est envoyé automatiquement et doit correspondre).
  if (url.pathname.startsWith("/api/") && request.method === "POST") {
    const origin = request.headers.get("origin") || "";
    let sameSite = false;
    try { sameSite = new URL(origin).host === url.host; } catch {}
    if (!sameSite) {
      return new Response(JSON.stringify({ error: "Origine non autorisée." }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
  }
}
