/* =========================================================
   AURA RNG — devtools-detect.js
   ========================================================= */
(function () {
    "use strict";
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
            const type = (node.type || "").toLowerCase();
            if (type.includes("json") || type.includes("ld+json")) return true;
            const text = (node.textContent || "").trim().slice(0, 200);
            if (text.includes("window.FB") || text.includes("initializeApp"))
                return true;
            return false;
        }
        const lowerSrc = src.toLowerCase();
        for (const d of ALLOWED_SCRIPT_DOMAINS)
            if (lowerSrc.includes(d)) return true;
        for (const p of ALLOWED_SCRIPT_PATHS)
            if (lowerSrc.endsWith(p) || lowerSrc.includes("/" + p)) return true;
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
        if (suspiciousScripts.some((e) => e.src === shortSrc)) return;
        suspiciousScripts.push(entry);
        console.warn("🚨 Script suspect :", shortSrc, "|", reason);
        notifyIntegrityCheck("script-injected", entry);
    }
    let observerStarted = false;
    function startScriptObserver() {
        if (observerStarted) return;
        observerStarted = true;
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                m.addedNodes.forEach((node) => {
                    if (
                        node.nodeName === "SCRIPT" &&
                        !initialScripts.has(node) &&
                        !isAllowedScript(node)
                    )
                        reportSuspiciousScript(node, "Ajout");
                    if (node.querySelectorAll)
                        node.querySelectorAll("script").forEach((s) => {
                            if (!initialScripts.has(s) && !isAllowedScript(s))
                                reportSuspiciousScript(s, "Injecté");
                        });
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
            if (initialScripts.has(s) || isAllowedScript(s)) return;
            if (suspiciousScripts.some((e) => e.src === (s.src || "(inline)")))
                return;
            reportSuspiciousScript(s, "Scan périodique");
        });
    }

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
    const SIZE_THRESHOLD = 160;
    function checkSizeMethod() {
        const w = window.outerWidth - window.innerWidth,
            h = window.outerHeight - window.innerHeight;
        devtoolsState.signals.size = w > SIZE_THRESHOLD || h > SIZE_THRESHOLD;
    }
    let timingRunning = false;
    function checkTimingMethod() {
        if (timingRunning) return;
        timingRunning = true;
        const s = performance.now();
        const t = /devtools-timing/;
        t.toString();
        console.log("%c", t);
        devtoolsState.signals.timing = performance.now() - s > 4;
        timingRunning = false;
    }
    let debuggerTrapObject = null;
    function setupDebuggerTrap() {
        debuggerTrapObject = {
            get active() {
                const t0 = performance.now();
                const magic = Math.random() > 2;
                if (magic) {
                    /* eslint-disable-next-line no-debugger */ debugger;
                }
                if (performance.now() - t0 > 50)
                    devtoolsState.signals.debuggerTrap = true;
                return true;
            },
        };
    }
    function runDebuggerTrap() {
        if (debuggerTrapObject) void debuggerTrapObject.active;
    }
    let toStringTrapEl = null;
    function setupToStringTrap() {
        toStringTrapEl = document.createElement("div");
        toStringTrapEl.id = "devtools-toString-trap";
        toStringTrapEl.style.cssText =
            "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
        document.body.appendChild(toStringTrapEl);
        const orig = Object.prototype.toString;
        Object.defineProperty(toStringTrapEl, "toString", {
            value: function () {
                const t0 = performance.now();
                const r = orig.call(this);
                if (performance.now() - t0 > 50)
                    devtoolsState.signals.toStringTrap = true;
                return r;
            },
            writable: true,
            configurable: true,
        });
    }
    function runToStringTrap() {
        if (toStringTrapEl) {
            void ("" + toStringTrapEl);
            void toStringTrapEl.id;
        }
    }
    function evaluateDevtoolsState() {
        const s = devtoolsState.signals;
        let open = 0;
        if (s.size) open++;
        if (s.timing) open++;
        if (s.debuggerTrap) open++;
        if (s.toStringTrap) open++;
        const wasOpen = devtoolsState.open;
        const isOpen = open >= 2;
        if (isOpen !== wasOpen) {
            devtoolsState.open = isOpen;
            devtoolsState.lastChangeAt = Date.now();
            if (isOpen) {
                console.warn("🕵️ DevTools probablement ouvert.");
                notifyIntegrityCheck("devtools-open", { signals: s });
            } else console.info("✅ DevTools fermé.");
            updateDevtoolsBadge();
        }
        s.timing = false;
        s.debuggerTrap = false;
        s.toStringTrap = false;
    }
    let devtoolsBadge = null;
    function createBadge() {
        devtoolsBadge = document.createElement("div");
        devtoolsBadge.id = "devtools-badge";
        devtoolsBadge.style.cssText = `position:fixed;top:8px;right:8px;z-index:9999;padding:4px 10px;border-radius:999px;background:rgba(239,68,68,0.9);color:#fff;font-family:system-ui,sans-serif;font-size:11px;font-weight:700;pointer-events:none;opacity:0;transition:opacity .3s;box-shadow:0 4px 12px rgba(0,0,0,0.4);`;
        devtoolsBadge.textContent = "🕵️ DevTools";
        document.body.appendChild(devtoolsBadge);
    }
    function updateDevtoolsBadge() {
        if (devtoolsBadge)
            devtoolsBadge.style.opacity = devtoolsState.open ? "1" : "0";
    }
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
    if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", start);
    else start();
})();
