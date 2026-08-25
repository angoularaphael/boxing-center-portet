/* =====================================================================
   Négociation de contenu markdown (acceptmarkdown.com)

   Un agent qui envoie `Accept: text/markdown` reçoit le miroir markdown de
   la page (cuit par scripts/cuire-md.mjs dans dist/md/), pas le HTML. Un
   navigateur n'envoie jamais cet en-tête : le trafic humain ne passe
   jamais par la réécriture.

   POURQUOI UN MIDDLEWARE ET PAS UNE RÈGLE vercel.json : Vercel sert les
   fichiers statiques AVANT d'évaluer les rewrites — une règle `has` sur
   l'en-tête Accept ne se déclencherait jamais pour une page qui existe.
   Le middleware, lui, passe avant le système de fichiers.

   La réponse porte le contrat officiel du middleware Vercel :
   `x-middleware-rewrite` réécrit, l'absence de retour laisse passer.
   `Vary: Accept` est posé par vercel.json sur TOUTES les réponses, pour
   que le CDN garde une entrée de cache par variante — sans lui, le HTML
   mis en cache serait servi à l'agent qui demande du markdown (l'audit
   du 25/08 pointe exactement ce risque).
   ===================================================================== */
export const config = {
  /* Jamais les assets, l'API, les fichiers à extension (.txt, .xml, .md…),
     ni l'admin. Uniquement les pages. */
  matcher: ["/((?!api/|assets/|fonts/|img/|admin|md/|.*\\.[a-zA-Z0-9]+$).*)"],
};

export default function middleware(request) {
  const accept = request.headers.get("accept") || "";
  if (!/\btext\/markdown\b/i.test(accept)) return; // trafic normal : on laisse passer

  const url = new URL(request.url);
  let chemin = url.pathname;
  if (!chemin.endsWith("/")) chemin += "/";
  url.pathname = "/md" + chemin + "index.md";

  return new Response(null, {
    headers: {
      "x-middleware-rewrite": url.toString(),
      "Vary": "Accept, Accept-Encoding",
    },
  });
}
