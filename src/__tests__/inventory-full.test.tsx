/**
 * Affichage d'un inventaire complet (32/32) avec un joueur fictif.
 * Rendu HTML en mémoire (react-dom/server) : aucun navigateur, aucun appel réseau,
 * le backend est remplacé par un faux qui échoue s'il est sollicité.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AURAS, createPlayerState, type PlayerState } from "../../shared";

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
    backend: {
      kind: "local",
      onAuthChange: forbidden,
      signIn: forbidden,
      register: forbidden,
      signOut: forbidden,
      call: forbidden,
      leaderboard: forbidden,
      loadSettings: forbidden,
      saveSettings: forbidden,
    },
  };
});

const { GameProvider } = await import("../game/GameContext");
const { SettingsProvider } = await import("../settings/SettingsContext");
const { InventoryPage } = await import("../pages/InventoryPage");
const { CollectionPage } = await import("../pages/CollectionPage");

const T0 = 1_700_000_000_000;

/** Joueur fictif possédant les 32 auras — n'existe que dans ce test. */
function fullCollectionPlayer(): PlayerState {
  const s = createPlayerState("JoueurFictif", T0);
  AURAS.forEach((a, i) => {
    s.inventory[a.id] = { count: i + 1, firstAt: T0 + i * 60_000, lastAt: T0 + i * 60_000 };
  });
  s.equipped = "ouroboros";
  s.stats.bestAuraId = "ouroboros";
  s.stats.rolls = 1234;
  return s;
}

function render(page: () => JSX.Element, state: PlayerState): string {
  const Page = page;
  return renderToStaticMarkup(
    <SettingsProvider uid={null}>
      <GameProvider user={{ uid: "fictif", name: "JoueurFictif" }} initial={{ state, serverNow: T0 }} onBanned={() => {}}>
        <Page />
      </GameProvider>
    </SettingsProvider>,
  );
}

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe("inventaire complet (données fictives)", () => {
  const html = render(InventoryPage, fullCollectionPlayer());

  it("annonce 32 auras sur 32 et aucune manquante", () => {
    expect(html).toContain("32 auras obtenues sur 32");
    expect(html).toContain("0 manquante");
  });

  it("affiche une carte pour chacune des 32 auras, sans silhouette", () => {
    expect(count(html, /class="inv-card /g)).toBe(32);
    expect(html).not.toContain("is-missing");
    expect(html).not.toContain("???");
    expect(html).not.toContain("Non découverte");
    for (const a of AURAS) expect(html, a.name).toContain(`>${a.name}<`);
  });

  it("marque l'aura équipée et affiche les quantités", () => {
    expect(count(html, /is-equipped/g)).toBe(1);
    expect(html).toContain("×32"); // Ouroboros, dernière du catalogue
  });
});

describe("collection complète (données fictives)", () => {
  const html = render(CollectionPage, fullCollectionPlayer());

  it("affiche 32/32 et une progression à 100 %", () => {
    expect(html).toContain("32<small>/32</small>");
    expect(html).toContain("width:100%");
  });

  it("aucune tuile verrouillée, chaque palier complet", () => {
    expect(count(html, /class="coll-tile /g)).toBe(32);
    expect(html).not.toContain("is-locked");
    expect(html).not.toContain("???");
    for (const [found, total] of [...html.matchAll(/tier-section__count tabular">(\d+)\/(\d+)</g)].map((m) => [m[1], m[2]])) {
      expect(found).toBe(total);
    }
  });
});

describe("inventaire partiel (contrôle)", () => {
  it("les auras non obtenues apparaissent en silhouette", () => {
    const s = createPlayerState("JoueurFictif", T0);
    s.inventory.lueur = { count: 1, firstAt: T0, lastAt: T0 };
    const html = render(CollectionPage, s);
    expect(count(html, /class="coll-tile is-locked"/g)).toBe(31);
    expect(html).toContain("1<small>/32</small>");
  });
});
