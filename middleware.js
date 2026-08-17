// Edge Middleware — protection de l'API uniquement.
//
// Le site public (HTML, photos, favicon, sitemap) doit rester ouvert aux
// crawlers. Un 403 sur une page ou une image = pas de favicon Google, pas de
// vignette, pas de référencement. La leçon : filtrer curl/puppeteer sur tout
// le site bloquait aussi des fetchers Google (favicon, inspection, images).
//
// Ce qui reste protégé : POST /api (mur communauté, chatbot). Les fonctions
// ont déjà preuve de travail, anti-injures et limites par IP.

export const config = {
  matcher: ["/api/:path*"],
};

const SEARCH_CRAWLER =
  /Googlebot|Google-InspectionTool|Google-Extended|Googlebot-Image|Googlebot-Video|Google-Favicon|Storebot-Google|AdsBot-Google|Bingbot|DuckDuckBot|Applebot|Yandex|GPTBot|OAI-SearchBot|ClaudeBot|Claude-SearchBot|Claude-User|PerplexityBot|ChatGPT-User|anthropic-ai|facebookexternalhit|FacebookBot|meta-externalagent|Amazonbot|Twitterbot|LinkedInBot/i;

const SCRAPER_UA =
  /curl|wget|python-requests|python-urllib|aiohttp|httpx|scrapy|go-http-client|libwww|winhttp|httrack|nikto|sqlmap|masscan|zgrab|node-fetch|undici|axios\/|phantomjs|puppeteer|playwright|selenium/i;

const sameSite = (a, b) => !!a && !!b && a.replace(/^www\./, "") === b.replace(/^www\./, "");

const devOrigin = (host) =>
  /^localhost(:\d+)?$/.test(host) ||
  /^127\.0\.0\.1(:\d+)?$/.test(host) ||
  /\.vercel\.app$/.test(host);

const refuse = (message) =>
  new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });

export default function middleware(request) {
  const ua = request.headers.get("user-agent") || "";

  if (SEARCH_CRAWLER.test(ua)) return;

  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return;
  }

  if (SCRAPER_UA.test(ua)) return refuse("Accès refusé.");

  if (request.method === "POST") {
    const source = request.headers.get("origin") || request.headers.get("referer") || "";
    let host = "";
    try { host = new URL(source).host; } catch { /* en-tête absent ou "null" */ }
    const url = new URL(request.url);
    if (host && !sameSite(host, url.host) && !devOrigin(host)) {
      return refuse("Origine non autorisée.");
    }
  }
}
