/**
 * Affichage d'un inventaire complet (toutes les auras du catalogue) avec un joueur fictif.
 * Rendu HTML en mémoire (react-dom/server) : aucun navigateur, aucun appel réseau,
 * le backend est remplacé par un faux qui échoue s'il est sollicité.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AURAS, createPlayerState, lookOf, type PlayerState } from "../../shared";

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
const { ProgressionPage } = await import("../pages/ProgressionPage");
const { QuestsPage } = await import("../pages/QuestsPage");
const { StatsPage } = await import("../pages/StatsPage");
const { RollPage } = await import("../pages/RollPage");

const T0 = 1_700_000_000_000;

const N = AURAS.length;

/** Joueur fictif possédant toutes les auras — n'existe que dans ce test. */
function fullCollectionPlayer(): PlayerState {
  const s = createPlayerState("JoueurFictif", T0);
  AURAS.forEach((a, i) => {
    s.inventory[a.id] = { count: i + 1, firstAt: T0 + i * 60_000, lastAt: T0 + i * 60_000, firstRoll: 0 };
    s.codex[a.id] = { firstAt: T0 + i * 60_000, total: i + 1 };
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

  it("annonce toutes les auras obtenues et aucune manquante", () => {
    expect(html).toContain(`${N} auras obtenues sur ${N}`);
    expect(html).toContain("0 manquante");
  });

  it("affiche une carte pour chacune des auras, sans silhouette, avec l'apparence propre au joueur", () => {
    expect(count(html, /class="inv-card /g)).toBe(N);
    expect(html).not.toContain("is-missing");
    expect(html).not.toContain("???");
    expect(html).not.toContain("Non découverte");
    const s = fullCollectionPlayer();
    for (const a of AURAS) {
      const shown = lookOf(a, { rolls: s.stats.rolls, inventory: s.inventory, mimicOf: s.mimicOf }).name.replace(/'/g, "&#x27;");
      expect(html, a.id).toContain(`>${shown}<`);
    }
  });

  it("marque l'aura équipée et affiche les quantités", () => {
    expect(count(html, /is-equipped/g)).toBe(1);
    expect(html).toContain("×32"); // Ouroboros, dernière du catalogue
  });
});

describe("collection complète (données fictives)", () => {
  const html = render(CollectionPage, fullCollectionPlayer());

  it("affiche N/N et une progression à 100 %", () => {
    expect(html).toContain(`${N}<small>/${N}</small>`);
    expect(html).toContain("width:100%");
  });

  it("aucune tuile verrouillée, chaque palier complet", () => {
    expect(count(html, /class="coll-tile /g)).toBe(N);
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
    s.inventory.lueur = { count: 1, firstAt: T0, lastAt: T0, firstRoll: 1 };
    s.codex.lueur = { firstAt: T0, total: 1 };
    const html = render(CollectionPage, s);
    expect(count(html, /class="coll-tile is-locked/g)).toBe(N - 1);
    expect(html).toContain(`1<small>/${N}</small>`);
  });
});

describe("pages de l'extension (rendu sans erreur)", () => {
  const veteran = () => {
    const s = fullCollectionPlayer();
    s.xp = 1e9;
    s.prestige = { level: 2, runStartRolls: 0, history: [{ at: T0, level: 1, runRolls: 10_000, bestAuraId: "phenix", collection: 12 }] };
    s.slots = ["phenix", null, "abysse"];
    s.title = "ressuscite";
    s.mimicOf = "phenix";
    return s;
  };

  it("Progression : niveau, emplacements, talents, prestige et fusions", () => {
    const html = render(ProgressionPage, veteran());
    expect(html).toContain("Arbre de talents");
    expect(html).toContain("Atelier de fusion");
    expect(html).toContain("Emplacement 4");
    expect(html).toContain("Ressuscité");
    expect(count(html, /class="fusion panel"/g)).toBe(4);
  });

  it("Quêtes : 3 quêtes du jour, 3 de la semaine, missions et événements", () => {
    const html = render(QuestsPage, veteran());
    expect(count(html, /class="quest /g)).toBe(6);
    expect(html).toContain("Pèlerin du hasard");
    expect(html).toContain("Nuit des Spectres");
  });

  it("Statistiques : détail par aura et historique des prestiges", () => {
    const html = render(StatsPage, veteran());
    expect(html).toContain("Détail par aura");
    expect(html).toContain("Historique des prestiges");
  });

  it("Roll : niveau et potions de l'extension", () => {
    const s = veteran();
    s.potions.owned.focus = 1;
    const html = render(RollPage, s);
    expect(html).toContain("Niveau 100");
    expect(html).toContain("Potion de chance ciblée");
  });
});
