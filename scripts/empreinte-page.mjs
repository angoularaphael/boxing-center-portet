/**
 * L'empreinte du contenu d'une page — ce qui date le `lastmod` du plan du site.
 *
 * On ne prend que le <main> du HTML servi : la barre, le pied de page et la tête
 * (métas, JSON-LD) n'en font pas partie. Un lien ajouté au pied de page ne
 * re-date pas trente pages que personne ne lit autrement (même règle qu'à
 * Ramonville, 26/09). Les scripts, styles et commentaires sortent aussi, et les
 * espaces sont ramenés à un seul : seul compte ce qu'un lecteur ou un robot lit.
 *
 * Partagé par scripts/sitemap-images.mjs (au build) et par scripts/verifier-agents.mjs.
 */
import { createHash } from "node:crypto";

export function corpsDePage(html) {
  const main = String(html).match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? String(html);
  return main
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const empreintePage = (html) => createHash("sha256").update(corpsDePage(html)).digest("hex").slice(0, 16);

/** La date du jour à Portet (AAAA-MM-JJ), pas celle du fuseau de la machine de build. */
export const jourParis = (d = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
