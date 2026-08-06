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
        const m = file.match(/\/([a-z]+)\/index\.html$/);
        const key = m ? m[1] : "home";

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
        if (!meta) return html;
        if (meta.title) {
          html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escAttr(meta.title)}</title>`);
          html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escAttr(meta.title)}$2`);
        }
        if (meta.description) {
          html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${escAttr(meta.description)}$2`);
          html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escAttr(meta.description)}$2`);
        }
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
        activites: page("activites/index.html"),
        salles: page("salles/index.html"),
        coachs: page("coachs/index.html"),
        boxeurs: page("boxeurs/index.html"),
        partenaires: page("partenaires/index.html"),
        galerie: page("galerie/index.html"),
        plannings: page("plannings/index.html"),
        tarifs: page("tarifs/index.html"),
        contact: page("contact/index.html"),
        "seance-offerte": page("seance-offerte/index.html"),
      },
    },
  },
});
