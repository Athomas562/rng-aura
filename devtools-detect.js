/* =========================================================
   AURA RNG — devtools-detect.js
   Détection : scripts injectés + DevTools ouverts
   ⚠️ Aucune action bloquante — signale uniquement.
   ========================================================= */
(function () {
    "use strict";

    // =========================================================
    // 1. DÉTECTION DE SCRIPTS INJECTÉS
    // =========================================================

    const ALLOWED_SCRIPT_DOMAINS = [
        "gstatic.com",
        "firebase",
        "googleapis.com",
        "google-analytics.com",
        "googletagmanager.com",
    ];

    const ALLOWED_SCRIPT_PATHS = [
        "script.js",
        "antitamper.js",
        "devtools-detect.js",
        "reveal.js",
    ];

    function isAllowedScript(node) {
        const src = (node.src || "").trim();

        if (!src) {
            // Script inline : on autorise seulement ceux qui ont nos signatures
            const type = (node.type || "").toLowerCase();
            if (type.includes("json") || type.includes("ld+json")) return true;
            const text = (node.textContent || "").trim().slice(0, 200);
            if (text.includes("window.FB") || text.includes("initializeApp"))
                return true;
            return false;
        }

        const lowerSrc = src.toLowerCase();
        for (const domain of ALLOWED_SCRIPT_DOMAINS) {
            if (lowerSrc.includes(domain)) return true;
        }
        for (const path of ALLOWED_SCRIPT_PATHS) {
            if (lowerSrc.endsWith(path) || lowerSrc.includes("/" + path))
                return true;
        }
        return false;
    }

    const initialScripts = new Set();
    function snapshotInitialScripts() {
        document
            .querySelectorAll("script")
            .forEach((s) => initialScripts.add(s));
    }

    const suspiciousScripts = [];

    function reportSuspiciousScript(node, reason) {
        const src = node.src || "(inline)";
        const shortSrc = src.length > 80 ? src.slice(0, 77) + "..." : src;
        const entry = { src: shortSrc, reason, ts: new Date().toISOString() };

        // Évite les doublons
        if (suspiciousScripts.some((e) => e.src === shortSrc)) return;

        suspiciousScripts.push(entry);
        console.warn("🚨 Script suspect injecté :", shortSrc);
        console.warn("   → Raison :", reason);
        console.warn("   → Total suspects :", suspiciousScripts.length);

        notifyIntegrityCheck("script-injected", entry);
    }

    let observerStarted = false;
    function startScriptObserver() {
        if (observerStarted) return;
        observerStarted = true;

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                m.addedNodes.forEach((node) => {
                    if (node.nodeName === "SCRIPT") {
                        if (
                            !initialScripts.has(node) &&
                            !isAllowedScript(node)
                        ) {
                            reportSuspiciousScript(
                                node,
                                "Ajout après chargement",
                            );
                        }
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll("script").forEach((s) => {
                            if (!initialScripts.has(s) && !isAllowedScript(s)) {
                                reportSuspiciousScript(
                                    s,
                                    "Injecté via conteneur",
                                );
                            }
                        });
                    }
                });
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });
    }

    function periodicScriptCheck() {
        document.querySelectorAll("script").forEach((s) => {
            if (initialScripts.has(s)) return;
            if (isAllowedScript(s)) return;
            if (suspiciousScripts.some((e) => e.src === (s.src || "(inline)")))
                return;
            reportSuspiciousScript(s, "Scan périodique");
        });
    }

    // =========================================================
    // 2. DÉTECTION DES DEVTOOLS
    // =========================================================

    const devtoolsState = {
        open: false,
        lastChangeAt: null,
        signals: {
            size: false,
            timing: false,
            debuggerTrap: false,
            toStringTrap: false,
        },
    };

    // ---------- Méthode 1 : Différence de taille ----------
    const SIZE_THRESHOLD = 160;
    function checkSizeMethod() {
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;
        devtoolsState.signals.size =
            widthDiff > SIZE_THRESHOLD || heightDiff > SIZE_THRESHOLD;
    }

    // ---------- Méthode 2 : Timing console ----------
    let timingCheckRunning = false;
    function checkTimingMethod() {
        if (timingCheckRunning) return;
        timingCheckRunning = true;

        const start = performance.now();
        const test = /devtools-timing/;
        test.toString();
        console.log("%c", test);
        const elapsed = performance.now() - start;

        devtoolsState.signals.timing = elapsed > 4;
        timingCheckRunning = false;
    }

    // ---------- Méthode 3 : Debugger trap ----------
    let debuggerTrapObject = null;
    function setupDebuggerTrap() {
        debuggerTrapObject = {
            get active() {
                const t0 = performance.now();
                const magic = Math.random() > 2;
                if (magic) {
                    // eslint-disable-next-line no-debugger
                    debugger;
                }
                const elapsed = performance.now() - t0;
                if (elapsed > 50) devtoolsState.signals.debuggerTrap = true;
                return true;
            },
        };
    }

    function runDebuggerTrap() {
        if (!debuggerTrapObject) return;
        void debuggerTrapObject.active;
    }

    // ---------- Méthode 4 : toString trap ----------
    let toStringTrapEl = null;
    function setupToStringTrap() {
        toStringTrapEl = document.createElement("div");
        toStringTrapEl.id = "devtools-toString-trap";
        toStringTrapEl.style.cssText =
            "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
        document.body.appendChild(toStringTrapEl);

        const originalToString = Object.prototype.toString;
        Object.defineProperty(toStringTrapEl, "toString", {
            value: function () {
                const t0 = performance.now();
                const result = originalToString.call(this);
                const elapsed = performance.now() - t0;
                if (elapsed > 50) devtoolsState.signals.toStringTrap = true;
                return result;
            },
            writable: true,
            configurable: true,
        });
    }

    function runToStringTrap() {
        if (!toStringTrapEl) return;
        void ("" + toStringTrapEl);
        const _ = toStringTrapEl.id;
    }

    // ---------- Agrégation ----------
    function evaluateDevtoolsState() {
        const signals = devtoolsState.signals;
        let openCount = 0;
        if (signals.size) openCount++;
        if (signals.timing) openCount++;
        if (signals.debuggerTrap) openCount++;
        if (signals.toStringTrap) openCount++;

        const wasOpen = devtoolsState.open;
        const isOpen = openCount >= 2;

        if (isOpen !== wasOpen) {
            devtoolsState.open = isOpen;
            devtoolsState.lastChangeAt = Date.now();

            if (isOpen) {
                console.warn("🕵️ DevTools probablement ouvert (indice).");
                console.warn("   Signaux :", signals);
                notifyIntegrityCheck("devtools-open", { signals });
            } else {
                console.info("✅ DevTools probablement fermé.");
            }

            updateDevtoolsBadge();
        }

        signals.timing = false;
        signals.debuggerTrap = false;
        signals.toStringTrap = false;
    }

    // ---------- Badge visuel ----------
    let devtoolsBadge = null;
    function createBadge() {
        devtoolsBadge = document.createElement("div");
        devtoolsBadge.id = "devtools-badge";
        devtoolsBadge.style.cssText = `
            position: fixed;
            top: 8px;
            right: 8px;
            z-index: 9999;
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(239, 68, 68, 0.9);
            color: #fff;
            font-family: system-ui, sans-serif;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        `;
        devtoolsBadge.textContent = "🕵️ DevTools";
        document.body.appendChild(devtoolsBadge);
    }

    function updateDevtoolsBadge() {
        if (!devtoolsBadge) return;
        devtoolsBadge.style.opacity = devtoolsState.open ? "1" : "0";
    }

    // =========================================================
    // 3. NOTIFICATION
    // =========================================================

    const localBuffer = [];
    function notifyIntegrityCheck(type, payload) {
        const event = { type, payload, ts: Date.now() };
        localBuffer.push(event);
        if (localBuffer.length > 50) localBuffer.shift();

        if (
            window.__auraAntiTamper &&
            typeof window.__auraAntiTamper.reportEvent === "function"
        ) {
            try {
                window.__auraAntiTamper.reportEvent(event);
            } catch (e) {}
        }
    }

    // =========================================================
    // 4. DÉMARRAGE
    // =========================================================

    function start() {
        snapshotInitialScripts();
        startScriptObserver();

        setupDebuggerTrap();
        setupToStringTrap();
        createBadge();

        setInterval(periodicScriptCheck, 3000);
        setInterval(() => {
            checkSizeMethod();
            checkTimingMethod();
            runDebuggerTrap();
            runToStringTrap();
            evaluateDevtoolsState();
        }, 1500);

        window.addEventListener("resize", () => {
            checkSizeMethod();
            evaluateDevtoolsState();
        });

        console.log("🛡️ DevTools & Script Inspector chargé.");
    }

    window.__auraDevtoolsDetect = {
        get isOpen() {
            return devtoolsState.open;
        },
        get signals() {
            return { ...devtoolsState.signals };
        },
        get suspiciousScripts() {
            return [...suspiciousScripts];
        },
        get events() {
            return [...localBuffer];
        },
        rescanScripts: periodicScriptCheck,
        forceDevtoolsCheck: evaluateDevtoolsState,
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
