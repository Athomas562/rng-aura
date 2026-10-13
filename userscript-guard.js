/* =========================================================
   AURA RNG — userscript-guard.js
   Détection "best effort" de Tampermonkey / Violentmonkey /
   Greasemonkey et des triches simples (clics automatisés,
   RNG / horloge remplacés). Ne modifie AUCUNE fonction native.

   ⚠️ Tout ce qui tourne dans le navigateur du joueur peut être
   contourné par ce même joueur. Cette garde élève la difficulté ;
   la vraie protection = règles de sécurité Firebase côté serveur.
   ========================================================= */
(function () {
    "use strict";

    const CONFIG = {
        scanIntervalMs: 2000,
        // true = appelle triggerAutoBan() de script.js. Déconseillé : faux positifs possibles.
        banOnDetect: false,
        maxUntrustedClicks: 3,
        // Fonctions natives dont le remplacement est quasi toujours une triche
        // (changer le RNG, accélérer l'horloge/les timers).
        watchedNatives: [
            ["Math", "random"],
            ["Date", "now"],
            ["performance", "now"],
            [null, "setTimeout"],
            [null, "setInterval"],
            ["crypto", "getRandomValues"],
        ],
    };

    const OVERLAY_ID = "aura-guard-overlay";
    const reasons = new Set();
    let blocked = false;
    let untrustedClicks = 0;

    /* ---------- utilitaires ---------- */

    const fnToString = Function.prototype.toString;
    function isNative(fn) {
        try {
            return (
                typeof fn === "function" &&
                /\[native code\]/.test(fnToString.call(fn))
            );
        } catch (e) {
            return false;
        }
    }

    function flag(reason) {
        if (reasons.has(reason)) return;
        reasons.add(reason);
        console.warn("🛡️ Guard :", reason);
        block();
        if (CONFIG.banOnDetect && typeof window.triggerAutoBan === "function") {
            try {
                window.triggerAutoBan("Script utilisateur : " + reason);
            } catch (e) {}
        }
    }

    /* ---------- blocage visuel + fonctionnel ---------- */

    function lockPage() {
        if (!document.body) return;
        Array.from(document.body.children).forEach((el) => {
            if (el.id === OVERLAY_ID || el.tagName === "SCRIPT") return;
            try {
                el.setAttribute("inert", "");
            } catch (e) {}
        });
    }

    function ensureOverlay() {
        if (!blocked) return;
        if (!document.body) {
            document.addEventListener("DOMContentLoaded", ensureOverlay, {
                once: true,
            });
            return;
        }
        lockPage();
        if (document.getElementById(OVERLAY_ID)) return;

        const overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        overlay.style.cssText =
            "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;" +
            "justify-content:center;padding:24px;text-align:center;color:#fff;" +
            "font-family:system-ui,sans-serif;background:radial-gradient(circle at 50% 40%,#1a0000,#050000 75%);";

        const box = document.createElement("div");
        box.style.cssText = "max-width:520px;";

        const icon = document.createElement("div");
        icon.textContent = "🚫";
        icon.style.cssText = "font-size:72px;margin-bottom:16px;";

        const title = document.createElement("h1");
        title.textContent = "Script utilisateur détecté";
        title.style.cssText =
            "color:#f87171;font-size:30px;margin-bottom:14px;";

        const text = document.createElement("p");
        text.textContent =
            "Une extension de scripts (Tampermonkey, Violentmonkey, Greasemonkey…) ou une " +
            "modification du navigateur a été détectée. Désactive-la pour ce site, puis recharge la page.";
        text.style.cssText = "color:#fca5a5;line-height:1.6;font-size:15px;";

        const detail = document.createElement("p");
        detail.textContent = "Raison : " + Array.from(reasons).join(" · ");
        detail.style.cssText = "margin-top:18px;font-size:12px;opacity:.55;";

        const btn = document.createElement("button");
        btn.textContent = "Recharger la page";
        btn.style.cssText =
            "margin-top:22px;padding:12px 22px;border-radius:10px;border:0;cursor:pointer;" +
            "background:#dc2626;color:#fff;font-weight:700;font-size:15px;";
        btn.addEventListener("click", (e) => {
            if (e.isTrusted) location.reload();
        });

        box.append(icon, title, text, detail, btn);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    function block() {
        if (!blocked) {
            blocked = true;
            try {
                window.dispatchEvent(
                    new CustomEvent("aura-guard-blocked", {
                        detail: Array.from(reasons),
                    }),
                );
            } catch (e) {}
        }
        ensureOverlay();
    }

    /* ---------- 1. API exposées par les gestionnaires de scripts ---------- */

    function checkExternalApis() {
        try {
            const ext = window.external;
            if (!ext) return;
            [
                "Tampermonkey",
                "Violentmonkey",
                "Greasemonkey",
                "FireMonkey",
            ].forEach((name) => {
                let value;
                try {
                    value = ext[name];
                } catch (e) {}
                if (value) flag("Gestionnaire détecté : " + name);
            });
        } catch (e) {}
    }

    /* ---------- 2. Variables globales des userscripts ---------- */

    const GM_GLOBALS = [
        "GM_info",
        "GM_getValue",
        "GM_setValue",
        "GM_xmlhttpRequest",
        "GM_addStyle",
        "GM",
        "unsafeWindow",
    ];
    function checkGlobals() {
        for (const name of GM_GLOBALS) {
            let defined = false;
            try {
                defined = typeof window[name] !== "undefined";
            } catch (e) {}
            if (defined) {
                flag("Variable de userscript : " + name);
                return;
            }
        }
    }

    /* ---------- 3. Scripts / éléments injectés dans la page ---------- */

    const SIGNATURE =
        /==UserScript==|GM_(getValue|setValue|xmlhttpRequest|addStyle|info)|GM\.(getValue|setValue|xmlHttpRequest)|unsafeWindow/;

    function inspectNode(node) {
        if (!node || node.nodeType !== 1) return;
        const scripts =
            node.tagName === "SCRIPT"
                ? [node]
                : node.querySelectorAll
                  ? Array.from(node.querySelectorAll("script"))
                  : [];
        scripts.forEach((s) => {
            const src = (s.src || "").toLowerCase();
            const txt = (s.textContent || "").slice(0, 5000);
            if (/^(chrome|moz|safari-web)-extension:/.test(src))
                flag("Script d'extension injecté");
            else if (/(tampermonkey|violentmonkey|greasemonkey)/.test(src))
                flag("Script de gestionnaire injecté");
            else if (SIGNATURE.test(txt))
                flag("Signature de userscript dans la page");
        });
        try {
            if (
                node.matches &&
                node.matches(
                    '[id*="tampermonkey" i],[class*="tampermonkey" i],[id*="violentmonkey" i],[class*="violentmonkey" i]',
                )
            )
                flag("Élément de gestionnaire de scripts");
        } catch (e) {}
    }

    /* ---------- 4. Fonctions natives remplacées ---------- */

    function checkNatives() {
        if (!isNative(fnToString)) {
            flag("Function.prototype.toString modifiée");
            return;
        }
        for (const [objName, fnName] of CONFIG.watchedNatives) {
            let target, fn;
            try {
                target = objName === null ? window : window[objName];
                fn = target && target[fnName];
            } catch (e) {
                continue;
            }
            if (typeof fn === "function" && !isNative(fn))
                flag(
                    "Fonction native remplacée : " +
                        (objName ? objName + "." : "") +
                        fnName,
                );
        }
    }

    /* ---------- 5. Clics automatisés (événements non fiables) ---------- */
    // Un clic réel a isTrusted === true ; element.click() / dispatchEvent() d'un script, non.
    document.addEventListener(
        "click",
        (e) => {
            if (e.isTrusted) return;
            const t = e.target;
            if (!t || !t.closest) return;
            if (t.closest("#" + OVERLAY_ID)) return;
            if (t.closest("#auth-modal")) return; // gestionnaires de mots de passe
            if (
                !t.closest(
                    "button, a, input, select, .card, .title-card, .skin-card, .skill-card",
                )
            )
                return;
            e.stopImmediatePropagation();
            e.preventDefault();
            untrustedClicks++;
            if (untrustedClicks >= CONFIG.maxUntrustedClicks)
                flag("Clics automatisés (événements non fiables)");
        },
        true,
    );

    /* ---------- surveillance continue ---------- */

    function scan() {
        checkExternalApis();
        checkGlobals();
        checkNatives();
        if (blocked) ensureOverlay();
    }

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            m.addedNodes.forEach(inspectNode);
            if (blocked && m.removedNodes.length) ensureOverlay();
            if (blocked && m.type === "attributes") lockPage();
        }
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });

    inspectNode(document.documentElement);
    scan();
    setInterval(scan, CONFIG.scanIntervalMs);

    Object.defineProperty(window, "__auraGuard", {
        value: Object.freeze({
            get blocked() {
                return blocked;
            },
            get reasons() {
                return Array.from(reasons);
            },
            rescan: scan,
        }),
        writable: false,
        configurable: false,
    });
})();
