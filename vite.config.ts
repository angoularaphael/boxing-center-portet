import { defineConfig } from "vite";
import { resolve } from "path";
import { readFileSync } from "fs";

const page = (p: string) => resolve(__dirname, p);

// Bake editable per-page SEO (from content.json) into each page's static HTML at
// build time → fully crawlable + editable via /admin (publish triggers a rebuild).
const escAttr = (s: string) => String(s).replace(/"/g, "&quot;");
function seoBakePlugin() {
  return {
    name: "bcp-seo-bake",
    transformIndexHtml: {
      order: "pre" as const,
      handler(html: string, ctx: { path?: string; filename?: string }) {
        let content: any = {};
        try { content = JSON.parse(readFileSync(page("src/content.json"), "utf8")); } catch { return html; }
        const seo: Record<string, { title?: string; description?: string }> = content.seo || {};
        const file = (ctx.path || ctx.filename || "").replace(/\\/g, "/");
        // Les dossiers à trait d'union comptent aussi (premiere-seance,
        // seance-offerte) : sans le tiret, la clé retombait sur « home ».
        // Et seul /index.html est l'accueil : 404.html (ou toute autre page
        // à la racine) n'a pas de clé — on ne touche pas à ses métas, sinon
        // la page « introuvable » s'annonçait comme la page d'accueil.
        const m = file.match(/\/([a-z0-9-]+)\/index\.html$/);
        const key = m ? m[1] : /(^|\/)index\.html$/.test(file) ? "home" : "";

        /* TOUT LE CONTENU CUIT DANS LE HTML — même raison que les prix :
           les robots des IA n'exécutent pas le JavaScript. Sans ça, ils
           lisaient un site sans disciplines, sans publics, sans planning,
           sans page activités, et SANS LES QUATRE VALEURS DU CLUB. Le JS
           réécrit ensuite chaque grille à l'identique (innerHTML), donc
           aucun doublon ; et si le JS tombe, la page reste lisible. */
        {
          const e = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const remplir = (id: string, cls: string, dedans: string) => {
            const rx = new RegExp(`(<div class="${cls}" id="${id}"[^>]*>|<div id="${id}"[^>]*class="${cls}"[^>]*>)\s*(</div>)`);
            if (dedans) html = html.replace(rx, `$1${dedans}$2`);
          };
          const D: any[] = content.disciplines || [];
          const n = String(D.length).padStart(2, "0");
          remplir("reel-track", "reel__track", D.map((d) => `<article class="reel__frame">`
            + `<span class="reel__num">${e(d.key)} / ${n}</span><span class="reel__tag">${e(d.tag)}</span>`
            + `<div class="reel__body"><h3 class="reel__name">${e(d.name)}</h3><p class="reel__desc">${e(d.desc)}</p></div></article>`).join(""));
          const carteDisc = (d: any, extra = "") => `<article class="disc${extra}" data-reveal>`
            + `<div class="disc__top"><span class="disc__key">${e(d.key)}</span><span class="disc__tag">${e(d.tag)}</span></div>`
            + `<div><h3 class="disc__name">${e(d.name)}</h3><p class="disc__desc">${e(d.desc)}</p></div></article>`;
          remplir("disc-grid", "disc-grid", D.map((d) => carteDisc(d)).join(""));
          remplir("act-grid", "disc-grid", D.map((d) => carteDisc(d, " disc--img")).join(""));
          remplir("aud-grid", "aud-grid", (content.audiences || []).map((a: any) =>
            `<article class="aud" data-reveal><span class="aud__tag">${e(a.tag)}</span>`
            + `<h3 class="aud__title">${e(a.title)}</h3><p class="aud__desc">${e(a.desc)}</p></article>`).join(""));
          remplir("values-grid", "values", (content.values || []).map((v: any) =>
            `<article class="value" data-reveal><span class="value__n">${e(v.n)}</span>`
            + `<h3 class="value__title">${e(v.title)}</h3><p class="value__desc">${e(v.desc)}</p></article>`).join(""));
          remplir("planning-grid", "planning", (content.planning || []).map((c: any) =>
            `<div class="plan-col" data-reveal><h3 class="plan-col__day">${e(c.day)}</h3>`
            + (c.items || []).map((i: any[]) => `<div class="plan-slot"><span class="plan-slot__t">${e(i[0])}</span><span class="plan-slot__n">${e(i[1])}</span></div>`).join("")
            + `</div>`).join(""));
          remplir("planning-mma-grid", "planning", (content.planningMma || []).map((c: any) =>
            `<div class="plan-col" data-reveal><h3 class="plan-col__day">${e(c.day)}</h3>`
            + (c.items || []).map((i: any[]) => `<div class="plan-slot"><span class="plan-slot__t">${e(i[0])}</span><span class="plan-slot__n">${e(i[1])}</span></div>`).join("")
            + `</div>`).join(""));

          /* LA GALERIE — la dernière grille encore vide, et la plus coûteuse.
             La page qui existe pour MONTRER la salle ne contenait pas une
             balise <img> : quarante-cinq clichés que Google Images ne pouvait
             pas indexer, faute d'exister dans le HTML. Le JS les peint ensuite
             avec leur srcset complet (imgAttrs) — on ne cuit ici que le
             strict nécessaire : la source, la légende en alt, les dimensions.
             Deux photos en `eager` : ce sont elles que le visiteur voit en
             premier, et le plus gros élément de la page. */
          remplir("gallery", "gallery", (content.gallery || []).map((g: any, i: number) =>
            `<figure class="shot ${g.span === "wide" ? "shot--wide" : g.span === "tall" ? "shot--tall" : ""}" data-gal-idx="${i}">`
            + `<img src="${e(g.src)}" alt="${e(g.label)}" ${i < 2 ? `loading="eager" fetchpriority="high"` : `loading="lazy"`} decoding="async" />`
            + `<figcaption class="shot__label">${e(g.label)}</figcaption></figure>`).join(""));
        }

        /* LES PRIX CUITS DANS LE HTML — les robots des IA (GPTBot,
           PerplexityBot, ClaudeBot) n'exécutent PAS le JavaScript : la grille
           des tarifs, rendue côté client, leur apparaissait VIDE. Ils
           citaient donc le club sans jamais connaître une seule offre. On
           écrit les cartes au build ; le JS réécrit ensuite le même contenu
           (idempotent), et le visiteur sans JavaScript voit les prix. */
        if (Array.isArray(content.tarifs) && content.tarifs.length) {
          const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const cartes = content.tarifs.map((t: any) => {
            const badge = t.badge ? `<span class="tarif__badge">${esc(t.badge)}</span>`
              : t.feature ? '<span class="tarif__badge">Le plus choisi</span>' : "";
            const vieux = t.old ? `<s class="tarif__old">${esc(t.old)}</s> ` : "";
            const cta = t.href
              ? `<a class="btn ${t.feature ? "btn--primary" : "btn--ghost"} tarif__cta" href="${esc(t.href)}" target="_blank" rel="noopener">${esc(t.cta || "Je choisis cette formule")}</a>`
              : "";
            return `<div class="tarif ${t.feature ? "tarif--feature" : ""}" data-reveal>${badge}`
              + `<span class="tarif__name">${esc(t.name)}</span>`
              + `<span class="tarif__price">${vieux}${esc(t.price)}<small> ${esc(t.unit || "")}</small></span>`
              + `<p class="tarif__note">${esc(t.note || "")}</p>${cta}</div>`;
          }).join("");
          html = html.replace(/(<div class="tarifs" id="tarifs-grid"[^>]*>)\s*(<\/div>)/, `$1${cartes}$2`);
        }

        // Preload the gallery's first (LCP) image with its responsive variants,
        // kept in sync with the editable content at every publish/rebuild.
        if (key === "galerie") {
          try {
            const first = content.gallery?.[0];
            const sizes = first?.span === "wide" ? "(max-width: 760px) 100vw, 66vw" : "(max-width: 760px) 100vw, 33vw";
            // même ratio de recadrage que le rendu (src/img.ts) pour que le preload soit réellement utilisé
            const ar = first?.span === "wide" ? "16:9" : first?.span === "tall" ? "4:5" : "3:2";
            let ss = "";
            const man = JSON.parse(readFileSync(page("src/img-manifest.json"), "utf8"));
            const e = first?.src && man[first.src];
            if (e) {
              const base = "/img/opt/" + first.src.slice("/img/".length).replace(/\.[a-z]+$/i, "");
              ss = e.w.map((w: number) => `${base}-${w}.webp ${w}w`).join(", ");
            } else {
              // première photo uploadée via l'admin (Cloudinary) : preload des variantes transformées
              const c = first?.src?.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?!\w+_)(.+)$/);
              if (c) ss = [480, 960, 1440].map((w) => `${c[1]}f_auto,q_auto,c_fill,g_auto,ar_${ar},w_${w}/${c[2]} ${w}w`).join(", ");
            }
            if (ss) {
              html = html.replace("</head>", `  <link rel="preload" as="image" href="${escAttr(first.src)}" imagesrcset="${escAttr(ss)}" imagesizes="${sizes}" fetchpriority="high" />\n</head>`);
            }
          } catch {}
        }

        const meta = seo[key];
        if (meta) {
          if (meta.title) {
            html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escAttr(meta.title)}</title>`);
            html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escAttr(meta.title)}$2`);
          }
          if (meta.description) {
            html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${escAttr(meta.description)}$2`);
            html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escAttr(meta.description)}$2`);
          }
        }

        /* GEO : les crawlers IA (GPTBot, Perplexity, Claude) n'exécutent pas
           le JS. On cuit NAP, liens llms.txt et schémas de page dans le HTML. */
        if (!html.includes('href="/llms.txt"')) {
          html = html.replace("</head>", `  <link rel="alternate" type="text/plain" href="/llms.txt" title="Informations pour assistants IA" />\n  <link rel="alternate" type="text/plain" href="/llms-full.txt" title="Fiche complète pour assistants IA" />\n</head>`);
        } else if (!html.includes('href="/llms-full.txt"')) {
          html = html.replace("</head>", `  <link rel="alternate" type="text/plain" href="/llms-full.txt" title="Fiche complète pour assistants IA" />\n</head>`);
        }
        const site = content.site || {};
        const addr = site.address || {};
        const nap = `Boxing Center Portet — ${addr.street || "61 route d’Espagne"}, ${addr.zip || "31120"} ${addr.city || "Portet-sur-Garonne"} — <a href="tel:+33687900216">${site.phone || "06 87 90 02 16"}</a> — <a href="mailto:${site.email || "boxingcenterportet@gmail.com"}">${site.email || "boxingcenterportet@gmail.com"}</a> — Lun–Sam 10h00–21h30`;
        html = html.replace('<div id="site-footer"></div>', `<div id="site-footer"><address class="sr-only geo-nap">${nap}</address></div>`);

        const ORIGIN = "https://www.boxing-center-portet.fr";
        const PAGE: Record<string, [string, string]> = {
          "premiere-seance": ["Ta première séance", "/premiere-seance/"],
          activites: ["Activités", "/activites/"],
          boxeurs: ["Nos Boxeurs", "/boxeurs/"],
          partenaires: ["Partenaires", "/partenaires/"],
          salles: ["Le club", "/salles/"],
          coachs: ["Coachs", "/coachs/"],
          galerie: ["Galerie", "/galerie/"],
          plannings: ["Planning", "/plannings/"],
          tarifs: ["Tarifs", "/tarifs/"],
          contact: ["Contact", "/contact/"],
        };
        const ld = (obj: unknown) => `<script type="application/ld+json" data-seo="1">${JSON.stringify(obj)}</script>\n`;
        let extraLd = "";
        const crumb = PAGE[key];
        if (crumb) {
          extraLd += ld({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: `${ORIGIN}/` },
              { "@type": "ListItem", position: 2, name: crumb[0], item: `${ORIGIN}${crumb[1]}` },
            ],
          });
        }
        if (key === "tarifs") {
          extraLd += ld({
            "@context": "https://schema.org",
            "@type": "OfferCatalog",
            "@id": `${ORIGIN}/tarifs/#catalog`,
            name: "Tarifs — Boxing Center Portet",
            url: `${ORIGIN}/tarifs/`,
            itemListElement: (content.tarifs || []).map((t: any) => ({
              "@type": "Offer",
              name: t.name,
              price: String(t.price || "").replace(/\D/g, "") || "0",
              priceCurrency: "EUR",
              description: t.note,
              url: t.href || `${ORIGIN}/tarifs/`,
              availability: "https://schema.org/InStock",
            })),
          });
        } else if (key === "activites") {
          extraLd += ld({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Disciplines — Boxing Center Portet",
            itemListElement: (content.disciplines || []).map((d: any, i: number) => ({
              "@type": "ListItem", position: i + 1, name: d.name, description: d.desc,
            })),
          });
        } else if (key === "coachs") {
          extraLd += ld({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Coachs — Boxing Center Portet",
            itemListElement: (content.team || []).map((m: any, i: number) => ({
              "@type": "ListItem",
              position: i + 1,
              item: {
                "@type": "Person",
                name: m.name,
                jobTitle: m.role,
                description: m.desc,
                worksFor: { "@id": `${ORIGIN}/#organization` },
              },
            })),
          });
        }
        if (extraLd) html = html.replace("</head>", extraLd + "</head>");

        return html;
      },
    },
  };
}

// Dev/preview only: serve the backoffice at the clean /admin URL (in production
// Vercel resolves the directory index itself, no filename ever shows).
function adminUrlPlugin() {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    if (req.url === "/admin" || req.url === "/admin/") req.url = "/admin/index.html";
    next();
  };
  return {
    name: "bcp-admin-url",
    configureServer(server: { middlewares: { use: (fn: typeof rewrite) => void } }) { server.middlewares.use(rewrite); },
    configurePreviewServer(server: { middlewares: { use: (fn: typeof rewrite) => void } }) { server.middlewares.use(rewrite); },
  };
}

export default defineConfig({
  base: "/",
  appType: "mpa",
  plugins: [seoBakePlugin(), adminUrlPlugin()],
  build: {
    target: "es2020",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          gsap: ["gsap"],
        },
      },
      input: {
        main: page("index.html"),
        "premiere-seance": page("premiere-seance/index.html"),
        activites: page("activites/index.html"),
        salles: page("salles/index.html"),
        coachs: page("coachs/index.html"),
        boxeurs: page("boxeurs/index.html"),
        partenaires: page("partenaires/index.html"),
        galerie: page("galerie/index.html"),
        plannings: page("plannings/index.html"),
        tarifs: page("tarifs/index.html"),
        contact: page("contact/index.html"),
        404: page("404.html"),
        "seance-offerte": page("seance-offerte/index.html"),
      },
    },
  },
});
