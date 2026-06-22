/** Per-page structured data (JSON-LD) for SEO + GEO. Home and Contact already
 *  carry static LD in their HTML; this adds BreadcrumbList everywhere else plus
 *  rich types (Offers, SportsActivityLocation, ItemList) sourced from data.ts. */
import { SITE, DISCIPLINES, TARIFS } from "./data";

const ORIGIN = "https://www.boxing-center-portet.fr";
const PAGE: Record<string, [string, string]> = {
  activites: ["Activités", "/activites/"],
  salles: ["Le club", "/salles/"],
  coachs: ["Coachs", "/coachs/"],
  galerie: ["Galerie", "/galerie/"],
  plannings: ["Planning", "/plannings/"],
  tarifs: ["Tarifs", "/tarifs/"],
  contact: ["Contact", "/contact/"],
};

function add(obj: unknown) {
  const s = document.createElement("script");
  s.type = "application/ld+json";
  s.dataset.seo = "1";
  s.textContent = JSON.stringify(obj);
  document.head.appendChild(s);
}

export function injectSchema(page?: string) {
  document.head.querySelectorAll("script[data-seo]").forEach((s) => s.remove()); // clear previous (soft-nav)
  if (!page || page === "home") return; // home has static LocalBusiness + FAQ
  const meta = PAGE[page];
  if (!meta) return;
  const [label, path] = meta;

  add({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: label, item: `${ORIGIN}${path}` },
    ],
  });

  if (page === "tarifs") {
    add({
      "@context": "https://schema.org",
      "@type": "OfferCatalog",
      name: "Tarifs — Boxing Center Portet",
      url: `${ORIGIN}/tarifs/`,
      itemListElement: TARIFS.map((t) => ({
        "@type": "Offer",
        name: t.name,
        price: (t.price.match(/\d+/) || ["0"])[0],
        priceCurrency: "EUR",
        description: t.note,
        url: `${ORIGIN}/tarifs/`,
        availability: "https://schema.org/InStock",
      })),
    });
  } else if (page === "salles") {
    add({
      "@context": "https://schema.org",
      "@type": "SportsActivityLocation",
      name: SITE.name,
      url: `${ORIGIN}/salles/`,
      telephone: SITE.phoneHref,
      address: {
        "@type": "PostalAddress",
        streetAddress: SITE.address.street,
        postalCode: SITE.address.zip,
        addressLocality: SITE.address.city,
        addressCountry: "FR",
      },
      amenityFeature: SITE.surfaces.map((s) => ({ "@type": "LocationFeatureSpecification", name: s.label, value: s.value })),
    });
  } else if (page === "activites") {
    add({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Disciplines — Boxing Center Portet",
      itemListElement: DISCIPLINES.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: d.name, description: d.desc })),
    });
  }
}
