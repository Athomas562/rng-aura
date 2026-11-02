/**
 * Boutique, durées de révélation, réglages locaux et accessibilité (rendu HTML en mémoire).
 * Aucun navigateur ni appel réseau : le backend est remplacé par un faux qui échoue s'il est appelé.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UPGRADES, createPlayerState, getUpgrade, type PlayerState } from "../../shared";

vi.mock("firebase/app", () => {
  throw new Error("Firebase interdit dans les tests d'affichage");
});

vi.mock("../backend", () => {
  const forbidden = () => {
    throw new Error("Le backend ne doit pas être appelé pendant le rendu");
  };
  class BackendError extends Error {}
  return {
    BackendError,
    backend: { kind: "local", onAuthChange: forbidden, signIn: forbidden, register: forbidden, signOut: forbidden, call: forbidden, leaderboard: forbidden, loadSettings: forbidden, saveSettings: forbidden },
  };
});

const { GameProvider } = await import("../game/GameContext");
const { SettingsProvider } = await import("../settings/SettingsContext");
const { ShopPage, upgradeEffect } = await import("../pages/ShopPage");
const { TopBar } = await import("../app/TopBar");
const { SubNav } = await import("../app/Nav");
const { RollPage } = await import("../pages/RollPage");
const { revealTiming, MAX_BURST_MS, MAX_OMEN_MS } = await import("../game/revealTiming");
const { sanitizeSettings, syncedPart, vfxDensity, decorativeMotion, defaultSettings, groupOf, NAV_GROUPS, NAV_ORDER } = await import("../settings/settings");

const T0 = 1_700_000_000_000;

/** Rendu normalisé : espaces insécables (format fr-FR) → espaces, apostrophes décodées. */
function render(node: JSX.Element, state: PlayerState): string {
  return renderHtml(node, state).replace(/[  ]/g, " ").replace(/&#x27;/g, "'");
}

function renderHtml(node: JSX.Element, state: PlayerState): string {
  return renderToStaticMarkup(
    <SettingsProvider uid={null}>
      <GameProvider user={{ uid: "fictif", name: "Fictif" }} initial={{ state, serverNow: T0 }} onBanned={() => {}}>
        {node}
      </GameProvider>
    </SettingsProvider>,
  );
}

const player = (shards: number) => {
  const s = createPlayerState("Fictif", T0);
  s.shards = shards;
  return s;
};
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe("boutique", () => {
  it("affiche une carte par amélioration avec nom, niveau, effet chiffré et coût", () => {
    const html = render(<ShopPage />, player(100_000));
    for (const u of UPGRADES) expect(html, u.id).toContain(u.name);
    expect(html).toContain("Recharge : <strong>0,9 s</strong>");
    expect(html).toContain("0,88 s");
    expect(html).toMatch(/Acheter · <span class="tabular">150<\/span>/);
  });

  it("états clairs : achetable, trop cher (avec le montant manquant), niveau maximal", () => {
    const s = player(160);
    s.upgrades.halo = getUpgrade("halo").maxLevel;
    const html = render(<ShopPage />, s);
    expect(html).toContain("Achetable"); // Mécanisme d'horlogerie : 150 ≤ 160
    expect(html).toMatch(/Il manque 40 ✦/); // Trèfle doré : 200
    expect(html).toContain("Niveau maximal");
    expect(count(html, /aria-disabled="true"/g)).toBeGreaterThan(0);
    expect(html).toContain("is-maxed");
  });

  it("annonce le solde et l'unité pour les lecteurs d'écran", () => {
    const html = render(<ShopPage />, player(1234));
    expect(html).toContain('aria-label="Solde : 1 234 éclats"');
    expect(html).toContain('<span class="sr-only"> éclats</span>');
  });

  it("l'effet affiché est calculé avec les fonctions du serveur", () => {
    const s = player(0);
    expect(upgradeEffect(getUpgrade("halo"), s, T0)).toEqual({ label: "Roll béni", before: "1 roll sur 10", after: "1 roll sur 9" });
    s.upgrades.slot = 1;
    expect(upgradeEffect(getUpgrade("slot"), s, T0).after).toBeNull();
  });

  it("filtres par catégorie accessibles (boutons à état pressé)", () => {
    const html = render(<ShopPage />, player(0));
    expect(html).toContain('role="group" aria-label="Filtrer par catégorie"');
    expect(count(html, /aria-pressed="true"/g)).toBe(1);
  });
});

describe("barre du haut et navigation", () => {
  it("affiche éclats, niveau (barre de progression ARIA) et série", () => {
    const s = player(4321);
    s.stats.streak = 12;
    const html = render(<TopBar />, s);
    expect(html).toContain('aria-label="4 321"');
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="0"/);
    expect(html).toContain("Aucune potion active");
  });

  it("sous-onglets : rôle tab, onglet courant marqué, fil d'Ariane", () => {
    const html = render(<SubNav page="inventory" onNavigate={() => {}} />, player(0));
    expect(html).toContain(`aria-label="Fil d'Ariane"`);
    expect(html).toContain('<span aria-current="page">Inventaire</span>');
    expect(count(html, /role="tab"/g)).toBe(3);
    expect(count(html, /aria-selected="true"/g)).toBe(1);
  });

  it("5 groupes couvrent toutes les pages, une seule fois chacune", () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual(["Jouer", "Boutique", "Progression", "Classement", "Paramètres"]);
    const all = NAV_GROUPS.flatMap((g) => g.pages);
    expect([...all].sort()).toEqual([...NAV_ORDER].sort());
    expect(groupOf("quests").id).toBe("progress");
  });

  it("le bouton ROLL décrit son état (recharge, prêt) via aria-describedby", () => {
    const html = render(<RollPage />, player(0));
    expect(html).toContain('aria-describedby="roll-status"');
    expect(html).toMatch(/id="roll-status"[^>]*>Prêt · un roll toutes les 0,9 s/);
  });
});

describe("durées de révélation", () => {
  const opts = { reducedMotion: false, skipCommonReveal: false, auto: false };

  it("croissent avec la rareté sans dépasser les plafonds (≈ 2 s de révélation)", () => {
    let prev = 0;
    for (let tier = 0; tier <= 14; tier++) {
      const { omenMs, burstMs } = revealTiming(tier, opts);
      expect(burstMs).toBeGreaterThanOrEqual(prev);
      expect(burstMs).toBeLessThanOrEqual(MAX_BURST_MS);
      expect(omenMs).toBeLessThanOrEqual(MAX_OMEN_MS);
      prev = burstMs;
    }
    expect(revealTiming(0, opts).omenMs).toBe(0);
  });

  it("réduire les animations raccourcit tout", () => {
    for (let tier = 0; tier <= 14; tier++) {
      const r = revealTiming(tier, { ...opts, reducedMotion: true });
      expect(r.burstMs).toBeLessThanOrEqual(900);
      expect(r.omenMs).toBeLessThanOrEqual(250);
    }
  });
});

describe("réglages locaux et accessibilité", () => {
  it("valeurs par défaut et nettoyage des valeurs invalides", () => {
    const s = sanitizeSettings({ vfxQuality: "ultra", uiScale: 9, calmMode: "oui", cursorTrail: false });
    expect(s.vfxQuality).toBe("normal");
    expect(s.uiScale).toBe(1);
    expect(s.calmMode).toBe(defaultSettings().calmMode);
    expect(s.cursorTrail).toBe(false);
  });

  it("réduire les animations ou le mode calme coupent les effets décoratifs ; la qualité règle la densité", () => {
    const d = defaultSettings();
    expect(decorativeMotion({ ...d, reducedMotion: false, calmMode: false })).toBe(true);
    expect(decorativeMotion({ ...d, reducedMotion: true, calmMode: false })).toBe(false);
    expect(decorativeMotion({ ...d, reducedMotion: false, calmMode: true })).toBe(false);
    expect(vfxDensity({ ...d, reducedMotion: false, vfxQuality: "low" })).toBeLessThan(vfxDensity({ ...d, reducedMotion: false, vfxQuality: "high" }));
    expect(vfxDensity({ ...d, reducedMotion: true, vfxQuality: "high" })).toBeLessThanOrEqual(0.5);
  });

  it("les nouveaux réglages ne sont jamais envoyés à Firebase", () => {
    const synced = syncedPart({ ...defaultSettings(), calmMode: true, uiScale: 1.2 }) as Record<string, unknown>;
    for (const k of ["calmMode", "uiScale", "vfxQuality", "cursorTrail"]) expect(synced[k]).toBeUndefined();
  });
});
