/* =========================================================
   AURA RNG — script.js
   ========================================================= */

/* =========================================================
   1. CONFIGURATION
   ========================================================= */

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

// ===== BASE DE DONNÉES DES AURAS =====
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
        weight: 9000,
        desc: "Un souffle léger.",
    },
    {
        id: "a03",
        name: "Rosée",
        rarity: "common",
        weight: 8500,
        desc: "Une goutte matinale.",
    },
    {
        id: "a04",
        name: "Sable",
        rarity: "common",
        weight: 8000,
        desc: "Grains emportés par le vent.",
    },
    {
        id: "a05",
        name: "Éclat terne",
        rarity: "common",
        weight: 7500,
        desc: "Une lueur sans éclat.",
    },
    {
        id: "a06",
        name: "Feuille",
        rarity: "uncommon",
        weight: 2000,
        desc: "Une feuille animée.",
    },
    {
        id: "a07",
        name: "Ondine",
        rarity: "uncommon",
        weight: 1800,
        desc: "Une onde douce.",
    },
    {
        id: "a08",
        name: "Braise",
        rarity: "uncommon",
        weight: 1500,
        desc: "Une petite flamme.",
    },
    {
        id: "a09",
        name: "Cristal",
        rarity: "uncommon",
        weight: 1300,
        desc: "Un cristal pur.",
    },
    {
        id: "a10",
        name: "Zéphyr",
        rarity: "uncommon",
        weight: 1100,
        desc: "Vent rapide et léger.",
    },
    {
        id: "a11",
        name: "Lame",
        rarity: "rare",
        weight: 400,
        desc: "Une lame tranchante.",
    },
    {
        id: "a12",
        name: "Prisme",
        rarity: "rare",
        weight: 350,
        desc: "Un prisme de lumière.",
    },
    {
        id: "a13",
        name: "Écho",
        rarity: "rare",
        weight: 300,
        desc: "Un écho profond.",
    },
    {
        id: "a14",
        name: "Givre",
        rarity: "rare",
        weight: 250,
        desc: "Glace éternelle.",
    },
    {
        id: "a15",
        name: "Foudre",
        rarity: "rare",
        weight: 200,
        desc: "Un éclair fulgurant.",
    },
    {
        id: "a16",
        name: "Nébuleuse",
        rarity: "epic",
        weight: 80,
        desc: "Une nébuleuse colorée.",
    },
    {
        id: "a17",
        name: "Phénix",
        rarity: "epic",
        weight: 60,
        desc: "Renaît de ses cendres.",
    },
    {
        id: "a18",
        name: "Abysse",
        rarity: "epic",
        weight: 50,
        desc: "Les profondeurs obscures.",
    },
    {
        id: "a19",
        name: "Tempête",
        rarity: "epic",
        weight: 40,
        desc: "Une tempête déchaînée.",
    },
    {
        id: "a20",
        name: "Séraphin",
        rarity: "epic",
        weight: 30,
        desc: "Une aura céleste.",
    },
    {
        id: "a21",
        name: "Éclipse",
        rarity: "legendary",
        weight: 15,
        desc: "Soleil noir.",
    },
    {
        id: "a22",
        name: "Draconique",
        rarity: "legendary",
        weight: 12,
        desc: "Souffle du dragon.",
    },
    {
        id: "a23",
        name: "Vortex",
        rarity: "legendary",
        weight: 10,
        desc: "Tourbillon cosmique.",
    },
    {
        id: "a24",
        name: "Aurore",
        rarity: "legendary",
        weight: 8,
        desc: "Lueur polaire.",
    },
    {
        id: "a25",
        name: "Ragnarök",
        rarity: "legendary",
        weight: 6,
        desc: "Fin des mondes.",
    },
    {
        id: "a26",
        name: "Chronos",
        rarity: "mythic",
        weight: 3,
        desc: "Maître du temps.",
    },
    {
        id: "a27",
        name: "Hadès",
        rarity: "mythic",
        weight: 2,
        desc: "Roi des enfers.",
    },
    {
        id: "a28",
        name: "Nyx",
        rarity: "mythic",
        weight: 2,
        desc: "Déesse de la nuit.",
    },
    {
        id: "a29",
        name: "Anubis",
        rarity: "mythic",
        weight: 2,
        desc: "Gardien des âmes.",
    },
    {
        id: "a30",
        name: "Léviathan",
        rarity: "mythic",
        weight: 1,
        desc: "Monstre des abysses.",
    },
    {
        id: "a31",
        name: "Création",
        rarity: "divine",
        weight: 1,
        desc: "L'origine du tout.",
    },
    {
        id: "a32",
        name: "Lumière pure",
        rarity: "divine",
        weight: 1,
        desc: "Lumière absolue.",
    },
    {
        id: "a33",
        name: "Éternité",
        rarity: "divine",
        weight: 1,
        desc: "Sans fin.",
    },
    {
        id: "a34",
        name: "Omniscience",
        rarity: "divine",
        weight: 1,
        desc: "Savoir absolu.",
    },
    {
        id: "a35",
        name: "Voie lactée",
        rarity: "celestial",
        weight: 1,
        desc: "La galaxie entière.",
    },
    {
        id: "a36",
        name: "Andromède",
        rarity: "celestial",
        weight: 1,
        desc: "Galaxie lointaine.",
    },
    {
        id: "a37",
        name: "Quasar",
        rarity: "celestial",
        weight: 1,
        desc: "Cœur énergétique.",
    },
    {
        id: "a38",
        name: "Big Bang",
        rarity: "cosmic",
        weight: 1,
        desc: "Naissance de l'univers.",
    },
    {
        id: "a39",
        name: "Singularité",
        rarity: "cosmic",
        weight: 1,
        desc: "Trou noir originel.",
    },
    {
        id: "a40",
        name: "Multivers",
        rarity: "cosmic",
        weight: 1,
        desc: "Toutes les réalités.",
    },
    {
        id: "a41",
        name: "Genesis",
        rarity: "secret",
        weight: 1,
        desc: "La première étincelle.",
    },
    {
        id: "a42",
        name: "Oméga",
        rarity: "secret",
        weight: 1,
        desc: "La fin de tout.",
    },
    {
        id: "a43",
        name: "Rêve",
        rarity: "secret",
        weight: 1,
        desc: "Illusion parfaite.",
    },
    {
        id: "a44",
        name: "Néant",
        rarity: "secret",
        weight: 1,
        desc: "Le vide absolu.",
    },
    {
        id: "a45",
        name: "Aura ultime",
        rarity: "secret",
        weight: 1,
        desc: "L'aura des légendes.",
    },
    {
        id: "a46",
        name: "Brumé",
        rarity: "common",
        weight: 7000,
        desc: "Brume épaisse.",
    },
    {
        id: "a47",
        name: "Épine",
        rarity: "uncommon",
        weight: 1400,
        desc: "Rose acérée.",
    },
    {
        id: "a48",
        name: "Mirage",
        rarity: "rare",
        weight: 220,
        desc: "Illusion du désert.",
    },
    {
        id: "a49",
        name: "Oracle",
        rarity: "epic",
        weight: 35,
        desc: "Voit l'avenir.",
    },
    {
        id: "a50",
        name: "Titan",
        rarity: "legendary",
        weight: 7,
        desc: "Force colossale.",
    },
    {
        id: "a51",
        name: "Soleil noir",
        rarity: "mythic",
        weight: 2,
        desc: "Étoile morte.",
    },
    {
        id: "a52",
        name: "Infini",
        rarity: "divine",
        weight: 1,
        desc: "Concept absolu.",
    },
    {
        id: "a53",
        name: "Supernova",
        rarity: "cosmic",
        weight: 1,
        desc: "Explosion stellaire.",
    },
];

const AURA_BY_ID = Object.fromEntries(AURAS.map((a) => [a.id, a]));

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
        luckBonus: 1.05,
        desc: "Débloqué après 100 rolls.",
    },
    {
        id: "desert",
        name: "Désert",
        className: "bg-desert",
        unlockRolls: 500,
        luckBonus: 1.1,
        desc: "Débloqué après 500 rolls.",
    },
    {
        id: "ocean",
        name: "Océan",
        className: "bg-ocean",
        unlockRolls: 2000,
        luckBonus: 1.2,
        desc: "Débloqué après 2000 rolls.",
    },
    {
        id: "space",
        name: "Espace",
        className: "bg-space",
        unlockRolls: 10000,
        luckBonus: 1.35,
        desc: "Débloqué après 10 000 rolls.",
    },
    {
        id: "cosmic",
        name: "Dimension cosmique",
        className: "bg-cosmic",
        unlockRolls: 50000,
        luckBonus: 1.5,
        desc: "Débloqué après 50 000 rolls.",
    },
];

const POTIONS = [
    {
        id: "p_luck1",
        name: "Potion de chance I",
        price: 250,
        bonus: 1.25,
        duration: 60,
        desc: "Chance x1.25 pendant 1 minute.",
    },
    {
        id: "p_luck2",
        name: "Potion de chance II",
        price: 1200,
        bonus: 1.75,
        duration: 120,
        desc: "Chance x1.75 pendant 2 minutes.",
    },
    {
        id: "p_luck3",
        name: "Élixir de chance",
        price: 5000,
        bonus: 3.0,
        duration: 90,
        desc: "Chance x3 pendant 1 min 30.",
    },
    {
        id: "p_speed",
        name: "Potion de vitesse",
        price: 800,
        speed: 0.5,
        duration: 60,
        desc: "Auto Roll 2x plus rapide pendant 1 min.",
    },
];

const SHOP_ITEMS = [
    {
        id: "i_lucky_charm",
        name: "Talisman porte-bonheur",
        price: 3000,
        luckBonus: 0.05,
        perm: true,
        desc: "+5% de chance en permanence.",
    },
    {
        id: "i_crystal",
        name: "Cristal de chance",
        price: 15000,
        luckBonus: 0.15,
        perm: true,
        desc: "+15% de chance en permanence.",
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
        ingredients: [{ id: "i_essence", qty: 3 }],
        desc: "Craft une Potion de chance II.",
    },
    {
        id: "r_crystal",
        result: { id: "i_crystal", qty: 1 },
        ingredients: [
            { id: "i_essence", qty: 10 },
            { id: "i_shard", qty: 2 },
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
        desc: "Augmente définitivement la chance globale.",
        maxLevel: 10,
        baseCost: 500,
        costMultiplier: 2.2,
        effectPerLevel: 0.05,
        effectType: "luck",
    },
    {
        id: "up_speed",
        name: "Réflexes affûtés",
        desc: "Réduit le délai entre deux Auto Rolls.",
        maxLevel: 8,
        baseCost: 800,
        costMultiplier: 2.0,
        effectPerLevel: 0.08,
        effectType: "speed",
    },
    {
        id: "up_coins",
        name: "Marchand chanceux",
        desc: "Augmente les gains de monnaie.",
        maxLevel: 10,
        baseCost: 400,
        costMultiplier: 2.1,
        effectPerLevel: 0.1,
        effectType: "coins",
    },
    {
        id: "up_double",
        name: "Écho du destin",
        desc: "Chance de dupliquer une aura obtenue.",
        maxLevel: 5,
        baseCost: 5000,
        costMultiplier: 3.0,
        effectPerLevel: 0.02,
        effectType: "double",
    },
    {
        id: "up_potion",
        name: "Alchimiste expert",
        desc: "Réduit le prix des potions.",
        maxLevel: 5,
        baseCost: 1000,
        costMultiplier: 2.4,
        effectPerLevel: 0.05,
        effectType: "potionDiscount",
    },
];

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

const RARE_REVEAL_THRESHOLD = ["divine", "celestial", "cosmic", "secret"];
const AUTOROLL_PRICE_COINS = 1500;
const AUTOROLL_SECRET_UNLOCK_AT = 10;

const SAVE_KEY = "auraRng_save_v1";
const SAVE_VERSION = 1;

const FB_EMAIL_DOMAIN = "@aurarng.local";

/* =========================================================
   2. ÉTAT DU JEU + SAUVEGARDE
   ========================================================= */

function createDefaultState() {
    return {
        version: SAVE_VERSION,
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
        console.warn("Sauvegarde invalide :", e);
    }
}

function saveGame() {
    try {
        localStorage.setItem(getSaveKey(), JSON.stringify(state));
    } catch (e) {
        console.warn("Impossible de sauvegarder :", e);
    }
}

/* =========================================================
   3. LOGIQUE DE ROLL & CHANCE
   ========================================================= */

function getUpgradeLevel(id) {
    return state.upgrades[id] || 0;
}

function getUpgradeCost(upgrade) {
    const level = getUpgradeLevel(upgrade.id);
    if (level >= upgrade.maxLevel) return null;
    return Math.round(
        upgrade.baseCost * Math.pow(upgrade.costMultiplier, level),
    );
}

function getUpgradeEffect(effectType) {
    let total = 0;
    UPGRADES.forEach((up) => {
        if (up.effectType === effectType)
            total += getUpgradeLevel(up.id) * up.effectPerLevel;
    });
    return total;
}

function buyUpgrade(upgrade) {
    const level = getUpgradeLevel(upgrade.id);
    if (level >= upgrade.maxLevel) {
        showToast("⭐ Déjà au niveau maximum.");
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
    showToast(`⭐ ${upgrade.name} niveau ${level + 1} acheté !`);
    saveGame();
    renderUI();
    renderUpgrades();
}

function getTotalLuckMultiplier() {
    let mult = 1;
    const biome = BIOMES.find((b) => b.id === state.currentBiome);
    if (biome) mult *= biome.luckBonus;
    SHOP_ITEMS.forEach((item) => {
        if (item.perm && state.ownedItems[item.id] > 0) mult += item.luckBonus;
    });
    mult += getUpgradeEffect("luck");
    state.activeEffects.forEach((eff) => {
        if (eff.bonus) mult *= eff.bonus;
    });
    if (state.equipped) {
        const equippedAura = AURA_BY_ID[state.equipped];
        if (equippedAura && equippedAura.luckBonus)
            mult *= equippedAura.luckBonus;
    }
    return mult;
}

function pickAuraByWeight(luckMultiplier) {
    const effective = AURAS.map((aura) => {
        const rarityIndex = RARITIES.indexOf(aura.rarity);
        const dampening = 1 - (rarityIndex / (RARITIES.length - 1)) * 0.85;
        const bonus = Math.pow(luckMultiplier, dampening);
        return { aura, weight: aura.weight * bonus };
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
    const total = AURAS.reduce((s, a) => s + a.weight, 0);
    const oneIn = Math.round(total / aura.weight);
    return `1 sur ${oneIn.toLocaleString("fr-FR")}`;
}

function performRoll() {
    const luck = getTotalLuckMultiplier();
    const aura = pickAuraByWeight(luck);
    registerAura(aura);
    return aura;
}

function registerAura(aura) {
    state.totalRolls++;
    const doubleChance = getUpgradeEffect("double");
    const quantity = Math.random() < doubleChance ? 2 : 1;
    state.inventory[aura.id] = (state.inventory[aura.id] || 0) + quantity;
    state.discovered[aura.id] = true;
    if (quantity === 2) showToast("✨ Écho du destin : aura doublée !");

    const currentBest = state.bestAura ? AURA_BY_ID[state.bestAura] : null;
    if (
        !currentBest ||
        RARITIES.indexOf(aura.rarity) > RARITIES.indexOf(currentBest.rarity)
    ) {
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

    const baseReward = COIN_REWARDS[aura.rarity] || 1;
    const coinBonus = 1 + getUpgradeEffect("coins");
    state.coins += Math.round(baseReward * coinBonus);

    BIOMES.forEach((b) => {
        if (
            state.totalRolls >= b.unlockRolls &&
            !state.unlockedBiomes.includes(b.id)
        ) {
            state.unlockedBiomes.push(b.id);
            showToast(`🌍 Nouveau biome débloqué : ${b.name}`);
        }
    });

    if (state.totalRolls % 10 === 0) pushToLeaderboard();
    saveGame();
}

/* =========================================================
   4. RENDU (UI)
   ========================================================= */

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
    text.textContent = aura.name;
    text.style.color = RARITY_COLORS[aura.rarity];
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.add("hidden"), 2500);
}

function displayAura(aura) {
    $("#aura-name").textContent = aura.name;
    $("#aura-rarity").textContent = aura.rarity.toUpperCase();
    $("#aura-chance").textContent = formatChance(aura);
    $("#aura-desc").textContent = aura.desc;
    $("#aura-name").style.color = RARITY_COLORS[aura.rarity];
    $("#aura-visual").className = "rarity-" + aura.rarity;
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

    if (state.equipped && AURA_BY_ID[state.equipped])
        displayAura(AURA_BY_ID[state.equipped]);

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

/* =========================================================
   5. INVENTAIRE / BOUTIQUE / CRAFT / BIOMES / AMÉLIORATIONS / STATS
   ========================================================= */

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
            (a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity),
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
      <div style="color:${RARITY_COLORS[aura.rarity]}; font-size:24px;">◆</div>
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
    } else {
        state.equipped = id;
        showToast("Aura équipée : " + AURA_BY_ID[id].name);
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
        showToast("❌ Tu ne possèdes pas cette potion.");
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
                const name = findItemName(ing.id);
                return `<div style="color:${ok ? "#4ade80" : "#f87171"}">${name} : ${owned} / ${ing.qty}</div>`;
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
      <div class="card-info">Bonus chance : x${b.luckBonus.toFixed(2)}</div>
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

function renderUpgrades() {
    const list = $("#upgrades-list");
    list.innerHTML = "";
    $("#upgrades-coins").textContent = state.coins.toLocaleString("fr-FR");

    UPGRADES.forEach((up) => {
        const level = getUpgradeLevel(up.id);
        const maxed = level >= up.maxLevel;
        const cost = getUpgradeCost(up);
        const totalEffect = level * up.effectPerLevel;
        let effectText = "";
        if (up.effectType === "luck")
            effectText = `Chance actuelle : +${(totalEffect * 100).toFixed(0)}%`;
        if (up.effectType === "speed")
            effectText = `Vitesse actuelle : +${(totalEffect * 100).toFixed(0)}%`;
        if (up.effectType === "coins")
            effectText = `Monnaie actuelle : +${(totalEffect * 100).toFixed(0)}%`;
        if (up.effectType === "double")
            effectText = `Chance de doubler : ${(totalEffect * 100).toFixed(0)}%`;
        if (up.effectType === "potionDiscount")
            effectText = `Réduction boutique : -${(totalEffect * 100).toFixed(0)}%`;

        const card = document.createElement("div");
        card.className = "upgrade-card" + (maxed ? " maxed" : "");
        card.innerHTML = `
      <div class="upgrade-info">
        <div class="upgrade-name">${up.name}</div>
        <div class="upgrade-desc">${up.desc}</div>
        <div class="upgrade-level">Niveau : ${level} / ${up.maxLevel}</div>
        <div class="upgrade-effect">${effectText}</div>
      </div>
      <button ${maxed ? "disabled" : ""}>
        ${maxed ? "MAX" : "💰 " + cost.toLocaleString("fr-FR")}
      </button>
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
    const minutes = Math.floor(state.playTime / 60);
    const totalUpgradeLevels = Object.values(state.upgrades).reduce(
        (a, b) => a + b,
        0,
    );

    $("#stats-content").innerHTML = `
    <p>🎲 Rolls totaux : ${state.totalRolls.toLocaleString("fr-FR")}</p>
    <p>🔍 Auras découvertes : ${discovered} / ${AURAS.length}</p>
    <p>⭐ Meilleure aura : ${bestAura ? bestAura.name + " (" + bestAura.rarity + ")" : "Aucune"}</p>
    <p>🎯 Rolls depuis une aura rare : ${state.rollsSinceRare}</p>
    <p>⏱️ Temps de jeu : ${minutes} min</p>
    <p>💰 Monnaie : ${state.coins.toLocaleString("fr-FR")}</p>
    <p>🧪 Potions utilisées : ${state.usedPotions}</p>
    <p>🔨 Objets fabriqués : ${state.craftedItems}</p>
    <p>⭐ Améliorations achetées : ${totalUpgradeLevels} niveaux</p>
    <p>🤖 Auto Roll : ${state.autoRollUnlocked ? "Débloqué" : "Verrouillé"}</p>
    <p>👤 Joueur : ${state.username || "—"}</p>
    <p>📊 Collection : ${pct}%</p>
    <hr style="margin:10px 0; opacity:.2;" />
    <h3>Répartition par rareté</h3>
    ${RARITIES.map((r) => `<p>${r} : ${byRarity[r]}</p>`).join("")}
  `;
}

/* =========================================================
   6. AUTHENTIFICATION (pseudo + mot de passe) + CLASSEMENT
   ========================================================= */

let authMode = "login";
let authInitialized = false;
let leaderboardInterval = null;

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
            text || "Connexion en cours...";
        loading.classList.remove("hidden");
    } else {
        loading.classList.add("hidden");
    }
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
            "Firebase non chargé. Recharge la page.";
        return;
    }

    const username = document.getElementById("auth-username").value.trim();
    const password = document.getElementById("auth-password").value;
    const errorEl = document.getElementById("auth-error");
    const submitBtn = document.getElementById("auth-submit");

    errorEl.textContent = "";

    if (!username || username.length < 3) {
        errorEl.textContent = "❌ Pseudo trop court (3 min).";
        return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        errorEl.textContent = "❌ Lettres, chiffres et _ uniquement.";
        return;
    }
    if (!password || password.length < 6) {
        errorEl.textContent = "❌ Mot de passe : 6 caractères minimum.";
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

            const userCredential = await FB.createUserWithEmailAndPassword(
                FB.auth,
                email,
                password,
            );
            const user = userCredential.user;

            await FB.set(usernameRef, { uid: user.uid, createdAt: Date.now() });
            try {
                await FB.updateProfile(user, { displayName: username });
            } catch (e) {
                console.warn("updateProfile a échoué (non bloquant) :", e);
            }
        } else {
            await FB.signInWithEmailAndPassword(FB.auth, email, password);
        }
        // onAuthStateChanged va fermer la modale
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
        if (e.code === "auth/too-many-requests")
            msg = "❌ Trop de tentatives. Patiente.";
        if (e.code === "auth/invalid-email") msg = "❌ Pseudo invalide.";
        if (e.code === "auth/operation-not-allowed")
            msg = "❌ Active E-mail/Mot de passe dans Firebase Authentication.";
        if (e.code === "auth/network-request-failed")
            msg = "❌ Problème de connexion réseau.";
        errorEl.textContent = msg;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent =
            authMode === "login" ? "Se connecter" : "Créer mon compte";
    }
}

async function handleLogout() {
    if (!window.FB) return;
    if (!confirm("Se déconnecter ?")) return;
    try {
        await window.FB.signOut(window.FB.auth);
        location.reload();
    } catch (e) {
        console.warn("Erreur déconnexion :", e);
    }
}

function initAuth() {
    const FB = window.FB;
    if (!FB) {
        console.warn("Firebase indisponible.");
        showAuthModal(false);
        return;
    }

    showAuthModal(true);
    setAuthMode("login");

    FB.onAuthStateChanged(FB.auth, async (user) => {
        if (user) {
            showAuthLoading(true, "Chargement de ta progression...");

            // 1) Identité
            state.uid = user.uid;

            // 2) Pseudo depuis la DB (fallback : displayName)
            let username = user.displayName || "Joueur";
            try {
                const snap = await FB.get(FB.ref(FB.db, "usernames"));
                if (snap.exists()) {
                    snap.forEach((child) => {
                        if (child.val().uid === user.uid) username = child.key;
                    });
                }
            } catch (e) {
                console.warn("Impossible de récupérer le pseudo :", e);
            }
            state.username = username;

            // 3) Sauvegarde liée à l'uid
            loadGame();
            state.uid = user.uid;
            state.username = username;

            // 4) UI
            document.getElementById("stat-username").textContent =
                state.username;
            showAuthLoading(false);
            showAuthModal(false);
            renderUI();

            // 5) Sync classement
            pushToLeaderboard();
            initLeaderboard();
        } else {
            state = createDefaultState();
            document.getElementById("stat-username").textContent = "—";
            showAuthLoading(false);
            showAuthModal(true);
            setAuthMode("login");

            if (leaderboardInterval) {
                clearInterval(leaderboardInterval);
                leaderboardInterval = null;
            }
        }
    });
}

// --- CLASSEMENT ---
function getPlayerName() {
    return state.username;
}

function pushToLeaderboard() {
    const name = getPlayerName();
    const uid = state.uid;
    if (!name || !uid || !window.FB) return;

    const { db, ref, update } = window.FB;
    const playerRef = ref(db, "players/" + uid);

    const bestAura = state.bestAura ? AURA_BY_ID[state.bestAura] : null;
    const bestRarityIndex = bestAura ? RARITIES.indexOf(bestAura.rarity) : -1;

    update(playerRef, {
        name,
        bestAuraName: bestAura ? bestAura.name : "Aucune",
        bestAuraRarity: bestAura ? bestAura.rarity : "none",
        bestAuraRarityIndex: bestRarityIndex,
        totalRolls: state.totalRolls,
        playTime: state.playTime,
        updatedAt: Date.now(),
    }).catch((e) => console.warn("Erreur sync classement :", e));
}

function fetchLeaderboard(type, callback) {
    if (!window.FB) {
        callback([]);
        return;
    }
    const { db, ref, query, orderByChild, limitToLast, get } = window.FB;
    const orderField = {
        bestAura: "bestAuraRarityIndex",
        totalRolls: "totalRolls",
        playTime: "playTime",
    }[type];
    if (!orderField) {
        callback([]);
        return;
    }

    const q = query(
        ref(db, "players"),
        orderByChild(orderField),
        limitToLast(20),
    );
    get(q)
        .then((snapshot) => {
            const results = [];
            snapshot.forEach((child) => results.push(child.val()));
            results.reverse();
            callback(results);
        })
        .catch((e) => {
            console.warn("Erreur classement :", e);
            callback([]);
        });
}

function renderLeaderboard(type) {
    const container = $("#lb-content");
    const status = $("#lb-status");
    status.textContent = "Chargement...";
    container.innerHTML = "";

    fetchLeaderboard(type, (players) => {
        if (players.length === 0) {
            status.textContent =
                "Aucun joueur pour le moment. Sois le premier !";
            return;
        }
        status.textContent = `Top ${players.length} joueurs`;
        const myName = getPlayerName();

        players.forEach((p, index) => {
            const rank = index + 1;
            const isMe = myName && p.name === myName;
            let displayValue = "",
                subValue = "";
            if (type === "bestAura") {
                displayValue = p.bestAuraName || "Aucune";
                subValue = p.bestAuraRarity || "";
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
            row.innerHTML = `
        <div class="lb-rank${rankClass}">${rank}</div>
        <div class="lb-name">
          ${p.name || "Anonyme"}${isMe ? ' <span style="opacity:.6">(toi)</span>' : ""}
          ${subValue ? `<span class="lb-sub">${subValue}</span>` : ""}
        </div>
        <div class="lb-value">${displayValue}</div>
      `;
            container.appendChild(row);
        });
    });
}

function initLeaderboard() {
    if (getPlayerName()) pushToLeaderboard();
    if (leaderboardInterval) return;
    leaderboardInterval = setInterval(() => {
        if (getPlayerName()) pushToLeaderboard();
    }, 60000);
}

/* =========================================================
   7. ÉVÉNEMENTS
   ========================================================= */

let rollInProgress = false;
let autoRollActive = false;
let autoRollTimer = null;

$("#roll-btn").addEventListener("click", () => {
    if (rollInProgress) return;
    rollInProgress = true;
    $("#roll-btn").disabled = true;

    const delay = state.settings.reduceAnim ? 0 : 300;
    setTimeout(() => {
        const aura = performRoll();
        displayAura(aura);
        if (
            RARE_REVEAL_THRESHOLD.includes(aura.rarity) &&
            !state.settings.reduceAnim
        )
            showReveal(aura);
        else if (!state.settings.hideCommon || aura.rarity !== "common")
            showToast(`✨ ${aura.name} (${aura.rarity})`);
        playSound("roll");
        if (RARE_REVEAL_THRESHOLD.includes(aura.rarity)) playSound("rare");
        renderUI();
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
    displayAura(aura);
    if (
        RARE_REVEAL_THRESHOLD.includes(aura.rarity) &&
        !state.settings.reduceAnim
    )
        showReveal(aura);
    playSound("roll");
    renderUI();
    saveGame();
    rollInProgress = false;

    let interval = 600;
    const speedEffect = state.activeEffects.find((e) => e.speed);
    if (speedEffect) interval *= 1 - speedEffect.speed;
    interval *= 1 - getUpgradeEffect("speed");
    interval = Math.max(60, interval);

    autoRollTimer = setTimeout(runAutoRollLoop, interval);
}

function openAutoRollPaywall() {
    state.autoRollPaywallOpenCount++;
    saveGame();
    const modal = document.getElementById("autoroll-paywall");
    const secretBox = document.getElementById("paywall-secret");
    const status = document.getElementById("paywall-status");
    status.textContent = "";
    if (state.autoRollPaywallOpenCount >= AUTOROLL_SECRET_UNLOCK_AT)
        secretBox.classList.remove("hidden");
    else secretBox.classList.add("hidden");
    modal.classList.remove("hidden");
}

// --- Fausses pages de paiement ---
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
    const overlay = document.getElementById("fake-payment");
    overlay.classList.remove("hidden");
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
                msg: `${method} a détecté une anomalie. Réessaie plus tard 😏`,
            },
            {
                title: "Fonds insuffisants",
                msg: `Ton compte ${method} est vide. Comme par hasard 😂`,
            },
            {
                title: "Erreur inconnue",
                msg: `Code erreur : TROLL-${Math.floor(Math.random() * 9000) + 1000}. Réessaie 10 fois 😉`,
            },
            {
                title: "Compte introuvable",
                msg: `Aucun compte ${method} associé. Crée-en un 🤷`,
            },
            {
                title: "Vérification échouée",
                msg: `Vérification d'identité refusée. T'as 8 ans ? 🎣`,
            },
            {
                title: "Serveur surchargé",
                msg: `Le serveur de ${method} est en pause café ☕ Réessaie dans 10 ans.`,
            },
            {
                title: "Session expirée",
                msg: `Ta session a expiré. Ferme et rouvre 10 fois 🕵️`,
            },
            {
                title: "Paiement suspect",
                msg: `Ce paiement est trop beau pour être vrai, non ? 😎`,
            },
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

// --- Modales ---
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

// --- AUTH : événements ---
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

// --- CLASSEMENT : événements ---
$("#leaderboard-btn").addEventListener("click", () => {
    if (!getPlayerName()) {
        showToast("❌ Connecte-toi pour voir le classement.");
        return;
    }
    renderLeaderboard("bestAura");
    openModal("leaderboard-modal");
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

// --- Filtres inventaire ---
["inv-search", "inv-filter-rarity", "inv-sort", "inv-show-locked"].forEach(
    (id) => {
        document.getElementById(id).addEventListener("input", renderInventory);
        document.getElementById(id).addEventListener("change", renderInventory);
    },
);

// --- Paramètres ---
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

$("#reset-save-btn").addEventListener("click", () => {
    if (
        !confirm("⚠️ Effacer toute la progression de ce compte ? Irréversible.")
    )
        return;
    localStorage.removeItem(getSaveKey());
    const uid = state.uid;
    const username = state.username;
    state = createDefaultState();
    state.uid = uid;
    state.username = username;
    saveGame();
    location.reload();
});

/* =========================================================
   8. AUDIO
   ========================================================= */
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
        dur = 0.1;
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

    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.value = state.settings.volume * 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
}

/* =========================================================
   9. INITIALISATION
   ========================================================= */
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

    setInterval(() => {
        if (!state.uid) return;
        state.playTime++;
        if (state.playTime % 10 === 0) saveGame();
    }, 1000);
    setInterval(renderEffectsBar, 1000);
    window.addEventListener("beforeunload", () => {
        if (state.uid) saveGame();
    });

    if (!authInitialized) {
        authInitialized = true;
        initAuth();
    }

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
