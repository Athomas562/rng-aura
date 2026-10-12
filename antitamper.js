/* =========================================================
   AURA RNG — antitamper.js
   Protections côté client contre la triche via la console.
   ⚠️ Ces protections sont dissuasives, PAS infaillibles.
   Pour une sécurité forte, il faut du serveur (Cloud Functions).
   ========================================================= */
(function () {
    "use strict";

    // =========================================================
    // 0. CONFIG
    // =========================================================

    const LIMITS = {
        rollsPerSecond: 5,
        rollsPerMinute: 300,
        rollsPerHour: 10000,
        minRollIntervalMs: 60,
    };

    const RATE_KEY = "auraRng_rollRate";
    const VIOLATION_KEY = "auraRng_violations";

    // =========================================================
    // 1. RATE LIMITING
    // =========================================================

    function loadRate() {
        try {
            const raw = localStorage.getItem(RATE_KEY);
            if (!raw) return { hits: [] };
            const p = JSON.parse(raw);
            if (!p || !Array.isArray(p.hits)) return { hits: [] };
            const now = Date.now();
            p.hits = p.hits.filter((t) => now - t < 3600 * 1000);
            return p;
        } catch (e) {
            return { hits: [] };
        }
    }

    function saveRate(data) {
        try {
            localStorage.setItem(RATE_KEY, JSON.stringify(data));
        } catch (e) {}
    }

    function getViolations() {
        try {
            const raw = localStorage.getItem(VIOLATION_KEY);
            return raw ? JSON.parse(raw) : { count: 0, until: 0 };
        } catch (e) {
            return { count: 0, until: 0 };
        }
    }

    function setViolations(v) {
        try {
            localStorage.setItem(VIOLATION_KEY, JSON.stringify(v));
        } catch (e) {}
    }

    window.__auraRateCheck = function () {
        const now = Date.now();
        const v = getViolations();

        // Quarantaine active ?
        if (v.until && now < v.until) {
            const secsLeft = Math.ceil((v.until - now) / 1000);
            return { ok: false, reason: `Quarantaine (${secsLeft}s)` };
        }

        const rate = loadRate();
        const last = rate.hits[rate.hits.length - 1] || 0;

        // Intervalle min entre 2 rolls
        if (now - last < LIMITS.minRollIntervalMs) {
            registerViolation("Trop rapide entre deux rolls.");
            return { ok: false, reason: "Trop rapide." };
        }

        // Limite par seconde
        const inLastSec = rate.hits.filter((t) => now - t < 1000).length;
        if (inLastSec >= LIMITS.rollsPerSecond) {
            registerViolation("Plus de 5 rolls en 1s.");
            return { ok: false, reason: "Trop de rolls par seconde." };
        }

        // Limite par minute
        const inLastMin = rate.hits.filter((t) => now - t < 60000).length;
        if (inLastMin >= LIMITS.rollsPerMinute) {
            registerViolation("Plus de 300 rolls en 1min.");
            return { ok: false, reason: "Trop de rolls par minute." };
        }

        // Limite par heure
        const inLastHour = rate.hits.length;
        if (inLastHour >= LIMITS.rollsPerHour) {
            registerViolation("Plus de 10 000 rolls en 1h.");
            return { ok: false, reason: "Trop de rolls par heure." };
        }

        // OK
        rate.hits.push(now);
        saveRate(rate);
        return { ok: true, reason: null };
    };

    function registerViolation(msg) {
        const v = getViolations();
        v.count = (v.count || 0) + 1;

        let delayMs = 0;
        if (v.count === 1) delayMs = 5000;
        else if (v.count === 2) delayMs = 30000;
        else if (v.count === 3) delayMs = 5 * 60 * 1000;
        else delayMs = 60 * 60 * 1000;

        v.until = Date.now() + delayMs;
        setViolations(v);

        console.warn(`🚨 Violation : ${msg} → quarantaine ${delayMs / 1000}s`);
    }

    // =========================================================
    // 2. GEL DES FONCTIONS CRITIQUES
    // =========================================================

    window.__auraFreeze = function (names) {
        names.forEach((name) => {
            try {
                const original = window[name];
                if (typeof original !== "function") return;

                Object.defineProperty(window, name, {
                    value: original,
                    writable: false,
                    configurable: false,
                    enumerable: true,
                });
            } catch (e) {}
        });
    };

    // =========================================================
    // 3. DÉTECTION DE RÉASSIGNATION
    // =========================================================

    const CRITICAL_FUNCS = [
        "performRoll",
        "registerAura",
        "getTotalLuckMultiplier",
    ];
    const FUNCTION_HASHES = new Map();

    function hashFn(fn) {
        try {
            return fn.toString().slice(0, 200);
        } catch (e) {
            return "unknown";
        }
    }

    window.__auraSnapshot = function () {
        CRITICAL_FUNCS.forEach((name) => {
            const fn = window[name];
            if (typeof fn === "function") {
                FUNCTION_HASHES.set(name, hashFn(fn));
            }
        });
    };

    window.__auraCheckIntegrity = function () {
        for (const name of CRITICAL_FUNCS) {
            const fn = window[name];
            if (typeof fn !== "function") {
                return { ok: false, reason: `${name} supprimée ou remplacée.` };
            }
            const original = FUNCTION_HASHES.get(name);
            if (original && hashFn(fn) !== original) {
                return { ok: false, reason: `${name} a été modifiée.` };
            }
        }
        return { ok: true };
    };

    // =========================================================
    // 4. SURVEILLANCE DE `state`
    // =========================================================

    window.__auraLockState = function () {
        try {
            let lastCoins = null;
            let lastRolls = null;

            setInterval(() => {
                if (!window.state) return;
                const s = window.state;

                // Coins
                if (typeof s.coins === "number") {
                    if (lastCoins !== null && s.coins - lastCoins > 500000) {
                        console.warn("🚨 Augmentation anormale de pièces.");
                        registerViolation("Pièces modifiées brutalement.");
                        s.coins = lastCoins;
                    } else {
                        lastCoins = s.coins;
                    }
                }

                // Rolls
                if (typeof s.totalRolls === "number") {
                    if (lastRolls !== null && s.totalRolls - lastRolls > 500) {
                        console.warn("🚨 Augmentation anormale de rolls.");
                        registerViolation("Rolls modifiés brutalement.");
                        s.totalRolls = lastRolls;
                    } else {
                        lastRolls = s.totalRolls;
                    }
                }
            }, 500);
        } catch (e) {
            console.warn("Impossible de verrouiller state :", e);
        }
    };

    // =========================================================
    // 5. RÉCEPTION DES ÉVÉNEMENTS DE `devtools-detect.js`
    // =========================================================

    function reportEvent(event) {
        if (!event || !event.type) return;
        console.warn(`🛡️ Événement anti-triche [${event.type}]`, event.payload);

        if (event.type === "script-injected") {
            // Script injecté = grave → violation
            registerViolation("Script injecté dans la page.");
        }
        // DevTools ouvert = signal seulement, PAS de violation
    }

    // =========================================================
    // 6. API PUBLIQUE
    // =========================================================

    window.__auraAntiTamper = {
        rateCheck: window.__auraRateCheck,
        freeze: window.__auraFreeze,
        snapshot: window.__auraSnapshot,
        checkIntegrity: window.__auraCheckIntegrity,
        lockState: window.__auraLockState,
        reportEvent,
        violations: {
            get: getViolations,
            reset: () => setViolations({ count: 0, until: 0 }),
        },
    };

    console.log("🛡️ AntiTamper chargé.");
})();
