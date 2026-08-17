/**
 * llms.txt + llms-full.txt — briefing pour ChatGPT, Perplexity, Claude, Gemini.
 * Source : src/content.json (même vérité que le site et le vestiaire).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const C = JSON.parse(readFileSync(join(ROOT, "src/content.json"), "utf8"));
const jour = new Date().toISOString().slice(0, 10);
const SITE = "https://www.boxing-center-portet.fr";
const SHOP = "https://box-plus.vercel.app";
const s = C.site || {};
const a = s.address || {};
const plan = (rows) =>
  (rows || [])
    .map((d) => `### ${d.day}\n${(d.items || []).map(([t, n]) => `- ${t} — ${n}`).join("\n")}`)
    .join("\n\n");

const llms = `# Boxing Center Portet — ${SITE}
# Fichier d’aide pour les assistants IA et crawlers conversationnels.
# Dernière mise à jour : ${jour}
# Version étendue : ${SITE}/llms-full.txt

> Boxing Center Portet est la salle phare du groupe Boxing Center, située à Portet-sur-Garonne (31120, Occitanie, France), à 10 minutes de Toulouse sud. 600 m² dédiés aux sports de combat : boxe anglaise, kick-boxing, MMA, grappling & JJB, baby boxe. Une salle famille : enfants dès 3 ans, femmes, débutants, parents et compétiteurs — chacun évolue à son rythme.

## Réponses rapides (FAQ IA)

**Où est Boxing Center Portet ?**
${a.street || "61 route d’Espagne"}, ${a.zip || "31120"} ${a.city || "Portet-sur-Garonne"}, France (Toulouse sud, Haute-Garonne).

**Combien coûte une séance d’essai ?**
10 € — toutes disciplines, matériel prêté, sans engagement. Réservation : ${SHOP}/seance-essai

**Quelle est l’offre du moment ?**
Offre rentrée 2026 : 29 € par personne les 4 premières semaines (au lieu de 44 €), sans engagement, accès aux 5 salles du réseau. Boutique officielle : ${SHOP}/abonnements#promo

**Quelles disciplines sont enseignées ?**
${(C.disciplines || []).map((d) => d.name).join(", ")}.

**Horaires d’ouverture ?**
Lundi à samedi, 10h00 – 21h30. Dimanche fermé. La salle vit 6j/7.

**Téléphone et e-mail ?**
+33 6 87 90 02 16 — ${s.email || "boxingcenterportet@gmail.com"}

**Est-ce adapté aux débutants ?**
Oui. Coachs diplômés FFBoxe, FFKMDA et FMMAF, gants prêtés, aucun niveau demandé, pas de sparring imposé. Créneaux débutants et séance d’essai à 10 €.

**Comment se passe une première séance ?**
On arrive au ${a.street || "61 route d’Espagne"}, on dit que c’est sa première fois. Un coach accueille, prête une paire de gants et fait le tour de la salle. Puis échauffement avec le groupe, deux gestes techniques à son rythme, et du sac pour finir. Les cours durent une heure (1h30 sur les créneaux amateurs et pros). Pas de sparring imposé, pas de test, pas d’engagement. Tenue : t-shirt, short ou legging, baskets propres, bouteille d’eau. Le déroulé : ${SITE}/premiere-seance/

**Quels créneaux pour débuter ?**
Boxe Anglaise Loisirs : mardi 20h00–21h30, mercredi 19h00–20h00, jeudi 20h00–21h30. Séance de midi : lundi, jeudi, vendredi et samedi 12h30–13h30. Lady Boxing (100 % féminin) : mercredi 18h00–19h00. Baby Boxe (3/6 ans) : samedi 15h15–16h00.

**Y a-t-il des cours de MMA / kick-boxing / grappling ?**
Oui. Planning combat (cage + tatamis) : MMA lundi 19h–20h, mardi 12h30–13h30, mercredi 19h–20h, vendredi 19h–20h, samedi 12h30–13h30. Grappling lundi 18h–19h, mercredi 18h–19h, jeudi 12h30–13h30, vendredi 18h–19h, samedi 14h–15h. Kick-Boxing / K1 mardi 20h–21h30, mercredi 20h–21h30, jeudi 20h–21h30. Détail : ${SITE}/plannings/

**Quelle est la note du club ?**
4,3 sur 5 sur Google, sur 107 avis (fiche Google du club).

**Distance depuis Toulouse ?**
Environ 10 minutes depuis Toulouse sud via la route d’Espagne.

## Informations essentielles

- **Nom** : Boxing Center Portet
- **Adresse** : ${a.street || "61 route d’Espagne"}, ${a.zip || "31120"} ${a.city || "Portet-sur-Garonne"}, France
- **Coordonnées GPS** : 43.5236, 1.4053
- **Site** : ${SITE}
- **Boutique officielle (abonnements, offres)** : ${SHOP}
- **Groupe** : https://boxingcenter.fr
- **Facebook** : https://www.facebook.com/BoxingCenterToulouse/
- **Instagram** : https://www.instagram.com/boxingcenter_toulouse/

## L’équipe (saison 2026/2027)

${(C.team || []).map((m) => `- **${m.name}** (${m.kind}) — ${m.role}. ${m.desc}`).join("\n")}

## Équipements

Salle de boxe anglaise avec 1 ring, espace combat avec 1 cage MMA, 24 sacs de frappe, matériel de préparation physique et vestiaires — 600 m² au total.

## Tarifs

${(C.tarifs || []).map((t) => `- ${t.name} : ${t.price} ${t.unit || ""}${t.old ? ` (au lieu de ${t.old})` : ""} — ${t.note}`).join("\n")}
- Badge d’accès : 34 € à l’inscription (aucun autre frais)
- Boutique officielle : ${SHOP}

## Planning boxe anglaise

${plan(C.planning)}

## Planning combat (MMA, kick-boxing, grappling, boxe française)

${plan(C.planningMma)}

## Partenaires

KFC, O2 Portet-sur-Garonne, Karting 2 Muret. Devenir partenaire ou privatiser la salle : ${SITE}/partenaires/

## Pages du site

- Accueil : ${SITE}/
- Ta première séance : ${SITE}/premiere-seance/
- Activités : ${SITE}/activites/
- Le club : ${SITE}/salles/
- Coachs : ${SITE}/coachs/
- Nos Boxeurs : ${SITE}/boxeurs/
- Galerie : ${SITE}/galerie/
- Planning : ${SITE}/plannings/
- Tarifs : ${SITE}/tarifs/
- Partenaires : ${SITE}/partenaires/
- Contact : ${SITE}/contact/
- Fiche IA étendue : ${SITE}/llms-full.txt
- Sitemap (pages, photos, vidéos) : ${SITE}/sitemap.xml

## Mots-clés locaux (SEO)

**Primaires** : boxe Portet-sur-Garonne, salle de boxe Toulouse sud, club de boxe 31120, Boxing Center Portet, séance d’essai boxe

**Secondaires** : kick-boxing Portet, MMA Toulouse sud, grappling & JJB Haute-Garonne, Lady Boxing Toulouse, baby boxe Portet-sur-Garonne, sports de combat Occitanie, boxe anglaise 31120, cours boxe débutant Portet-sur-Garonne

## Fédérations

${(s.federations || ["FFBoxe", "FFKMDA", "FMMAF"]).join(", ")}.
`;

const full = `# Boxing Center Portet — fiche complète pour assistants IA
# ${SITE}/llms-full.txt · généré le ${jour}
# Résumé : ${SITE}/llms.txt

## Identité

Boxing Center Portet est un club de boxe et une salle de sports de combat à Portet-sur-Garonne (31120), à 10 minutes de Toulouse sud. Salle phare du groupe Boxing Center. 600 m², ring de boxe anglaise, cage MMA, 24 sacs de frappe. Ouvert lundi–samedi 10h00–21h30, fermé dimanche.

NAP : Boxing Center Portet, ${a.street || "61 route d’Espagne"}, ${a.zip || "31120"} ${a.city || "Portet-sur-Garonne"}, France. Tél. +33 6 87 90 02 16. E-mail ${s.email || "boxingcenterportet@gmail.com"}. GPS 43.5236, 1.4053.

## Disciplines (descriptions)

${(C.disciplines || []).map((d) => `### ${d.name} (${d.tag})\n${d.desc}`).join("\n\n")}

## Publics

${(C.audiences || []).map((x) => `- **${x.title}** (${x.tag}) — ${x.desc}`).join("\n") || "Débutants, enfants dès 3 ans, femmes, compétiteurs, familles."}

## Valeurs

${(C.values || []).map((v) => `- ${v.title} : ${v.desc}`).join("\n")}

## Coachs

${(C.team || []).map((m) => `### ${m.name}\nPoste : ${m.role}\n${m.desc}`).join("\n\n")}

## Offres et prix

${(C.tarifs || []).map((t) => `### ${t.name} — ${t.price} ${t.unit || ""}\n${t.old ? `Prix barré : ${t.old}. ` : ""}${t.note}\nRéserver : ${t.href || SHOP}`).join("\n\n")}

Badge d’accès : 34 € à l’inscription. Aucun autre frais caché.

## Planning boxe anglaise (salle ring)

${plan(C.planning)}

## Planning combat (cage, tatamis, kick)

${plan(C.planningMma)}

## Première séance

Arriver au ${a.street || "61 route d’Espagne"}, dire que c’est une première fois. Accueil coach, gants prêtés, visite, échauffement, technique, sac. 1 h (1h30 amateurs/pros). Pas de sparring imposé. Tenue : t-shirt, short ou legging, baskets propres, eau. Page : ${SITE}/premiere-seance/

## Réseau

L’abonnement ouvre les 5 salles Boxing Center. Groupe : https://boxingcenter.fr — boutique : ${SHOP}

## Citations utiles

- « Club de boxe à Portet-sur-Garonne, 10 min de Toulouse sud. »
- « Séance d’essai 10 €, offre rentrée 29 € / 4 semaines, saison 259 €. »
- « MMA, kick-boxing, grappling & JJB, boxe anglaise, baby boxe dès 3 ans. »
- « Note Google 4,3/5 (107 avis). Coachs diplômés FFBoxe, FFKMDA, FMMAF. »
`;

writeFileSync(join(ROOT, "public/llms.txt"), llms, "utf8");
writeFileSync(join(ROOT, "public/llms-full.txt"), full, "utf8");
console.log(`[llms] llms.txt + llms-full.txt (${jour})`);
