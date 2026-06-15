/**
 * Single source of truth for Boxing Center Portet content.
 * Facts verified from boxingcenter.fr + the Portet flagship page.
 * Copy written for impact: hooks, ethos (heritage, coaches, federations),
 * pathos (belonging, transformation), logos (numbers, proof).
 */

export const SITE = {
  name: "Boxing Center Portet",
  group: "Boxing Center",
  city: "Portet-sur-Garonne",
  baseline: "Boxes pieds, poings, projections.",
  claim: "La plus grande salle du groupe. 800 m² pour devenir plus fort.",
  since: 2016,
  address: {
    street: "61 route d'Espagne",
    zip: "31120",
    city: "Portet-sur-Garonne",
    country: "FR",
    lat: 43.5236,
    lng: 1.4053,
  },
  phone: "05 62 24 46 82",
  phoneHref: "+33562244682",
  email: "boxingcenter31@gmail.com",
  hours: "Lun–Sam · 10h00 – 21h30",
  hoursData: [
    { d: "Lundi – Vendredi", h: "10:00 – 21:30" },
    { d: "Samedi", h: "10:00 – 21:30" },
    { d: "Dimanche", h: "Fermé" },
  ],
  federations: ["FFBoxe", "FFKMDA", "FMMAF"],
  surfaces: [
    { label: "Aire de boxe & combat", value: "500 m²" },
    { label: "Cross training", value: "400 m²" },
    { label: "Sacs lourds Metal Boxe", value: "24" },
    { label: "Ring olympique", value: "1" },
  ],
  social: {
    facebook: "https://www.facebook.com/BoxingCenterToulouse/",
    instagram: "https://www.instagram.com/boxingcenter_toulouse/",
    parent: "https://boxingcenter.fr/",
  },
};

export const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/activites/", label: "Activités" },
  { href: "/salles/", label: "Le club" },
  { href: "/coachs/", label: "Coachs" },
  { href: "/galerie/", label: "Galerie" },
  { href: "/plannings/", label: "Planning" },
  { href: "/tarifs/", label: "Tarifs" },
  { href: "/contact/", label: "Contact" },
];

export type Discipline = { key: string; name: string; tag: string; desc: string; img: string };

export const DISCIPLINES: Discipline[] = [
  { key: "01", name: "Boxe Anglaise", tag: "Poings", desc: "Le noble art. Esquive, timing, jeu de jambes — la discipline qui forge le sang-froid avant le poing.", img: "/img/disc/boxe-anglaise.webp" },
  { key: "02", name: "Muay Thaï", tag: "8 armes", desc: "Poings, pieds, genoux, coudes. La science des huit armes : brutale, élégante, totale.", img: "/img/disc/muay-thai.webp" },
  { key: "03", name: "Kick / K1", tag: "Pieds-poings", desc: "Le tempo le plus électrique du ring. La vitesse rencontre la puissance.", img: "/img/disc/kick.webp" },
  { key: "04", name: "MMA & Grappling", tag: "Cage", desc: "Debout, au sol, dans la cage. L'art complet du combat — encadré, progressif, sans ego.", img: "/img/disc/mma.webp" },
  { key: "05", name: "Cross Training", tag: "Force", desc: "Le moteur du combattant. Cages, barres, rameurs : la force qui tient trois rounds.", img: "/img/disc/cross.webp" },
  { key: "06", name: "Boxing Training", tag: "Cardio", desc: "Toute l'intensité du ring, zéro coup encaissé. Tu brûles, tu te défoules, tu te transformes.", img: "/img/gym-20.jpg" },
  { key: "07", name: "Lady Punch", tag: "100% femmes", desc: "Un créneau, une communauté, zéro complexe. La force et la confiance, à ton rythme.", img: "/img/disc/lady.webp" },
  { key: "08", name: "Boxe Éducative", tag: "Dès 7 ans", desc: "Respect, discipline, énergie canalisée. Le ring qui construit des enfants debout.", img: "/img/disc/educative.webp" },
];

export const STATS = [
  { value: "800", suffix: "m²", label: "deux espaces XXL" },
  { value: "24", suffix: "", label: "sacs lourds Metal Boxe" },
  { value: "10", suffix: "+", label: "disciplines, un seul pass" },
  { value: "7", suffix: "j/7", label: "accès illimité" },
];

/** Who it's for — pathos: everyone has a place. */
export const AUDIENCES = [
  { tag: "Dès 7 ans", title: "Les enfants", desc: "Confiance, respect, discipline. Ils repartent plus forts — sur le ring comme à l'école." },
  { tag: "Lady Punch", title: "Les femmes", desc: "Des créneaux 100% féminins. Une communauté qui pousse, jamais qui juge." },
  { tag: "Premier jab", title: "Les débutants", desc: "Tout le monde a commencé un jour. Ici, personne ne se moque — on t'apprend." },
  { tag: "Galas & ring", title: "Les compétiteurs", desc: "Du sparring à la corde, jusqu'au gala. On t'amène au combat, prêt." },
];

/** Real Boxing Center team — pros + diplomaed coaches. Photos: boxingcenter.fr. */
export type Member = { name: string; role: string; kind: string; img: string; initials: string; desc: string };

export const TEAM: Member[] = [
  { name: "Salomon Kitoko", role: "Super-plume · Pro", kind: "Boxeur pro", img: "/img/coaches/salomon-kitoko.webp", initials: "SK", desc: "Vitesse de mains, science du ring. Formé au club, monté jusqu'au rang professionnel." },
  { name: "Elyasse Azap", role: "Welters · Pro", kind: "Boxeur pro", img: "/img/coaches/elyasse-azap.webp", initials: "EA", desc: "Puissance et sang-froid, round après round — la preuve que le club mène au haut niveau." },
  { name: "Johnson Suffo", role: "Poids moyens · Pro", kind: "Boxeur pro", img: "/img/coaches/johnson-suffo.webp", initials: "JS", desc: "L'explosivité au service de la technique. Un style qui ne laisse pas le ring respirer." },
  { name: "Coach Dadi", role: "Coach diplômé", kind: "Encadrement", img: "/img/coaches/coach-dadi.webp", initials: "DA", desc: "Du premier jab jusqu'au ring. Exigeant sur la technique, présent à chaque round." },
  { name: "Coach Mehdi", role: "Coach diplômé", kind: "Encadrement", img: "/img/coaches/coach-mehdi.webp", initials: "ME", desc: "Il lit le combat avant toi. La tactique, le timing, le détail qui fait la différence." },
  { name: "Coach Valentin", role: "Coach diplômé", kind: "Encadrement", img: "/img/coaches/coach-valentin.webp", initials: "VA", desc: "Le moteur physique. Force, cardio, condition — il te construit pour tenir la distance." },
  { name: "Coach Brice", role: "Coach diplômé", kind: "Encadrement", img: "/img/coaches/coach-brice.webp", initials: "BR", desc: "Pédagogue avant tout. Il accueille les débutants et n'en laisse aucun sur le banc." },
];

export const CHAMPIONS = TEAM.filter((m) => m.kind === "Boxeur pro");  // pros only
export const COACHS = TEAM.filter((m) => m.kind === "Encadrement");    // coaches only

export const VALUES = [
  { n: "01", title: "Discipline", desc: "Le talent ouvre la porte. La discipline te garde dans le ring." },
  { n: "02", title: "Respect", desc: "On salue avant de frapper. Le respect, c'est la première règle du club." },
  { n: "03", title: "Dépassement", desc: "Tu repars toujours un peu plus fort qu'en arrivant. C'est la promesse." },
  { n: "04", title: "Famille", desc: "Toutes les couches sociales, tous les niveaux. Un seul vestiaire, une seule meute." },
];

export const TARIFS = [
  { name: "Séance d'essai", price: "10€", unit: "la séance", note: "Pousse la porte. Une séance pour comprendre pourquoi on revient.", feature: false },
  { name: "Mensuel", price: "36–44€", unit: "/ mois", note: "Toutes disciplines, 7j/7, sans engagement annuel. Le choix des réguliers.", feature: true },
  { name: "Annuel", price: "250–400€", unit: "/ an", note: "L'engagement des passionnés — le meilleur tarif, toute l'année.", feature: false },
  { name: "Enfants", price: "280€", unit: "/ an", note: "Encadrement diplômé, créneaux dédiés. Ils repartent plus forts, dedans comme dehors.", feature: false },
];

export const PLANNING = [
  { day: "Lundi", items: [["18:30", "Boxe Anglaise"], ["19:30", "Muay Thaï"], ["20:30", "Cross Training"]] },
  { day: "Mardi", items: [["12:30", "Boxing Training"], ["18:30", "MMA"], ["19:30", "Lady Punch"]] },
  { day: "Mercredi", items: [["14:00", "Boxe Éducative"], ["18:30", "Kick / K1"], ["19:30", "Boxe Anglaise"]] },
  { day: "Jeudi", items: [["12:30", "Cross Training"], ["18:30", "Muay Thaï"], ["19:30", "Grappling"]] },
  { day: "Vendredi", items: [["18:30", "Boxe Anglaise"], ["19:30", "Sparring"], ["20:30", "MMA"]] },
  { day: "Samedi", items: [["10:30", "Cross Training"], ["11:30", "Boxing Training"], ["12:30", "Open Mat"]] },
];

export const GALLERY = [
  { src: "/img/gym-21.jpg", label: "Le ring", span: "wide" },
  { src: "/img/gym-14.jpg", label: "Les champions", span: "tall" },
  { src: "/img/gym-24.jpg", label: "La cage MMA", span: "" },
  { src: "/img/gym-22.jpg", label: "Les tatamis", span: "" },
  { src: "/img/gym-06.jpg", label: "L'espace force", span: "wide" },
  { src: "/img/gym-25.jpg", label: "800 m² — deux espaces", span: "" },
];

/** Real walkthrough footage of the Portet space (no people → space/tour clips). */
export const CLIPS = [
  { src: "/media/clip-cross.mp4", label: "Le cross training" },
  { src: "/media/clip-mats.mp4", label: "L'aire de combat" },
  { src: "/media/clip-exterior.mp4", label: "Notre salle · 61 route d'Espagne" },
  { src: "/media/clip-entrance.mp4", label: "L'entrée" },
];

export const THEMES = [
  { id: "dark", label: "Sombre", hint: "Navy · arène" },
  { id: "light", label: "Clair", hint: "Papier · bleu" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
