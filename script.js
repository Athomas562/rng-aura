/* =========================================================
   AURA RNG — script.js
   v3 : leaderboard fiable + playTime multi-onglets
   ========================================================= */

/* ---------- 1. CONFIGURATION ---------- */

const RARITIES = [
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
    "mythic",
    "divine",
    "celestial",
    "cosmic",
    "secret",
];
const RARITY_INDEX = Object.fromEntries(RARITIES.map((r, i) => [r, i]));

const RARITY_COLORS = {
    common: "#9aa5b1",
    uncommon: "#4ade80",
    rare: "#38bdf8",
    epic: "#a855f7",
    legendary: "#fbbf24",
    mythic: "#f43f5e",
    divine: "#fef08a",
    celestial: "#67e8f9",
    cosmic: "#c084fc",
    secret: "#ff00ff",
};

/* ===== AURAS D'ORIGINE (108) ===== */
const AURAS = [
    {
        id: "a01",
        name: "Cendre",
        rarity: "common",
        weight: 10000,
        desc: "Un simple voile de poussière.",
    },
    {
        id: "a02",
        name: "Brise",
        rarity: "common",
        weight: 9500,
        desc: "Un souffle léger.",
    },
    {
        id: "a03",
        name: "Rosée",
        rarity: "common",
        weight: 9000,
        desc: "Une goutte matinale.",
    },
    {
        id: "a04",
        name: "Sable",
        rarity: "common",
        weight: 8800,
        desc: "Grains emportés par le vent.",
    },
    {
        id: "a05",
        name: "Éclat terne",
        rarity: "common",
        weight: 8600,
        desc: "Une lueur sans éclat.",
    },
    {
        id: "a06",
        name: "Brumé",
        rarity: "common",
        weight: 8400,
        desc: "Brume épaisse.",
    },
    {
        id: "a07",
        name: "Goutte",
        rarity: "common",
        weight: 8200,
        desc: "Une simple goutte d'eau.",
    },
    {
        id: "a08",
        name: "Poussière",
        rarity: "common",
        weight: 8000,
        desc: "Poussière dorée.",
    },
    {
        id: "a09",
        name: "Écho lointain",
        rarity: "common",
        weight: 7800,
        desc: "Un son à peine perceptible.",
    },
    {
        id: "a10",
        name: "Brindille",
        rarity: "common",
        weight: 7600,
        desc: "Un bout de bois sec.",
    },
    {
        id: "a11",
        name: "Silence",
        rarity: "common",
        weight: 7400,
        desc: "Le calme absolu.",
    },
    {
        id: "a12",
        name: "Souffle",
        rarity: "common",
        weight: 7200,
        desc: "Un souffle doux.",
    },
    {
        id: "a13",
        name: "Nuage",
        rarity: "common",
        weight: 7000,
        desc: "Un nuage léger.",
    },
    {
        id: "a14",
        name: "Étincelle",
        rarity: "common",
        weight: 6800,
        desc: "Une petite étincelle.",
    },
    {
        id: "a15",
        name: "Vent",
        rarity: "common",
        weight: 6600,
        desc: "Le vent qui passe.",
    },

    {
        id: "a16",
        name: "Feuille",
        rarity: "uncommon",
        weight: 3000,
        desc: "Une feuille animée.",
    },
    {
        id: "a17",
        name: "Ondine",
        rarity: "uncommon",
        weight: 2900,
        desc: "Une onde douce.",
    },
    {
        id: "a18",
        name: "Braise",
        rarity: "uncommon",
        weight: 2800,
        desc: "Une petite flamme.",
    },
    {
        id: "a19",
        name: "Cristal",
        rarity: "uncommon",
        weight: 2700,
        desc: "Un cristal pur.",
    },
    {
        id: "a20",
        name: "Zéphyr",
        rarity: "uncommon",
        weight: 2600,
        desc: "Vent rapide et léger.",
    },
    {
        id: "a21",
        name: "Épine",
        rarity: "uncommon",
        weight: 2500,
        desc: "Rose acérée.",
    },
    {
        id: "a22",
        name: "Champignon",
        rarity: "uncommon",
        weight: 2400,
        desc: "Un champignon lumineux.",
    },
    {
        id: "a23",
        name: "Lierre",
        rarity: "uncommon",
        weight: 2300,
        desc: "Une plante grimpante.",
    },
    {
        id: "a24",
        name: "Ambre",
        rarity: "uncommon",
        weight: 2200,
        desc: "Résine dorée.",
    },
    {
        id: "a25",
        name: "Soleil",
        rarity: "uncommon",
        weight: 2100,
        desc: "Une lumière chaude.",
    },
    {
        id: "a26",
        name: "Pluie",
        rarity: "uncommon",
        weight: 2000,
        desc: "Gouttes qui tombent.",
    },
    {
        id: "a27",
        name: "Neige",
        rarity: "uncommon",
        weight: 1900,
        desc: "Flocons légers.",
    },
    {
        id: "a28",
        name: "Roseau",
        rarity: "uncommon",
        weight: 1800,
        desc: "Au bord de l'eau.",
    },
    {
        id: "a29",
        name: "Coquillage",
        rarity: "uncommon",
        weight: 1700,
        desc: "Un souvenir marin.",
    },
    {
        id: "a30",
        name: "Plume",
        rarity: "uncommon",
        weight: 1600,
        desc: "Une plume légère.",
    },

    {
        id: "a31",
        name: "Lame",
        rarity: "rare",
        weight: 700,
        desc: "Une lame tranchante.",
    },
    {
        id: "a32",
        name: "Prisme",
        rarity: "rare",
        weight: 650,
        desc: "Un prisme de lumière.",
    },
    {
        id: "a33",
        name: "Écho",
        rarity: "rare",
        weight: 620,
        desc: "Un écho profond.",
    },
    {
        id: "a34",
        name: "Givre",
        rarity: "rare",
        weight: 600,
        desc: "Glace éternelle.",
    },
    {
        id: "a35",
        name: "Foudre",
        rarity: "rare",
        weight: 580,
        desc: "Un éclair fulgurant.",
    },
    {
        id: "a36",
        name: "Mirage",
        rarity: "rare",
        weight: 550,
        desc: "Illusion du désert.",
    },
    {
        id: "a37",
        name: "Cristallin",
        rarity: "rare",
        weight: 530,
        desc: "Une aura cristalline.",
    },
    {
        id: "a38",
        name: "Automne",
        rarity: "rare",
        weight: 510,
        desc: "L'esprit de l'automne.",
    },
    {
        id: "a39",
        name: "Mousson",
        rarity: "rare",
        weight: 490,
        desc: "La pluie tropicale.",
    },
    {
        id: "a40",
        name: "Marée",
        rarity: "rare",
        weight: 470,
        desc: "Le mouvement des vagues.",
    },
    {
        id: "a41",
        name: "Éclat lunaire",
        rarity: "rare",
        weight: 450,
        desc: "Lumière de la lune.",
    },
    {
        id: "a42",
        name: "Verdure",
        rarity: "rare",
        weight: 430,
        desc: "La puissance du végétal.",
    },
    {
        id: "a43",
        name: "Brumelame",
        rarity: "rare",
        weight: 410,
        desc: "Lame de brouillard.",
    },
    {
        id: "a44",
        name: "Vent glacial",
        rarity: "rare",
        weight: 390,
        desc: "Un souffle polaire.",
    },
    {
        id: "a45",
        name: "Éclat d'étoile",
        rarity: "rare",
        weight: 370,
        desc: "Un morceau de ciel.",
    },

    {
        id: "a46",
        name: "Nébuleuse",
        rarity: "epic",
        weight: 150,
        desc: "Une nébuleuse colorée.",
    },
    {
        id: "a47",
        name: "Phénix",
        rarity: "epic",
        weight: 140,
        desc: "Renaît de ses cendres.",
    },
    {
        id: "a48",
        name: "Abysse",
        rarity: "epic",
        weight: 130,
        desc: "Les profondeurs obscures.",
    },
    {
        id: "a49",
        name: "Tempête",
        rarity: "epic",
        weight: 125,
        desc: "Une tempête déchaînée.",
    },
    {
        id: "a50",
        name: "Séraphin",
        rarity: "epic",
        weight: 120,
        desc: "Une aura céleste.",
    },
    {
        id: "a51",
        name: "Oracle",
        rarity: "epic",
        weight: 115,
        desc: "Voit l'avenir.",
    },
    {
        id: "a52",
        name: "Vampirique",
        rarity: "epic",
        weight: 110,
        desc: "Soif de sang.",
    },
    {
        id: "a53",
        name: "Glaciaire",
        rarity: "epic",
        weight: 105,
        desc: "Froid absolu.",
    },
    {
        id: "a54",
        name: "Sismique",
        rarity: "epic",
        weight: 100,
        desc: "Tremblement de terre.",
    },
    {
        id: "a55",
        name: "Volcanique",
        rarity: "epic",
        weight: 95,
        desc: "Lave en fusion.",
    },
    {
        id: "a56",
        name: "Miroir",
        rarity: "epic",
        weight: 90,
        desc: "Reflète l'âme.",
    },
    {
        id: "a57",
        name: "Spectre",
        rarity: "epic",
        weight: 85,
        desc: "Un esprit errant.",
    },
    {
        id: "a58",
        name: "Nécro",
        rarity: "epic",
        weight: 80,
        desc: "Maître des morts.",
    },
    {
        id: "a59",
        name: "Lumière noire",
        rarity: "epic",
        weight: 75,
        desc: "Obscurité lumineuse.",
    },
    {
        id: "a60",
        name: "Runique",
        rarity: "epic",
        weight: 70,
        desc: "Runes anciennes.",
    },

    {
        id: "a61",
        name: "Éclipse",
        rarity: "legendary",
        weight: 40,
        desc: "Soleil noir.",
    },
    {
        id: "a62",
        name: "Draconique",
        rarity: "legendary",
        weight: 38,
        desc: "Souffle du dragon.",
    },
    {
        id: "a63",
        name: "Vortex",
        rarity: "legendary",
        weight: 36,
        desc: "Tourbillon cosmique.",
    },
    {
        id: "a64",
        name: "Aurore",
        rarity: "legendary",
        weight: 34,
        desc: "Lueur polaire.",
    },
    {
        id: "a65",
        name: "Ragnarök",
        rarity: "legendary",
        weight: 32,
        desc: "Fin des mondes.",
    },
    {
        id: "a66",
        name: "Titan",
        rarity: "legendary",
        weight: 30,
        desc: "Force colossale.",
    },
    {
        id: "a67",
        name: "Féérique",
        rarity: "legendary",
        weight: 28,
        desc: "Magie des fées.",
    },
    {
        id: "a68",
        name: "Amazone",
        rarity: "legendary",
        weight: 26,
        desc: "Guerrière légendaire.",
    },
    {
        id: "a69",
        name: "Griffon",
        rarity: "legendary",
        weight: 24,
        desc: "Créature mythique.",
    },
    {
        id: "a70",
        name: "Liche",
        rarity: "legendary",
        weight: 22,
        desc: "Mort-vivant puissant.",
    },
    {
        id: "a71",
        name: "Sacré",
        rarity: "legendary",
        weight: 20,
        desc: "Bénédiction divine.",
    },
    {
        id: "a72",
        name: "Maudit",
        rarity: "legendary",
        weight: 18,
        desc: "Malédiction ancienne.",
    },
    {
        id: "a73",
        name: "Céleste",
        rarity: "legendary",
        weight: 16,
        desc: "Au-dessus des cieux.",
    },
    {
        id: "a74",
        name: "Enfer",
        rarity: "legendary",
        weight: 14,
        desc: "Feux de l'enfer.",
    },
    {
        id: "a75",
        name: "Paradis",
        rarity: "legendary",
        weight: 12,
        desc: "Le jardin d'Éden.",
    },

    {
        id: "a76",
        name: "Chronos",
        rarity: "mythic",
        weight: 8,
        desc: "Maître du temps.",
    },
    {
        id: "a77",
        name: "Hadès",
        rarity: "mythic",
        weight: 7,
        desc: "Roi des enfers.",
    },
    {
        id: "a78",
        name: "Nyx",
        rarity: "mythic",
        weight: 6,
        desc: "Déesse de la nuit.",
    },
    {
        id: "a79",
        name: "Anubis",
        rarity: "mythic",
        weight: 5,
        desc: "Gardien des âmes.",
    },
    {
        id: "a80",
        name: "Léviathan",
        rarity: "mythic",
        weight: 4,
        desc: "Monstre des abysses.",
    },
    {
        id: "a81",
        name: "Odin",
        rarity: "mythic",
        weight: 3.5,
        desc: "Père de tout.",
    },
    {
        id: "a82",
        name: "Zeus",
        rarity: "mythic",
        weight: 3,
        desc: "Roi de l'Olympe.",
    },
    {
        id: "a83",
        name: "Loki",
        rarity: "mythic",
        weight: 2.5,
        desc: "Dieu de la ruse.",
    },
    {
        id: "a84",
        name: "Athéna",
        rarity: "mythic",
        weight: 2,
        desc: "Déesse de la sagesse.",
    },
    {
        id: "a85",
        name: "Soleil noir",
        rarity: "mythic",
        weight: 1.5,
        desc: "Étoile morte.",
    },

    {
        id: "a86",
        name: "Création",
        rarity: "divine",
        weight: 1,
        desc: "L'origine du tout.",
    },
    {
        id: "a87",
        name: "Lumière pure",
        rarity: "divine",
        weight: 0.9,
        desc: "Lumière absolue.",
    },
    {
        id: "a88",
        name: "Éternité",
        rarity: "divine",
        weight: 0.8,
        desc: "Sans fin.",
    },
    {
        id: "a89",
        name: "Omniscience",
        rarity: "divine",
        weight: 0.7,
        desc: "Savoir absolu.",
    },
    {
        id: "a90",
        name: "Infini",
        rarity: "divine",
        weight: 0.6,
        desc: "Concept absolu.",
    },
    {
        id: "a91",
        name: "Genèse",
        rarity: "divine",
        weight: 0.5,
        desc: "Le commencement.",
    },
    {
        id: "a92",
        name: "Apocalypse",
        rarity: "divine",
        weight: 0.4,
        desc: "La fin des temps.",
    },
    {
        id: "a93",
        name: "Ascension",
        rarity: "divine",
        weight: 0.3,
        desc: "Élévation ultime.",
    },

    {
        id: "a94",
        name: "Voie lactée",
        rarity: "celestial",
        weight: 0.2,
        desc: "La galaxie entière.",
    },
    {
        id: "a95",
        name: "Andromède",
        rarity: "celestial",
        weight: 0.18,
        desc: "Galaxie lointaine.",
    },
    {
        id: "a96",
        name: "Quasar",
        rarity: "celestial",
        weight: 0.15,
        desc: "Cœur énergétique.",
    },
    {
        id: "a97",
        name: "Nova",
        rarity: "celestial",
        weight: 0.12,
        desc: "Étoile nouvelle.",
    },
    {
        id: "a98",
        name: "Pulsar",
        rarity: "celestial",
        weight: 0.1,
        desc: "Phare cosmique.",
    },

    {
        id: "a99",
        name: "Big Bang",
        rarity: "cosmic",
        weight: 0.08,
        desc: "Naissance de l'univers.",
    },
    {
        id: "a100",
        name: "Singularité",
        rarity: "cosmic",
        weight: 0.06,
        desc: "Trou noir originel.",
    },
    {
        id: "a101",
        name: "Multivers",
        rarity: "cosmic",
        weight: 0.05,
        desc: "Toutes les réalités.",
    },
    {
        id: "a102",
        name: "Supernova",
        rarity: "cosmic",
        weight: 0.04,
        desc: "Explosion stellaire.",
    },
    {
        id: "a103",
        name: "Dimension X",
        rarity: "cosmic",
        weight: 0.03,
        desc: "Une réalité parallèle.",
    },

    {
        id: "a104",
        name: "Genesis",
        rarity: "secret",
        weight: 0.02,
        desc: "La première étincelle.",
    },
    {
        id: "a105",
        name: "Oméga",
        rarity: "secret",
        weight: 0.015,
        desc: "La fin de tout.",
    },
    {
        id: "a106",
        name: "Rêve",
        rarity: "secret",
        weight: 0.01,
        desc: "Illusion parfaite.",
    },
    {
        id: "a107",
        name: "Néant",
        rarity: "secret",
        weight: 0.008,
        desc: "Le vide absolu.",
    },
    {
        id: "a108",
        name: "Aura ultime",
        rarity: "secret",
        weight: 0.005,
        desc: "L'aura des légendes.",
    },
];

/* ===== 63 NOUVELLES AURAS ===== */
const NEW_AURAS_RAW = [
    [
        "a109",
        "Murmure",
        "common",
        24,
        "#a3b1c6",
        "Un chuchotement porté par le vent.",
    ],
    [
        "a110",
        "Mousse",
        "common",
        28,
        "#86b08c",
        "Un tapis vert, doux et humide.",
    ],
    [
        "a111",
        "Orchidée nocturne",
        "uncommon",
        70,
        "#f0abfc",
        "Une fleur qui s'ouvre sous la lune.",
    ],
    [
        "a112",
        "Torrent",
        "uncommon",
        85,
        "#2dd4bf",
        "Une rivière qui ne dort jamais.",
    ],
    [
        "a113",
        "Dune chantante",
        "uncommon",
        105,
        "#e0b25a",
        "Le sable murmure en s'effondrant.",
    ],
    [
        "a114",
        "Lucioles",
        "uncommon",
        130,
        "#bef264",
        "Une danse de petites lumières.",
    ],
    [
        "a115",
        "Aube glacée",
        "rare",
        280,
        "#7dd3fc",
        "Le premier rayon sur un lac gelé.",
    ],
    [
        "a116",
        "Cendres ardentes",
        "rare",
        330,
        "#fb923c",
        "Elles brûlent encore, très loin.",
    ],
    [
        "a117",
        "Sentinelle",
        "rare",
        390,
        "#94a3b8",
        "Une silhouette qui veille en silence.",
    ],
    [
        "a118",
        "Lotus d'argent",
        "rare",
        460,
        "#e2e8f0",
        "Il flotte sur un étang sans fond.",
    ],
    [
        "a119",
        "Corail vif",
        "rare",
        540,
        "#fb7185",
        "Un récif qui pulse comme un cœur.",
    ],
    [
        "a120",
        "Lost Signal",
        "rare",
        640,
        "#22c55e",
        "Un message sans émetteur.",
    ],
    [
        "a121",
        "Orage lointain",
        "rare",
        740,
        "#818cf8",
        "Le tonnerre gronde au-delà de l'horizon.",
    ],
    [
        "a122",
        "Forêt murmurante",
        "rare",
        850,
        "#34d399",
        "Chaque arbre connaît ton nom.",
    ],
    [
        "a123",
        "Absolute Zero",
        "epic",
        1400,
        "#bae6fd",
        "Le froid où plus rien ne bouge.",
    ],
    ["a124", "Inferno", "epic", 1700, "#f97316", "Une fournaise sans fin."],
    ["a125", "The Observer", "epic", 2000, "#a78bfa", "Il te regardait déjà."],
    [
        "a126",
        "Fallen Angel",
        "epic",
        2400,
        "#a5b4fc",
        "Des ailes brisées, une lumière têtue.",
    ],
    [
        "a127",
        "Thunder God",
        "epic",
        2800,
        "#facc15",
        "La foudre obéit à sa voix.",
    ],
    [
        "a128",
        "Forgotten",
        "epic",
        3100,
        "#7c8cff",
        "Même son nom s'est effacé.",
    ],
    [
        "a129",
        "Obsidienne",
        "epic",
        3400,
        "#c026d3",
        "Un éclat noir qui boit la lumière.",
    ],
    [
        "a130",
        "Mer de cristal",
        "epic",
        3700,
        "#22d3ee",
        "Des vagues figées en pleine course.",
    ],
    [
        "a131",
        "Reliquaire",
        "epic",
        4000,
        "#fcd34d",
        "Un trésor que nul n'ose ouvrir.",
    ],
    [
        "a132",
        "Spirale ardente",
        "epic",
        4300,
        "#fb7185",
        "Une flamme qui tourne sur elle-même.",
    ],
    [
        "a133",
        "Phoenix King",
        "legendary",
        5500,
        "#ff7a1a",
        "Le roi des renaissances.",
    ],
    [
        "a134",
        "Dragon Sovereign",
        "legendary",
        7000,
        "#ef4444",
        "Les cieux plient devant son souffle.",
    ],
    [
        "a135",
        "Eternal Storm",
        "legendary",
        8500,
        "#60a5fa",
        "Une tempête qui ne s'est jamais calmée.",
    ],
    [
        "a136",
        "Shadow Reaper",
        "legendary",
        10000,
        "#9333ea",
        "Il fauche ce que la lumière oublie.",
    ],
    [
        "a137",
        "Time Fracture",
        "legendary",
        12000,
        "#5eead4",
        "Une faille dans l'écoulement du temps.",
    ],
    [
        "a138",
        "Eternal Hour",
        "legendary",
        14000,
        "#fde68a",
        "Une heure qui ne finit jamais.",
    ],
    [
        "a139",
        "Couronne brisée",
        "legendary",
        16000,
        "#f59e0b",
        "Un règne éteint, un éclat intact.",
    ],
    [
        "a140",
        "Abyssal King",
        "legendary",
        18500,
        "#0891b2",
        "Il règne là où le sonar se tait.",
    ],
    [
        "a141",
        "Serpent d'étoiles",
        "legendary",
        20500,
        "#4ade80",
        "Il s'enroule autour des constellations.",
    ],
    [
        "a142",
        "Gardien du seuil",
        "legendary",
        22500,
        "#f472b6",
        "Nul ne passe sans son accord.",
    ],
    [
        "a143",
        "Cosmic Rift",
        "mythic",
        26000,
        "#d946ef",
        "Une déchirure dans le tissu du ciel.",
    ],
    [
        "a144",
        "Event Horizon",
        "mythic",
        36000,
        "#fb923c",
        "Au-delà, rien ne revient.",
    ],
    [
        "a145",
        "Void Emperor",
        "mythic",
        48000,
        "#8b5cf6",
        "Il règne sur le vide entre les mondes.",
    ],
    [
        "a146",
        "Null Entity",
        "mythic",
        62000,
        "#cbd5e1",
        "Une présence qui n'existe pas.",
    ],
    [
        "a147",
        "Morrigan",
        "mythic",
        78000,
        "#be123c",
        "Corbeau de guerre, présage de fin.",
    ],
    [
        "a148",
        "Quetzalcoatl",
        "mythic",
        98000,
        "#10b981",
        "Le serpent à plumes survole les âges.",
    ],
    [
        "a149",
        "Ra l'Éternel",
        "mythic",
        120000,
        "#ffb703",
        "Le soleil lui-même s'incline.",
    ],
    [
        "a150",
        "Fenrir",
        "mythic",
        145000,
        "#93c5fd",
        "Le loup qui dévorera les dieux.",
    ],
    [
        "a151",
        "Amaterasu",
        "mythic",
        180000,
        "#fda4af",
        "La lumière sortie de sa grotte.",
    ],
    [
        "a152",
        "Celestial Crown",
        "divine",
        260000,
        "#fde047",
        "Une couronne tissée de lumière pure.",
    ],
    [
        "a153",
        "Divine Judgment",
        "divine",
        340000,
        "#fef9c3",
        "Le verdict tombe, sans appel.",
    ],
    [
        "a154",
        "Eternal Light",
        "divine",
        420000,
        "#fff7ae",
        "Elle brillait avant le premier matin.",
    ],
    [
        "a155",
        "Sérénité absolue",
        "divine",
        500000,
        "#bbf7d0",
        "Le calme de toutes les choses finies.",
    ],
    [
        "a156",
        "Archange",
        "divine",
        580000,
        "#e0f2fe",
        "Six ailes, un seul serment.",
    ],
    [
        "a157",
        "Ordre primordial",
        "divine",
        680000,
        "#fcd34d",
        "La loi qui précède l'univers.",
    ],
    [
        "a158",
        "Sceau de l'aube",
        "divine",
        780000,
        "#fed7aa",
        "Il scelle la frontière du jour.",
    ],
    [
        "a159",
        "Nébuleuse mère",
        "celestial",
        1000000,
        "#a5f3fc",
        "Le berceau de mille étoiles.",
    ],
    [
        "a160",
        "Anneaux stellaires",
        "celestial",
        1200000,
        "#7dd3fc",
        "Des cercles de glace autour d'un astre.",
    ],
    [
        "a161",
        "Comète éternelle",
        "celestial",
        1400000,
        "#bae6fd",
        "Elle passe, et ne repart jamais.",
    ],
    [
        "a162",
        "Trou blanc",
        "celestial",
        1600000,
        "#f8fafc",
        "Tout en jaillit, rien n'y entre.",
    ],
    [
        "a163",
        "Constellation vivante",
        "celestial",
        1900000,
        "#99f6e4",
        "Elle te suit du regard.",
    ],
    [
        "a164",
        "Fracture du cosmos",
        "cosmic",
        2600000,
        "#e879f9",
        "L'espace se plie, puis se brise.",
    ],
    [
        "a165",
        "Âme de l'univers",
        "cosmic",
        3800000,
        "#c4b5fd",
        "Le souffle qui anime chaque étoile.",
    ],
    [
        "a166",
        "Entropie",
        "cosmic",
        5200000,
        "#a78bfa",
        "Tout s'éteint, doucement.",
    ],
    [
        "a167",
        "Horloge cosmique",
        "cosmic",
        7000000,
        "#818cf8",
        "Elle compte les âges de l'univers.",
    ],
    [
        "a168",
        "Unknown",
        "secret",
        12000000,
        "#ff66ff",
        "Aucune donnée. Aucun témoin.",
    ],
    [
        "a169",
        "Écho de l'Alpha",
        "secret",
        22000000,
        "#ff2bd6",
        "Le tout premier battement, rejoué.",
    ],
    [
        "a170",
        "Le Dernier Rêveur",
        "secret",
        45000000,
        "#f0abfc",
        "S'il se réveille, tout s'arrête.",
    ],
    [
        "a171",
        "Aura sans nom",
        "secret",
        80000000,
        "#ff3d9a",
        "Elle n'a jamais eu besoin d'un nom.",
    ],
];

// Poids des nouvelles auras
const BASE_WEIGHT_TOTAL = AURAS.reduce((s, a) => s + a.weight, 0);
const NEW_AURA_MASS = NEW_AURAS_RAW.reduce((s, r) => s + 1 / r[3], 0);
const TOTAL_WEIGHT = BASE_WEIGHT_TOTAL / (1 - NEW_AURA_MASS);
NEW_AURAS_RAW.forEach(([id, name, rarity, oneIn, color, desc]) => {
    AURAS.push({
        id,
        name,
        rarity,
        weight: TOTAL_WEIGHT / oneIn,
        oneIn,
        color,
        desc,
    });
});

const AURA_BY_ID = Object.fromEntries(AURAS.map((a) => [a.id, a]));

// Couleur principale d'une aura
function auraColor(aura) {
    return aura.color || RARITY_COLORS[aura.rarity];
}

// ✅ Poids de référence d'une aura (nombre de 1 sur N)
function auraWeight(aura) {
    if (!aura) return Infinity;
    if (aura.oneIn) return aura.oneIn;
    return TOTAL_WEIGHT / aura.weight;
}

/* ===== BIOMES ===== */
const BIOMES = [
    {
        id: "plains",
        name: "Plaines",
        className: "bg-plains",
        unlockRolls: 0,
        luckBonus: 1.0,
        desc: "Biome de départ.",
    },
    {
        id: "forest",
        name: "Forêt",
        className: "bg-forest",
        unlockRolls: 100,
        luckBonus: 1.02,
        desc: "Débloqué après 100 rolls.",
    },
    {
        id: "desert",
        name: "Désert",
        className: "bg-desert",
        unlockRolls: 500,
        luckBonus: 1.04,
        desc: "Débloqué après 500 rolls.",
    },
    {
        id: "ocean",
        name: "Océan",
        className: "bg-ocean",
        unlockRolls: 2000,
        luckBonus: 1.07,
        desc: "Débloqué après 2000 rolls.",
    },
    {
        id: "space",
        name: "Espace",
        className: "bg-space",
        unlockRolls: 10000,
        luckBonus: 1.1,
        desc: "Débloqué après 10 000 rolls.",
    },
    {
        id: "cosmic",
        name: "Dimension cosmique",
        className: "bg-cosmic",
        unlockRolls: 50000,
        luckBonus: 1.15,
        desc: "Débloqué après 50 000 rolls.",
    },
];

/* ===== POTIONS ===== */
const POTIONS = [
    {
        id: "p_luck1",
        name: "Potion de chance I",
        price: 300,
        bonus: 1.1,
        duration: 60,
        desc: "Temporaire : chance x1.10 pendant 1 minute.",
    },
    {
        id: "p_luck2",
        name: "Potion de chance II",
        price: 1200,
        bonus: 1.2,
        duration: 120,
        desc: "Temporaire : chance x1.20 pendant 2 minutes.",
    },
    {
        id: "p_luck3",
        name: "Élixir de chance",
        price: 6000,
        bonus: 1.35,
        duration: 90,
        desc: "Temporaire : chance x1.35 pendant 1 min 30.",
    },
    {
        id: "p_speed",
        name: "Potion de vitesse",
        price: 800,
        speed: 0.35,
        duration: 60,
        desc: "Temporaire : Auto Roll 35 % plus rapide pendant 1 min.",
    },
];

/* ===== BOUTIQUE ===== */
const SHOP_ITEMS = [
    {
        id: "i_lucky_charm",
        name: "Talisman porte-bonheur",
        price: 6000,
        luckBonus: 0.03,
        perm: true,
        desc: "Permanent : +3 % de chance (achat unique).",
    },
    {
        id: "i_crystal",
        name: "Cristal de chance",
        price: 45000,
        luckBonus: 0.06,
        perm: true,
        desc: "Permanent : +6 % de chance (achat unique).",
    },
    {
        id: "i_essence",
        name: "Essence mystique",
        price: 200,
        resource: true,
        desc: "Ressource de crafting.",
    },
    {
        id: "i_shard",
        name: "Éclat cosmique",
        price: 800,
        resource: true,
        desc: "Ressource de crafting rare.",
    },
];

const RECIPES = [
    {
        id: "r_luck_potion",
        result: { id: "p_luck2", qty: 1 },
        ingredients: [{ id: "i_essence", qty: 4 }],
        desc: "Craft une Potion de chance II.",
    },
    {
        id: "r_crystal",
        result: { id: "i_crystal", qty: 1 },
        ingredients: [
            { id: "i_essence", qty: 40 },
            { id: "i_shard", qty: 12 },
        ],
        desc: "Craft un Cristal de chance.",
    },
    {
        id: "r_luck_elixir",
        result: { id: "p_luck3", qty: 1 },
        ingredients: [
            { id: "i_shard", qty: 5 },
            { id: "i_essence", qty: 5 },
        ],
        desc: "Craft un Élixir de chance.",
    },
];

/* ===== AMÉLIORATIONS ===== */
const UPGRADES = [
    {
        id: "up_luck",
        name: "Maîtrise de la chance",
        desc: "Augmente la chance de façon permanente (+66 % au niveau max).",
        maxLevel: 10,
        costs: [100, 250, 600, 1500, 4000, 10000, 25000, 60000, 150000, 400000],
        effects: [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.12],
        effectType: "luck",
    },
    {
        id: "up_speed",
        name: "Réflexes affûtés",
        desc: "Réduit le délai entre deux Auto Rolls (-33 % au niveau max).",
        maxLevel: 6,
        costs: [300, 900, 2500, 7000, 20000, 55000],
        effects: [0.03, 0.04, 0.05, 0.06, 0.07, 0.08],
        effectType: "speed",
    },
    {
        id: "up_coins",
        name: "Marchand chanceux",
        desc: "Augmente les gains de monnaie (+45 % au niveau max).",
        maxLevel: 10,
        costs: [150, 400, 900, 2200, 5500, 13000, 32000, 80000, 200000, 500000],
        effects: [0.02, 0.03, 0.03, 0.04, 0.04, 0.05, 0.05, 0.06, 0.06, 0.07],
        effectType: "coins",
    },
    {
        id: "up_double",
        name: "Écho du destin",
        desc: "Chance de dupliquer une aura obtenue (10 % au niveau max).",
        maxLevel: 5,
        costs: [3000, 10000, 35000, 120000, 400000],
        effects: [0.01, 0.015, 0.02, 0.025, 0.03],
        effectType: "double",
    },
    {
        id: "up_potion",
        name: "Alchimiste expert",
        desc: "Réduit le prix des potions (-25 % au niveau max).",
        maxLevel: 5,
        costs: [600, 2000, 6500, 20000, 60000],
        effects: [0.03, 0.04, 0.05, 0.06, 0.07],
        effectType: "potionDiscount",
    },
];

/* ===== PLAFONDS DE CHANCE ===== */
const LUCK_SOFT_CAP = 2.0;
const LUCK_HARD_CAP = 3.5;
const POTION_LUCK_MAX = 1.35;

const COIN_REWARDS = {
    common: 1,
    uncommon: 3,
    rare: 10,
    epic: 30,
    legendary: 120,
    mythic: 500,
    divine: 2000,
    celestial: 5000,
    cosmic: 15000,
    secret: 50000,
};

const REVEAL_RARITIES = ["divine", "celestial", "cosmic", "secret"];
const SHAKE_RARITIES = ["secret"];
const PARTICLE_RARITIES = ["cosmic", "secret"];

const AUTOROLL_PRICE_COINS = 1500;
const AUTOROLL_SECRET_UNLOCK_AT = 10;
const AUTOROLL_MIN_INTERVAL = 150;

const SAVE_KEY = "auraRng_save_v1";
const SAVE_VERSION = 1;
const FB_EMAIL_DOMAIN = "@aurarng.local";

// ✅ Dernière aura rollée
let lastRolledAura = null;

/* ---------- 2. ÉTAT + SAUVEGARDE ---------- */

function createDefaultState() {
    return {
        version: SAVE_VERSION,
        _uid: null,
        coins: 0,
        totalRolls: 0,
        rollsSinceRare: 0,
        playTime: 0,
        equipped: null,
        inventory: {},
        discovered: {},
        bestAura: null,
        ownedItems: {},
        activeEffects: [],
        usedPotions: 0,
        craftedItems: 0,
        unlockedBiomes: ["plains"],
        currentBiome: "plains",
        upgrades: {},
        autoRollUnlocked: false,
        autoRollPaywallOpenCount: 0,
        uid: null,
        username: null,
        settings: {
            sound: true,
            volume: 0.5,
            reduceAnim: false,
            hideCommon: false,
        },
    };
}

let state = createDefaultState();

function getSaveKey() {
    return state.uid ? `auraRng_save_v1_${state.uid}` : SAVE_KEY;
}

function loadGame() {
    try {
        const raw = localStorage.getItem(getSaveKey());
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== SAVE_VERSION) return;
        if (parsed._uid && parsed._uid !== state.uid) return;
        const currentUid = state.uid;
        const currentUsername = state.username;
        state = Object.assign(createDefaultState(), parsed);
        state.uid = currentUid;
        state.username = currentUsername;
        state.settings = Object.assign(
            createDefaultState().settings,
            parsed.settings || {},
        );
    } catch (e) {
        console.warn("Save locale invalide :", e);
    }
}

async function loadGameFromCloud() {
    if (!state.uid || !window.FB) return false;
    try {
        const { db, ref, get } = window.FB;
        const snap = await get(ref(db, "saves/" + state.uid));
        if (!snap.exists()) return false;
        const parsed = snap.val();
        if (!parsed || parsed.version !== SAVE_VERSION) return false;
        if (parsed._uid && parsed._uid !== state.uid) return false;
        const currentUid = state.uid;
        const currentUsername = state.username;
        state = Object.assign(createDefaultState(), parsed);
        state.uid = currentUid;
        state.username = currentUsername;
        state.settings = Object.assign(
            createDefaultState().settings,
            parsed.settings || {},
        );
        console.log("☁️ Save cloud chargée :", state.totalRolls, "rolls");
        return true;
    } catch (e) {
        console.warn("Erreur cloud load :", e);
        return false;
    }
}

let fbSaveTimer = null;
let fbSavePending = false;

function saveGame(skipCloud = false) {
    state._uid = state.uid;
    try {
        localStorage.setItem(getSaveKey(), JSON.stringify(state));
    } catch (e) {
        console.warn("Erreur save locale :", e);
    }
    if (skipCloud) return;
    if (!state.uid || !window.FB) return;
    fbSavePending = true;
    clearTimeout(fbSaveTimer);
    fbSaveTimer = setTimeout(pushSaveToCloud, 3000);
}

function pushSaveToCloud() {
    if (!state.uid || !window.FB) return;
    fbSavePending = false;
    const { db, ref, set } = window.FB;
    state._uid = state.uid;
    const payload = { ...state };
    delete payload.uid;
    delete payload.username;
    set(ref(db, "saves/" + state.uid), payload)
        .then(() => console.log("☁️ Save cloud OK"))
        .catch((e) => console.warn("Erreur save cloud :", e));
}

function flushCloudSave() {
    if (fbSavePending) {
        clearTimeout(fbSaveTimer);
        pushSaveToCloud();
    }
}

/* ---------- 3. ROLLS & CHANCE ---------- */

function getUpgradeLevel(id) {
    const up = UPGRADES.find((u) => u.id === id);
    const lvl = state.upgrades[id] || 0;
    return up ? Math.min(lvl, up.maxLevel) : lvl;
}

function getUpgradeCost(upgrade) {
    const level = getUpgradeLevel(upgrade.id);
    if (level >= upgrade.maxLevel) return null;
    return upgrade.costs[level];
}

function getUpgradeTotalEffect(upgrade, level) {
    return upgrade.effects.slice(0, level).reduce((a, b) => a + b, 0);
}

function getUpgradeEffect(effectType) {
    let total = 0;
    UPGRADES.forEach((up) => {
        if (up.effectType === effectType)
            total += getUpgradeTotalEffect(up, getUpgradeLevel(up.id));
    });
    return total;
}

function buyUpgrade(upgrade) {
    const level = getUpgradeLevel(upgrade.id);
    if (level >= upgrade.maxLevel) {
        showToast("⭐ Niveau max.");
        return;
    }
    const cost = getUpgradeCost(upgrade);
    if (state.coins < cost) {
        showToast("❌ Pas assez de monnaie.");
        return;
    }
    state.coins -= cost;
    state.upgrades[upgrade.id] = level + 1;
    playSound("buy");
    showToast(`⭐ ${upgrade.name} niv. ${level + 1} !`);
    saveGame();
    renderUI();
    renderUpgrades();
}

function getPermanentLuckBonus() {
    let bonus = 0;
    const biome = BIOMES.find((b) => b.id === state.currentBiome);
    if (biome) bonus += biome.luckBonus - 1;
    SHOP_ITEMS.forEach((item) => {
        if (item.perm && state.ownedItems[item.id] > 0) bonus += item.luckBonus;
    });
    bonus += getUpgradeEffect("luck");
    if (state.equipped) {
        const a = AURA_BY_ID[state.equipped];
        if (a && a.luckBonus) bonus += a.luckBonus - 1;
    }
    return bonus;
}

function getTemporaryLuckMultiplier() {
    const now = Date.now();
    let best = 1;
    state.activeEffects.forEach((eff) => {
        if (eff.bonus && eff.endsAt > now)
            best = Math.max(best, Math.min(eff.bonus, POTION_LUCK_MAX));
    });
    return best;
}

function applyLuckCap(raw) {
    if (raw <= LUCK_SOFT_CAP) return raw;
    return Math.min(LUCK_HARD_CAP, LUCK_SOFT_CAP + (raw - LUCK_SOFT_CAP) * 0.5);
}

function getTotalLuckMultiplier() {
    const raw = (1 + getPermanentLuckBonus()) * getTemporaryLuckMultiplier();
    return applyLuckCap(raw);
}

function pickAuraByWeight(luckMultiplier) {
    const luck = Math.max(1, luckMultiplier);
    const maxIdx = RARITIES.length - 1;
    const effective = AURAS.map((aura) => {
        const exponent = RARITY_INDEX[aura.rarity] / maxIdx;
        return { aura, weight: aura.weight * Math.pow(luck, exponent) };
    });
    const total = effective.reduce((sum, e) => sum + e.weight, 0);
    let r = Math.random() * total;
    for (const e of effective) {
        r -= e.weight;
        if (r <= 0) return e.aura;
    }
    return effective[effective.length - 1].aura;
}

function formatChance(aura) {
    const oneIn = Math.round(TOTAL_WEIGHT / aura.weight);
    return `1 sur ${oneIn.toLocaleString("fr-FR")}`;
}

function performRoll() {
    const aura = pickAuraByWeight(getTotalLuckMultiplier());
    registerAura(aura);
    return aura;
}

function registerAura(aura) {
    state.totalRolls++;
    const doubleChance = getUpgradeEffect("double");
    const quantity = Math.random() < doubleChance ? 2 : 1;
    state.inventory[aura.id] = (state.inventory[aura.id] || 0) + quantity;
    state.discovered[aura.id] = true;
    if (quantity === 2) showToast("✨ Aura doublée !");

    // ✅ Meilleure aura : on compare D'ABORD par rareté, puis par poids (1 sur N)
    const currentBest = state.bestAura ? AURA_BY_ID[state.bestAura] : null;
    if (!currentBest) {
        state.bestAura = aura.id;
    } else {
        const newR = RARITY_INDEX[aura.rarity];
        const oldR = RARITY_INDEX[currentBest.rarity];
        const newW = auraWeight(aura);
        const oldW = auraWeight(currentBest);

        if (
            newR > oldR ||
            (newR === oldR && newW > oldW) || // ✅ poids plus grand = plus rare
            (newR === oldR && newW === oldW && aura.id < currentBest.id)
        ) {
            state.bestAura = aura.id;
        }
    }

    const rareRarities = [
        "legendary",
        "mythic",
        "divine",
        "celestial",
        "cosmic",
        "secret",
    ];
    if (rareRarities.includes(aura.rarity)) state.rollsSinceRare = 0;
    else state.rollsSinceRare++;

    state.coins += Math.round(
        (COIN_REWARDS[aura.rarity] || 1) * (1 + getUpgradeEffect("coins")),
    );

    BIOMES.forEach((b) => {
        if (
            state.totalRolls >= b.unlockRolls &&
            !state.unlockedBiomes.includes(b.id)
        ) {
            state.unlockedBiomes.push(b.id);
            showToast(`🌍 Biome débloqué : ${b.name}`);
        }
    });

    if (state.totalRolls % 10 === 0) pushToLeaderboard();
    saveGame();
}

/* ---------- 4. UI ---------- */

const $ = (sel) => document.querySelector(sel);

let toastTimer = null;
function showToast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
}

function showReveal(aura) {
    const overlay = $("#reveal-overlay");
    const text = $("#reveal-text");
    const rarityTag = $("#reveal-rarity-tag");
    const chanceEl = $("#reveal-chance");
    const particlesBox = $("#reveal-particles");

    overlay.className = "";
    particlesBox.innerHTML = "";
    document.body.classList.remove("screen-shake");

    text.textContent = aura.name;
    rarityTag.textContent = aura.rarity;
    rarityTag.style.color = auraColor(aura);
    chanceEl.textContent = formatChance(aura);
    chanceEl.style.color = auraColor(aura);

    overlay.classList.add("rarity-" + aura.rarity);

    let duration = 2500;
    if (aura.rarity === "secret") duration = 4500;
    else if (aura.rarity === "cosmic") duration = 3800;
    else if (aura.rarity === "celestial") duration = 3500;
    else if (aura.rarity === "divine") duration = 3200;

    if (SHAKE_RARITIES.includes(aura.rarity)) {
        document.body.classList.add("screen-shake");
        setTimeout(() => document.body.classList.remove("screen-shake"), 600);
    }

    if (PARTICLE_RARITIES.includes(aura.rarity)) {
        const count = aura.rarity === "secret" ? 60 : 35;
        spawnParticles(particlesBox, count, aura.rarity);
    }

    playSound("reveal-" + aura.rarity);
    overlay.classList.remove("hidden");

    setTimeout(() => {
        overlay.classList.add("hidden");
        overlay.className = "hidden";
    }, duration);
}

function spawnParticles(container, count, rarity) {
    const colors = {
        cosmic: ["#c084fc", "#67e8f9", "#a855f7", "#818cf8"],
        secret: [
            "#ff0000",
            "#ff7700",
            "#ffff00",
            "#00ff00",
            "#00ffff",
            "#0088ff",
            "#aa00ff",
            "#ff00ff",
        ],
    };
    const palette = colors[rarity] || ["#ffffff"];

    for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "reveal-particle";
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const distance = 300 + Math.random() * 500;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        p.style.setProperty("--tx", tx + "px");
        p.style.setProperty("--ty", ty + "px");
        p.style.left = "50%";
        p.style.top = "50%";
        p.style.background =
            palette[Math.floor(Math.random() * palette.length)];
        p.style.boxShadow = `0 0 20px ${p.style.background}, 0 0 40px ${p.style.background}`;
        p.style.animationDelay = Math.random() * 0.4 + "s";
        p.style.width = 6 + Math.random() * 12 + "px";
        p.style.height = p.style.width;

        container.appendChild(p);
    }
}

function displayAura(aura) {
    lastRolledAura = aura;
    $("#aura-name").textContent = aura.name;
    $("#aura-rarity").textContent = aura.rarity.toUpperCase();
    $("#aura-chance").textContent = formatChance(aura);
    $("#aura-desc").textContent = aura.desc;
    $("#aura-name").style.color = auraColor(aura);
    $("#aura-visual").className = "rarity-" + aura.rarity;
    $("#aura-visual").style.color = aura.color || "";
}

function renderEffectsBar() {
    const now = Date.now();
    state.activeEffects = state.activeEffects.filter((e) => e.endsAt > now);
    const bar = $("#effects-bar");
    bar.innerHTML = "";
    state.activeEffects.forEach((eff) => {
        const remaining = Math.ceil((eff.endsAt - now) / 1000);
        const chip = document.createElement("div");
        chip.className = "effect-chip";
        chip.textContent = `${eff.name} (${remaining}s)`;
        bar.appendChild(chip);
    });
}

function renderBiomeBackground() {
    const biome = BIOMES.find((b) => b.id === state.currentBiome) || BIOMES[0];
    $("#background-layer").className = biome.className;
}

function renderUI() {
    $("#stat-rolls").textContent = state.totalRolls.toLocaleString("fr-FR");
    $("#stat-luck").textContent = "x" + getTotalLuckMultiplier().toFixed(2);
    $("#stat-coins").textContent = state.coins.toLocaleString("fr-FR");
    $("#stat-best").textContent = state.bestAura
        ? AURA_BY_ID[state.bestAura].name
        : "Aucune";
    $("#stat-username").textContent = state.username || "—";

    if (lastRolledAura) {
        displayAura(lastRolledAura);
    } else if (state.equipped && AURA_BY_ID[state.equipped]) {
        displayAura(AURA_BY_ID[state.equipped]);
    } else {
        $("#aura-name").textContent = "Aucune aura";
        $("#aura-rarity").textContent = "—";
        $("#aura-chance").textContent = "—";
        $("#aura-desc").textContent =
            "Lance un roll pour commencer ton aventure !";
        $("#aura-name").style.color = "";
        $("#aura-visual").className = "rarity-common";
        $("#aura-visual").style.color = "";
    }

    const btn = $("#auto-roll-btn");
    if (!state.autoRollUnlocked) {
        btn.textContent = "🔒 Auto Roll";
        btn.classList.remove("active");
    } else if (!autoRollActive) {
        btn.textContent = "Auto Roll : OFF";
        btn.classList.remove("active");
    } else {
        btn.textContent = "Auto Roll : ON";
        btn.classList.add("active");
    }

    renderEffectsBar();
    renderBiomeBackground();
}

/* ---------- 5. INVENTAIRE / BOUTIQUE / CRAFT / BIOMES / UPGRADES / STATS ---------- */

function renderInventory() {
    const grid = $("#inventory-grid");
    grid.innerHTML = "";
    const search = $("#inv-search").value.toLowerCase();
    const filterR = $("#inv-filter-rarity").value;
    const sortBy = $("#inv-sort").value;
    const showLocked = $("#inv-show-locked").checked;

    let list = AURAS.filter((a) => {
        const owned = state.inventory[a.id] > 0;
        if (!owned && !showLocked) return false;
        if (filterR !== "all" && a.rarity !== filterR) return false;
        if (search && !a.name.toLowerCase().includes(search)) return false;
        return true;
    });

    if (sortBy === "rarity")
        list.sort(
            (a, b) =>
                RARITY_INDEX[b.rarity] - RARITY_INDEX[a.rarity] ||
                b.weight - a.weight,
        );
    else if (sortBy === "name")
        list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "quantity")
        list.sort(
            (a, b) =>
                (state.inventory[b.id] || 0) - (state.inventory[a.id] || 0),
        );

    list.forEach((aura) => {
        const owned = state.inventory[aura.id] > 0;
        const card = document.createElement("div");
        card.className =
            "card" +
            (owned ? "" : " locked") +
            (state.equipped === aura.id ? " equipped" : "");
        card.innerHTML = `
      <div style="color:${auraColor(aura)}; font-size:24px;">◆</div>
      <div class="card-name">${owned ? aura.name : "???"}</div>
      <span class="rarity-tag tag-${aura.rarity}">${aura.rarity}</span>
      <div class="card-info">${owned ? "x" + state.inventory[aura.id] : "Non découverte"}</div>
      ${owned ? `<div class="card-desc">${formatChance(aura)}</div>` : ""}
    `;
        if (owned) card.addEventListener("click", () => equipAura(aura.id));
        grid.appendChild(card);
    });

    const discovered = Object.keys(state.discovered).length;
    const pct = Math.round((discovered / AURAS.length) * 100);
    $("#collection-progress").textContent =
        `Collection : ${discovered} / ${AURAS.length} (${pct}%)`;
}

function equipAura(id) {
    if (!state.discovered[id]) return;
    if (state.equipped === id) {
        state.equipped = null;
        showToast("Aura déséquipée");
        lastRolledAura = null;
    } else {
        state.equipped = id;
        showToast("Aura équipée : " + AURA_BY_ID[id].name);
        lastRolledAura = AURA_BY_ID[id];
    }
    saveGame();
    renderUI();
    renderInventory();
}

function renderShop() {
    const grid = $("#shop-grid");
    grid.innerHTML = "";
    $("#shop-coins").textContent = state.coins.toLocaleString("fr-FR");
    const discount = getUpgradeEffect("potionDiscount");

    POTIONS.forEach((p) => {
        const realPrice = Math.round(p.price * (1 - discount));
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
      <div class="card-name">${p.name}</div>
      <div class="card-desc">${p.desc}</div>
      <div class="card-info">💰 ${realPrice}${discount > 0 ? ` <s style="opacity:.5">${p.price}</s>` : ""}</div>
      <div class="card-info">Possédé : ${state.ownedItems[p.id] || 0}</div>
      <button class="small-btn" style="margin-top:8px;">Acheter</button>
      <button class="small-btn" style="margin-top:6px;">Utiliser</button>
    `;
        const [buyBtn, useBtn] = card.querySelectorAll("button");
        buyBtn.addEventListener("click", () =>
            buyItem({ ...p, price: realPrice }),
        );
        useBtn.addEventListener("click", () => usePotion(p.id));
        grid.appendChild(card);
    });

    SHOP_ITEMS.forEach((item) => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
      <div class="card-name">${item.name}</div>
      <div class="card-desc">${item.desc}</div>
      <div class="card-info">💰 ${item.price} — possédé : ${state.ownedItems[item.id] || 0}</div>
      <button class="small-btn" style="margin-top:8px;">Acheter</button>
    `;
        card.querySelector("button").addEventListener("click", () =>
            buyItem(item),
        );
        grid.appendChild(card);
    });
}

function buyItem(item) {
    if (item.perm && (state.ownedItems[item.id] || 0) > 0) {
        showToast("✅ Déjà possédé : le bonus permanent est actif.");
        return;
    }
    if (state.coins < item.price) {
        showToast("❌ Pas assez de monnaie.");
        return;
    }
    state.coins -= item.price;
    state.ownedItems[item.id] = (state.ownedItems[item.id] || 0) + 1;
    playSound("buy");
    showToast(`✅ ${item.name} acheté.`);
    saveGame();
    renderUI();
    renderShop();
}

function usePotion(potionId) {
    if (!state.ownedItems[potionId]) {
        showToast("❌ Pas cette potion.");
        return;
    }
    const potion = POTIONS.find((p) => p.id === potionId);
    if (!potion) return;
    state.ownedItems[potionId]--;
    state.usedPotions++;
    state.activeEffects = state.activeEffects.filter((e) => e.id !== potionId);
    state.activeEffects.push({
        id: potion.id,
        name: potion.name,
        bonus: potion.bonus || null,
        speed: potion.speed || null,
        endsAt: Date.now() + potion.duration * 1000,
    });
    playSound("potion");
    showToast(`🧪 ${potion.name} utilisée !`);
    saveGame();
    renderUI();
    renderShop();
}

function renderCraft() {
    const list = $("#craft-list");
    list.innerHTML = "";
    RECIPES.forEach((r) => {
        const div = document.createElement("div");
        div.className = "card";
        div.style.marginTop = "10px";
        const ingredientsHTML = r.ingredients
            .map((ing) => {
                const owned = state.ownedItems[ing.id] || 0;
                const ok = owned >= ing.qty;
                return `<div style="color:${ok ? "#4ade80" : "#f87171"}">${findItemName(ing.id)} : ${owned} / ${ing.qty}</div>`;
            })
            .join("");
        const canCraft = r.ingredients.every(
            (ing) => (state.ownedItems[ing.id] || 0) >= ing.qty,
        );
        div.innerHTML = `
      <div class="card-name">${findItemName(r.result.id)}</div>
      <div class="card-desc">${r.desc}</div>
      <div style="margin-top:8px; font-size:12px;">${ingredientsHTML}</div>
      <button class="small-btn" style="margin-top:8px;" ${canCraft ? "" : "disabled"}>
        ${canCraft ? "Fabriquer" : "Ressources insuffisantes"}
      </button>
    `;
        div.querySelector("button").addEventListener("click", () =>
            craftRecipe(r),
        );
        list.appendChild(div);
    });
}

function findItemName(id) {
    const potion = POTIONS.find((p) => p.id === id);
    if (potion) return potion.name;
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (item) return item.name;
    return id;
}

function craftRecipe(recipe) {
    const ok = recipe.ingredients.every(
        (ing) => (state.ownedItems[ing.id] || 0) >= ing.qty,
    );
    if (!ok) {
        showToast("❌ Ressources insuffisantes.");
        return;
    }
    const resultItem = SHOP_ITEMS.find((i) => i.id === recipe.result.id);
    if (
        resultItem &&
        resultItem.perm &&
        (state.ownedItems[resultItem.id] || 0) > 0
    ) {
        showToast("✅ Déjà possédé : le bonus permanent est actif.");
        return;
    }
    recipe.ingredients.forEach((ing) => {
        state.ownedItems[ing.id] -= ing.qty;
    });
    state.ownedItems[recipe.result.id] =
        (state.ownedItems[recipe.result.id] || 0) + recipe.result.qty;
    state.craftedItems++;
    showToast(`🔨 ${findItemName(recipe.result.id)} fabriqué !`);
    saveGame();
    renderCraft();
    renderUI();
}

function renderBiomes() {
    const list = $("#biomes-list");
    list.innerHTML = "";
    BIOMES.forEach((b) => {
        const unlocked = state.unlockedBiomes.includes(b.id);
        const div = document.createElement("div");
        div.className = "card";
        div.style.marginTop = "10px";
        div.innerHTML = `
      <div class="card-name">${unlocked ? b.name : "🔒 " + b.name}</div>
      <div class="card-desc">${b.desc}</div>
      <div class="card-info">Bonus chance permanent : +${Math.round((b.luckBonus - 1) * 100)} %</div>
      <button class="small-btn" style="margin-top:8px;" ${unlocked ? "" : "disabled"}>
        ${state.currentBiome === b.id ? "Actif" : unlocked ? "Activer" : "Verrouillé"}
      </button>
    `;
        if (unlocked) {
            div.querySelector("button").addEventListener("click", () => {
                state.currentBiome = b.id;
                saveGame();
                renderUI();
                renderBiomes();
                showToast(`🌍 Biome actif : ${b.name}`);
            });
        }
        list.appendChild(div);
    });
}

function fmtPct(x) {
    return (x * 100).toFixed(1).replace(/\.0$/, "") + "%";
}

function renderUpgrades() {
    const list = $("#upgrades-list");
    list.innerHTML = "";
    $("#upgrades-coins").textContent = state.coins.toLocaleString("fr-FR");

    UPGRADES.forEach((up) => {
        const level = getUpgradeLevel(up.id);
        const maxed = level >= up.maxLevel;
        const cost = getUpgradeCost(up);
        const totalEffect = getUpgradeTotalEffect(up, level);
        const next = maxed ? null : up.effects[level];
        const nextTxt = next ? ` (prochain niveau : +${fmtPct(next)})` : "";
        let effectText = "";
        if (up.effectType === "luck")
            effectText = `Chance : +${fmtPct(totalEffect)}${nextTxt}`;
        if (up.effectType === "speed")
            effectText = `Vitesse : +${fmtPct(totalEffect)}${nextTxt}`;
        if (up.effectType === "coins")
            effectText = `Monnaie : +${fmtPct(totalEffect)}${nextTxt}`;
        if (up.effectType === "double")
            effectText = `Double : ${fmtPct(totalEffect)}${nextTxt}`;
        if (up.effectType === "potionDiscount")
            effectText = `Réduction : -${fmtPct(totalEffect)}${nextTxt}`;

        const card = document.createElement("div");
        card.className = "upgrade-card" + (maxed ? " maxed" : "");
        card.innerHTML = `
      <div class="upgrade-info">
        <div class="upgrade-name">${up.name}</div>
        <div class="upgrade-desc">${up.desc}</div>
        <div class="upgrade-level">Niveau : ${level} / ${up.maxLevel}</div>
        <div class="upgrade-effect">${effectText}</div>
      </div>
      <button ${maxed ? "disabled" : ""}>${maxed ? "MAX" : "💰 " + cost.toLocaleString("fr-FR")}</button>
    `;
        if (!maxed)
            card.querySelector("button").addEventListener("click", () =>
                buyUpgrade(up),
            );
        list.appendChild(card);
    });
}

function renderStats() {
    const discovered = Object.keys(state.discovered).length;
    const pct = Math.round((discovered / AURAS.length) * 100);
    const bestAura = state.bestAura ? AURA_BY_ID[state.bestAura] : null;
    const byRarity = {};
    RARITIES.forEach((r) => (byRarity[r] = 0));
    Object.keys(state.discovered).forEach((id) => {
        const aura = AURA_BY_ID[id];
        if (aura) byRarity[aura.rarity]++;
    });
    const totalByRarity = {};
    RARITIES.forEach((r) => (totalByRarity[r] = 0));
    AURAS.forEach((a) => totalByRarity[a.rarity]++);
    const minutes = Math.floor(state.playTime / 60);
    const totalUpgradeLevels = UPGRADES.reduce(
        (sum, up) => sum + getUpgradeLevel(up.id),
        0,
    );
    const permBonus = getPermanentLuckBonus();
    const tempMult = getTemporaryLuckMultiplier();
    const totalLuck = getTotalLuckMultiplier();

    $("#stats-content").innerHTML = `
    <p>🎲 Rolls totaux : ${state.totalRolls.toLocaleString("fr-FR")}</p>
    <p>🔍 Auras découvertes : ${discovered} / ${AURAS.length}</p>
    <p>⭐ Meilleure aura : ${bestAura ? bestAura.name + " (" + bestAura.rarity + ")" : "Aucune"}</p>
    <p>🎯 Rolls depuis une aura rare : ${state.rollsSinceRare}</p>
    <p>⏱️ Temps de jeu : ${minutes} min</p>
    <p>💰 Monnaie : ${state.coins.toLocaleString("fr-FR")}</p>
    <p>🧪 Potions utilisées : ${state.usedPotions}</p>
    <p>🔨 Objets fabriqués : ${state.craftedItems}</p>
    <p>⭐ Améliorations : ${totalUpgradeLevels} niveaux</p>
    <p>🤖 Auto Roll : ${state.autoRollUnlocked ? "Débloqué" : "Verrouillé"}</p>
    <p>♾️ Chance permanente : +${(permBonus * 100).toFixed(1)}%</p>
    <p>⏳ Chance temporaire (potion) : +${((tempMult - 1) * 100).toFixed(0)}%</p>
    <p>🍀 Chance totale : x${totalLuck.toFixed(2)} (plafond x${LUCK_HARD_CAP.toFixed(2)})</p>
    <p>👤 Joueur : ${state.username || "—"}</p>
    <p>📊 Collection : ${pct}%</p>
    <hr style="margin:10px 0; opacity:.2;" />
    <h3>Répartition par rareté</h3>
    ${RARITIES.map((r) => `<p>${r} : ${byRarity[r]} / ${totalByRarity[r]}</p>`).join("")}
  `;
}

/* ---------- 6. AUTH + LEADERBOARD ---------- */

let authMode = "login";
let authInitialized = false;
let leaderboardInterval = null;
let leaderboardRefreshInterval = null;
let currentLeaderboardTab = "bestAura";

const LS_PENDING_PSEUDO = "auraRng_pendingPseudo";
const pseudoKeyFor = (uid) => "auraRng_pseudo_" + uid;

function usernameToEmail(username) {
    return username.toLowerCase().replace(/[^a-z0-9_]/g, "") + FB_EMAIL_DOMAIN;
}

function showAuthModal(show) {
    const modal = document.getElementById("auth-modal");
    if (show) {
        modal.classList.remove("hidden");
        document.body.classList.add("not-logged");
    } else {
        modal.classList.add("hidden");
        document.body.classList.remove("not-logged");
    }
}

function showAuthLoading(show, text) {
    const loading = document.getElementById("auth-loading");
    if (show) {
        document.getElementById("auth-loading-text").textContent =
            text || "Chargement...";
        loading.classList.remove("hidden");
    } else loading.classList.add("hidden");
}

function setAuthMode(mode) {
    authMode = mode;
    showAuthLoading(false);
    document.querySelectorAll(".auth-tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.auth === mode);
    });
    document.getElementById("auth-title").textContent =
        mode === "login" ? "🔐 Connexion" : "✨ Créer un compte";
    document.getElementById("auth-submit").textContent =
        mode === "login" ? "Se connecter" : "Créer mon compte";
    document.getElementById("auth-error").textContent = "";
}

async function handleAuthSubmit() {
    const FB = window.FB;
    if (!FB) {
        document.getElementById("auth-error").textContent =
            "Firebase non chargé.";
        return;
    }

    const username = document.getElementById("auth-username").value.trim();
    const password = document.getElementById("auth-password").value;
    const errorEl = document.getElementById("auth-error");
    const submitBtn = document.getElementById("auth-submit");
    errorEl.textContent = "";

    if (!username || username.length < 3) {
        errorEl.textContent = "❌ Pseudo trop court.";
        return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        errorEl.textContent = "❌ Lettres, chiffres et _ uniquement.";
        return;
    }
    if (!password || password.length < 6) {
        errorEl.textContent = "❌ Mot de passe : 6 car. min.";
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Chargement...";

    try {
        const email = usernameToEmail(username);
        if (authMode === "register") {
            const usernameRef = FB.ref(
                FB.db,
                "usernames/" + username.toLowerCase(),
            );
            const snap = await FB.get(usernameRef);
            if (snap.exists()) {
                errorEl.textContent = "❌ Ce pseudo est déjà pris.";
                return;
            }

            localStorage.setItem(LS_PENDING_PSEUDO, username);

            let user;
            try {
                const cred = await FB.createUserWithEmailAndPassword(
                    FB.auth,
                    email,
                    password,
                );
                user = cred.user;
            } catch (e) {
                localStorage.removeItem(LS_PENDING_PSEUDO);
                throw e;
            }

            localStorage.setItem(pseudoKeyFor(user.uid), username);

            try {
                await FB.set(usernameRef, {
                    uid: user.uid,
                    createdAt: Date.now(),
                });
            } catch (e) {
                console.warn("usernames échoué :", e);
            }

            try {
                await FB.updateProfile(user, { displayName: username });
            } catch (e) {
                console.warn("updateProfile échoué :", e);
            }
        } else {
            await FB.signInWithEmailAndPassword(FB.auth, email, password);
        }
    } catch (e) {
        console.warn("Erreur auth :", e);
        let msg = "❌ Erreur inconnue.";
        if (e.code === "auth/user-not-found")
            msg = "❌ Aucun compte avec ce pseudo.";
        if (e.code === "auth/wrong-password")
            msg = "❌ Mot de passe incorrect.";
        if (e.code === "auth/invalid-credential")
            msg = "❌ Pseudo ou mot de passe incorrect.";
        if (e.code === "auth/email-already-in-use")
            msg = "❌ Ce pseudo est déjà utilisé.";
        if (e.code === "auth/weak-password")
            msg = "❌ Mot de passe trop faible.";
        if (e.code === "auth/too-many-requests") msg = "❌ Trop de tentatives.";
        if (e.code === "auth/invalid-email") msg = "❌ Pseudo invalide.";
        if (e.code === "auth/operation-not-allowed")
            msg = "❌ Active E-mail/Mot de passe dans Firebase.";
        if (e.code === "auth/network-request-failed")
            msg = "❌ Problème réseau.";
        errorEl.textContent = msg;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent =
            authMode === "login" ? "Se connecter" : "Créer mon compte";
    }
}

async function handleLogout() {
    if (!window.FB) return;
    if (!confirm("Se déconnecter ? Ta progression est dans le cloud.")) return;
    try {
        flushPlayTime();
        await window.FB.signOut(window.FB.auth);
        location.reload();
    } catch (e) {
        console.warn("Erreur déconnexion :", e);
    }
}

async function resolveUsername(user) {
    let username = localStorage.getItem(pseudoKeyFor(user.uid));
    if (!username) {
        const pending = localStorage.getItem(LS_PENDING_PSEUDO);
        if (pending) username = pending;
    }
    if (!username && user.displayName) username = user.displayName;
    if (!username) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const snap = await window.FB.get(
                    window.FB.ref(window.FB.db, "usernames"),
                );
                if (snap.exists()) {
                    snap.forEach((child) => {
                        if (child.val().uid === user.uid) username = child.key;
                    });
                }
                if (username) break;
            } catch (e) {
                console.warn("Lookup pseudo échoué :", e);
            }
            await new Promise((r) => setTimeout(r, 400));
        }
    }
    if (!username) username = "Joueur";
    localStorage.setItem(pseudoKeyFor(user.uid), username);
    return username;
}

function initAuth() {
    const FB = window.FB;
    if (!FB) {
        showAuthModal(false);
        return;
    }

    showAuthModal(true);
    setAuthMode("login");

    FB.onAuthStateChanged(FB.auth, async (user) => {
        if (user) {
            showAuthLoading(true, "Chargement de ta progression...");

            state = createDefaultState();
            state.uid = user.uid;
            lastRolledAura = null;

            const username = await resolveUsername(user);
            state.username = username;

            const loadedFromCloud = await loadGameFromCloud();
            if (!loadedFromCloud) {
                loadGame();
                if (
                    (state.totalRolls > 0 || state.coins > 0) &&
                    state._uid === user.uid
                ) {
                    pushSaveToCloud();
                }
            }
            state.uid = user.uid;
            state.username = username;
            state._uid = user.uid;

            document.getElementById("stat-username").textContent =
                state.username;
            showAuthLoading(false);
            showAuthModal(false);
            renderUI();

            // ✅ Sync classement (y compris bestAuraScore pour les anciens comptes)
            pushToLeaderboard();
            initLeaderboard();
            localStorage.removeItem(LS_PENDING_PSEUDO);
        } else {
            state = createDefaultState();
            lastRolledAura = null;
            document.getElementById("stat-username").textContent = "—";
            showAuthLoading(false);
            showAuthModal(true);
            setAuthMode("login");
            if (leaderboardInterval) {
                clearInterval(leaderboardInterval);
                leaderboardInterval = null;
            }
            if (leaderboardRefreshInterval) {
                clearInterval(leaderboardRefreshInterval);
                leaderboardRefreshInterval = null;
            }
            stopPlayTimeTracker();
        }
    });
}

function getPlayerName() {
    return state.username;
}

// ✅ Push : bestAuraScore POSITIF et proportionnel à la rareté
function pushToLeaderboard() {
    const name = getPlayerName();
    const uid = state.uid;
    if (!name || !uid || !window.FB) return;

    const { db, ref, update } = window.FB;
    const playerRef = ref(db, "players/" + uid);

    const bestAura = state.bestAura ? AURA_BY_ID[state.bestAura] : null;

    // Formule : (rarityIndex + 1) × 10^12 + poids
    // - Rareté domine toujours le poids
    // - À rareté égale, l'aura la plus rare (poids le plus grand) gagne
    let bestAuraScore = 0;
    let bestAuraName = "Aucune";
    let bestAuraRarity = "none";
    let bestAuraWeight = 0;
    let bestAuraChance = "—";

    if (bestAura) {
        const rIdx = RARITY_INDEX[bestAura.rarity];
        const w = auraWeight(bestAura);
        bestAuraScore = (rIdx + 1) * 1e12 + w;
        bestAuraName = bestAura.name;
        bestAuraRarity = bestAura.rarity;
        bestAuraWeight = w;
        bestAuraChance = formatChance(bestAura);
    }

    update(playerRef, {
        name,
        bestAuraName,
        bestAuraRarity,
        bestAuraScore,
        bestAuraWeight,
        bestAuraChance,
        totalRolls: state.totalRolls,
        playTime: Math.floor(state.playTime),
        updatedAt: Date.now(),
    }).catch((e) => console.warn("Erreur sync classement :", e));
}

function fetchLeaderboard(type, callback) {
    if (!window.FB) {
        callback({ players: [], error: "Firebase indisponible" });
        return;
    }
    const { db, ref, query, orderByChild, limitToLast, get } = window.FB;

    const config = {
        bestAura: "bestAuraScore",
        totalRolls: "totalRolls",
        playTime: "playTime",
    }[type];

    if (!config) {
        callback({ players: [], error: "Type inconnu" });
        return;
    }

    // limitToLast(20) sur un tri ASC prend les 20 plus grands scores
    // → reverse() les met dans le bon ordre (meilleur en premier)
    const q = query(ref(db, "players"), orderByChild(config), limitToLast(20));

    get(q)
        .then((snapshot) => {
            const results = [];
            snapshot.forEach((child) => {
                const val = child.val();
                if (!val) return;
                if (!val.name || val.name === "Joueur") return;
                if (
                    type === "bestAura" &&
                    (!val.bestAuraRarity || val.bestAuraRarity === "none")
                )
                    return;
                results.push(val);
            });

            results.reverse();

            callback({ players: results, error: null });
        })
        .catch((e) => {
            console.warn("Erreur classement :", e);
            const msg =
                e.code === "PERMISSION_DENIED"
                    ? "Accès refusé — vérifie les règles Firebase."
                    : e.message || "Erreur inconnue.";
            callback({ players: [], error: msg });
        });
}

function renderLeaderboard(type, silent = false) {
    const container = $("#lb-content");
    const status = $("#lb-status");

    currentLeaderboardTab = type;

    if (!silent) {
        status.textContent = "Chargement...";
        status.style.color = "";
        container.innerHTML = "";
    }

    fetchLeaderboard(type, ({ players, error }) => {
        if (error) {
            status.textContent = "⚠️ " + error;
            status.style.color = "#fca5a5";
            container.innerHTML = "";
            return;
        }

        if (!players || players.length === 0) {
            status.textContent = "Aucun joueur pour le moment.";
            status.style.color = "";
            container.innerHTML = "";
            return;
        }

        status.style.color = "";
        const myName = getPlayerName();
        const timeStr = new Date().toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        status.textContent = `Top ${players.length} joueurs · actualisé à ${timeStr}`;

        container.innerHTML = "";

        players.forEach((p, index) => {
            const rank = index + 1;
            const isMe = myName && p.name === myName;

            let displayValue = "";
            let subValue = "";
            let valueColor = "#4ade80";

            if (type === "bestAura") {
                displayValue = p.bestAuraName || "Aucune";
                subValue =
                    p.bestAuraChance && p.bestAuraChance !== "—"
                        ? p.bestAuraChance
                        : (p.bestAuraRarity || "").toUpperCase();
                valueColor = RARITY_COLORS[p.bestAuraRarity] || "#4ade80";
            } else if (type === "totalRolls") {
                displayValue =
                    (p.totalRolls || 0).toLocaleString("fr-FR") + " rolls";
            } else if (type === "playTime") {
                const mins = Math.floor((p.playTime || 0) / 60);
                displayValue = mins.toLocaleString("fr-FR") + " min";
            }

            const row = document.createElement("div");
            row.className = "lb-row" + (isMe ? " me" : "");
            const rankClass =
                rank === 1
                    ? " top1"
                    : rank === 2
                      ? " top2"
                      : rank === 3
                        ? " top3"
                        : "";

            row.innerHTML = `
                <div class="lb-rank${rankClass}">${rank}</div>
                <div class="lb-name">
                    ${p.name || "Anonyme"}${isMe ? ' <span style="opacity:.6">(toi)</span>' : ""}
                    ${subValue ? `<span class="lb-sub" style="color:${valueColor}">${subValue}</span>` : ""}
                </div>
                <div class="lb-value" style="color:${valueColor}">${displayValue}</div>
            `;
            container.appendChild(row);
        });
    });
}

function initLeaderboard() {
    if (getPlayerName()) pushToLeaderboard();

    if (leaderboardInterval) clearInterval(leaderboardInterval);
    leaderboardInterval = setInterval(() => {
        if (getPlayerName()) pushToLeaderboard();
    }, 15000);

    if (leaderboardRefreshInterval) clearInterval(leaderboardRefreshInterval);
    leaderboardRefreshInterval = setInterval(() => {
        const modal = document.getElementById("leaderboard-modal");
        if (modal && !modal.classList.contains("hidden") && getPlayerName()) {
            renderLeaderboard(currentLeaderboardTab, true);
        }
    }, 15000);
}

async function cleanGhostPlayers() {
    if (!window.FB || !state.uid) return { removed: 0 };
    try {
        const { db, ref, get, remove } = window.FB;
        const snap = await get(ref(db, "players"));
        if (!snap.exists()) return { removed: 0 };
        const deletions = [];
        snap.forEach((child) => {
            const val = child.val();
            const uid = child.key;
            if (uid === state.uid) return;
            if (
                !val ||
                !val.name ||
                val.name === "Joueur" ||
                (val.totalRolls === 0 && val.bestAuraName === "Aucune")
            ) {
                deletions.push(remove(ref(db, "players/" + uid)));
            }
        });
        if (deletions.length > 0) await Promise.all(deletions);
        return { removed: deletions.length };
    } catch (e) {
        return { removed: 0, error: e.message };
    }
}

/* ---------- 7. PLAYTIME TRACKER (multi-onglets + arrière-plan) ---------- */

const TAB_ID = Math.random().toString(36).slice(2, 10);
const TAB_HEARTBEAT_KEY = "auraRng_activeTab";
const TAB_HEARTBEAT_INTERVAL = 5000;
const TAB_STALE_MS = 10000;

let playTimeTickInterval = null;
let heartbeatInterval = null;
let lastTickAt = 0;
let isPrimaryTab = false;
let tabChannel = null;

function startPlayTimeTracker() {
    try {
        if ("BroadcastChannel" in window)
            tabChannel = new BroadcastChannel("auraRng_tabs");
    } catch (e) {
        tabChannel = null;
    }

    electPrimaryTab();

    if (tabChannel) {
        tabChannel.onmessage = (ev) => {
            if (!ev.data) return;
            if (ev.data.type === "iam_primary" && ev.data.tabId !== TAB_ID) {
                isPrimaryTab = false;
            }
        };
    }

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            lastTickAt = Date.now();
            electPrimaryTab();
        } else {
            flushPlayTime();
        }
    });

    heartbeatInterval = setInterval(() => {
        if (document.visibilityState === "visible") {
            try {
                localStorage.setItem(
                    TAB_HEARTBEAT_KEY,
                    JSON.stringify({ tabId: TAB_ID, ts: Date.now() }),
                );
            } catch (e) {}
            if (tabChannel) tabChannel.postMessage({ type: "hello" });
        }
    }, TAB_HEARTBEAT_INTERVAL);

    lastTickAt = Date.now();
    playTimeTickInterval = setInterval(() => {
        const now = Date.now();
        const delta = (now - lastTickAt) / 1000;
        lastTickAt = now;

        if (!state.uid) return;
        if (document.visibilityState !== "visible") return;
        if (!isPrimaryTab) return;
        if (delta > 10) return; // throttle navigateur → ignore

        const beforeFloor = Math.floor(state.playTime);
        state.playTime += delta;
        const afterFloor = Math.floor(state.playTime);

        if (afterFloor !== beforeFloor && afterFloor % 10 === 0) saveGame(true);
        if (afterFloor !== beforeFloor && afterFloor % 60 === 0) saveGame();
    }, 1000);
}

function stopPlayTimeTracker() {
    if (playTimeTickInterval) {
        clearInterval(playTimeTickInterval);
        playTimeTickInterval = null;
    }
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    try {
        localStorage.removeItem(TAB_HEARTBEAT_KEY);
    } catch (e) {}
}

function flushPlayTime() {
    if (!state.uid) return;
    saveGame();
    flushCloudSave();
}

function electPrimaryTab() {
    try {
        const raw = localStorage.getItem(TAB_HEARTBEAT_KEY);
        if (!raw) {
            isPrimaryTab = true;
            return;
        }
        const data = JSON.parse(raw);
        if (!data || !data.ts || Date.now() - data.ts > TAB_STALE_MS) {
            isPrimaryTab = true;
            return;
        }
        isPrimaryTab = data.tabId === TAB_ID;
    } catch (e) {
        isPrimaryTab = true;
    }
}

/* ---------- 8. ÉVÉNEMENTS ---------- */

let rollInProgress = false;
let autoRollActive = false;
let autoRollTimer = null;

function handleAuraReveal(aura) {
    if (REVEAL_RARITIES.includes(aura.rarity) && !state.settings.reduceAnim) {
        showReveal(aura);
    } else if (!state.settings.hideCommon || aura.rarity !== "common") {
        showToast(`✨ ${aura.name} (${aura.rarity})`);
    }
}

$("#roll-btn").addEventListener("click", () => {
    if (rollInProgress) return;
    rollInProgress = true;
    $("#roll-btn").disabled = true;

    const delay = state.settings.reduceAnim ? 0 : 300;
    setTimeout(() => {
        const aura = performRoll();
        handleAuraReveal(aura);
        playSound("roll");
        if (REVEAL_RARITIES.includes(aura.rarity)) playSound("rare");
        renderUI();
        displayAura(aura);
        saveGame();
        rollInProgress = false;
        $("#roll-btn").disabled = false;
    }, delay);
});

$("#auto-roll-btn").addEventListener("click", () => {
    if (!state.autoRollUnlocked) {
        openAutoRollPaywall();
        return;
    }
    toggleAutoRoll();
});

function toggleAutoRoll() {
    if (!state.autoRollUnlocked) return;
    autoRollActive = !autoRollActive;
    const btn = $("#auto-roll-btn");
    if (autoRollActive) {
        btn.textContent = "Auto Roll : ON";
        btn.classList.add("active");
        runAutoRollLoop();
    } else {
        btn.textContent = "Auto Roll : OFF";
        btn.classList.remove("active");
        clearTimeout(autoRollTimer);
    }
}

function runAutoRollLoop() {
    if (!autoRollActive) return;
    if (rollInProgress) {
        autoRollTimer = setTimeout(runAutoRollLoop, 100);
        return;
    }
    rollInProgress = true;

    const aura = performRoll();
    handleAuraReveal(aura);
    playSound("roll");
    renderUI();
    displayAura(aura);
    saveGame();
    rollInProgress = false;

    let interval = 600;
    const speedEffect = state.activeEffects.find((e) => e.speed);
    if (speedEffect) interval *= 1 - speedEffect.speed;
    interval *= 1 - getUpgradeEffect("speed");
    interval = Math.max(AUTOROLL_MIN_INTERVAL, interval);
    autoRollTimer = setTimeout(runAutoRollLoop, interval);
}

function openAutoRollPaywall() {
    state.autoRollPaywallOpenCount++;
    saveGame();
    const modal = document.getElementById("autoroll-paywall");
    const secretBox = document.getElementById("paywall-secret");
    document.getElementById("paywall-status").textContent = "";
    if (state.autoRollPaywallOpenCount >= AUTOROLL_SECRET_UNLOCK_AT)
        secretBox.classList.remove("hidden");
    else secretBox.classList.add("hidden");
    modal.classList.remove("hidden");
}

const PAYMENT_FORMS = {
    PayPal: "form-paypal",
    "Apple Pay": "form-apple",
    "Google Pay": "form-google",
    "Carte bancaire": "form-cb",
};
const PAYMENT_BUTTONS = {
    PayPal: ".pp-btn",
    "Apple Pay": ".ap-btn",
    "Google Pay": ".gp-btn",
    "Carte bancaire": ".cb-btn",
};

document.querySelectorAll(".pay-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const method = btn.dataset.method;
        playSound("roll");
        const formId = PAYMENT_FORMS[method];
        if (!formId) return;
        showFakePayment(formId);
        attachFakePaymentHandler(method);
    });
});

function showFakePayment(formId) {
    document.getElementById("fake-payment").classList.remove("hidden");
    document
        .querySelectorAll("#fake-payment .payment-screen")
        .forEach((el) => el.classList.add("hidden"));
    document.getElementById(formId).classList.remove("hidden");
}

function attachFakePaymentHandler(method) {
    const sel = PAYMENT_BUTTONS[method];
    if (!sel) return;
    const btn = document.querySelector(sel);
    if (!btn) return;
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener("click", () => {
        fresh.disabled = true;
        startFakePaymentProcess(method);
    });
    if (method === "Apple Pay") {
        const cancel = document.querySelector(".ap-cancel");
        if (cancel) {
            const freshCancel = cancel.cloneNode(true);
            cancel.parentNode.replaceChild(freshCancel, cancel);
            freshCancel.addEventListener("click", closeFakePayment);
        }
    }
}

function startFakePaymentProcess(method) {
    document
        .querySelectorAll("#fake-payment .payment-screen")
        .forEach((el) => el.classList.add("hidden"));
    document.getElementById("payment-loading").classList.remove("hidden");
    const loadingText = document.getElementById("payment-loading-text");
    const steps = [
        "Connexion sécurisée...",
        "Vérification du compte...",
        "Autorisation en cours...",
        "Traitement du paiement...",
        `Communication avec ${method}...`,
    ];
    let i = 0;
    loadingText.textContent = steps[0];
    const stepInterval = setInterval(() => {
        i++;
        if (i < steps.length) loadingText.textContent = steps[i];
    }, 500);
    setTimeout(() => {
        clearInterval(stepInterval);
        const trolls = [
            {
                title: "Paiement refusé",
                msg: `${method} a détecté une anomalie `,
            },
            {
                title: "Fonds insuffisants",
                msg: `Ton compte ${method} est vide `,
            },
            {
                title: "Erreur inconnue",
                msg: `Code : TROLL-${Math.floor(Math.random() * 9000) + 1000}`,
            },
            {
                title: "Compte introuvable",
                msg: `Aucun compte ${method} associé `,
            },
            { title: "Vérification échouée", msg: `Identité refusée ` },
            { title: "Serveur surchargé", msg: `Serveur en pause café ` },
            { title: "Session expirée", msg: `Session expirée ` },
            { title: "Paiement suspect", msg: `Trop beau pour être vrai ` },
        ];
        const troll = trolls[Math.floor(Math.random() * trolls.length)];
        document.getElementById("payment-error-title").textContent =
            troll.title;
        document.getElementById("payment-error-msg").textContent = troll.msg;
        document
            .querySelectorAll("#fake-payment .payment-screen")
            .forEach((el) => el.classList.add("hidden"));
        document.getElementById("payment-error").classList.remove("hidden");
    }, 2500);
}

function closeFakePayment() {
    document.getElementById("fake-payment").classList.add("hidden");
    document
        .querySelectorAll("#fake-payment .payment-screen")
        .forEach((el) => el.classList.add("hidden"));
}

document
    .getElementById("payment-error-close")
    .addEventListener("click", () => closeFakePayment());

document.getElementById("paywall-buy-coins").addEventListener("click", () => {
    if (state.coins < AUTOROLL_PRICE_COINS) {
        document.getElementById("paywall-status").textContent =
            `❌ Il te manque ${(AUTOROLL_PRICE_COINS - state.coins).toLocaleString("fr-FR")} pièces.`;
        return;
    }
    state.coins -= AUTOROLL_PRICE_COINS;
    state.autoRollUnlocked = true;
    playSound("buy");
    showToast("🎉 Auto Roll débloqué !");
    saveGame();
    renderUI();
    document.getElementById("autoroll-paywall").classList.add("hidden");
    toggleAutoRoll();
});

document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () =>
        document.getElementById(btn.dataset.close).classList.add("hidden"),
    );
});

function openModal(id) {
    document.getElementById(id).classList.remove("hidden");
}

$("#inventory-btn").addEventListener("click", () => {
    renderInventory();
    openModal("inventory-modal");
});
$("#shop-btn").addEventListener("click", () => {
    renderShop();
    openModal("shop-modal");
});
$("#craft-btn").addEventListener("click", () => {
    renderCraft();
    openModal("craft-modal");
});
$("#biomes-btn").addEventListener("click", () => {
    renderBiomes();
    openModal("biomes-modal");
});
$("#upgrades-btn").addEventListener("click", () => {
    renderUpgrades();
    openModal("upgrades-modal");
});
$("#stats-btn").addEventListener("click", () => {
    renderStats();
    openModal("stats-modal");
});
$("#settings-btn").addEventListener("click", () => openModal("settings-modal"));

document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => setAuthMode(tab.dataset.auth));
});
document
    .getElementById("auth-submit")
    .addEventListener("click", handleAuthSubmit);
["auth-username", "auth-password"].forEach((id) => {
    document.getElementById(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleAuthSubmit();
    });
});
document.getElementById("logout-btn").addEventListener("click", handleLogout);

$("#leaderboard-btn").addEventListener("click", () => {
    if (!getPlayerName()) {
        showToast("❌ Connecte-toi pour voir le classement.");
        return;
    }
    pushToLeaderboard();
    setTimeout(() => {
        renderLeaderboard("bestAura");
        openModal("leaderboard-modal");
    }, 400);
});
document.querySelectorAll(".lb-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document
            .querySelectorAll(".lb-tab")
            .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        renderLeaderboard(tab.dataset.lb);
    });
});

["inv-search", "inv-filter-rarity", "inv-sort", "inv-show-locked"].forEach(
    (id) => {
        document.getElementById(id).addEventListener("input", renderInventory);
        document.getElementById(id).addEventListener("change", renderInventory);
    },
);

$("#opt-sound").addEventListener("change", (e) => {
    state.settings.sound = e.target.checked;
    saveGame();
});
$("#opt-volume").addEventListener("input", (e) => {
    state.settings.volume = parseFloat(e.target.value);
    saveGame();
});
$("#opt-reduce-anim").addEventListener("change", (e) => {
    state.settings.reduceAnim = e.target.checked;
    document.body.classList.toggle("reduce-anim", state.settings.reduceAnim);
    saveGame();
});
$("#opt-hide-common").addEventListener("change", (e) => {
    state.settings.hideCommon = e.target.checked;
    saveGame();
});

document.getElementById("clean-lb-btn").addEventListener("click", async () => {
    if (!confirm("Supprimer toutes les entrées 'Joueur' du classement ?"))
        return;
    const btn = document.getElementById("clean-lb-btn");
    btn.disabled = true;
    btn.textContent = "🧹 Nettoyage...";
    const result = await cleanGhostPlayers();
    btn.disabled = false;
    btn.textContent = "🧹 Nettoyer le classement (fantômes)";
    if (result.error) showToast("❌ Erreur : " + result.error);
    else if (result.removed === 0) showToast("✅ Aucun fantôme trouvé");
    else showToast(`✅ ${result.removed} entrée(s) supprimée(s)`);
});

$("#reset-save-btn").addEventListener("click", () => {
    if (!confirm("⚠️ Effacer toute la progression ? Irréversible.")) return;
    localStorage.removeItem(getSaveKey());
    const uid = state.uid;
    const username = state.username;
    if (uid && window.FB) {
        window.FB.set(window.FB.ref(window.FB.db, "saves/" + uid), null).catch(
            (e) => console.warn("Erreur reset cloud :", e),
        );
    }
    state = createDefaultState();
    state.uid = uid;
    state.username = username;
    lastRolledAura = null;
    saveGame(true);
    location.reload();
});

/* ---------- 9. AUDIO ---------- */

let audioCtx = null;
function playSound(type) {
    if (!state.settings.sound) return;
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            return;
        }
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    let freq = 440,
        dur = 0.1,
        waveType = "sine";

    if (type === "roll") {
        freq = 300;
        dur = 0.08;
    }
    if (type === "rare") {
        freq = 880;
        dur = 0.5;
    }
    if (type === "buy") {
        freq = 600;
        dur = 0.15;
    }
    if (type === "potion") {
        freq = 700;
        dur = 0.2;
    }
    if (type === "reveal-divine") {
        freq = 1200;
        dur = 1.2;
        waveType = "triangle";
    }
    if (type === "reveal-celestial") {
        freq = 1400;
        dur = 1.5;
        waveType = "sine";
    }
    if (type === "reveal-cosmic") {
        freq = 1600;
        dur = 1.8;
        waveType = "sawtooth";
    }
    if (type === "reveal-secret") {
        freq = 2000;
        dur = 2.5;
        waveType = "square";
    }

    osc.frequency.value = freq;
    osc.type = waveType;
    gain.gain.value = state.settings.volume * 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);

    if (type.startsWith("reveal-")) {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.value = freq * 1.5;
        osc2.type = "sine";
        gain2.gain.value = state.settings.volume * 0.1;
        gain2.gain.exponentialRampToValueAtTime(
            0.001,
            audioCtx.currentTime + dur,
        );
        osc2.start();
        osc2.stop(audioCtx.currentTime + dur);
    }
}

/* ---------- 10. INIT ---------- */

function init() {
    const raritySelect = $("#inv-filter-rarity");
    RARITIES.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r;
        opt.textContent = r;
        raritySelect.appendChild(opt);
    });

    showAuthModal(true);
    setAuthMode("login");

    setInterval(renderEffectsBar, 1000);

    window.addEventListener("beforeunload", () => {
        if (state.uid) {
            saveGame();
            flushCloudSave();
        }
    });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden" && state.uid)
            flushCloudSave();
    });

    if (!authInitialized) {
        authInitialized = true;
        initAuth();
    }

    // Démarre le tracker de temps dès qu'un utilisateur est connecté
    // (le tracker vérifie lui-même state.uid à chaque tick)
    startPlayTimeTracker();

    console.log("🎮 Aura RNG prêt !");
}

if (window.FB) {
    init();
} else {
    window.addEventListener("fb-ready", init, { once: true });
    setTimeout(() => {
        if (!authInitialized && window.FB) init();
    }, 500);
}
