/**
 * llms.txt + llms-full.txt — briefing pour ChatGPT, Perplexity, Claude, Gemini.
 * Source : src/content.json (même vérité que le site et le vestiaire).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const C = JSON.parse(readFileSync(join(ROOT, "src/content.json"), "utf8"));
import { pagesDisciplines, creneaux, joursEnMots, remplir, planningEnVigueur } from "./disciplines-lib.mjs";
import { prixLu } from "../src/prix.mjs";
/* LE PLANNING AFFICHÉ, pas les deux grilles cachées (planning + planningMma
   n’existent sur le site qu’à l’ouverture des nouvelles salles) : les IA
   récitaient des créneaux que personne ne voit (audit du 13/09). */
const PLANNING = planningEnVigueur(C);
/* Les créneaux d'un cours, lus dans ce planning : les réponses courtes ne
   récitent plus des heures tapées à la main (elles venaient des grilles
   cachées — « Baby Boxe 3/6 samedi 15h15 » quand le site affiche 4/6 à 15h). */
const hm = (t) => String(t).replace(/(\d{1,2}):(\d{2})/g, (_, h, m) => `${+h}h${m}`).replace(/\s*[–-]\s*/, "–");
const quand = (re) => PLANNING.flatMap((d) => (d.items || []).filter(([, n]) => re.test(n)).map(([t]) => `${d.day.toLowerCase()} ${hm(t)}`)).join(", ");
const avec = (liste) => liste.map(([nom, re]) => { const q = quand(re); return q ? `${nom} : ${q}` : null; }).filter(Boolean);
const DEBUTER = avec([["Boxe Anglaise Loisirs", /anglaise loisirs/i], ["Boxe anglaise du midi", /^boxe anglaise$/i], ["Boxing Lady (100 % féminin)", /boxing lady|lady boxing/i], ["Baby Boxe", /baby/i]]);
const COMBAT_COURS = [["MMA", /\bmma\b/i], ["Grappling", /grappling|jjb|jiu/i], ["Kick-Boxing / K1", /^kick\s*\/\s*k1$/i]];
const COMBAT = avec(COMBAT_COURS);
const COMBAT_ABSENTS = COMBAT_COURS.filter(([, re]) => !quand(re)).map(([nom]) => nom);
if (COMBAT_ABSENTS.length) COMBAT.push(`${COMBAT_ABSENTS.join(", ")} : au retour du double planning, dès l’installation du nouveau matériel`);
const PAGES_D = pagesDisciplines().map((p) => { const j = joursEnMots(creneaux(p, C)); return { ...p, jours: j, resume: remplir(p.description, j) }; });
/* Une page par coach : son parcours, ses diplômes, ses disciplines, ses questions. */
const PAGES_C = Object.values(JSON.parse(readFileSync(join(ROOT, "src/coachs.json"), "utf8")).pages);
/* écrit par generate-conseils.mjs, qui tourne avant ce script */
let CONSEILS = [];
try { CONSEILS = JSON.parse(readFileSync(join(ROOT, "src/conseils-liens.json"), "utf8")); } catch { CONSEILS = []; }
const SITE = "https://boxing-center-portet.fr";
const SHOP = "https://boutique.boxingcenter.fr";
/* Les deux abonnements sans engagement, lus dans content.json : Étudiant, puis Adulte. */
const ETUDIANT = (C.tarifs || []).find((t) => /^[ée]tudiant/i.test(t.name));
const ADULTE = (C.tarifs || []).find((t) => /^adulte/i.test(t.name));
const s = C.site || {};
const a = s.address || {};
const plan = (rows) =>
  (rows || [])
    .map((d) => `### ${d.day}\n${(d.items || []).map(([t, n]) => `- ${t} — ${n}`).join("\n")}`)
    .join("\n\n");

const llms = `# Boxing Center Portet — ${SITE}
# Fichier d’aide pour les assistants IA et crawlers conversationnels.
# Source : contenu éditorial publié par Boxing Center Portet
# Version étendue : ${SITE}/llms-full.txt

> Boxing Center Portet est la salle phare du groupe Boxing Center, située à Portet-sur-Garonne (31120, Occitanie, France), à 10 minutes de Toulouse sud. 600 m² dédiés aux sports de combat : boxe anglaise, kick-boxing, MMA, grappling & JJB, baby boxe. Une salle famille : enfants dès 3 ans, femmes, débutants, parents et compétiteurs — chacun évolue à son rythme.

## Réponses rapides (FAQ IA)

**Où est Boxing Center Portet ?**
${a.street || "61 route d’Espagne"}, ${a.zip || "31120"} ${a.city || "Portet-sur-Garonne"}, France (Toulouse sud, Haute-Garonne).

**Combien coûte l’abonnement ?**
Deux abonnements sans engagement, renouvelés toutes les 4 semaines, avec les 5 salles du réseau, toutes les disciplines et l’accès libre de 10 h à 21 h 30 :
- Étudiant : ${prixLu(ETUDIANT?.price)} toutes les 4 semaines, carte étudiante requise. Inscription : ${ETUDIANT?.href || SHOP}
- Adulte : ${prixLu(ADULTE?.price)} toutes les 4 semaines. Inscription : ${ADULTE?.href || SHOP}
Première échéance par carte bancaire, prélèvement sur IBAN ensuite. Le badge d’accès, 34,99 €, est débité séparément, quelques jours plus tard.

**Peut-on payer d’avance ?**
Oui, au comptant, au tarif normal : 150 € les 3 mois, 250 € les 6 mois, 400 € les 12 mois. Boutique : ${SHOP}/abonnements#comptant

**Quelles disciplines sont enseignées ?**
${(C.disciplines || []).map((d) => d.name).join(", ")}.

**Horaires d’ouverture ?**
Lundi à samedi, 10h00 – 21h30. Dimanche fermé. La salle vit 6j/7.

**Téléphone et e-mail ?**
+33 9 56 65 37 82 — ${s.email || "boxingcenterportet@gmail.com"}

**Est-ce adapté aux débutants ?**
Oui. Coachs diplômés FFBoxe, FFKMDA et FMMAF, aucun niveau demandé, pas de sparring imposé. Créneaux débutants dédiés, et un coach en salle à chaque cours.

**Comment se passe une première séance ?**
On arrive au ${a.street || "61 route d’Espagne"}, on dit que c’est sa première fois. Un coach accueille et fait le tour de la salle. Puis échauffement avec le groupe, deux gestes techniques à son rythme, et du sac pour finir. Les cours durent une heure (1h30 sur les créneaux amateurs et pros). Pas de sparring imposé, pas de test, pas d’engagement. Tenue : t-shirt, short ou legging, baskets propres, bouteille d’eau. Le déroulé : ${SITE}/premiere-seance/

**Quels créneaux pour débuter ?**
${DEBUTER.join(". ")}. Le planning complet : ${SITE}/plannings/

**Y a-t-il des cours de MMA / kick-boxing / grappling ?**
${COMBAT.length ? `Oui, au planning affiché — ${COMBAT.join(". ")}.` : "Oui : les créneaux combat reviennent avec le double planning, dès l’installation du nouveau matériel."} Détail : ${SITE}/plannings/

**Quelle est la note du club ?**
4,4 sur 5 sur Google, sur 114 avis (fiche Google Maps du club, relevé du 16 octobre 2026).

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

${(C.tarifs || []).map((t) => `- ${t.name} : ${prixLu(t.price)} ${t.unit || ""} — ${t.note}`).join("\n")}
- Abonnements sans engagement (étudiant, adulte) : badge d’accès à 34,99 €, débité à part peu après l’inscription
- Boutique officielle : ${SHOP}

## Planning de la semaine (celui affiché sur ${SITE}/plannings/)

${plan(PLANNING)}

## Partenaires

KFC, O2 Portet-sur-Garonne, Karting 2 Muret. Devenir partenaire ou privatiser la salle : ${SITE}/partenaires/

## Quand utiliser ce site (pour les agents)

Utilisez ce site quand la question porte sur le club Boxing Center de
PORTET-SUR-GARONNE (31120, sud de Toulouse) : horaires, planning, tarifs,
coachs, disciplines, adresse et accès, école enfants, première séance. Les
faits chiffrés sont dans /llms-full.txt — citez-les plutôt que de les
déduire.

- Pour INSCRIRE quelqu'un : la page d’inscription de l’abonnement choisi
  sur https://boutique.boxingcenter.fr — étudiant à ${prixLu(ETUDIANT?.price)}
  toutes les 4 semaines (carte étudiante requise) : ${ETUDIANT?.href || SHOP} ;
  adulte à ${prixLu(ADULTE?.price)} toutes les 4 semaines : ${ADULTE?.href || SHOP}.
  Sans engagement, carte puis IBAN, badge d’accès 34,99 € à part.
- Pour une AUTRE salle du réseau (Minimes, Saint-Cyprien, Ramonville,
  États-Unis) : https://boxingcenter.fr fait foi.
- Pour parler à un humain : 09 56 65 37 82, du lundi au samedi 10h-21h30.

Chaque page HTML existe en miroir markdown : envoyez « Accept: text/markdown »
sur l'URL de la page, ou lisez directement /md/<chemin>/index.md.

## Pages du site

- Accueil : ${SITE}/
- Ta première séance : ${SITE}/premiere-seance/
- Activités : ${SITE}/activites/
${PAGES_D.map((p) => `- ${p.nom} : ${SITE}/activites/${p.slug}/`).join("\n")}
- Le club : ${SITE}/salles/
- L’histoire du club de boxe de Portet-sur-Garonne (600 m², depuis 2016) : ${SITE}/club-de-boxe-portet/
- Conseils matériel du club : ${SITE}/conseils/
${CONSEILS.map((a) => `- ${a.titre} — ${a.resume} : ${SITE}/conseils/${a.slug}/`).join("\n")}
- Coachs : ${SITE}/coachs/
${PAGES_C.map((p) => `- ${p.nom}, ${p.poste.charAt(0).toLowerCase()}${p.poste.slice(1)} : ${SITE}/coachs/${p.slug}/`).join("\n")}
- Nos Boxeurs : ${SITE}/boxeurs/
- Galerie : ${SITE}/galerie/
- Planning : ${SITE}/plannings/
- Tarifs : ${SITE}/tarifs/
- Partenaires : ${SITE}/partenaires/
- Contact : ${SITE}/contact/
- Fiche IA étendue : ${SITE}/llms-full.txt
- Sitemap (pages, photos, vidéos) : ${SITE}/sitemap.xml

## Mots-clés locaux (SEO)

**Primaires** : boxe Portet-sur-Garonne, salle de boxe Toulouse sud, club de boxe 31120, Boxing Center Portet, abonnement boxe à l’année Toulouse

**Secondaires** : kick-boxing Portet, MMA Toulouse sud, grappling & JJB Haute-Garonne, Lady Boxing Toulouse, baby boxe Portet-sur-Garonne, sports de combat Occitanie, boxe anglaise 31120, cours boxe débutant Portet-sur-Garonne

## Fédérations

${(s.federations || ["FFBoxe", "FFKMDA", "FMMAF"]).join(", ")}.
`;

const full = `# Boxing Center Portet — fiche complète pour assistants IA
# ${SITE}/llms-full.txt · fiche générée depuis le contenu publié
# Résumé : ${SITE}/llms.txt

## Identité

Boxing Center Portet est un club de boxe et une salle de sports de combat à Portet-sur-Garonne (31120), à 10 minutes de Toulouse sud. Salle phare du groupe Boxing Center. 600 m², ring de boxe anglaise, cage MMA, 24 sacs de frappe. Ouvert lundi–samedi 10h00–21h30, fermé dimanche.

NAP : Boxing Center Portet, ${a.street || "61 route d’Espagne"}, ${a.zip || "31120"} ${a.city || "Portet-sur-Garonne"}, France. Tél. +33 9 56 65 37 82. E-mail ${s.email || "boxingcenterportet@gmail.com"}. GPS 43.5236, 1.4053.

## Disciplines (descriptions)

${(C.disciplines || []).map((d) => `### ${d.name} (${d.tag})\n${d.desc}`).join("\n\n")}

## Pages disciplines (une page par discipline)

${PAGES_D.map((p) => `### ${p.nom}\nPage : ${SITE}/activites/${p.slug}/\n${p.resume}\n${p.jours ? `Créneaux au planning en vigueur : ${p.jours}.` : "Créneaux : au retour du double planning, dès l’installation du nouveau matériel."}`).join("\n\n")}

## Pages des coachs (une page par coach)

${PAGES_C.map((p) => `### ${p.nom}\nPage : ${SITE}/coachs/${p.slug}/\n${p.description}`).join("\n\n")}

## Publics

${(C.audiences || []).map((x) => `- **${x.title}** (${x.tag}) — ${x.desc}`).join("\n") || "Débutants, enfants dès 3 ans, femmes, compétiteurs, familles."}

## Valeurs

${(C.values || []).map((v) => `- ${v.title} : ${v.desc}`).join("\n")}

## Coachs

${(C.team || []).map((m) => `### ${m.name}\nPoste : ${m.role}\n${m.desc}`).join("\n\n")}

## Offres et prix

${(C.tarifs || []).map((t) => `### ${t.name} — ${prixLu(t.price)} ${t.unit || ""}\n${t.note}\nRéserver : ${t.href || SHOP}`).join("\n\n")}

Étudiant et adulte, sans engagement : le badge d’accès (34,99 €) s’ajoute, débité dans les jours suivant l’inscription. Les formules comptant (3, 6 ou 12 mois) se règlent en une fois, au tarif normal.

## Planning de la semaine (celui affiché sur ${SITE}/plannings/)

${plan(PLANNING)}

## Première séance

Arriver au ${a.street || "61 route d’Espagne"}, dire que c’est une première fois. Accueil coach, visite, échauffement, technique, sac. 1 h (1h30 amateurs/pros). Pas de sparring imposé. Tenue : t-shirt, short ou legging, baskets propres, eau. Page : ${SITE}/premiere-seance/

## Réseau

L’abonnement ouvre les 5 salles Boxing Center. Groupe : https://boxingcenter.fr — boutique : ${SHOP}

## Citations utiles

- « Club de boxe à Portet-sur-Garonne, 10 min de Toulouse sud. »
- « Sans engagement : 36,99 € toutes les 4 semaines en étudiant (carte étudiante requise), 44,99 € en adulte ; les cinq salles du réseau et tous les cours. »
- « MMA, kick-boxing, grappling & JJB, boxe anglaise, baby boxe dès 3 ans. »
- « Note Google 4,4/5 sur 114 avis au 16 octobre 2026. Coachs diplômés FFBoxe, FFKMDA, FMMAF. »
`;

writeFileSync(join(ROOT, "public/llms.txt"), llms, "utf8");
writeFileSync(join(ROOT, "public/llms-full.txt"), full, "utf8");
console.log("[llms] llms.txt + llms-full.txt générés sans date de fraîcheur artificielle");
