/**
 * Accès autorisés / interdits avec les règles candidates, contre l'émulateur local uniquement.
 *
 *   npm run test:rules     (nécessite Java ; lance l'émulateur Realtime Database)
 *
 * Le projet « demo-rng-aura » est un projet de démonstration Firebase : il n'existe
 * qu'en local, aucune requête ne peut atteindre la vraie base rng-aura.
 */
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it, expect } from "vitest";

const PROJECT_ID = "demo-rng-aura";
const rules = readFileSync(new URL("../../database.rules.candidate.json", import.meta.url), "utf8");
const [host, port] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? "127.0.0.1:9000").split(":");

let env: RulesTestEnvironment;

const validSettings = {
  soundEnabled: true,
  volume: 0.5,
  reducedMotion: false,
  noFlashes: false,
  skipCommonReveal: false,
  keybinds: { roll: "Space", auto: "KeyA", nav1: "Digit1", nav2: "Digit2", nav3: "Digit3", nav4: "Digit4", nav5: "Digit5", nav6: "Digit6", nav7: "" },
};

/** Données fictives présentes avant chaque test (écrites sans règles, comme le ferait le serveur). */
const seed = {
  v2: {
    players: { alice: { name: "alice", stats: { rolls: 10 } }, bob: { name: "bob", stats: { rolls: 5 } } },
    leaderboard: {
      alice: { name: "alice", rolls: 10, bestOdds: 1500, collection: 4, achievements: 2 },
      bob: { name: "bob", rolls: 5, bestOdds: 25, collection: 2, achievements: 1 },
    },
    settings: { alice: validSettings, bob: validSettings },
  },
  usernames: { alice: { uid: "alice" } },
  bans: { mallory: { until: 9_999_999_999_999, reason: "test" } },
  players: { alice: { totalRolls: 10 } },
  saves: { alice: { coins: 100 } },
  ip_bans: { "1_2_3_4": { until: 1 } },
  kicked: { bob: true },
  frozen: { bob: true },
  admins: { alice: true },
  deleted: { x: { name: "old" } },
  deleted_usernames: { old: true },
  chat: { m1: { text: "salut" } },
  chat_mutes: { bob: 1 },
  announcements: { a1: { text: "news" } },
  activity: { alice: { a: 1 } },
  friends: { alice: { bob: true } },
};

const LEGACY = Object.keys(seed).filter((k) => k !== "v2");

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: { rules, host, port: Number(port) },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref().set(seed);
  });
});

const alice = () => env.authenticatedContext("alice").database();
const anon = () => env.unauthenticatedContext().database();

describe("classement v2", () => {
  it("un joueur connecté lit le classement avec la requête de l'application", async () => {
    for (const cat of ["rolls", "bestOdds", "collection", "achievements"]) {
      await assertSucceeds(alice().ref("v2/leaderboard").orderByChild(cat).limitToLast(50).get());
    }
  });

  it("un visiteur non connecté ne lit pas le classement", async () => {
    await assertFails(anon().ref("v2/leaderboard").get());
  });

  it("personne ne peut écrire dans le classement depuis le navigateur", async () => {
    await assertFails(alice().ref("v2/leaderboard/alice/rolls").set(1e9));
    await assertFails(alice().ref("v2/leaderboard/alice").set({ name: "alice", rolls: 1e9 }));
    await assertFails(alice().ref("v2/leaderboard/bob").remove());
    await assertFails(alice().ref("v2/leaderboard").set(null));
  });
});

describe("joueurs v2 (réservés au serveur)", () => {
  it("le navigateur ne lit ni n'écrit aucun état de joueur, même le sien", async () => {
    await assertFails(alice().ref("v2/players/alice").get());
    await assertFails(alice().ref("v2/players/alice/stats/rolls").set(1e9));
    await assertFails(alice().ref("v2/players/alice/inventory/ouroboros").set({ count: 1 }));
    await assertFails(alice().ref("v2/players/bob").remove());
  });
});

describe("paramètres v2", () => {
  it("un joueur lit et écrit ses propres paramètres", async () => {
    await assertSucceeds(alice().ref("v2/settings/alice").get());
    await assertSucceeds(alice().ref("v2/settings/alice").set({ ...validSettings, volume: 0.8 }));
  });

  it("un joueur ne lit ni n'écrit les paramètres d'un autre", async () => {
    await assertFails(alice().ref("v2/settings/bob").get());
    await assertFails(alice().ref("v2/settings/bob").set(validSettings));
    await assertFails(alice().ref("v2/settings").get());
  });

  it("un visiteur non connecté n'y a pas accès", async () => {
    await assertFails(anon().ref("v2/settings/alice").get());
    await assertFails(anon().ref("v2/settings/alice").set(validSettings));
  });

  it("refuse des paramètres invalides", async () => {
    await assertFails(alice().ref("v2/settings/alice").set({ ...validSettings, volume: 2 }));
    await assertFails(alice().ref("v2/settings/alice").set({ ...validSettings, soundEnabled: "oui" }));
    await assertFails(alice().ref("v2/settings/alice").set({ ...validSettings, isAdmin: true }));
    await assertFails(alice().ref("v2/settings/alice").set({ ...validSettings, keybinds: { ...validSettings.keybinds, hack: "KeyH" } }));
    await assertFails(alice().ref("v2/settings/alice").set({ ...validSettings, keybinds: { ...validSettings.keybinds, roll: "x".repeat(25) } }));
    await assertFails(alice().ref("v2/settings/alice").set("texte"));
    await assertFails(alice().ref("v2/settings/alice").set({ volume: 0.5 })); // incomplet
  });
});

describe("anciens chemins et modération", () => {
  it.each(LEGACY)("%s : ni lecture ni écriture depuis le navigateur", async (path) => {
    await assertFails(alice().ref(path).get());
    await assertFails(alice().ref(`${path}/alice`).get());
    await assertFails(alice().ref(`${path}/alice`).set({ hacked: true }));
    await assertFails(alice().ref(path).remove());
    await assertFails(anon().ref(path).get());
  });

  it("un joueur ne peut pas se débannir ni s'ajouter administrateur", async () => {
    await assertFails(env.authenticatedContext("mallory").database().ref("bans/mallory").remove());
    await assertFails(alice().ref("admins/bob").set(true));
    await assertFails(alice().ref("usernames/admin").set({ uid: "alice" }));
  });

  it("la racine est refusée en lecture et en écriture", async () => {
    await assertFails(alice().ref().get());
    await assertFails(alice().ref().update({ "v2/leaderboard/alice/rolls": 1e9 }));
    await assertFails(anon().ref().get());
  });
});

describe("conservation des données", () => {
  it("aucune donnée n'est modifiée par les tentatives refusées", async () => {
    const db = alice();
    await Promise.allSettled([
      db.ref("v2/leaderboard/alice/rolls").set(1e9),
      db.ref("v2/players/alice").remove(),
      db.ref("bans/mallory").remove(),
      db.ref("saves/alice").set(null),
      db.ref("chat").remove(),
    ]);
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await ctx.database().ref().get();
      expect(snap.val()).toEqual(seed);
    });
  });
});
