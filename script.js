/* =========================================================
   AURA RNG — script.js
   v12 : Ban UID/IP + Wipe + Delete + Ban permanent + Verrou
         + Anti-scripts utilisateur + Bouton logout ban
   ========================================================= */

/* ---------- 0. ANTI-SCRIPTS UTILISATEUR (Tampermonkey, Violentmonkey) ---------- */
(function protectAgainstUserScripts() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes != null && mutation.addedNodes.length > 0) {
                for (const addedNode of mutation.addedNodes) {
                    if (
                        addedNode.innerHTML &&
                        addedNode.innerHTML.includes("==UserScript==")
                    ) {
                        console.warn(
                            "🚨 Script utilisateur détecté (signature) !",
                        );
                        blockUserScript(
                            "Injection de script utilisateur détectée",
                        );
                        return;
                    }
                    if (addedNode.tagName === "SCRIPT") {
                        const src = addedNode.src || "";
                        const text = addedNode.textContent || "";
                        if (
                            src.includes("tampermonkey") ||
                            src.includes("violentmonkey") ||
                            src.includes("greasemonkey") ||
                            text.includes("GM_setValue") ||
                            text.includes("GM_xmlhttpRequest") ||
                            text.includes("unsafeWindow")
                        ) {
                            console.warn(
                                "🚨 Script utilisateur détecté (balise) !",
                            );
                            blockUserScript("Script utilisateur détecté");
                            return;
                        }
                    }
                }
            }
        });
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });

    function checkGlobals() {
        const suspects = [
            "GM_info",
            "GM_setValue",
            "GM_getValue",
            "GM_xmlhttpRequest",
            "GM_addStyle",
            "unsafeWindow",
            "unsafeWindow_",
        ];
        for (const s of suspects) {
            if (typeof window[s] !== "undefined") {
                console.warn("🚨 Variable suspecte détectée :", s);
                blockUserScript("Gestionnaire de scripts détecté : " + s);
                return;
            }
        }
    }

    function checkToString() {
        try {
            const fn = function () {};
            if (!fn.toString().includes("function")) {
                console.warn("🚨 toString() altéré !");
                blockUserScript("Altération de toString détectée");
            }
        } catch (e) {}
    }

    setInterval(() => {
        checkGlobals();
        checkToString();
    }, 3000);
    checkGlobals();

    function blockUserScript(reason) {
        if (window.__auraUserScriptBlocked) return;
        window.__auraUserScriptBlocked = true;

        console.error("🛡️ Blocage :", reason);

        if (
            typeof triggerAutoBan === "function" &&
            window.state &&
            window.state.uid
        ) {
            try {
                triggerAutoBan("Script utilisateur détecté : " + reason);
            } catch (e) {}
        }

        const overlay = document.createElement("div");
        overlay.id = "userscript-blocked-overlay";
        overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      background: radial-gradient(circle at 50% 40%, #1a0000, #0a0000 70%);
      backdrop-filter: blur(20px);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-family: system-ui, sans-serif; text-align: center; padding: 20px;
    `;
        overlay.innerHTML = `
      <div style="max-width: 500px;">
        <div style="font-size: 80px; margin-bottom: 20px;">🚫</div>
        <h1 style="color: #f87171; font-size: 32px; margin-bottom: 16px;">Script détecté</h1>
        <p style="color: #fca5a5; font-size: 16px; line-height: 1.6;">
          Un script utilisateur (Tampermonkey, Violentmonkey, Greasemonkey...) a été détecté.<br><br>
          <strong>Désactive tes extensions de scripts</strong> puis recharge la page.
        </p>
        <p style="color: #fff; font-size: 13px; margin-top: 20px; opacity: 0.6;">
          Raison : ${reason}
        </p>
      </div>
    `;
        document.body.appendChild(overlay);

        document.body.style.pointerEvents = "none";
        overlay.style.pointerEvents = "all";
    }
})();

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
function auraColor(aura) {
    return aura.color || RARITY_COLORS[aura.rarity];
}
function auraWeight(aura) {
    if (!aura) return Infinity;
    if (aura.oneIn) return aura.oneIn;
    return TOTAL_WEIGHT / aura.weight;
}

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
const ANNOUNCE_RARITIES = ["mythic", "divine", "celestial", "cosmic", "secret"];

const AUTOROLL_PRICE_COINS = 1500;
const AUTOROLL_SECRET_UNLOCK_AT = 10;
const AUTOROLL_MIN_INTERVAL = 150;

const SAVE_KEY = "auraRng_save_v1";
const SAVE_VERSION = 1;
const FB_EMAIL_DOMAIN = "@aurarng.local";

const SKINS = [
    {
        id: "default",
        name: "Cosmique",
        desc: "Thème par défaut.",
        preview: "default",
        unlock: () => true,
        price: 0,
    },
    {
        id: "halloween",
        name: "Halloween",
        desc: "Orange et citrouilles.",
        preview: "halloween",
        unlock: () => (state.level || 1) >= 15,
        price: 50000,
    },
    {
        id: "christmas",
        name: "Noël",
        desc: "Vert et rouge.",
        preview: "christmas",
        unlock: () => new Date().getMonth() === 11,
        price: 50000,
    },
    {
        id: "cyberpunk",
        name: "Cyberpunk",
        desc: "Rose néon futuriste.",
        preview: "cyberpunk",
        unlock: () => (state.level || 1) >= 40,
        price: 200000,
    },
    {
        id: "sakura",
        name: "Sakura",
        desc: "Rose et cerisier.",
        preview: "sakura",
        unlock: () => new Date().getMonth() === 5,
        price: 100000,
    },
];

const SKILL_BRANCHES = [
    {
        id: "luck",
        icon: "🌿",
        name: "Chance",
        className: "skill-luck",
        desc: "Augmente ta chance.",
        benefits: [
            "+15% de chance permanente",
            "Potions durent 50% plus longtemps",
            "+2% sur divine+",
        ],
    },
    {
        id: "speed",
        icon: "⚡",
        name: "Vitesse",
        className: "skill-speed",
        desc: "Accélère les rolls.",
        benefits: [
            "Auto-roll 2x plus rapide",
            "Multi-roll x10 débloqué",
            "-20% de délai",
        ],
    },
    {
        id: "fortune",
        icon: "💰",
        name: "Fortune",
        className: "skill-fortune",
        desc: "Améliore les gains.",
        benefits: [
            "+40% de pièces par roll",
            "-25% sur les améliorations",
            "+5% de doubler",
        ],
    },
];
const SKILL_REQUIRED_LEVEL = 20;

const CHAT_BANNED_WORDS = [
    "connard",
    "connasse",
    "salaud",
    "salope",
    "pute",
    "enculé",
    "enculer",
    "fdp",
    "ntm",
    "nique",
    "baiser",
    "bordel",
    "merde",
    "pd",
    "tapette",
    "chier",
    "chiotte",
    "foutre",
    "bites",
    "bite",
    "couilles",
    "zob",
];
const CHAT_MAX_MESSAGES = 200;
const CHAT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
function filterChatText(text) {
    let filtered = text;
    CHAT_BANNED_WORDS.forEach((w) => {
        filtered = filtered.replace(new RegExp(w, "gi"), "*".repeat(w.length));
    });
    return filtered.slice(0, 200);
}

const FRIENDS_MAX_ACTIVITY_PER_PLAYER = 20;
const FRIENDS_ONLINE_WINDOW_MS = 5 * 60 * 1000;
const FRIENDS_SOCIAL_BONUS_PER_FRIEND = 0.01;
const FRIENDS_SOCIAL_BONUS_MAX = 10;

const XP_REWARDS = {
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
const MAX_LEVEL = 100;
function xpForLevel(n) {
    if (n <= 1) return 0;
    return Math.round((100 * n * (n - 1)) / 2);
}
function xpToNextLevel(n) {
    if (n >= MAX_LEVEL) return 0;
    return xpForLevel(n + 1) - xpForLevel(n);
}

const TITLES = [
    {
        id: "t_rookie",
        name: "Débutant",
        icon: "🌱",
        desc: "Bienvenue.",
        check: () => true,
    },
    {
        id: "t_passion",
        name: "Passionné",
        icon: "🔥",
        desc: "Niveau 10.",
        check: () => (state.level || 1) >= 10,
    },
    {
        id: "t_veteran",
        name: "Vétéran",
        icon: "👑",
        desc: "Niveau 30.",
        check: () => (state.level || 1) >= 30,
    },
    {
        id: "t_legend",
        name: "Légende",
        icon: "💎",
        desc: "Niveau 50.",
        check: () => (state.level || 1) >= 50,
    },
    {
        id: "t_supreme",
        name: "Maître Suprême",
        icon: "🌟",
        desc: "Niveau 100.",
        check: () => (state.level || 1) >= 100,
    },
    {
        id: "t_rollking",
        name: "Roi des Rolls",
        icon: "🎲",
        desc: "10 000 rolls.",
        check: () => (state.totalRolls || 0) >= 10000,
    },
    {
        id: "t_secret",
        name: "Chasseur de Secrets",
        icon: "🎯",
        desc: "1 secret.",
        check: () => hasRarity("secret"),
    },
    {
        id: "t_blessed",
        name: "Béni des Dieux",
        icon: "🍀",
        desc: "1 divine+.",
        check: () =>
            ["divine", "celestial", "cosmic", "secret"].some(hasRarity),
    },
    {
        id: "t_collector",
        name: "Le Collectionneur",
        icon: "📚",
        desc: "50% collection.",
        check: () => collectionPercent() >= 50,
    },
    {
        id: "t_master",
        name: "Maître Absolu",
        icon: "🏆",
        desc: "100% collection.",
        check: () => collectionPercent() >= 100,
    },
];
function hasRarity(rarity) {
    return AURAS.some((a) => a.rarity === rarity && state.discovered[a.id]);
}
function collectionPercent() {
    const total = AURAS.length;
    const found = Object.keys(state.discovered).length;
    return total > 0 ? (found / total) * 100 : 0;
}

const COMPLETE_COLLECTION_BONUSES = {
    common: 0.01,
    uncommon: 0.015,
    rare: 0.02,
    epic: 0.03,
    legendary: 0.04,
    mythic: 0.06,
    divine: 0.08,
    celestial: 0.1,
    cosmic: 0.15,
    secret: 0.25,
};
function isRarityComplete(rarity) {
    return AURAS.filter((a) => a.rarity === rarity).every(
        (a) => state.discovered[a.id],
    );
}
function getCompleteCollectionBonus() {
    let b = 0;
    RARITIES.forEach((r) => {
        if (isRarityComplete(r)) b += COMPLETE_COLLECTION_BONUSES[r] || 0;
    });
    return b;
}

const ADMIN_USERNAME = "ks_l9";
const CONSOLE_BAN_REASON = "Utilisation de la console détectée";
const BAN_DURATIONS = {
    first: 10 * 60 * 1000,
    second: 30 * 60 * 1000,
    third: 2 * 60 * 60 * 1000,
    fourth: 24 * 60 * 60 * 1000,
    fifth: 7 * 24 * 60 * 60 * 1000,
    permanent: 9999 * 365 * 24 * 60 * 60 * 1000,
};
const BAN_COUNT_KEY = "auraRng_banCount";

let isAdminUser = false;
let currentAdminTarget = null;
let banTimerInterval = null;
window.__auraBanLocked = false;
window.__auraBanUntil = 0;

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
        xp: 0,
        level: 1,
        equippedTitle: null,
        unlockedTitles: [],
        equippedSkin: "default",
        unlockedSkins: ["default"],
        skillBranch: null,
        adminLuckBonus: 0,
        settings: {
            sound: true,
            volume: 0.5,
            reduceAnim: false,
            hideCommon: false,
        },
    };
}

let state = createDefaultState();
let lastRolledAura = null;
let rollLock = false;
let autoRollActive = false;
let autoRollTimer = null;

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
        const curUid = state.uid,
            curName = state.username;
        state = Object.assign(createDefaultState(), parsed);
        state.uid = curUid;
        state.username = curName;
        state.settings = Object.assign(
            createDefaultState().settings,
            parsed.settings || {},
        );
    } catch (e) {}
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
        const curUid = state.uid,
            curName = state.username;
        state = Object.assign(createDefaultState(), parsed);
        state.uid = curUid;
        state.username = curName;
        state.settings = Object.assign(
            createDefaultState().settings,
            parsed.settings || {},
        );
        return true;
    } catch (e) {
        return false;
    }
}

let fbSaveTimer = null,
    fbSavePending = false;
function saveGame(skipCloud = false) {
    state._uid = state.uid;
    try {
        localStorage.setItem(getSaveKey(), JSON.stringify(state));
    } catch (e) {}
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
    set(ref(db, "saves/" + state.uid), payload).catch(() => {});
}
function flushCloudSave() {
    if (fbSavePending) {
        clearTimeout(fbSaveTimer);
        pushSaveToCloud();
    }
}

/* ---------- 3. ROLLS ---------- */

function getUpgradeLevel(id) {
    const up = UPGRADES.find((u) => u.id === id);
    const lvl = state.upgrades[id] || 0;
    return up ? Math.min(lvl, up.maxLevel) : lvl;
}
function getUpgradeCost(upgrade) {
    const level = getUpgradeLevel(upgrade.id);
    if (level >= upgrade.maxLevel) return null;
    let cost = upgrade.costs[level];
    if (state.skillBranch === "fortune") cost = Math.round(cost * 0.75);
    return cost;
}
function getUpgradeTotalEffect(upgrade, level) {
    return upgrade.effects.slice(0, level).reduce((a, b) => a + b, 0);
}
function getUpgradeEffect(effectType) {
    let t = 0;
    UPGRADES.forEach((up) => {
        if (up.effectType === effectType)
            t += getUpgradeTotalEffect(up, getUpgradeLevel(up.id));
    });
    return t;
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

function getSocialBonus() {
    const count = Math.min(
        Object.keys(state._following || {}).length,
        FRIENDS_SOCIAL_BONUS_MAX,
    );
    return count * FRIENDS_SOCIAL_BONUS_PER_FRIEND;
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
    bonus += getCompleteCollectionBonus();
    if (state.skillBranch === "luck") bonus += 0.15;
    bonus += getSocialBonus();
    if (state.adminLuckBonus) bonus += state.adminLuckBonus;
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
    const divineBonus = state.skillBranch === "luck" ? 1.02 : 1;
    const effective = AURAS.map((aura) => {
        const exponent = RARITY_INDEX[aura.rarity] / maxIdx;
        let w = aura.weight * Math.pow(luck, exponent);
        if (
            state.skillBranch === "luck" &&
            RARITY_INDEX[aura.rarity] >= RARITY_INDEX["divine"]
        )
            w *= divineBonus;
        return { aura, weight: w };
    });
    const total = effective.reduce((s, e) => s + e.weight, 0);
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

let __auraInternalWrite = false;
function performRoll() {
    const banOverlay = document.getElementById("ban-overlay");
    if (banOverlay && !banOverlay.classList.contains("hidden")) {
        showToast("🚫 Tu es banni.");
        return null;
    }

    if (window.__auraAntiTamper) {
        try {
            const check = window.__auraAntiTamper.rateCheck();
            if (!check.ok) {
                console.warn("AntiTamper:", check.reason);
                if (
                    window.__auraAntiTamper.violations &&
                    check.reason &&
                    check.reason.includes("Quarantaine")
                ) {
                    window.__auraAntiTamper.violations.reset();
                    console.info("🔓 Quarantaine levée automatiquement");
                }
            }
        } catch (e) {}
    }

    if (window.FB && state.uid) {
        window.FB.get(window.FB.ref(window.FB.db, "bans/" + state.uid))
            .then((snap) => {
                if (snap.exists()) {
                    const d = snap.val();
                    if (d.until && Date.now() < d.until)
                        showBanOverlay(d.until, d.reason || "Banni");
                }
            })
            .catch(() => {});
    }

    let aura = null;
    try {
        aura = pickAuraByWeight(getTotalLuckMultiplier());
    } catch (e) {
        console.error("pickAuraByWeight a crashé :", e);
    }

    if (!aura) {
        console.warn("⚠️ Fallback tirage manuel");
        const total = AURAS.reduce((s, a) => s + (a.weight || 1), 0);
        let r = Math.random() * total;
        for (const a of AURAS) {
            r -= a.weight || 1;
            if (r <= 0) {
                aura = a;
                break;
            }
        }
        if (!aura) aura = AURAS[AURAS.length - 1];
    }

    if (!aura) {
        console.error("❌ Aucune aura trouvée !");
        showToast("❌ Erreur de roll");
        return null;
    }

    try {
        registerAura(aura);
    } catch (e) {
        console.error("registerAura a crashé :", e);
        showToast("❌ Erreur registerAura");
        return null;
    }

    return aura;
}

function registerAura(aura) {
    __auraInternalWrite = true;
    state.totalRolls++;
    let doubleChance = getUpgradeEffect("double");
    if (state.skillBranch === "fortune") doubleChance += 0.05;
    const quantity = Math.random() < doubleChance ? 2 : 1;
    state.inventory[aura.id] = (state.inventory[aura.id] || 0) + quantity;
    state.discovered[aura.id] = true;
    if (quantity === 2) showToast("✨ Aura doublée !");
    const currentBest = state.bestAura ? AURA_BY_ID[state.bestAura] : null;
    if (!currentBest) {
        state.bestAura = aura.id;
    } else {
        const nR = RARITY_INDEX[aura.rarity],
            oR = RARITY_INDEX[currentBest.rarity];
        const nW = auraWeight(aura),
            oW = auraWeight(currentBest);
        if (
            nR > oR ||
            (nR === oR && nW > oW) ||
            (nR === oR && nW === oW && aura.id < currentBest.id)
        )
            state.bestAura = aura.id;
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
    const fortuneMult = state.skillBranch === "fortune" ? 1.4 : 1;
    state.coins += Math.round(
        (COIN_REWARDS[aura.rarity] || 1) *
            (1 + getUpgradeEffect("coins")) *
            fortuneMult,
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
    if (ANNOUNCE_RARITIES.includes(aura.rarity)) publishAnnouncement(aura);
    if (
        [
            "legendary",
            "mythic",
            "divine",
            "celestial",
            "cosmic",
            "secret",
        ].includes(aura.rarity)
    )
        publishActivity(aura);
    gainXP(XP_REWARDS[aura.rarity] || 1);
    if (state.totalRolls % 10 === 0) pushToLeaderboard();
    saveGame();
    __auraInternalWrite = false;
}

/* ---------- 4. XP / TITRES ---------- */

function gainXP(amount) {
    if (amount <= 0) return;
    if (!Number.isFinite(state.xp)) state.xp = 0;
    if (!Number.isFinite(state.level)) state.level = 1;
    if (state.level < 1) state.level = 1;
    if (state.level > MAX_LEVEL) state.level = MAX_LEVEL;
    state.xp = Math.max(0, state.xp + amount);
    let leveled = false;
    let safety = 0;
    while (
        state.level < MAX_LEVEL &&
        state.xp >= xpForLevel(state.level + 1) &&
        safety < 1000
    ) {
        state.level++;
        leveled = true;
        const reward = 50 * state.level;
        state.coins += reward;
        showToast(
            `🎉 Niveau ${state.level} atteint ! +${reward.toLocaleString("fr-FR")} 💰`,
        );
        safety++;
    }
    if (safety >= 1000) {
        state.xp = 0;
        console.warn("⚠️ Boucle XP interrompue (safety).");
    }
    TITLES.forEach((t) => {
        if (!state.unlockedTitles.includes(t.id) && t.check()) {
            state.unlockedTitles.push(t.id);
            if (!leveled) showToast(`🎖️ Titre débloqué : ${t.icon} ${t.name}`);
        }
    });
    if (leveled)
        setTimeout(() => {
            const b = document.getElementById("stat-level-badge");
            if (b) {
                b.classList.add("level-up-anim");
                setTimeout(() => b.classList.remove("level-up-anim"), 900);
            }
        }, 100);
}

function equipTitle(titleId) {
    if (!titleId) {
        state.equippedTitle = null;
        showToast("Titre retiré");
    } else {
        if (!state.unlockedTitles.includes(titleId)) {
            showToast("❌ Titre non débloqué.");
            return;
        }
        state.equippedTitle = titleId;
        const t = TITLES.find((x) => x.id === titleId);
        showToast(`🎖️ Titre équipé : ${t.icon} ${t.name}`);
    }
    saveGame();
    renderUI();
    renderTitles();
}

/* ---------- 5. UI ---------- */

const $ = (sel) => document.querySelector(sel);
let toastTimer = null;
function showToast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
}

function showReveal(aura) {
    const overlay = $("#reveal-overlay"),
        text = $("#reveal-text"),
        rarityTag = $("#reveal-rarity-tag"),
        chanceEl = $("#reveal-chance"),
        particlesBox = $("#reveal-particles");
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
    if (PARTICLE_RARITIES.includes(aura.rarity))
        spawnParticles(
            particlesBox,
            aura.rarity === "secret" ? 60 : 35,
            aura.rarity,
        );
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
        p.style.setProperty("--tx", Math.cos(angle) * distance + "px");
        p.style.setProperty("--ty", Math.sin(angle) * distance + "px");
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
        const r = Math.ceil((eff.endsAt - now) / 1000);
        const chip = document.createElement("div");
        chip.className = "effect-chip";
        chip.textContent = `${eff.name} (${r}s)`;
        bar.appendChild(chip);
    });
}

function renderBiomeBackground() {
    const biome = BIOMES.find((b) => b.id === state.currentBiome) || BIOMES[0];
    $("#background-layer").className = biome.className;
    startBiomeParticles();
}

function renderUI() {
    animateNumber($("#stat-rolls"), state.totalRolls);
    animateNumber($("#stat-coins"), state.coins);
    $("#stat-luck").textContent = "x" + getTotalLuckMultiplier().toFixed(2);
    $("#stat-best").textContent = state.bestAura
        ? AURA_BY_ID[state.bestAura].name
        : "Aucune";
    $("#stat-username").textContent = state.username || "—";
    const sb = document.getElementById("stat-social-bonus");
    if (sb) sb.textContent = "+" + (getSocialBonus() * 100).toFixed(0) + "%";
    const levelBadge = document.getElementById("stat-level-badge"),
        levelNum = document.getElementById("stat-level");
    if (levelBadge && levelNum) {
        if (state.uid) {
            levelBadge.classList.remove("hidden");
            levelNum.textContent = state.level || 1;
        } else levelBadge.classList.add("hidden");
    }
    const titleBadge = document.getElementById("stat-title");
    if (titleBadge) {
        if (state.equippedTitle) {
            const t = TITLES.find((x) => x.id === state.equippedTitle);
            if (t) {
                titleBadge.classList.remove("hidden");
                titleBadge.textContent = `${t.icon} ${t.name}`;
            } else titleBadge.classList.add("hidden");
        } else titleBadge.classList.add("hidden");
    }
    renderXPBar();
    if (lastRolledAura) displayAura(lastRolledAura);
    else if (state.equipped && AURA_BY_ID[state.equipped])
        displayAura(AURA_BY_ID[state.equipped]);
    else {
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

    const rollBtn = document.getElementById("roll-btn");
    if (rollBtn) {
        const isBannedLocked =
            window.__auraBanLocked && Date.now() < window.__auraBanUntil;
        const isBannedVisible = !document
            .getElementById("ban-overlay")
            .classList.contains("hidden");
        const isFrozen = document.body.classList.contains("is-frozen");
        if (
            !isBannedLocked &&
            !isBannedVisible &&
            !isFrozen &&
            !rollLock &&
            !autoRollActive
        ) {
            rollBtn.disabled = false;
        }
        if (isBannedLocked) {
            const overlay = document.getElementById("ban-overlay");
            if (overlay && overlay.classList.contains("hidden"))
                overlay.classList.remove("hidden");
            rollBtn.disabled = true;
        }
    }
}

function renderXPBar() {
    const container = document.getElementById("xp-bar-container"),
        fill = document.getElementById("xp-bar-fill"),
        text = document.getElementById("xp-bar-text");
    if (!container || !fill || !text) return;
    if (!state.uid) {
        container.classList.add("hidden");
        return;
    }
    container.classList.remove("hidden");
    const level = Math.max(1, Math.min(MAX_LEVEL, state.level || 1));
    if (level >= MAX_LEVEL) {
        fill.style.width = "100%";
        text.textContent = `Niveau max (${MAX_LEVEL})`;
        return;
    }
    const floorXP = xpForLevel(level);
    let xpThisLevel = (state.xp || 0) - floorXP;
    const xpNeeded = xpToNextLevel(level);
    if (!Number.isFinite(xpThisLevel) || xpThisLevel < 0) xpThisLevel = 0;
    if (xpThisLevel > xpNeeded) xpThisLevel = xpNeeded;
    const pct =
        xpNeeded > 0
            ? Math.max(0, Math.min(100, (xpThisLevel / xpNeeded) * 100))
            : 0;
    fill.style.width = pct.toFixed(1) + "%";
    text.textContent = `${xpThisLevel.toLocaleString("fr-FR")} / ${xpNeeded.toLocaleString("fr-FR")} XP`;
}

function renderTitles() {
    const grid = document.getElementById("titles-grid");
    if (!grid) return;
    grid.innerHTML = "";
    TITLES.forEach((t) => {
        if (!state.unlockedTitles.includes(t.id) && t.check())
            state.unlockedTitles.push(t.id);
    });
    TITLES.forEach((t) => {
        const unlocked = state.unlockedTitles.includes(t.id),
            equipped = state.equippedTitle === t.id;
        const card = document.createElement("div");
        card.className =
            "title-card" +
            (unlocked ? "" : " locked") +
            (equipped ? " equipped" : "");
        card.innerHTML = `<div class="title-icon">${t.icon}</div><div class="title-name">${t.name}</div><div class="title-desc">${unlocked ? t.desc : "🔒 " + t.desc}</div>`;
        if (unlocked)
            card.addEventListener("click", () => {
                if (equipped) equipTitle(null);
                else equipTitle(t.id);
            });
        grid.appendChild(card);
    });
}

function renderSkins() {
    const grid = document.getElementById("skins-grid");
    if (!grid) return;
    grid.innerHTML = "";
    SKINS.forEach((skin) => {
        const unlocked = state.unlockedSkins.includes(skin.id),
            equipped = state.equippedSkin === skin.id;
        const canUnlock = !unlocked && skin.unlock(),
            canBuy = !unlocked && state.coins >= skin.price;
        const card = document.createElement("div");
        card.className =
            "skin-card" +
            (unlocked ? "" : " locked") +
            (equipped ? " equipped" : "");
        card.innerHTML = `<div class="skin-preview skin-preview-${skin.preview}"></div><div class="skin-name">${skin.name}</div><div class="skin-desc">${skin.desc}</div>${!unlocked ? `<div class="skin-price">💰 ${skin.price.toLocaleString("fr-FR")}</div>` : ""}`;
        if (unlocked)
            card.addEventListener("click", () => {
                state.equippedSkin = skin.id;
                applySkin(skin.id);
                saveGame();
                renderSkins();
                renderUI();
                showToast(`🎨 Skin équipé : ${skin.name}`);
            });
        else
            card.addEventListener("click", () => {
                if (canUnlock) {
                    state.unlockedSkins.push(skin.id);
                    state.equippedSkin = skin.id;
                    applySkin(skin.id);
                    saveGame();
                    renderSkins();
                    renderUI();
                    showToast(`🎨 Skin débloqué : ${skin.name}`);
                } else if (canBuy) {
                    state.coins -= skin.price;
                    state.unlockedSkins.push(skin.id);
                    state.equippedSkin = skin.id;
                    applySkin(skin.id);
                    saveGame();
                    renderSkins();
                    renderUI();
                    showToast(`🎨 Skin acheté : ${skin.name}`);
                } else showToast("🔒 Pas encore débloqué.");
            });
        grid.appendChild(card);
    });
}
function applySkin(skinId) {
    if (!skinId || skinId === "default")
        document.body.removeAttribute("data-skin");
    else document.body.setAttribute("data-skin", skinId);
}

function renderSkills() {
    const grid = document.getElementById("skills-grid"),
        status = document.getElementById("skills-status");
    if (!grid || !status) return;
    const level = state.level || 1,
        alreadyChosen = !!state.skillBranch;
    if (alreadyChosen) {
        status.textContent = "✅ Choix effectué.";
        status.style.color = "#4ade80";
    } else if (level < SKILL_REQUIRED_LEVEL) {
        status.textContent = `🔒 Débloqué au niveau ${SKILL_REQUIRED_LEVEL} (tu es niveau ${level}).`;
        status.style.color = "";
    } else {
        status.textContent = "⚠️ Choisis UNE branche. Définitif.";
        status.style.color = "#fbbf24";
    }
    grid.innerHTML = "";
    SKILL_BRANCHES.forEach((b) => {
        const chosen = state.skillBranch === b.id,
            locked = alreadyChosen && !chosen;
        const canChoose = !alreadyChosen && level >= SKILL_REQUIRED_LEVEL;
        const card = document.createElement("div");
        card.className =
            "skill-card " +
            b.className +
            (chosen ? " chosen" : "") +
            (locked ? " unavailable" : "") +
            (!canChoose && !chosen ? " locked" : "");
        card.innerHTML = `<div class="skill-icon">${b.icon}</div><div class="skill-title">${b.name}</div><div class="skin-desc">${b.desc}</div><ul class="skill-benefits">${b.benefits.map((x) => `<li>${x}</li>`).join("")}</ul>`;
        if (canChoose)
            card.addEventListener("click", () => {
                if (alreadyChosen) return;
                if (!confirm(`Choisir "${b.name}" ? DÉFINITIF.`)) return;
                state.skillBranch = b.id;
                saveGame();
                renderSkills();
                renderUI();
                showToast(`🌳 Branche choisie : ${b.icon} ${b.name}`);
            });
        grid.appendChild(card);
    });
}

/* ---------- 6. INVENTAIRE / BOUTIQUE / CRAFT / BIOMES / UPGRADES / STATS ---------- */

function renderInventory() {
    const grid = $("#inventory-grid");
    grid.innerHTML = "";
    const search = $("#inv-search").value.toLowerCase(),
        filterR = $("#inv-filter-rarity").value,
        sortBy = $("#inv-sort").value,
        showLocked = $("#inv-show-locked").checked;
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
        card.innerHTML = `<div style="color:${auraColor(aura)}; font-size:24px;">◆</div><div class="card-name">${owned ? aura.name : "???"}</div><span class="rarity-tag tag-${aura.rarity}">${aura.rarity}</span><div class="card-info">${owned ? "x" + state.inventory[aura.id] : "Non découverte"}</div>${owned ? `<div class="card-desc">${formatChance(aura)}</div>` : ""}`;
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
        card.innerHTML = `<div class="card-name">${p.name}</div><div class="card-desc">${p.desc}</div><div class="card-info">💰 ${realPrice}${discount > 0 ? ` <s style="opacity:.5">${p.price}</s>` : ""}</div><div class="card-info">Possédé : ${state.ownedItems[p.id] || 0}</div><button class="small-btn" style="margin-top:8px;">Acheter</button><button class="small-btn" style="margin-top:6px;">Utiliser</button>`;
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
        card.innerHTML = `<div class="card-name">${item.name}</div><div class="card-desc">${item.desc}</div><div class="card-info">💰 ${item.price} — possédé : ${state.ownedItems[item.id] || 0}</div><button class="small-btn" style="margin-top:8px;">Acheter</button>`;
        card.querySelector("button").addEventListener("click", () =>
            buyItem(item),
        );
        grid.appendChild(card);
    });
}
function buyItem(item) {
    if (item.perm && (state.ownedItems[item.id] || 0) > 0) {
        showToast("✅ Déjà possédé.");
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
    const durationMult = state.skillBranch === "luck" ? 1.5 : 1;
    state.activeEffects.push({
        id: potion.id,
        name: potion.name,
        bonus: potion.bonus || null,
        speed: potion.speed || null,
        endsAt: Date.now() + potion.duration * 1000 * durationMult,
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
        div.innerHTML = `<div class="card-name">${findItemName(r.result.id)}</div><div class="card-desc">${r.desc}</div><div style="margin-top:8px; font-size:12px;">${ingredientsHTML}</div><button class="small-btn" style="margin-top:8px;" ${canCraft ? "" : "disabled"}>${canCraft ? "Fabriquer" : "Ressources insuffisantes"}</button>`;
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
        showToast("✅ Déjà possédé.");
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
        div.innerHTML = `<div class="card-name">${unlocked ? b.name : "🔒 " + b.name}</div><div class="card-desc">${b.desc}</div><div class="card-info">Bonus chance permanent : +${Math.round((b.luckBonus - 1) * 100)} %</div><button class="small-btn" style="margin-top:8px;" ${unlocked ? "" : "disabled"}>${state.currentBiome === b.id ? "Actif" : unlocked ? "Activer" : "Verrouillé"}</button>`;
        if (unlocked)
            div.querySelector("button").addEventListener("click", () => {
                state.currentBiome = b.id;
                saveGame();
                renderUI();
                renderBiomes();
                showToast(`🌍 Biome actif : ${b.name}`);
            });
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
        const level = getUpgradeLevel(up.id),
            maxed = level >= up.maxLevel,
            cost = getUpgradeCost(up);
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
        card.innerHTML = `<div class="upgrade-info"><div class="upgrade-name">${up.name}</div><div class="upgrade-desc">${up.desc}</div><div class="upgrade-level">Niveau : ${level} / ${up.maxLevel}</div><div class="upgrade-effect">${effectText}</div></div><button ${maxed ? "disabled" : ""}>${maxed ? "MAX" : "💰 " + cost.toLocaleString("fr-FR")}</button>`;
        if (!maxed)
            card.querySelector("button").addEventListener("click", () =>
                buyUpgrade(up),
            );
        list.appendChild(card);
    });
}

function renderStats() {
    const discovered = Object.keys(state.discovered).length,
        pct = Math.round((discovered / AURAS.length) * 100);
    const bestAura = state.bestAura ? AURA_BY_ID[state.bestAura] : null;
    const byRarity = {};
    RARITIES.forEach((r) => (byRarity[r] = 0));
    Object.keys(state.discovered).forEach((id) => {
        const a = AURA_BY_ID[id];
        if (a) byRarity[a.rarity]++;
    });
    const totalByRarity = {};
    RARITIES.forEach((r) => (totalByRarity[r] = 0));
    AURAS.forEach((a) => totalByRarity[a.rarity]++);
    const minutes = Math.floor(state.playTime / 60);
    const totalUpgradeLevels = UPGRADES.reduce(
        (sum, up) => sum + getUpgradeLevel(up.id),
        0,
    );
    const permBonus = getPermanentLuckBonus(),
        tempMult = getTemporaryLuckMultiplier(),
        totalLuck = getTotalLuckMultiplier();
    const level = state.level || 1,
        xpThis = state.xp - xpForLevel(level),
        xpNext = xpToNextLevel(level);
    const levelLine =
        level >= MAX_LEVEL
            ? `<p>🎖️ Niveau : ${level} (MAX)</p>`
            : `<p>🎖️ Niveau : ${level} — ${xpThis.toLocaleString("fr-FR")} / ${xpNext.toLocaleString("fr-FR")} XP</p>`;
    const titleLine = state.equippedTitle
        ? (() => {
              const t = TITLES.find((x) => x.id === state.equippedTitle);
              return t ? `<p>🎖️ Titre : ${t.icon} ${t.name}</p>` : "";
          })()
        : "";
    const skillLine = state.skillBranch
        ? (() => {
              const b = SKILL_BRANCHES.find((x) => x.id === state.skillBranch);
              return b ? `<p>🌳 Branche : ${b.icon} ${b.name}</p>` : "";
          })()
        : "";
    const socialBonus = getSocialBonus();
    $("#stats-content").innerHTML = `
    <p>🎲 Rolls : ${state.totalRolls.toLocaleString("fr-FR")}</p>
    <p>🔍 Auras : ${discovered} / ${AURAS.length}</p>
    <p>⭐ Meilleure : ${bestAura ? bestAura.name + " (" + bestAura.rarity + ")" : "Aucune"}</p>
    <p>🎯 Depuis rare : ${state.rollsSinceRare}</p>
    <p>⏱️ Temps : ${minutes} min</p>
    <p>💰 Monnaie : ${state.coins.toLocaleString("fr-FR")}</p>
    <p>🧪 Potions : ${state.usedPotions}</p>
    <p>🔨 Crafts : ${state.craftedItems}</p>
    <p>⭐ Améliorations : ${totalUpgradeLevels}</p>
    <p>🤖 Auto Roll : ${state.autoRollUnlocked ? "✅" : "❌"}</p>
    <p>♾️ Chance permanente : +${(permBonus * 100).toFixed(1)}%</p>
    <p>👥 Bonus social : +${(socialBonus * 100).toFixed(1)}%</p>
    <p>⏳ Chance temporaire : +${((tempMult - 1) * 100).toFixed(0)}%</p>
    <p>🍀 Chance totale : x${totalLuck.toFixed(2)} (plafond x${LUCK_HARD_CAP.toFixed(2)})</p>
    <p>👤 ${state.username || "—"}</p>
    ${levelLine}${titleLine}${skillLine}
    <p>📊 Collection : ${pct}%</p>
    <hr style="margin:10px 0; opacity:.2;" /><h3>Répartition</h3>
    ${RARITIES.map((r) => `<p>${r} : ${byRarity[r]} / ${totalByRarity[r]}</p>`).join("")}
    <hr style="margin:10px 0; opacity:.2;" /><h3>Collections complètes</h3>
    <div class="collections-section">${RARITIES.map((r) => {
        const found = byRarity[r],
            total = totalByRarity[r],
            complete = isRarityComplete(r),
            bonus = COMPLETE_COLLECTION_BONUSES[r] || 0;
        const bonusText = complete
            ? `✅ +${(bonus * 100).toFixed(1)}% active`
            : `+${(bonus * 100).toFixed(1)}% si complète`;
        return `<div class="collection-row ${complete ? "complete" : ""}"><span class="col-rarity">${r}</span><span class="col-progress">${found} / ${total}</span><span class="col-bonus">${bonusText}</span></div>`;
    }).join("")}</div>`;
}
/* ---------- 7. AUTH + LEADERBOARD ---------- */

let authMode = "login";
let authInitialized = false;
let leaderboardInterval = null,
    leaderboardRefreshInterval = null,
    currentLeaderboardTab = "bestAura";
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
    document
        .querySelectorAll(".auth-tab")
        .forEach((t) => t.classList.toggle("active", t.dataset.auth === mode));
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
    const username = document.getElementById("auth-username").value.trim(),
        password = document.getElementById("auth-password").value;
    const errorEl = document.getElementById("auth-error"),
        submitBtn = document.getElementById("auth-submit");
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
            // ✅ Vérifie si le pseudo a déjà été supprimé
            const deletedCheck = await checkPseudoDeleted(username);
            if (deletedCheck) {
                errorEl.textContent =
                    "🚫 Ce pseudo a été supprimé définitivement. Choisis-en un autre.";
                return;
            }

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
            } catch (e) {}
            try {
                await FB.updateProfile(user, { displayName: username });
            } catch (e) {}
        } else {
            // ✅ Vérifie si le compte a été supprimé AVANT de connecter
            const deletedCheck = await checkPseudoDeleted(username);
            if (deletedCheck) {
                errorEl.textContent =
                    "🚫 Ce compte a été supprimé définitivement. Tu ne peux plus te connecter.";
                return;
            }
            await FB.signInWithEmailAndPassword(FB.auth, email, password);
        }
    } catch (e) {
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

/* ✅ Vérifie si un pseudo a été marqué comme supprimé */
async function checkPseudoDeleted(username) {
    if (!window.FB) return false;
    try {
        // 1. Cherche dans /deleted_usernames/
        const delSnap = await window.FB.get(
            window.FB.ref(
                window.FB.db,
                "deleted_usernames/" + username.toLowerCase(),
            ),
        );
        if (delSnap.exists()) return true;

        // 2. Cherche dans /deleted/ par nom
        const allDeleted = await window.FB.get(
            window.FB.ref(window.FB.db, "deleted"),
        );
        if (allDeleted.exists()) {
            let found = false;
            allDeleted.forEach((child) => {
                const val = child.val();
                if (
                    val &&
                    val.name &&
                    val.name.toLowerCase() === username.toLowerCase()
                ) {
                    found = true;
                }
            });
            if (found) return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

async function handleLogout() {
    if (!window.FB) return;
    if (!confirm("Se déconnecter ?")) return;
    try {
        flushPlayTime();
        await window.FB.signOut(window.FB.auth);
        location.reload();
    } catch (e) {}
}

async function resolveUsername(user) {
    let username = localStorage.getItem(pseudoKeyFor(user.uid));
    if (!username) {
        const pending = localStorage.getItem(LS_PENDING_PSEUDO);
        if (pending) username = pending;
    }
    if (!username && user.displayName) username = user.displayName;
    if (!username)
        for (let i = 0; i < 3; i++) {
            try {
                const snap = await window.FB.get(
                    window.FB.ref(window.FB.db, "usernames"),
                );
                if (snap.exists())
                    snap.forEach((c) => {
                        if (c.val().uid === user.uid) username = c.key;
                    });
                if (username) break;
            } catch (e) {}
            await new Promise((r) => setTimeout(r, 400));
        }
    if (!username) username = "Joueur";
    localStorage.setItem(pseudoKeyFor(user.uid), username);
    return username;
}

/* =========================================================
   SYNC TEMPS RÉEL
   ========================================================= */

let realtimeSyncStarted = false;
let realtimeBanListener = null;
let realtimeFreezeListener = null;
let realtimeSaveListener = null;
let realtimePlayerListener = null;
let realtimeKickListener = null;
let realtimeDeletedListener = null;

function startRealtimeSync() {
    if (!window.FB || !state.uid || realtimeSyncStarted) return;
    realtimeSyncStarted = true;

    const { db, ref, onValue } = window.FB;

    // 1. BAN
    const banRef = ref(db, "bans/" + state.uid);
    realtimeBanListener = onValue(banRef, (snap) => {
        const overlay = document.getElementById("ban-overlay");
        if (snap.exists()) {
            const d = snap.val();
            if (d.until && Date.now() < d.until) {
                showBanOverlay(
                    d.until,
                    d.reason || "Banni par un administrateur",
                );
                if (autoRollActive) toggleAutoRoll();
                return;
            }
        }
        console.info("🔓 Ban supprimé du serveur → levée du verrou");
        window.__auraBanLocked = false;
        window.__auraBanUntil = 0;
        try {
            localStorage.removeItem("auraRng_localBan");
        } catch (e) {}
        clearInterval(banTimerInterval);
        if (overlay) {
            overlay.classList.add("hidden");
            delete overlay.dataset.activeUntil;
        }
        const rb = document.getElementById("roll-btn");
        if (rb) rb.disabled = false;
        const ab = document.getElementById("auto-roll-btn");
        if (ab) ab.disabled = false;
    });

    // 2. FREEZE
    const freezeRef = ref(db, "frozen/" + state.uid);
    realtimeFreezeListener = onValue(freezeRef, (snap) => {
        const frozen = snap.exists() && snap.val() === true;
        document.body.classList.toggle("is-frozen", frozen);
        if (frozen) {
            if (autoRollActive) toggleAutoRoll();
            showToast("🧊 Ton compte a été gelé par un administrateur.");
        } else {
            showToast("🔥 Ton compte n'est plus gelé.");
        }
    });

    // 3. DELETED (compte supprimé)
    const deletedRef = ref(db, "deleted/" + state.uid);
    realtimeDeletedListener = onValue(deletedRef, (snap) => {
        if (snap.exists()) {
            showDeletedOverlay(snap.val());
        }
    });

    // 4. SAVE
    const saveRef = ref(db, "saves/" + state.uid);
    let firstSaveLoad = true;
    realtimeSaveListener = onValue(saveRef, (snap) => {
        if (!snap.exists()) return;
        const cloud = snap.val();
        if (!cloud) return;
        if (firstSaveLoad) {
            firstSaveLoad = false;
            return;
        }

        const wasWiped =
            cloud.totalRolls === 0 &&
            cloud.coins === 0 &&
            (state.totalRolls > 0 || state.coins > 0) &&
            Object.keys(cloud.inventory || {}).length === 0;
        if (wasWiped) {
            console.info("🗑️ Wipe détecté par le serveur → reset local");
            const curUid = state.uid,
                curName = state.username;
            state = Object.assign(createDefaultState(), cloud);
            state.uid = curUid;
            state.username = curName;
            state.settings = Object.assign(
                createDefaultState().settings,
                cloud.settings || {},
            );
            lastRolledAura = null;
            renderUI();
            try {
                localStorage.setItem(getSaveKey(), JSON.stringify(state));
            } catch (e) {}
            showToast("🗑️ Tes stats ont été effacées par un admin.");
            return;
        }

        let changed = false;
        if (typeof cloud.coins === "number" && cloud.coins !== state.coins) {
            const diff = cloud.coins - state.coins;
            state.coins = cloud.coins;
            changed = true;
            if (diff > 0)
                showToast(
                    `💰 +${diff.toLocaleString("fr-FR")} pièces reçues !`,
                );
            else if (diff < 0)
                showToast(
                    `💰 ${Math.abs(diff).toLocaleString("fr-FR")} pièces retirées.`,
                );
        }
        if (
            typeof cloud.totalRolls === "number" &&
            cloud.totalRolls !== state.totalRolls
        ) {
            const diff = cloud.totalRolls - state.totalRolls;
            state.totalRolls = cloud.totalRolls;
            changed = true;
            if (diff < 0) showToast(`🎲 ${Math.abs(diff)} rolls retirés.`);
        }
        if (
            typeof cloud.adminLuckBonus === "number" &&
            cloud.adminLuckBonus !== state.adminLuckBonus
        ) {
            state.adminLuckBonus = cloud.adminLuckBonus;
            changed = true;
            showToast(
                `🍀 Bonus de chance admin appliqué : +${(cloud.adminLuckBonus * 100).toFixed(1)}%`,
            );
        }
        if (cloud.inventory && typeof cloud.inventory === "object") {
            const localKeys = Object.keys(state.inventory);
            for (const key of localKeys) {
                if (state.inventory[key] > 0 && !cloud.inventory[key]) {
                    state.inventory[key] = 0;
                    const aura = AURA_BY_ID[key];
                    if (aura)
                        showToast(
                            `✦ L'aura [${aura.name}] t'a été retirée par un admin.`,
                        );
                    changed = true;
                }
            }
        }
        if (changed) {
            renderUI();
            try {
                localStorage.setItem(getSaveKey(), JSON.stringify(state));
            } catch (e) {}
        }
    });

    // 5. PLAYER
    const playerRef = ref(db, "players/" + state.uid);
    let firstPlayerLoad = true;
    realtimePlayerListener = onValue(playerRef, (snap) => {
        if (!snap.exists()) return;
        const cloud = snap.val();
        if (!cloud) return;
        if (firstPlayerLoad) {
            firstPlayerLoad = false;
            return;
        }
        if (typeof cloud.level === "number" && cloud.level !== state.level) {
            state.level = cloud.level;
            renderUI();
            showToast(`🎖️ Niveau mis à jour : ${cloud.level}`);
        }
    });

    // 6. KICK
    const kickRef = ref(db, "kicked/" + state.uid);
    realtimeKickListener = onValue(kickRef, (snap) => {
        if (snap.exists()) {
            const d = snap.val();
            if (d.ts && Date.now() - d.ts < 10000) {
                console.warn("🚫 Tu as été kické !");
                const until = d.until || Date.now() + 60000;
                const reason = d.reason || "Banni par un administrateur";
                showBanOverlay(until, reason);
                if (autoRollActive) toggleAutoRoll();
                if (rollLock) rollLock = false;
                document.querySelectorAll("button").forEach((b) => {
                    if (
                        b.id !== "payment-error-close" &&
                        b.id !== "logout-btn" &&
                        b.id !== "ban-logout-btn"
                    )
                        b.disabled = true;
                });
            }
        }
    });

    console.log("⚡ Sync temps réel activée");
}

function stopRealtimeSync() {
    if (!window.FB) return;
    const { db, ref, off } = window.FB;
    if (realtimeBanListener) {
        off(ref(db, "bans/" + state.uid));
        realtimeBanListener = null;
    }
    if (realtimeFreezeListener) {
        off(ref(db, "frozen/" + state.uid));
        realtimeFreezeListener = null;
    }
    if (realtimeSaveListener) {
        off(ref(db, "saves/" + state.uid));
        realtimeSaveListener = null;
    }
    if (realtimePlayerListener) {
        off(ref(db, "players/" + state.uid));
        realtimePlayerListener = null;
    }
    if (realtimeKickListener) {
        off(ref(db, "kicked/" + state.uid));
        realtimeKickListener = null;
    }
    if (realtimeDeletedListener) {
        off(ref(db, "deleted/" + state.uid));
        realtimeDeletedListener = null;
    }
    realtimeSyncStarted = false;
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
            showAuthLoading(true, "Chargement...");
            if (window.__auraOriginalConsole) {
                const o = window.__auraOriginalConsole;
                console.log = o.log;
                console.warn = o.warn;
                console.error = o.error;
            }
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
                )
                    pushSaveToCloud();
            }
            state.uid = user.uid;
            state.username = username;
            state._uid = user.uid;
            state._connectedAt = Date.now();
            if (!Array.isArray(state.unlockedTitles)) state.unlockedTitles = [];
            if (!Number.isFinite(state.level) || state.level < 1)
                state.level = 1;
            if (state.level > MAX_LEVEL) state.level = MAX_LEVEL;
            if (!Number.isFinite(state.xp) || state.xp < 0) state.xp = 0;
            const minXP = xpForLevel(state.level);
            if (state.xp < minXP) state.xp = minXP;
            const maxXP =
                state.level < MAX_LEVEL
                    ? xpForLevel(state.level + 1) - 1
                    : Infinity;
            if (state.xp > maxXP) state.xp = minXP;
            console.log("🎖️ Niveau/XP corrigés :", state.level, state.xp);
            if (!Array.isArray(state.unlockedSkins))
                state.unlockedSkins = ["default"];
            if (!state.equippedSkin) state.equippedSkin = "default";
            TITLES.forEach((t) => {
                if (!state.unlockedTitles.includes(t.id) && t.check())
                    state.unlockedTitles.push(t.id);
            });
            applySkin(state.equippedSkin);
            document.getElementById("stat-username").textContent =
                state.username;
            showAuthLoading(false);
            showAuthModal(false);
            renderUI();
            pushToLeaderboard();
            initLeaderboard();
            startAnnouncementsListener();
            startChatListener();
            await loadFriendsLists();
            renderFriendsStats();
            updateSocialBonus();
            startFriendsActivityListener();
            localStorage.removeItem(LS_PENDING_PSEUDO);

            setTimeout(() => {
                if (!window.__auraConsoleHooked) detectConsoleInput();
            }, 2000);
            postLoginChecks();
            setTimeout(() => startRealtimeSync(), 1500);
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
            stopBiomeParticles();
            stopRealtimeSync();
        }
    });
}

function getPlayerName() {
    return state.username;
}

function pushToLeaderboard() {
    const name = getPlayerName(),
        uid = state.uid;
    if (!name || !uid || !window.FB) return;
    const { db, ref, update } = window.FB;
    const playerRef = ref(db, "players/" + uid);
    const bestAura = state.bestAura ? AURA_BY_ID[state.bestAura] : null;
    let bestAuraScore = 0,
        bestAuraName = "Aucune",
        bestAuraRarity = "none",
        bestAuraWeight = 0,
        bestAuraChance = "—";
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
        level: state.level || 1,
        xp: state.xp || 0,
        updatedAt: Date.now(),
    }).catch(() => {});
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
    const q = query(ref(db, "players"), orderByChild(config), limitToLast(20));
    get(q)
        .then((snap) => {
            const results = [];
            snap.forEach((child) => {
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
            const msg =
                e.code === "PERMISSION_DENIED"
                    ? "Accès refusé."
                    : e.message || "Erreur.";
            callback({ players: [], error: msg });
        });
}

function renderLeaderboard(type, silent = false) {
    const container = $("#lb-content"),
        status = $("#lb-status");
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
            status.textContent = "Aucun joueur.";
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
        status.textContent = `Top ${players.length} · actualisé à ${timeStr}`;
        container.innerHTML = "";
        players.forEach((p, index) => {
            const rank = index + 1,
                isMe = myName && p.name === myName;
            let displayValue = "",
                subValue = "",
                valueColor = "#4ade80";
            if (type === "bestAura") {
                displayValue = p.bestAuraName || "Aucune";
                subValue =
                    p.bestAuraChance && p.bestAuraChance !== "—"
                        ? p.bestAuraChance
                        : (p.bestAuraRarity || "").toUpperCase();
                valueColor = RARITY_COLORS[p.bestAuraRarity] || "#4ade80";
            } else if (type === "totalRolls")
                displayValue =
                    (p.totalRolls || 0).toLocaleString("fr-FR") + " rolls";
            else if (type === "playTime")
                displayValue =
                    Math.floor((p.playTime || 0) / 60).toLocaleString("fr-FR") +
                    " min";
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
            row.innerHTML = `<div class="lb-rank${rankClass}">${rank}</div><div class="lb-name">${p.name || "Anonyme"}${isMe ? ' <span style="opacity:.6">(toi)</span>' : ""}${subValue ? `<span class="lb-sub" style="color:${valueColor}">${subValue}</span>` : ""}</div><div class="lb-value" style="color:${valueColor}">${displayValue}</div>`;
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
        if (modal && !modal.classList.contains("hidden") && getPlayerName())
            renderLeaderboard(currentLeaderboardTab, true);
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
            )
                deletions.push(remove(ref(db, "players/" + uid)));
        });
        if (deletions.length > 0) await Promise.all(deletions);
        return { removed: deletions.length };
    } catch (e) {
        return { removed: 0, error: e.message };
    }
}

/* ---------- 8. PLAYTIME ---------- */

const TAB_ID = Math.random().toString(36).slice(2, 10);
const TAB_HEARTBEAT_KEY = "auraRng_activeTab";
const TAB_HEARTBEAT_INTERVAL = 5000,
    TAB_STALE_MS = 10000;
let playTimeTickInterval = null,
    heartbeatInterval = null,
    lastTickAt = 0,
    isPrimaryTab = false,
    tabChannel = null;

function startPlayTimeTracker() {
    try {
        if ("BroadcastChannel" in window)
            tabChannel = new BroadcastChannel("auraRng_tabs");
    } catch (e) {
        tabChannel = null;
    }
    electPrimaryTab();
    if (tabChannel)
        tabChannel.onmessage = (ev) => {
            if (!ev.data) return;
            if (ev.data.type === "iam_primary" && ev.data.tabId !== TAB_ID)
                isPrimaryTab = false;
        };
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            lastTickAt = Date.now();
            electPrimaryTab();
        } else flushPlayTime();
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
        const now = Date.now(),
            delta = (now - lastTickAt) / 1000;
        lastTickAt = now;
        if (!state.uid) return;
        if (document.visibilityState !== "visible") return;
        if (!isPrimaryTab) return;
        if (delta > 10) return;
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

/* ---------- 9. BANDEAU / NUMÉROS / PARTICULES ---------- */

let bannerTimeout = null;
function showGlobalBanner(data) {
    const banner = document.getElementById("global-banner"),
        text = document.getElementById("global-banner-text");
    if (!banner || !text) return;
    const rarity = data.auraRarity || "mythic";
    text.innerHTML = `⚡ <strong>${data.name}</strong> vient d'obtenir <strong>[${data.auraName}]</strong> — ${data.chance || "?"}`;
    banner.setAttribute("data-rarity", rarity);
    banner.classList.remove("hidden");
    void banner.offsetWidth;
    banner.classList.add("show");
    clearTimeout(bannerTimeout);
    const duration =
        rarity === "secret" ? 7000 : rarity === "cosmic" ? 6000 : 5000;
    bannerTimeout = setTimeout(() => {
        banner.classList.remove("show");
        setTimeout(() => banner.classList.add("hidden"), 500);
    }, duration);
}

async function publishAnnouncement(aura) {
    if (!window.FB || !state.uid || !state.username) return;
    if (!ANNOUNCE_RARITIES.includes(aura.rarity)) return;
    try {
        const { db, ref, push, set, serverTimestamp } = window.FB;
        const annRef = push(ref(db, "announcements"));
        await set(annRef, {
            name: state.username,
            auraName: aura.name,
            auraRarity: aura.rarity,
            chance: formatChance(aura),
            ts: serverTimestamp(),
        });
        setTimeout(cleanOldAnnouncements, 3000);
    } catch (e) {}
}
async function cleanOldAnnouncements() {
    if (!window.FB) return;
    try {
        const { db, ref, get, remove } = window.FB;
        const snap = await get(ref(db, "announcements"));
        if (!snap.exists()) return;
        const now = Date.now();
        const dels = [];
        snap.forEach((c) => {
            const v = c.val();
            if (!v || !v.ts) return;
            if (now - v.ts > 10 * 60 * 1000)
                dels.push(remove(ref(db, "announcements/" + c.key)));
        });
        if (dels.length) await Promise.all(dels);
    } catch (e) {}
}

let announcementsListenerStarted = false;
function startAnnouncementsListener() {
    if (!window.FB || announcementsListenerStarted) return;
    announcementsListenerStarted = true;
    const { db, ref, query, orderByChild, limitToLast, onChildAdded } =
        window.FB;
    const q = query(
        ref(db, "announcements"),
        orderByChild("ts"),
        limitToLast(5),
    );
    const startTs = Date.now();
    onChildAdded(q, (snap) => {
        const data = snap.val();
        if (!data) return;
        if (data.ts && startTs - data.ts > 30000) return;
        if (data.name === state.username) return;
        showGlobalBanner(data);
    });
}

const _lastValues = new WeakMap();
function animateNumber(el, newValue, options = {}) {
    if (!el) return;
    const duration = options.duration || 700,
        prefix = options.prefix || "",
        suffix = options.suffix || "",
        locale = options.locale || "fr-FR",
        flash = options.flash !== false;
    const prev = _lastValues.get(el),
        from = typeof prev === "number" ? prev : newValue;
    _lastValues.set(el, newValue);
    const start = performance.now(),
        diff = newValue - from;
    function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const current = Math.round(from + diff * eased);
        el.textContent = prefix + current.toLocaleString(locale) + suffix;
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = prefix + newValue.toLocaleString(locale) + suffix;
    }
    requestAnimationFrame(tick);
    if (flash && diff !== 0) {
        el.classList.remove("num-up", "num-down", "num-flash");
        void el.offsetWidth;
        el.classList.add(diff > 0 ? "num-up" : "num-down", "num-flash");
        setTimeout(
            () => el.classList.remove("num-up", "num-down", "num-flash"),
            800,
        );
    }
}

const BIOME_PARTICLE_CONFIG = {
    plains: { cls: "particle-plains", count: 18, spawnRate: 500 },
    forest: {
        cls: "particle-forest",
        count: 22,
        spawnRate: 450,
        colors: ["#4ade80", "#86efac", "#34d399"],
    },
    desert: { cls: "particle-desert", count: 30, spawnRate: 200 },
    ocean: { cls: "particle-ocean", count: 14, spawnRate: 600 },
    space: { cls: "particle-space", count: 12, spawnRate: 900 },
    cosmic: {
        cls: "particle-cosmic",
        count: 20,
        spawnRate: 500,
        colors: ["#c084fc", "#67e8f9", "#a855f7", "#818cf8", "#f0abfc"],
    },
};
let particleSpawnInterval = null,
    currentBiomeParticleType = null;
function startBiomeParticles() {
    const box = document.getElementById("biome-particles");
    if (!box) return;
    const biomeId = state.currentBiome;
    if (currentBiomeParticleType === biomeId && particleSpawnInterval) return;
    currentBiomeParticleType = biomeId;
    if (particleSpawnInterval) {
        clearInterval(particleSpawnInterval);
        particleSpawnInterval = null;
    }
    box.innerHTML = "";
    if (state.settings.reduceAnim) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const config =
        BIOME_PARTICLE_CONFIG[biomeId] || BIOME_PARTICLE_CONFIG.plains;
    function spawnOne() {
        if (!document.body.contains(box)) return;
        const el = document.createElement("div");
        el.className = "biome-particle " + config.cls;
        if (biomeId === "desert") {
            el.style.left = "-5%";
            el.style.top = Math.random() * 100 + "%";
            el.style.setProperty("--dy", Math.random() * 100 + "%");
        } else if (biomeId === "ocean") {
            el.style.left = Math.random() * 100 + "%";
            el.style.top = "100%";
            el.style.setProperty("--dx", Math.random() * 60 - 30 + "px");
        } else if (biomeId === "space") {
            el.style.left = Math.random() * 100 + "%";
            el.style.top = "-2%";
            el.style.setProperty("--dx", Math.random() * 400 - 200 + "px");
            el.style.setProperty("--dy", Math.random() * 60 + 30 + "vh");
        } else if (biomeId === "cosmic") {
            el.style.left = Math.random() * 100 + "%";
            el.style.top = Math.random() * 100 + "%";
            el.style.setProperty("--dx", Math.random() * 200 - 100 + "px");
            el.style.setProperty("--dy", Math.random() * 200 - 100 + "px");
        } else {
            el.style.left = Math.random() * 100 + "%";
            el.style.top = "-2%";
            el.style.setProperty("--dx", Math.random() * 200 - 100 + "px");
        }
        if (config.colors && config.colors.length) {
            const c =
                config.colors[Math.floor(Math.random() * config.colors.length)];
            el.style.color = c;
            if (biomeId === "forest") el.style.background = c;
        }
        const dur = 6 + Math.random() * 6;
        el.style.animationDuration = dur + "s";
        box.appendChild(el);
        setTimeout(() => el.remove(), (dur + 0.5) * 1000);
    }
    for (let i = 0; i < config.count; i++) setTimeout(spawnOne, i * 120);
    particleSpawnInterval = setInterval(spawnOne, config.spawnRate);
}
function stopBiomeParticles() {
    if (particleSpawnInterval) {
        clearInterval(particleSpawnInterval);
        particleSpawnInterval = null;
    }
    const box = document.getElementById("biome-particles");
    if (box) box.innerHTML = "";
    currentBiomeParticleType = null;
}
/* ---------- 10. CHAT ---------- */

let chatListenerStarted = false,
    chatMessages = [];
function startChatListener() {
    if (!window.FB || chatListenerStarted) return;
    chatListenerStarted = true;
    const { db, ref, query, orderByChild, limitToLast, onChildAdded } =
        window.FB;
    const q = query(
        ref(db, "chat"),
        orderByChild("ts"),
        limitToLast(CHAT_MAX_MESSAGES),
    );
    onChildAdded(q, (snap) => {
        const msg = snap.val();
        if (!msg || !msg.ts) return;
        if (Date.now() - msg.ts > CHAT_MAX_AGE_MS) return;
        chatMessages.push({ id: snap.key, ...msg });
        if (chatMessages.length > CHAT_MAX_MESSAGES) chatMessages.shift();
        appendChatMessage({ id: snap.key, ...msg });
    });
    setTimeout(cleanOldChat, 5000);
}
function appendChatMessage(msg) {
    const box = document.getElementById("chat-messages");
    if (!box) return;
    const isMe = state.username && msg.name === state.username;
    const el = document.createElement("div");
    el.className = "chat-msg" + (isMe ? " own" : "");
    const color = getPlayerDisplayColor(msg.name);
    const time = new Date(msg.ts).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
    });
    el.innerHTML = `<span class="chat-author" style="color:${color}">${escapeHtml(msg.name)}</span><span class="chat-text">${escapeHtml(msg.text)}</span><span class="chat-time">${time}</span>`;
    const wasAtBottom =
        box.scrollHeight - box.scrollTop - box.clientHeight < 50;
    box.appendChild(el);
    if (wasAtBottom) box.scrollTop = box.scrollHeight;
}
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function getPlayerDisplayColor(name) {
    if (name === state.username && state.bestAura) {
        const aura = AURA_BY_ID[state.bestAura];
        if (aura) return RARITY_COLORS[aura.rarity] || "#c4b5fd";
    }
    let hash = 0;
    for (let i = 0; i < name.length; i++)
        hash = (hash << 5) - hash + name.charCodeAt(i);
    const hues = [260, 290, 320, 200, 170, 40, 15];
    return `hsl(${hues[Math.abs(hash) % hues.length]}, 70%, 65%)`;
}
async function sendChatMessage() {
    const input = document.getElementById("chat-input");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    if (text.length > 200) {
        showToast("❌ Trop long.");
        return;
    }
    if (!state.uid || !state.username) {
        showToast("❌ Connecte-toi.");
        return;
    }
    const now = Date.now();
    if (state._lastChatAt && now - state._lastChatAt < 2000) {
        showToast("⏳ Attends.");
        return;
    }
    state._lastChatAt = now;
    const safeText = filterChatText(text);
    try {
        const { db, ref, push, set, serverTimestamp } = window.FB;
        const msgRef = push(ref(db, "chat"));
        await set(msgRef, {
            name: state.username,
            text: safeText,
            ts: serverTimestamp(),
        });
        input.value = "";
    } catch (e) {
        showToast("❌ Erreur d'envoi.");
    }
}
async function cleanOldChat() {
    if (!window.FB) return;
    try {
        const { db, ref, get, remove } = window.FB;
        const snap = await get(ref(db, "chat"));
        if (!snap.exists()) return;
        const now = Date.now();
        const dels = [];
        snap.forEach((c) => {
            const v = c.val();
            if (!v || !v.ts) return;
            if (now - v.ts > CHAT_MAX_AGE_MS)
                dels.push(remove(ref(db, "chat/" + c.key)));
        });
        if (dels.length) await Promise.all(dels);
    } catch (e) {}
}

/* ---------- 11. AMIS ---------- */

let friendsCurrentTab = "following",
    friendsUnreadCount = 0,
    friendsActivityListenerStarted = false;

async function loadFriendsLists() {
    if (!window.FB || !state.uid) return;
    try {
        const { db, ref, get } = window.FB;
        const snap = await get(ref(db, "friends/" + state.uid));
        if (!snap.exists()) {
            state._following = {};
            state._followers = {};
            return;
        }
        const data = snap.val();
        state._following = data.following || {};
        state._followers = data.followers || {};
    } catch (e) {}
}
async function fetchPlayerInfo(uid) {
    if (!window.FB) return null;
    try {
        const { db, ref, get } = window.FB;
        const snap = await get(ref(db, "players/" + uid));
        if (!snap.exists()) return null;
        return { uid, ...snap.val() };
    } catch (e) {
        return null;
    }
}

async function renderFollowingTab() {
    const container = document.getElementById("friends-content");
    if (!container) return;
    container.innerHTML = `<p class="hint">Chargement...</p>`;
    const uids = Object.keys(state._following);
    if (uids.length === 0) {
        container.innerHTML = `<p class="hint">Tu ne suis personne.</p>`;
        return;
    }
    const players = await Promise.all(uids.map((uid) => fetchPlayerInfo(uid)));
    container.innerHTML = "";
    players
        .filter(Boolean)
        .forEach((p) => container.appendChild(buildFriendCard(p, "following")));
    if (container.children.length === 0)
        container.innerHTML = `<p class="hint">Aucun profil.</p>`;
}
async function renderFollowersTab() {
    const container = document.getElementById("friends-content");
    if (!container) return;
    container.innerHTML = `<p class="hint">Chargement...</p>`;
    const uids = Object.keys(state._followers);
    if (uids.length === 0) {
        container.innerHTML = `<p class="hint">Aucun abonné.</p>`;
        return;
    }
    const players = await Promise.all(uids.map((uid) => fetchPlayerInfo(uid)));
    container.innerHTML = "";
    players
        .filter(Boolean)
        .forEach((p) => container.appendChild(buildFriendCard(p, "followers")));
    if (container.children.length === 0)
        container.innerHTML = `<p class="hint">Aucun profil.</p>`;
}
function buildFriendCard(player, mode) {
    const card = document.createElement("div");
    card.className = "friend-card";
    const initial = (player.name || "?")[0].toUpperCase();
    const hue = hashStringHue(player.name || "?");
    const avatar = document.createElement("div");
    avatar.className = "friend-avatar";
    avatar.style.background = `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 40) % 360}, 70%, 40%))`;
    avatar.textContent = initial;
    const info = document.createElement("div");
    info.className = "friend-info";
    const lastUpd = player.updatedAt || 0,
        isOnline = Date.now() - lastUpd < FRIENDS_ONLINE_WINDOW_MS;
    const onlineHtml = isOnline
        ? `<span class="friend-online"></span>En ligne`
        : `<span class="friend-offline"></span>${formatLastSeen(lastUpd)}`;
    const bestAuraTxt =
        player.bestAuraName && player.bestAuraName !== "Aucune"
            ? `⭐ ${player.bestAuraName} (${player.bestAuraRarity})`
            : "⭐ Aucune";
    info.innerHTML = `<div class="friend-name">${escapeHtml(player.name || "Anonyme")}</div><div class="friend-sub">🎖️ Niv. ${player.level || 1} · ${bestAuraTxt}</div><div class="friend-sub">${onlineHtml}</div>`;
    const actions = document.createElement("div");
    actions.className = "friend-actions";
    const iFollow = !!state._following[player.uid],
        theyFollow = !!state._followers[player.uid];
    if (mode === "following") {
        const btn = document.createElement("button");
        btn.className = "unfollow-btn";
        btn.textContent = "Ne plus suivre";
        btn.addEventListener("click", () =>
            unfollowPlayer(player.uid, player.name),
        );
        actions.appendChild(btn);
    } else if (mode === "followers") {
        if (iFollow) {
            const btn = document.createElement("button");
            btn.className = "unfollow-btn";
            btn.textContent = "Ne plus suivre";
            btn.addEventListener("click", () =>
                unfollowPlayer(player.uid, player.name),
            );
            actions.appendChild(btn);
        } else {
            const btn = document.createElement("button");
            btn.className = "follow-btn";
            btn.textContent = "Suivre en retour";
            btn.addEventListener("click", () =>
                followPlayer(player.uid, player.name),
            );
            actions.appendChild(btn);
        }
        if (theyFollow && iFollow) {
            const mutual = document.createElement("span");
            mutual.style.cssText =
                "font-size:11px;opacity:.7;align-self:center;";
            mutual.textContent = "🤝 Mutuel";
            actions.appendChild(mutual);
        }
    } else if (mode === "search") {
        const btn = document.createElement("button");
        btn.className = iFollow ? "unfollow-btn" : "follow-btn";
        btn.textContent = iFollow ? "Ne plus suivre" : "Suivre";
        btn.addEventListener("click", () =>
            iFollow
                ? unfollowPlayer(player.uid, player.name)
                : followPlayer(player.uid, player.name),
        );
        actions.appendChild(btn);
    }
    card.appendChild(avatar);
    card.appendChild(info);
    card.appendChild(actions);
    return card;
}
function hashStringHue(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
    return Math.abs(h) % 360;
}
function formatLastSeen(ts) {
    if (!ts) return "Jamais connecté";
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000),
        h = Math.floor(diff / 3600000),
        d = Math.floor(diff / 86400000);
    if (min < 1) return "À l'instant";
    if (min < 60) return `Il y a ${min} min`;
    if (h < 24) return `Il y a ${h} h`;
    if (d < 30) return `Il y a ${d} j`;
    return `Il y a +1 mois`;
}

function renderSearchTab() {
    const container = document.getElementById("friends-content");
    if (!container) return;
    container.innerHTML = `<div class="friends-search"><input type="text" id="friends-search-input" placeholder="Pseudo exact..." maxlength="20" autocomplete="off" /><button id="friends-search-btn">Chercher</button></div><div id="friends-search-results"></div>`;
    const input = document.getElementById("friends-search-input"),
        btn = document.getElementById("friends-search-btn");
    const doSearch = () => searchPlayers(input.value.trim());
    btn.addEventListener("click", doSearch);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSearch();
    });
}
async function searchPlayers(query) {
    const resultsBox = document.getElementById("friends-search-results"),
        btn = document.getElementById("friends-search-btn");
    if (!resultsBox) return;
    resultsBox.innerHTML = "";
    if (!query || query.length < 3) {
        resultsBox.innerHTML = `<p class="hint">Tape 3 caractères min.</p>`;
        return;
    }
    btn.disabled = true;
    btn.textContent = "…";
    resultsBox.innerHTML = `<p class="hint">Recherche...</p>`;
    try {
        const { db, ref, get } = window.FB;
        const snap = await get(ref(db, "usernames/" + query.toLowerCase()));
        resultsBox.innerHTML = "";
        if (!snap.exists()) {
            resultsBox.innerHTML = `<p class="hint">Aucun joueur.</p>`;
            return;
        }
        const uid = snap.val().uid;
        if (uid === state.uid) {
            resultsBox.innerHTML = `<p class="hint">C'est toi 😄</p>`;
            return;
        }
        const player = await fetchPlayerInfo(uid);
        if (!player) {
            resultsBox.innerHTML = `<p class="hint">Profil introuvable.</p>`;
            return;
        }
        resultsBox.appendChild(buildFriendCard(player, "search"));
    } catch (e) {
        resultsBox.innerHTML = `<p class="hint">Erreur.</p>`;
    } finally {
        btn.disabled = false;
        btn.textContent = "Chercher";
    }
}
async function followPlayer(targetUid, targetName) {
    if (!window.FB || !state.uid || targetUid === state.uid) return;
    try {
        const { db, ref, set } = window.FB;
        const now = Date.now();
        await set(ref(db, `friends/${state.uid}/following/${targetUid}`), {
            name: targetName,
            since: now,
        });
        await set(ref(db, `friends/${targetUid}/followers/${state.uid}`), {
            name: state.username,
            since: now,
        });
        state._following[targetUid] = { name: targetName, since: now };
        showToast(`✅ Tu suis ${targetName}`);
        renderFriendsStats();
        refreshFriendsTab();
        updateSocialBonus();
    } catch (e) {
        showToast("❌ Impossible.");
    }
}
async function unfollowPlayer(targetUid, targetName) {
    if (!window.FB || !state.uid) return;
    if (!confirm(`Ne plus suivre ${targetName} ?`)) return;
    try {
        const { db, ref, remove } = window.FB;
        await remove(ref(db, `friends/${state.uid}/following/${targetUid}`));
        await remove(ref(db, `friends/${targetUid}/followers/${state.uid}`));
        delete state._following[targetUid];
        showToast(`👋 ${targetName} retiré`);
        renderFriendsStats();
        refreshFriendsTab();
        updateSocialBonus();
    } catch (e) {
        showToast("❌ Erreur.");
    }
}
function renderFriendsStats() {
    const el = document.getElementById("friends-stats");
    if (!el) return;
    const f = Object.keys(state._following || {}).length,
        fo = Object.keys(state._followers || {}).length;
    el.textContent = `${f} abonnement${f > 1 ? "s" : ""} · ${fo} abonné${fo > 1 ? "s" : ""}`;
}
function refreshFriendsTab() {
    if (friendsCurrentTab === "following") renderFollowingTab();
    else if (friendsCurrentTab === "followers") renderFollowersTab();
}
function updateSocialBonus() {
    const el = document.getElementById("stat-social-bonus");
    if (el) el.textContent = "+" + (getSocialBonus() * 100).toFixed(0) + "%";
}

async function publishActivity(aura) {
    if (!window.FB || !state.uid) return;
    if (
        ![
            "legendary",
            "mythic",
            "divine",
            "celestial",
            "cosmic",
            "secret",
        ].includes(aura.rarity)
    )
        return;
    try {
        const { db, ref, push, set, serverTimestamp } = window.FB;
        const evtRef = push(ref(db, "activity/" + state.uid));
        await set(evtRef, {
            auraName: aura.name,
            auraRarity: aura.rarity,
            chance: formatChance(aura),
            ts: serverTimestamp(),
        });
        setTimeout(cleanOldActivity, 3000);
    } catch (e) {}
}
async function cleanOldActivity() {
    if (!window.FB || !state.uid) return;
    try {
        const { db, ref, get, remove } = window.FB;
        const snap = await get(ref(db, "activity/" + state.uid));
        if (!snap.exists()) return;
        const list = [];
        snap.forEach((c) => {
            const v = c.val();
            if (v && v.ts) list.push({ key: c.key, ts: v.ts });
        });
        list.sort((a, b) => b.ts - a.ts);
        const toDel = list.slice(FRIENDS_MAX_ACTIVITY_PER_PLAYER);
        await Promise.all(
            toDel.map((e) =>
                remove(ref(db, "activity/" + state.uid + "/" + e.key)),
            ),
        );
    } catch (e) {}
}
async function loadFriendsFeed() {
    if (!window.FB || !state.uid) return;
    const feedBox = document.getElementById("friends-feed");
    if (!feedBox) return;
    const uids = Object.keys(state._following);
    if (uids.length === 0) {
        feedBox.innerHTML = `<p class="hint">Suis des joueurs pour voir l'activité.</p>`;
        return;
    }
    feedBox.innerHTML = `<p class="hint">Chargement...</p>`;
    try {
        const { db, ref, get } = window.FB;
        const allEvents = [];
        await Promise.all(
            uids.slice(0, 15).map(async (uid) => {
                try {
                    const snap = await get(ref(db, "activity/" + uid));
                    if (!snap.exists()) return;
                    snap.forEach((c) => {
                        const v = c.val();
                        if (v && v.ts) allEvents.push({ uid, ...v });
                    });
                } catch (e) {}
            }),
        );
        allEvents.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        const recent = allEvents.slice(0, 20);
        feedBox.innerHTML = "";
        if (recent.length === 0) {
            feedBox.innerHTML = `<p class="hint">Aucune activité.</p>`;
            return;
        }
        recent.forEach((evt) => {
            const followingName = state._following[evt.uid]?.name || "Ami";
            const item = document.createElement("div");
            item.className = "feed-item feed-" + (evt.auraRarity || "common");
            item.innerHTML = `<span class="feed-icon">⚡</span><span class="feed-text"><span class="feed-author">${escapeHtml(followingName)}</span> a obtenu <strong>[${escapeHtml(evt.auraName)}]</strong> — ${escapeHtml(evt.chance || "?")} <span class="feed-time">${formatLastSeen(evt.ts)}</span></span>`;
            feedBox.appendChild(item);
        });
    } catch (e) {
        feedBox.innerHTML = `<p class="hint">Erreur.</p>`;
    }
}
function startFriendsActivityListener() {
    if (!window.FB || friendsActivityListenerStarted) return;
    friendsActivityListenerStarted = true;
    const { db, ref, query, orderByChild, limitToLast, onChildAdded } =
        window.FB;
    const q = query(ref(db, "activity"), orderByChild("ts"), limitToLast(50));
    const startTs = Date.now();
    onChildAdded(q, (snap) => {
        const uid = snap.ref.parent.key;
        if (uid === state.uid) return;
        const data = snap.val();
        if (!data || !data.ts) return;
        if (startTs - data.ts > 60000) return;
        if (!state._following[uid]) return;
        const friendName = state._following[uid].name || "Ami";
        if (
            ["mythic", "divine", "celestial", "cosmic", "secret"].includes(
                data.auraRarity,
            )
        )
            showToast(`⚡ ${friendName} vient d'obtenir [${data.auraName}] !`);
        friendsUnreadCount++;
        updateFriendsBadge();
    });
}
function updateFriendsBadge() {
    const badge = document.getElementById("friends-badge");
    if (!badge) return;
    if (friendsUnreadCount > 0) {
        badge.classList.remove("hidden");
        badge.textContent =
            friendsUnreadCount > 99 ? "99+" : friendsUnreadCount;
    } else badge.classList.add("hidden");
}

/* ---------- 12. LOT 5 : BAN + ADMIN ---------- */

function ipToKey(ip) {
    return String(ip).replace(/[^a-zA-Z0-9]/g, "_");
}
async function getUserIP() {
    try {
        const res = await fetch("https://api.ipify.org?format=json", {
            cache: "no-store",
        });
        const data = await res.json();
        return data.ip || null;
    } catch (e) {
        return null;
    }
}

function triggerAutoBan(reason) {
    if (isAdminUser) return;
    if (!state.uid || !window.FB) return;
    if (
        window.__auraBanCooldown &&
        Date.now() - window.__auraBanCooldown < 5000
    )
        return;
    window.__auraBanCooldown = Date.now();

    getUserIP().then((ip) => {
        const count =
            (parseInt(localStorage.getItem(BAN_COUNT_KEY) || "0", 10) || 0) + 1;
        localStorage.setItem(BAN_COUNT_KEY, String(count));
        let duration = BAN_DURATIONS.first;
        if (count === 2) duration = BAN_DURATIONS.second;
        else if (count === 3) duration = BAN_DURATIONS.third;
        else if (count === 4) duration = BAN_DURATIONS.fourth;
        else if (count === 5) duration = BAN_DURATIONS.fifth;
        else if (count >= 6) duration = BAN_DURATIONS.permanent;
        const until = Date.now() + duration;
        const banData = {
            until,
            reason,
            count,
            name: state.username || "?",
            uid: state.uid || null,
            ip: ip || null,
            ts: Date.now(),
        };
        try {
            localStorage.setItem(
                "auraRng_localBan",
                JSON.stringify({ until, reason }),
            );
        } catch (e) {}
        if (window.FB) {
            try {
                const { db, ref, set } = window.FB;
                if (state.uid)
                    set(ref(db, "bans/" + state.uid), banData).catch(() => {});
                if (ip)
                    set(ref(db, "ip_bans/" + ipToKey(ip)), banData).catch(
                        () => {},
                    );
            } catch (e) {}
        }
        if (window.__auraOriginalConsole) {
            window.__auraOriginalConsole.warn(
                "🚨 Ban :",
                reason,
                "→",
                duration / 1000 + "s",
            );
        }
        showBanOverlay(until, reason);
    });
}

function showBanOverlay(until, reason) {
    const overlay = document.getElementById("ban-overlay");
    if (!overlay) return;

    if (!until || Date.now() >= until) {
        if (window.__auraBanLocked && Date.now() < window.__auraBanUntil)
            return;
        overlay.classList.add("hidden");
        delete overlay.dataset.activeUntil;
        window.__auraBanLocked = false;
        window.__auraBanUntil = 0;
        try {
            localStorage.removeItem("auraRng_localBan");
        } catch (e) {}
        clearInterval(banTimerInterval);
        const rollBtn = document.getElementById("roll-btn");
        if (rollBtn) rollBtn.disabled = false;
        const autoBtn = document.getElementById("auto-roll-btn");
        if (autoBtn) autoBtn.disabled = false;
        return;
    }

    window.__auraBanLocked = true;
    window.__auraBanUntil = until;

    try {
        localStorage.setItem(
            "auraRng_localBan",
            JSON.stringify({ until, reason: reason || "Banni" }),
        );
    } catch (e) {}

    overlay.dataset.activeUntil = String(until);
    document.getElementById("ban-reason-text").textContent =
        reason || CONSOLE_BAN_REASON;
    overlay.classList.remove("hidden");

    if (autoRollActive) toggleAutoRoll();
    const rollBtn = document.getElementById("roll-btn");
    if (rollBtn) rollBtn.disabled = true;
    clearInterval(banTimerInterval);

    // ✅ S'assure que le bouton logout est bien là et cliquable
    const logoutBtn = document.getElementById("ban-logout-btn");
    if (logoutBtn) {
        logoutBtn.style.display = "block";
        logoutBtn.style.pointerEvents = "auto";
    }

    const tick = () => {
        const remaining = Math.max(0, until - Date.now());
        const el = document.getElementById("ban-timer");
        if (el) {
            const isPermanent = remaining > 100 * 365 * 24 * 60 * 60 * 1000;
            if (isPermanent) {
                el.textContent = "∞ PERMANENT";
                el.style.fontSize = "20px";
            } else {
                const totalSec = Math.ceil(remaining / 1000);
                const totalMin = Math.floor(totalSec / 60);
                const totalH = Math.floor(totalMin / 60);
                const totalD = Math.floor(totalH / 24);
                if (totalD >= 1)
                    el.textContent = `${totalD}j ${totalH % 24}h ${totalMin % 60}min`;
                else if (totalH >= 1)
                    el.textContent = `${totalH}h ${totalMin % 60}min`;
                else el.textContent = `${totalMin}min ${totalSec % 60}s`;
            }
        }

        if (remaining > 0 && overlay.classList.contains("hidden"))
            overlay.classList.remove("hidden");

        if (remaining <= 0) {
            clearInterval(banTimerInterval);
            window.__auraBanLocked = false;
            window.__auraBanUntil = 0;
            try {
                localStorage.removeItem("auraRng_localBan");
            } catch (e) {}
            overlay.classList.add("hidden");
            delete overlay.dataset.activeUntil;
            const rb = document.getElementById("roll-btn");
            if (rb) rb.disabled = false;
            const ab = document.getElementById("auto-roll-btn");
            if (ab) ab.disabled = false;
            console.info("✅ Ban expiré → boutons réactivés");
        }
    };
    tick();
    banTimerInterval = setInterval(tick, 1000);
}

function checkLocalBan() {
    try {
        const raw = localStorage.getItem("auraRng_localBan");
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || !data.until) {
            localStorage.removeItem("auraRng_localBan");
            return false;
        }
        const MAX_DURATION = 100 * 365 * 24 * 60 * 60 * 1000;
        if (data.until - Date.now() > MAX_DURATION) {
            console.warn("⚠️ Ban local anormalement long → suppression");
            localStorage.removeItem("auraRng_localBan");
            return false;
        }
        if (Date.now() < data.until) {
            showBanOverlay(data.until, data.reason);
            return true;
        }
        localStorage.removeItem("auraRng_localBan");
        return false;
    } catch (e) {
        localStorage.removeItem("auraRng_localBan");
        return false;
    }
}

async function checkBanned() {
    if (!window.FB) return false;
    if (state.uid) {
        try {
            const snap = await window.FB.get(
                window.FB.ref(window.FB.db, "bans/" + state.uid),
            );
            if (snap.exists()) {
                const d = snap.val();
                if (d.until && Date.now() < d.until) {
                    showBanOverlay(d.until, d.reason);
                    return true;
                }
            }
        } catch (e) {}
    }
    const ip = await getUserIP();
    if (ip) {
        try {
            const snap = await window.FB.get(
                window.FB.ref(window.FB.db, "ip_bans/" + ipToKey(ip)),
            );
            if (snap.exists()) {
                const d = snap.val();
                if (d.until && Date.now() < d.until) {
                    showBanOverlay(d.until, d.reason);
                    return true;
                }
            }
        } catch (e) {}
    }
    return false;
}

/* ✅ Vérifie si le compte a été supprimé */
async function checkDeleted() {
    if (!window.FB || !state.uid) return false;
    try {
        const snap = await window.FB.get(
            window.FB.ref(window.FB.db, "deleted/" + state.uid),
        );
        if (snap.exists()) {
            showDeletedOverlay(snap.val());
            return true;
        }
        const banSnap = await window.FB.get(
            window.FB.ref(window.FB.db, "bans/" + state.uid),
        );
        if (banSnap.exists()) {
            const d = banSnap.val();
            if (d.deleted) {
                showDeletedOverlay(d);
                return true;
            }
        }
    } catch (e) {}
    return false;
}

/* ✅ Overlay de compte supprimé */
function showDeletedOverlay(data) {
    if (document.getElementById("deleted-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "deleted-overlay";
    overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 999999;
    background: radial-gradient(circle at 50% 40%, #1a0000, #0a0000 70%);
    backdrop-filter: blur(20px);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-family: system-ui, sans-serif; text-align: center; padding: 20px;
  `;
    overlay.innerHTML = `
    <div style="max-width: 500px;">
      <div style="font-size: 80px; margin-bottom: 20px;">❌</div>
      <h1 style="color: #f87171; font-size: 32px; margin-bottom: 16px;">Compte supprimé</h1>
      <p style="color: #fca5a5; font-size: 16px; line-height: 1.6;">
        Ton compte a été <strong>supprimé définitivement</strong> par un administrateur.<br><br>
        Tu ne peux plus te connecter avec ce pseudo.
      </p>
      <p style="color: #fff; font-size: 13px; margin-top: 20px; opacity: 0.6;">
        Raison : ${(data && data.reason) || "Compte supprimé"}
      </p>
      <button id="deleted-logout-btn" style="margin-top: 30px; padding: 12px 24px; border-radius: 10px; background: rgba(220, 38, 38, 0.9); color: #fff; font-weight: 700; font-size: 15px; border: 1px solid rgba(248, 113, 113, 0.6); cursor: pointer;">
        🚪 Se déconnecter
      </button>
    </div>
  `;
    document.body.appendChild(overlay);

    document.body.style.pointerEvents = "none";
    overlay.style.pointerEvents = "all";

    document
        .getElementById("deleted-logout-btn")
        .addEventListener("click", async () => {
            try {
                if (window.FB && window.FB.signOut) {
                    await window.FB.signOut(window.FB.auth);
                }
            } catch (e) {}
            location.reload();
        });
}

function detectConsoleInput() {
    if (window.__auraConsoleHooked) return;
    window.__auraConsoleHooked = true;

    const origLog = console.log.bind(console);
    const origWarn = console.warn.bind(console);
    const origError = console.error.bind(console);

    window.__auraOriginalConsole = {
        log: origLog,
        warn: origWarn,
        error: origError,
    };

    const SUSPICIOUS = [
        "state.coins",
        "state.totalRolls",
        "state.level",
        "state.xp",
        "state.bestAura",
        "state.inventory",
        "state.discovered",
        "performRoll(",
        "registerAura(",
        "pushToLeaderboard(",
        "getTotalLuckMultiplier",
        "Object.defineProperty",
        "delete state",
    ];

    let inspecting = false;
    function inspect(args) {
        if (isAdminUser) return;
        if (inspecting) return;
        if (!state.uid) return;
        if (Date.now() - (state._connectedAt || 0) < 5000) return;
        inspecting = true;
        try {
            const txt = args
                .map((a) => {
                    if (typeof a === "string") return a;
                    try {
                        return JSON.stringify(a);
                    } catch (e) {
                        return String(a);
                    }
                })
                .join(" ");
            for (const k of SUSPICIOUS) {
                if (txt.includes(k)) {
                    triggerAutoBan("Code suspect : " + k);
                    break;
                }
            }
        } catch (e) {
        } finally {
            inspecting = false;
        }
    }

    function isFirebaseMessage(args) {
        try {
            const s = args
                .map((a) => (typeof a === "string" ? a : ""))
                .join(" ");
            return (
                s.includes("@firebase/") ||
                s.includes("firebase") ||
                s.includes("Auth (")
            );
        } catch (e) {
            return false;
        }
    }

    console.log = function (...a) {
        if (!isFirebaseMessage(a)) inspect(a);
        return origLog(...a);
    };
    console.warn = function (...a) {
        if (!isFirebaseMessage(a)) inspect(a);
        return origWarn(...a);
    };
    console.error = function (...a) {
        if (!isFirebaseMessage(a)) inspect(a);
        return origError(...a);
    };

    setTimeout(() => {
        if (!state || typeof state !== "object") return;
        const protectedProps = [
            "coins",
            "totalRolls",
            "level",
            "xp",
            "bestAura",
            "inventory",
            "discovered",
        ];
        protectedProps.forEach((prop) => {
            try {
                let currentVal = state[prop];
                Object.defineProperty(state, prop, {
                    get() {
                        return currentVal;
                    },
                    set(newVal) {
                        if (
                            window.__auraInternalWrite ||
                            isAdminUser ||
                            !state.uid
                        ) {
                            currentVal = newVal;
                            return;
                        }
                        if (
                            typeof newVal === "number" &&
                            typeof currentVal === "number" &&
                            newVal <= currentVal
                        ) {
                            currentVal = newVal;
                            return;
                        }
                        if (
                            window.__auraBanCooldown &&
                            Date.now() - window.__auraBanCooldown < 5000
                        ) {
                            currentVal = newVal;
                            return;
                        }
                        if (Date.now() - (state._connectedAt || 0) < 5000) {
                            currentVal = newVal;
                            return;
                        }
                        triggerAutoBan(`Modification de state.${prop}`);
                    },
                    configurable: false,
                });
            } catch (e) {}
        });
    }, 500);
}

async function checkFrozen() {
    if (!window.FB || !state.uid) return false;
    try {
        const snap = await window.FB.get(
            window.FB.ref(window.FB.db, "frozen/" + state.uid),
        );
        const frozen = snap.exists() && snap.val() === true;
        document.body.classList.toggle("is-frozen", frozen);
        return frozen;
    } catch (e) {
        return false;
    }
}

async function registerPlayerIP() {
    if (!window.FB || !state.uid) return;
    const ip = await getUserIP();
    if (!ip) return;
    try {
        await window.FB.update(
            window.FB.ref(window.FB.db, "players/" + state.uid),
            { lastIp: ip },
        );
    } catch (e) {}
}

async function checkAdminStatus() {
    isAdminUser = false;
    const btn = document.getElementById("admin-toggle");
    if (btn) btn.classList.add("hidden");
    if (
        !state.username ||
        state.username.toLowerCase() !== ADMIN_USERNAME.toLowerCase()
    )
        return;
    if (!window.FB || !state.uid) return;
    try {
        const snap = await window.FB.get(
            window.FB.ref(window.FB.db, "admins/" + state.uid),
        );
        if (snap.exists() && snap.val() === true) {
            isAdminUser = true;
            if (btn) btn.classList.remove("hidden");
            console.log("👑 Mode admin activé.");
        }
    } catch (e) {}
}

async function postLoginChecks() {
    await checkDeleted();
    await checkBanned();
    await registerPlayerIP();
    await checkAdminStatus();
    await checkFrozen();
}

async function openAdminPanel() {
    if (!isAdminUser) {
        showToast("❌ Accès refusé.");
        return;
    }
    const modal = document.getElementById("admin-modal");
    if (modal) modal.classList.remove("hidden");
    loadAdminBanList();
}

async function loadAdminBanList() {
    if (!isAdminUser) return;
    const box = document.getElementById("admin-ban-list");
    if (!box) return;
    box.innerHTML = `<p class="hint">Chargement...</p>`;
    try {
        const snap = await window.FB.get(window.FB.ref(window.FB.db, "bans"));
        box.innerHTML = "";
        if (!snap.exists()) {
            box.innerHTML = `<p class="hint">Aucun ban actif.</p>`;
            return;
        }
        const now = Date.now();
        let count = 0;
        snap.forEach((child) => {
            const d = child.val();
            if (!d || !d.until || d.until <= now) return;
            count++;
            const remainingMs = d.until - now;
            const isPermanent = remainingMs > 100 * 365 * 24 * 60 * 60 * 1000;
            const remainingTxt = isPermanent
                ? "∞ PERMANENT"
                : Math.ceil(remainingMs / 60000) + " min";
            const item = document.createElement("div");
            item.className = "admin-ban-item";
            item.innerHTML = `<span class="admin-ban-name">${escapeHtml(d.name || "?")}</span><span class="admin-ban-time">⏱️ ${remainingTxt}</span><span class="admin-ban-reason">${escapeHtml(d.reason || "")}</span><button class="small-btn" data-unban="${child.key}">Débannir</button>`;
            box.appendChild(item);
        });
        if (count === 0) box.innerHTML = `<p class="hint">Aucun ban actif.</p>`;
        box.querySelectorAll("[data-unban]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const uid = btn.dataset.unban;
                try {
                    await window.FB.remove(
                        window.FB.ref(window.FB.db, "bans/" + uid),
                    );
                    showToast("✅ Ban retiré.");
                    loadAdminBanList();
                } catch (e) {
                    showToast("❌ Erreur.");
                }
            });
        });
    } catch (e) {
        box.innerHTML = `<p class="hint">Erreur.</p>`;
    }
}

async function adminSearchPlayer(query) {
    if (!isAdminUser) return;
    const info = document.getElementById("admin-player-info"),
        status = document.getElementById("admin-status");
    if (!query || query.length < 3) {
        showToast("❌ Pseudo trop court.");
        return;
    }
    status.textContent = "";
    info.classList.add("hidden");
    try {
        let uid = null;
        const snap = await window.FB.get(
            window.FB.ref(window.FB.db, "usernames/" + query.toLowerCase()),
        );
        if (snap.exists()) uid = snap.val().uid;
        if (!uid) {
            const playersSnap = await window.FB.get(
                window.FB.ref(window.FB.db, "players"),
            );
            if (playersSnap.exists()) {
                playersSnap.forEach((child) => {
                    const val = child.val();
                    if (
                        val &&
                        val.name &&
                        val.name.toLowerCase() === query.toLowerCase()
                    )
                        uid = child.key;
                });
            }
        }
        if (!uid) {
            showToast("❌ Introuvable.");
            return;
        }

        const playerSnap = await window.FB.get(
            window.FB.ref(window.FB.db, "players/" + uid),
        );
        const player = playerSnap.exists() ? playerSnap.val() : { name: query };
        const frozenSnap = await window.FB.get(
            window.FB.ref(window.FB.db, "frozen/" + uid),
        );
        const isFrozen = frozenSnap.exists() && frozenSnap.val() === true;
        const banSnap = await window.FB.get(
            window.FB.ref(window.FB.db, "bans/" + uid),
        );
        const isBanned = banSnap.exists() && banSnap.val().until > Date.now();

        currentAdminTarget = { uid, name: player.name || query };
        document.getElementById("admin-player-name").textContent =
            player.name || query;
        document.getElementById("admin-player-uid").textContent = "UID: " + uid;
        document.getElementById("admin-freeze-btn").textContent = isFrozen
            ? "🔥 Unfreeze"
            : "🧊 Freeze";
        document.getElementById("admin-ban-btn").textContent = isBanned
            ? "🚫 Rebannir (UID)"
            : "🚫 Bannir (UID)";
        info.classList.remove("hidden");
    } catch (e) {
        showToast("❌ Erreur.");
    }
}

async function adminFreezeToggle() {
    if (!isAdminUser || !currentAdminTarget) return;
    try {
        const snap = await window.FB.get(
            window.FB.ref(window.FB.db, "frozen/" + currentAdminTarget.uid),
        );
        const frozen = snap.exists() && snap.val() === true;
        if (frozen) {
            await window.FB.remove(
                window.FB.ref(window.FB.db, "frozen/" + currentAdminTarget.uid),
            );
            showToast(`🔥 ${currentAdminTarget.name} unfreeze.`);
        } else {
            await window.FB.set(
                window.FB.ref(window.FB.db, "frozen/" + currentAdminTarget.uid),
                true,
            );
            showToast(`🧊 ${currentAdminTarget.name} freeze.`);
        }
        adminSearchPlayer(currentAdminTarget.name);
    } catch (e) {
        showToast("❌ Erreur.");
    }
}
async function adminResetRolls() {
    if (!isAdminUser || !currentAdminTarget) return;
    const amount = parseInt(prompt("Nombre de rolls à retirer ?", "100"), 10);
    if (isNaN(amount) || amount <= 0) return;
    try {
        const snap = await window.FB.get(
            window.FB.ref(window.FB.db, "players/" + currentAdminTarget.uid),
        );
        if (!snap.exists()) {
            showToast("❌ Introuvable.");
            return;
        }
        const p = snap.val();
        const newRolls = Math.max(0, (p.totalRolls || 0) - amount);
        await window.FB.update(
            window.FB.ref(window.FB.db, "players/" + currentAdminTarget.uid),
            { totalRolls: newRolls },
        );
        try {
            const sSnap = await window.FB.get(
                window.FB.ref(window.FB.db, "saves/" + currentAdminTarget.uid),
            );
            if (sSnap.exists())
                await window.FB.update(
                    window.FB.ref(
                        window.FB.db,
                        "saves/" + currentAdminTarget.uid,
                    ),
                    { totalRolls: newRolls },
                );
        } catch (e) {}
        showToast(`🎲 ${amount} rolls retirés.`);
        adminSearchPlayer(currentAdminTarget.name);
    } catch (e) {
        showToast("❌ Erreur.");
    }
}
async function adminResetCoins() {
    if (!isAdminUser || !currentAdminTarget) return;
    const amount = parseInt(prompt("Pièces à retirer ?", "1000"), 10);
    if (isNaN(amount) || amount <= 0) return;
    try {
        const sSnap = await window.FB.get(
            window.FB.ref(window.FB.db, "saves/" + currentAdminTarget.uid),
        );
        if (sSnap.exists()) {
            const s = sSnap.val();
            const newCoins = Math.max(0, (s.coins || 0) - amount);
            await window.FB.update(
                window.FB.ref(window.FB.db, "saves/" + currentAdminTarget.uid),
                { coins: newCoins },
            );
        }
        showToast(`💰 ${amount} pièces retirées.`);
        adminSearchPlayer(currentAdminTarget.name);
    } catch (e) {
        showToast("❌ Erreur.");
    }
}
async function adminGiveCoins() {
    if (!isAdminUser || !currentAdminTarget) return;
    const amount = parseInt(prompt("Pièces à donner ?", "1000"), 10);
    if (isNaN(amount) || amount <= 0) return;
    try {
        const sSnap = await window.FB.get(
            window.FB.ref(window.FB.db, "saves/" + currentAdminTarget.uid),
        );
        if (sSnap.exists()) {
            const s = sSnap.val();
            await window.FB.update(
                window.FB.ref(window.FB.db, "saves/" + currentAdminTarget.uid),
                { coins: (s.coins || 0) + amount },
            );
        } else {
            await window.FB.set(
                window.FB.ref(window.FB.db, "saves/" + currentAdminTarget.uid),
                { coins: amount },
            );
        }
        showToast(`💰 ${amount} pièces données.`);
    } catch (e) {
        showToast("❌ Erreur.");
    }
}
async function adminGiveLuck() {
    if (!isAdminUser || !currentAdminTarget) return;
    const pct = parseInt(prompt("Bonus chance en % (ex: 50) ?", "50"), 10);
    if (isNaN(pct) || pct === 0) return;
    try {
        const sSnap = await window.FB.get(
            window.FB.ref(window.FB.db, "saves/" + currentAdminTarget.uid),
        );
        const s = sSnap.exists() ? sSnap.val() : {};
        const newBonus = (s.adminLuckBonus || 0) + pct / 100;
        await window.FB.update(
            window.FB.ref(window.FB.db, "saves/" + currentAdminTarget.uid),
            { adminLuckBonus: newBonus },
        );
        showToast(`🍀 +${pct}% chance données.`);
    } catch (e) {
        showToast("❌ Erreur.");
    }
}
async function adminRemoveAura() {
    if (!isAdminUser || !currentAdminTarget) return;
    const auraId = prompt("ID de l'aura (ex: a108) :", "");
    if (!auraId) return;
    if (!AURA_BY_ID[auraId]) {
        showToast("❌ Aura inconnue.");
        return;
    }
    try {
        const sSnap = await window.FB.get(
            window.FB.ref(window.FB.db, "saves/" + currentAdminTarget.uid),
        );
        if (!sSnap.exists()) {
            showToast("❌ Pas de save.");
            return;
        }
        const s = sSnap.val();
        const inventory = s.inventory || {};
        if (!inventory[auraId]) {
            showToast("❌ Aura absente.");
            return;
        }
        delete inventory[auraId];
        await window.FB.update(
            window.FB.ref(window.FB.db, "saves/" + currentAdminTarget.uid),
            { inventory },
        );
        showToast(`✦ ${AURA_BY_ID[auraId].name} retirée.`);
    } catch (e) {
        showToast("❌ Erreur.");
    }
}

/* ✅ Efface TOUTES les stats du joueur (sauf le pseudo) */
async function adminWipeStats() {
    if (!isAdminUser || !currentAdminTarget) return;
    const confirmed = confirm(
        `⚠️ Effacer TOUTES les stats de ${currentAdminTarget.name} ?\n\n` +
            `• Rolls\n• Pièces\n• Inventaire\n• Auras découvertes\n• Niveau / XP\n` +
            `• Titres\n• Skins\n• Améliorations\n• Effets actifs\n• Classement\n\n` +
            `Le pseudo sera conservé. Action IRRÉVERSIBLE.`,
    );
    if (!confirmed) return;
    const uid = currentAdminTarget.uid;
    const name = currentAdminTarget.name;
    const statusEl = document.getElementById("admin-status");
    statusEl.textContent = "⏳ Effacement en cours...";
    try {
        const freshSave = {
            version: SAVE_VERSION,
            _uid: uid,
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
            xp: 0,
            level: 1,
            equippedTitle: null,
            unlockedTitles: [],
            equippedSkin: "default",
            unlockedSkins: ["default"],
            skillBranch: null,
            adminLuckBonus: 0,
            settings: {
                sound: true,
                volume: 0.5,
                reduceAnim: false,
                hideCommon: false,
            },
        };
        await window.FB.set(
            window.FB.ref(window.FB.db, "saves/" + uid),
            freshSave,
        );
        await window.FB.update(window.FB.ref(window.FB.db, "players/" + uid), {
            name: name,
            bestAuraName: "Aucune",
            bestAuraRarity: "none",
            bestAuraScore: 0,
            bestAuraWeight: 0,
            bestAuraChance: "—",
            totalRolls: 0,
            playTime: 0,
            level: 1,
            xp: 0,
            updatedAt: Date.now(),
        });
        try {
            await window.FB.remove(
                window.FB.ref(window.FB.db, "activity/" + uid),
            );
        } catch (e) {}
        if (uid === state.uid) {
            state = createDefaultState();
            state.uid = uid;
            state.username = name;
            lastRolledAura = null;
            saveGame(true);
            renderUI();
            console.info("🔄 Auto-wipe détecté → état local reset");
        }
        statusEl.textContent = `✅ Stats de ${name} effacées.`;
        showToast(`🗑️ Stats de ${name} effacées.`);
        adminSearchPlayer(name);
        loadAdminBanList();
    } catch (e) {
        console.error("adminWipeStats error:", e);
        let msg = e.message || "inconnue";
        if (e.code === "PERMISSION_DENIED")
            msg = "Permission refusée. Vérifie les règles Firebase.";
        statusEl.textContent = "❌ Erreur : " + msg;
        showToast("❌ " + msg);
    }
}

/* ✅ Supprime DÉFINITIVEMENT le compte (marqueur deleted + ban permanent + wipe total) */
async function adminDeleteAccount() {
    if (!isAdminUser || !currentAdminTarget) return;

    const uid = currentAdminTarget.uid;
    const name = currentAdminTarget.name;

    const confirmed = confirm(
        `⚠️ SUPPRIMER DÉFINITIVEMENT le compte de ${name} ?\n\n` +
            `Cette action va :\n` +
            `• Marquer le compte comme supprimé (il ne pourra PLUS se connecter)\n` +
            `• Supprimer sa save (progression)\n` +
            `• Supprimer son profil joueur (classement)\n` +
            `• Supprimer son pseudo (/usernames/)\n` +
            `• Supprimer son activité\n` +
            `• Le bannir de force (permanent)\n\n` +
            `⚠️ IRRÉVERSIBLE.`,
    );
    if (!confirmed) return;

    const confirmed2 = confirm(
        `Es-tu VRAIMENT sûr ? Cette action est DÉFINITIVE.`,
    );
    if (!confirmed2) return;

    const statusEl = document.getElementById("admin-status");
    statusEl.textContent = "⏳ Suppression en cours...";

    try {
        // 1. Marquer comme supprimé (marqueur principal)
        try {
            await window.FB.set(window.FB.ref(window.FB.db, "deleted/" + uid), {
                deletedAt: Date.now(),
                by: state.username,
                name: name,
                reason: "Compte supprimé par admin",
            });
        } catch (e) {
            console.warn("Écriture deleted échouée :", e.message);
        }

        // 2. Marquer le pseudo comme supprimé (bloque la reconnexion)
        try {
            await window.FB.set(
                window.FB.ref(
                    window.FB.db,
                    "deleted_usernames/" + name.toLowerCase(),
                ),
                {
                    uid: uid,
                    deletedAt: Date.now(),
                    by: state.username,
                },
            );
        } catch (e) {
            console.warn("Écriture deleted_usernames échouée :", e.message);
        }

        // 3. Ban permanent (sécurité supplémentaire)
        try {
            await window.FB.set(window.FB.ref(window.FB.db, "bans/" + uid), {
                until: Date.now() + 9999 * 365 * 24 * 60 * 60 * 1000,
                reason: "Compte supprimé définitivement",
                ts: Date.now(),
                name: name,
                by: state.username,
                deleted: true,
            });
        } catch (e) {
            console.warn("Écriture ban échouée :", e.message);
        }

        // 4. Supprimer la save
        try {
            await window.FB.remove(window.FB.ref(window.FB.db, "saves/" + uid));
        } catch (e) {
            console.warn("Suppression save échouée :", e.message);
        }

        // 5. Supprimer le profil joueur (classement)
        try {
            await window.FB.remove(
                window.FB.ref(window.FB.db, "players/" + uid),
            );
        } catch (e) {
            console.warn("Suppression player échouée :", e.message);
        }

        // 6. Supprimer le pseudo
        try {
            const usernamesSnap = await window.FB.get(
                window.FB.ref(window.FB.db, "usernames"),
            );
            if (usernamesSnap.exists()) {
                const removals = [];
                usernamesSnap.forEach((child) => {
                    if (child.val().uid === uid) {
                        removals.push(
                            window.FB.remove(
                                window.FB.ref(
                                    window.FB.db,
                                    "usernames/" + child.key,
                                ),
                            ),
                        );
                    }
                });
                await Promise.all(removals);
            }
        } catch (e) {
            console.warn("Suppression username échouée :", e.message);
        }

        // 7. Supprimer l'activité
        try {
            await window.FB.remove(
                window.FB.ref(window.FB.db, "activity/" + uid),
            );
        } catch (e) {
            console.warn("Suppression activity échouée :", e.message);
        }

        // 8. Supprimer les amis
        try {
            await window.FB.remove(
                window.FB.ref(window.FB.db, "friends/" + uid),
            );
        } catch (e) {
            console.warn("Suppression friends échouée :", e.message);
        }

        // 9. Supprimer le freeze
        try {
            await window.FB.remove(
                window.FB.ref(window.FB.db, "frozen/" + uid),
            );
        } catch (e) {}

        // 10. Kick immédiat
        try {
            await window.FB.set(window.FB.ref(window.FB.db, "kicked/" + uid), {
                ts: Date.now(),
                reason: "Compte supprimé",
                until: Date.now() + 9999 * 365 * 24 * 60 * 60 * 1000,
            });
        } catch (e) {}

        statusEl.textContent = `✅ Compte de ${name} supprimé.`;
        showToast(`❌ Compte de ${name} supprimé définitivement.`);

        currentAdminTarget = null;
        document.getElementById("admin-player-info").classList.add("hidden");
        loadAdminBanList();
    } catch (e) {
        console.error("adminDeleteAccount error:", e);
        statusEl.textContent = "❌ Erreur : " + (e.message || "inconnue");
        showToast("❌ Erreur lors de la suppression.");
    }
}

/* ✅ Ban UID uniquement */
async function adminBan() {
    if (!isAdminUser || !currentAdminTarget) return;
    const durationInput = prompt(
        "Durée (minutes) ?\n• Nombre > 0 : ban temporaire\n• 0 : BAN PERMANENT",
        "60",
    );
    if (durationInput === null) return;
    const durationMin = parseInt(durationInput, 10);
    if (isNaN(durationMin) || durationMin < 0) return;
    const reason = prompt("Raison ?", "Banni par admin") || "Banni par admin";
    const until =
        durationMin === 0
            ? Date.now() + 9999 * 365 * 24 * 60 * 60 * 1000
            : Date.now() + durationMin * 60 * 1000;
    try {
        const banData = {
            until,
            reason,
            ts: Date.now(),
            name: currentAdminTarget.name,
            by: state.username,
        };
        await window.FB.set(
            window.FB.ref(window.FB.db, "bans/" + currentAdminTarget.uid),
            banData,
        );
        try {
            await window.FB.set(
                window.FB.ref(window.FB.db, "kicked/" + currentAdminTarget.uid),
                { ts: Date.now(), reason, until },
            );
        } catch (e) {
            console.warn("Kick échoué (ignoré) :", e.message);
        }
        const label = durationMin === 0 ? "PERMANENT" : durationMin + " min";
        showToast(`🚫 ${currentAdminTarget.name} banni ${label} (UID).`);
        adminSearchPlayer(currentAdminTarget.name);
        loadAdminBanList();
    } catch (e) {
        console.warn(e);
        showToast("❌ Erreur.");
    }
}

/* ✅ Ban UID + IP */
async function adminBanIP() {
    if (!isAdminUser || !currentAdminTarget) return;
    const durationInput = prompt(
        "Durée (minutes) ?\n• Nombre > 0 : ban temporaire\n• 0 : BAN PERMANENT",
        "60",
    );
    if (durationInput === null) return;
    const durationMin = parseInt(durationInput, 10);
    if (isNaN(durationMin) || durationMin < 0) return;
    const reason = prompt("Raison ?", "Banni par admin") || "Banni par admin";
    const until =
        durationMin === 0
            ? Date.now() + 9999 * 365 * 24 * 60 * 60 * 1000
            : Date.now() + durationMin * 60 * 1000;
    try {
        const pSnap = await window.FB.get(
            window.FB.ref(window.FB.db, "players/" + currentAdminTarget.uid),
        );
        const player = pSnap.exists() ? pSnap.val() : {};
        const targetIp = player.lastIp || null;
        const banData = {
            until,
            reason,
            ts: Date.now(),
            name: currentAdminTarget.name,
            by: state.username,
            ip: targetIp,
        };
        await window.FB.set(
            window.FB.ref(window.FB.db, "bans/" + currentAdminTarget.uid),
            banData,
        );
        if (targetIp) {
            try {
                await window.FB.set(
                    window.FB.ref(window.FB.db, "ip_bans/" + ipToKey(targetIp)),
                    banData,
                );
            } catch (e) {
                console.warn("Ban IP échoué (ignoré) :", e.message);
            }
        }
        try {
            await window.FB.set(
                window.FB.ref(window.FB.db, "kicked/" + currentAdminTarget.uid),
                { ts: Date.now(), reason, until },
            );
        } catch (e) {
            console.warn("Kick échoué (ignoré) :", e.message);
        }
        const label = durationMin === 0 ? "PERMANENT" : durationMin + " min";
        showToast(
            `🚫 ${currentAdminTarget.name} banni ${label}${targetIp ? " (UID + IP)" : " (UID seul)"}.`,
        );
        adminSearchPlayer(currentAdminTarget.name);
        loadAdminBanList();
    } catch (e) {
        console.warn(e);
        showToast("❌ Erreur.");
    }
}

async function adminUnban() {
    if (!isAdminUser || !currentAdminTarget) return;
    try {
        try {
            await window.FB.remove(
                window.FB.ref(window.FB.db, "bans/" + currentAdminTarget.uid),
            );
        } catch (e) {
            console.warn("Suppression ban UID échouée :", e.message);
        }
        try {
            const pSnap = await window.FB.get(
                window.FB.ref(
                    window.FB.db,
                    "players/" + currentAdminTarget.uid,
                ),
            );
            const player = pSnap.exists() ? pSnap.val() : {};
            if (player.lastIp) {
                await window.FB.remove(
                    window.FB.ref(
                        window.FB.db,
                        "ip_bans/" + ipToKey(player.lastIp),
                    ),
                );
            }
        } catch (e) {
            console.warn("Suppression ban IP échouée (ignorée) :", e.message);
        }
        try {
            await window.FB.remove(
                window.FB.ref(window.FB.db, "kicked/" + currentAdminTarget.uid),
            );
        } catch (e) {}
        showToast(`✅ ${currentAdminTarget.name} débanni.`);
        if (currentAdminTarget.uid === state.uid) {
            window.__auraBanLocked = false;
            window.__auraBanUntil = 0;
            try {
                localStorage.removeItem("auraRng_localBan");
            } catch (e) {}
            clearInterval(banTimerInterval);
            const overlay = document.getElementById("ban-overlay");
            if (overlay) {
                overlay.classList.add("hidden");
                delete overlay.dataset.activeUntil;
            }
            const rb = document.getElementById("roll-btn");
            if (rb) rb.disabled = false;
            const ab = document.getElementById("auto-roll-btn");
            if (ab) ab.disabled = false;
            console.info("🔓 Auto-unban détecté → déverrouillé");
        }
        adminSearchPlayer(currentAdminTarget.name);
        loadAdminBanList();
    } catch (e) {
        showToast("❌ Erreur.");
    }
}
/* ---------- 13. ÉVÉNEMENTS ---------- */

function handleAuraReveal(aura) {
    if (REVEAL_RARITIES.includes(aura.rarity) && !state.settings.reduceAnim)
        showReveal(aura);
    else if (!state.settings.hideCommon || aura.rarity !== "common")
        showToast(`✨ ${aura.name} (${aura.rarity})`);
}

$("#roll-btn").addEventListener("click", () => {
    if (rollLock) return;
    rollLock = true;
    $("#roll-btn").disabled = true;
    const delay = state.settings.reduceAnim ? 0 : 300;
    setTimeout(() => {
        try {
            const aura = performRoll();
            if (!aura) return;
            handleAuraReveal(aura);
            playSound("roll");
            if (REVEAL_RARITIES.includes(aura.rarity)) playSound("rare");
            renderUI();
            displayAura(aura);
            saveGame();
        } catch (e) {
        } finally {
            rollLock = false;
            if (!autoRollActive) $("#roll-btn").disabled = false;
        }
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
        if (!rollLock) $("#roll-btn").disabled = false;
    }
}
function runAutoRollLoop() {
    if (!autoRollActive) return;
    if (rollLock) {
        autoRollTimer = setTimeout(runAutoRollLoop, 100);
        return;
    }
    rollLock = true;
    $("#roll-btn").disabled = true;
    try {
        const aura = performRoll();
        if (!aura) {
            autoRollActive = false;
            const btn = $("#auto-roll-btn");
            btn.textContent = "Auto Roll : OFF";
            btn.classList.remove("active");
            showToast("🚫 Auto Roll arrêté.");
            return;
        }
        handleAuraReveal(aura);
        playSound("roll");
        renderUI();
        displayAura(aura);
        saveGame();
    } catch (e) {
    } finally {
        rollLock = false;
        if (!autoRollActive) $("#roll-btn").disabled = false;
    }
    let interval = 600;
    const speedEffect = state.activeEffects.find((e) => e.speed);
    if (speedEffect) interval *= 1 - speedEffect.speed;
    interval *= 1 - getUpgradeEffect("speed");
    if (state.skillBranch === "speed") interval *= 0.5;
    interval = Math.max(AUTOROLL_MIN_INTERVAL, interval);
    autoRollTimer = setTimeout(runAutoRollLoop, interval);
}

function openAutoRollPaywall() {
    state.autoRollPaywallOpenCount++;
    saveGame();
    const modal = document.getElementById("autoroll-paywall"),
        secretBox = document.getElementById("paywall-secret");
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
            const fc = cancel.cloneNode(true);
            cancel.parentNode.replaceChild(fc, cancel);
            fc.addEventListener("click", closeFakePayment);
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
        "Vérification...",
        "Autorisation...",
        "Traitement...",
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
                msg: `${method} a détecté une anomalie 😏`,
            },
            {
                title: "Fonds insuffisants",
                msg: `Ton compte ${method} est vide 😂`,
            },
            {
                title: "Erreur inconnue",
                msg: `Code TROLL-${Math.floor(Math.random() * 9000) + 1000}`,
            },
            {
                title: "Compte introuvable",
                msg: `Aucun compte ${method} associé 🤷`,
            },
            { title: "Vérification échouée", msg: `Identité refusée 🎣` },
            { title: "Serveur surchargé", msg: `Serveur en pause café ☕` },
            { title: "Session expirée", msg: `Session expirée 🕵️` },
            { title: "Paiement suspect", msg: `Trop beau pour être vrai 😎` },
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
$("#titles-btn").addEventListener("click", () => {
    renderTitles();
    openModal("titles-modal");
});
$("#skills-btn").addEventListener("click", () => {
    renderSkills();
    openModal("skills-modal");
});
$("#skins-btn").addEventListener("click", () => {
    renderSkins();
    openModal("skins-modal");
});
$("#chat-btn").addEventListener("click", () => {
    if (!getPlayerName()) {
        showToast("❌ Connecte-toi.");
        return;
    }
    startChatListener();
    openModal("chat-modal");
    setTimeout(() => {
        const box = document.getElementById("chat-messages");
        if (box) box.scrollTop = box.scrollHeight;
    }, 100);
});
$("#friends-btn").addEventListener("click", async () => {
    if (!getPlayerName()) {
        showToast("❌ Connecte-toi.");
        return;
    }
    await loadFriendsLists();
    friendsUnreadCount = 0;
    updateFriendsBadge();
    renderFriendsStats();
    refreshFriendsTab();
    loadFriendsFeed();
    openModal("friends-modal");
});
$("#stats-btn").addEventListener("click", () => {
    renderStats();
    openModal("stats-modal");
});
$("#settings-btn").addEventListener("click", () => openModal("settings-modal"));

document.querySelectorAll(".friends-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document
            .querySelectorAll(".friends-tab")
            .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        friendsCurrentTab = tab.dataset.friends;
        if (friendsCurrentTab === "search") renderSearchTab();
        else refreshFriendsTab();
    });
});

const chatSendBtn = document.getElementById("chat-send");
if (chatSendBtn) chatSendBtn.addEventListener("click", sendChatMessage);
const chatInput = document.getElementById("chat-input");
if (chatInput)
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendChatMessage();
        }
    });

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
        showToast("❌ Connecte-toi.");
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

const resetAtBtn = document.getElementById("reset-antitamper-btn");
if (resetAtBtn)
    resetAtBtn.addEventListener("click", () => {
        if (window.__auraAntiTamper) {
            window.__auraAntiTamper.violations.reset();
            showToast("✅ Violations réinitialisées");
        }
    });

document.getElementById("clean-lb-btn").addEventListener("click", async () => {
    if (!confirm("Supprimer les entrées 'Joueur' ?")) return;
    const btn = document.getElementById("clean-lb-btn");
    btn.disabled = true;
    btn.textContent = "🧹 Nettoyage...";
    const result = await cleanGhostPlayers();
    btn.disabled = false;
    btn.textContent = "🧹 Nettoyer le classement (fantômes)";
    if (result.error) showToast("❌ " + result.error);
    else if (result.removed === 0) showToast("✅ Aucun fantôme");
    else showToast(`✅ ${result.removed} supprimé(s)`);
});

$("#reset-save-btn").addEventListener("click", () => {
    if (!confirm("⚠️ Effacer toute la progression ?")) return;
    localStorage.removeItem(getSaveKey());
    const uid = state.uid,
        username = state.username;
    if (uid && window.FB) {
        window.FB.set(window.FB.ref(window.FB.db, "saves/" + uid), null).catch(
            () => {},
        );
    }
    state = createDefaultState();
    state.uid = uid;
    state.username = username;
    lastRolledAura = null;
    saveGame(true);
    location.reload();
});

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("admin-toggle");
    if (btn) btn.addEventListener("click", openAdminPanel);
    const searchBtn = document.getElementById("admin-search-btn"),
        searchInput = document.getElementById("admin-search-input");
    if (searchBtn)
        searchBtn.addEventListener("click", () =>
            adminSearchPlayer(searchInput.value.trim()),
        );
    if (searchInput)
        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") adminSearchPlayer(searchInput.value.trim());
        });
    const bind = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("click", fn);
    };
    bind("admin-freeze-btn", adminFreezeToggle);
    bind("admin-reset-rolls-btn", adminResetRolls);
    bind("admin-reset-coins-btn", adminResetCoins);
    bind("admin-give-coins-btn", adminGiveCoins);
    bind("admin-give-luck-btn", adminGiveLuck);
    bind("admin-remove-aura-btn", adminRemoveAura);
    bind("admin-wipe-btn", adminWipeStats);
    bind("admin-delete-btn", adminDeleteAccount);
    bind("admin-ban-btn", adminBan);
    bind("admin-ban-ip-btn", adminBanIP);
    bind("admin-unban-btn", adminUnban);
    detectConsoleInput();

    // ✅ Bouton déconnexion dans l'overlay de ban
    const banLogoutBtn = document.getElementById("ban-logout-btn");
    if (banLogoutBtn) {
        banLogoutBtn.addEventListener("click", async () => {
            if (
                !confirm("Se déconnecter ? Tu pourras créer un nouveau compte.")
            )
                return;
            try {
                if (window.FB && window.FB.signOut) {
                    await window.FB.signOut(window.FB.auth);
                }
            } catch (e) {}
            try {
                localStorage.removeItem("auraRng_localBan");
            } catch (e) {}
            window.__auraBanLocked = false;
            window.__auraBanUntil = 0;
            location.reload();
        });
    }
});

/* ---------- 14. AUDIO ---------- */

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
    const osc = audioCtx.createOscillator(),
        gain = audioCtx.createGain();
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
        const osc2 = audioCtx.createOscillator(),
            gain2 = audioCtx.createGain();
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

/* ---------- 15. INIT ---------- */

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
    startPlayTimeTracker();
    startBiomeParticles();
    setTimeout(cleanOldAnnouncements, 5000);
    console.log("🎮 Aura RNG prêt !");
}

if (checkLocalBan()) {
    console.info("🚫 Ban local actif au démarrage");
}

function waitForFB(cb, attempt = 0) {
    if (window.FB) return cb();
    if (attempt > 50) {
        console.warn("⚠️ Firebase n'a pas répondu après 5s");
        return;
    }
    setTimeout(() => waitForFB(cb, attempt + 1), 100);
}

waitForFB(() => {
    init();
});

/* ---------- 16. EXPOSE POUR ANTI-TRICHE ---------- */

window.performRoll = performRoll;
window.registerAura = registerAura;
window.getTotalLuckMultiplier = getTotalLuckMultiplier;
window.pushToLeaderboard = pushToLeaderboard;
window.state = state;

setTimeout(() => {
    if (window.__auraAntiTamper) {
        window.__auraAntiTamper.snapshot();
        window.__auraAntiTamper.freeze(["performRoll", "registerAura"]);
        window.__auraAntiTamper.lockState();
        setInterval(() => {
            const integrity = window.__auraAntiTamper.checkIntegrity();
            if (!integrity.ok) {
                console.warn("🚨", integrity.reason);
                document.body.innerHTML = `<div style="color:#fff;background:#1a0000;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;padding:40px;"><div><h1 style="color:#f87171;">🚫 Triche détectée</h1><p style="margin-top:20px;opacity:.8;">${integrity.reason}</p><p style="margin-top:20px;opacity:.6;">Recharge la page.</p></div></div>`;
            }
        }, 5000);
    }
}, 1000);
