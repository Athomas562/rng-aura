/* =========================================================
   AURA RNG — lockdown.js (version safe + verrou ban)
   ========================================================= */
(function () {
  "use strict";

  document.addEventListener(
    "contextmenu",
    (e) => {
      e.preventDefault();
      return false;
    },
    true,
  );
  document.oncontextmenu = () => false;

  document.addEventListener("selectstart", (e) => e.preventDefault(), true);
  document.addEventListener("dragstart", (e) => e.preventDefault(), true);
  document.addEventListener(
    "drop",
    (e) => {
      e.preventDefault();
      return false;
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (e) => {
      const k = (e.key || "").toLowerCase();
      const code = e.keyCode || e.which;

      if (code === 123 || k === "f12") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (e.ctrlKey && e.shiftKey && ["i", "j", "c", "k"].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (e.ctrlKey && !e.shiftKey && k === "u") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (e.ctrlKey && !e.shiftKey && k === "s") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (e.metaKey && e.altKey && ["i", "j", "c", "u"].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (e.metaKey && e.shiftKey && k === "c") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    },
    true,
  );

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.tagName === "IFRAME") {
          const src = node.src || "";
          if (
            src === "about:blank" ||
            src.includes("devtools") ||
            src.includes("chrome-devtools")
          ) {
            node.remove();
          }
        }
      });
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  setInterval(() => {
    const overlay = document.getElementById("ban-overlay");

    // ✅ Si ban verrouillé → on force la visibilité
    if (window.__auraBanLocked && Date.now() < window.__auraBanUntil) {
      if (overlay && overlay.classList.contains("hidden")) {
        overlay.classList.remove("hidden");
      }
      const rb = document.getElementById("roll-btn");
      if (rb) rb.disabled = true;
      return;
    }

    // ✅ Vérifie le ban local
    let banActive = false;
    let banUntil = 0;
    try {
      const raw = localStorage.getItem("auraRng_localBan");
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.until && Date.now() < data.until) {
          banActive = true;
          banUntil = data.until;
        } else {
          localStorage.removeItem("auraRng_localBan");
        }
      }
    } catch (e) {}

    // ✅ Pas de ban → on cache l'overlay
    if (!banActive) {
      if (overlay && !overlay.classList.contains("hidden")) {
        overlay.classList.add("hidden");
      }
      return;
    }

    // ✅ Ban actif mais PAS verrouillé dans le script principal
    // (cas où le ban a été supprimé du serveur mais le localStorage traîne)
    // → on laisse le script principal gérer, on ne force pas
    if (!window.__auraBanLocked) {
      return;
    }

    // ✅ Sinon on affiche
    if (overlay && overlay.classList.contains("hidden")) {
      overlay.classList.remove("hidden");
    }
  }, 1000);

  console.log("🔒 Lockdown actif");
})();
