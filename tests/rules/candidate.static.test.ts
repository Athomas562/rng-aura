/**
 * Vérifications structurelles des règles candidates (sans émulateur, sans réseau).
 * Les accès réels sont testés dans candidate.emulator.test.ts.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KEY_ACTIONS, defaultSettings } from "../../src/settings/settings";

type RuleNode = { [key: string]: RuleNode | string | boolean | string[] };

const candidate = JSON.parse(readFileSync(new URL("../../database.rules.candidate.json", import.meta.url), "utf8"))
  .rules as RuleNode;

/** Liste toutes les règles `.read` / `.write` avec leur chemin. */
function collect(node: RuleNode, kind: ".read" | ".write", path: string[] = []): { path: string; rule: unknown }[] {
  const out: { path: string; rule: unknown }[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === kind) out.push({ path: "/" + path.join("/"), rule: value });
    else if (!key.startsWith(".") && value && typeof value === "object" && !Array.isArray(value)) {
      out.push(...collect(value as RuleNode, kind, [...path, key]));
    }
  }
  return out;
}

const granted = (kind: ".read" | ".write") => collect(candidate, kind).filter((r) => r.rule !== false);

/** Chemins de l'ancien jeu (vérifiés dans l'historique git, a7f3b9c2.js) + règles actives fournies. */
const LEGACY_PATHS = [
  "players",
  "saves",
  "bans",
  "ip_bans",
  "kicked",
  "frozen",
  "admins",
  "deleted",
  "deleted_usernames",
  "usernames",
  "chat",
  "chat_mutes",
  "announcements",
  "activity",
  "friends",
];

describe("règles candidates : structure", () => {
  it("refusent tout par défaut à la racine", () => {
    expect(candidate[".read"]).toBe(false);
    expect(candidate[".write"]).toBe(false);
  });

  it("n'accordent l'écriture qu'aux paramètres du joueur lui-même", () => {
    expect(granted(".write")).toEqual([{ path: "/v2/settings/$uid", rule: "auth != null && auth.uid === $uid" }]);
  });

  it("n'accordent la lecture qu'au classement (connecté) et à ses propres paramètres", () => {
    expect(granted(".read")).toEqual([
      { path: "/v2/leaderboard", rule: "auth != null" },
      { path: "/v2/settings/$uid", rule: "auth != null && auth.uid === $uid" },
    ]);
  });

  it("ne contiennent aucune règle à `true` ni accès anonyme", () => {
    for (const kind of [".read", ".write"] as const) {
      for (const r of granted(kind)) {
        expect(r.rule, r.path).not.toBe(true);
        expect(String(r.rule), r.path).toContain("auth != null");
      }
    }
  });

  it("verrouillent explicitement tous les anciens chemins, sans en oublier", () => {
    for (const p of LEGACY_PATHS) {
      const node = candidate[p] as RuleNode;
      expect(node, p).toBeDefined();
      expect(node[".read"], p).toBe(false);
      expect(node[".write"], p).toBe(false);
    }
  });

  it("couvrent tous les chemins des règles actuellement actives", () => {
    const active = ["players", "saves", "bans", "ip_bans", "kicked", "frozen", "admins", "deleted", "deleted_usernames", "usernames", "chat", "announcements", "activity", "friends"];
    for (const p of active) expect(Object.keys(candidate), p).toContain(p);
  });

  it("conservent l'index historique de players et indexent le classement v2", () => {
    expect((candidate.players as RuleNode)[".indexOn"]).toEqual(["bestAuraScore", "totalRolls", "playTime"]);
    const v2 = candidate.v2 as RuleNode;
    expect((v2.leaderboard as RuleNode)[".indexOn"]).toEqual(["rolls", "bestOdds", "collection", "achievements"]);
  });
});

describe("commandes de publication des règles", () => {
  const read = (f: string) => JSON.parse(readFileSync(new URL(`../../${f}`, import.meta.url), "utf8"));
  const scripts = read("package.json").scripts as Record<string, string>;
  const firebase = read("firebase.json");

  it("firebase.json ne pointe que vers le fichier approuvé", () => {
    expect(firebase.database).toEqual({ rules: "database.rules.candidate.json" });
  });

  it("aucune commande ne référence l'ancien database.rules.json", () => {
    for (const [name, cmd] of Object.entries(scripts)) expect(cmd, name).not.toContain("database.rules.json");
  });

  it("deploy:rules vérifie les règles puis ne publie que la base", () => {
    const cmd = scripts["deploy:rules"];
    expect(cmd).toMatch(/^vitest run tests\/rules\/candidate\.static\.test\.ts && firebase deploy --only database$/);
  });

  it("deploy:backend ne publie plus aucune règle", () => {
    expect(scripts["deploy:backend"]).toMatch(/firebase deploy --only functions$/);
    expect(scripts["deploy:backend"]).not.toMatch(/database/);
  });

  it("seul deploy:rules peut publier des règles, et aucun script ne lance un déploiement Firebase complet", () => {
    const firebaseDeploys = Object.entries(scripts).filter(([, c]) => c.includes("firebase deploy"));
    for (const [name, cmd] of firebaseDeploys) expect(cmd, name).toMatch(/firebase deploy --only (functions|database)\b/);
    const publishing = firebaseDeploys.filter(([, c]) => /--only[^&]*database/.test(c)).map(([n]) => n);
    expect(publishing).toEqual(["deploy:rules"]);
  });
});

describe("règles candidates : cohérence avec le code", () => {
  const settingsRules = ((candidate.v2 as RuleNode).settings as RuleNode).$uid as RuleNode;

  it("valident exactement les champs écrits par l'application", () => {
    const fields = Object.keys(defaultSettings()).sort();
    const validated = Object.keys(settingsRules).filter((k) => !k.startsWith(".") && !k.startsWith("$")).sort();
    expect(validated).toEqual(fields);
    for (const f of fields) expect(String(settingsRules[".validate"]), f).toContain(`'${f}'`);
    expect((settingsRules.$other as RuleNode)[".validate"]).toBe(false);
  });

  it("acceptent tous les raccourcis de l'application et rien d'autre", () => {
    const rule = String(((settingsRules.keybinds as RuleNode).$action as RuleNode)[".validate"]);
    const re = new RegExp(rule.match(/matches\(\/(.+?)\/\)/)![1]);
    for (const a of KEY_ACTIONS) expect(re.test(a.id), a.id).toBe(true);
    for (const bad of ["nav8", "roll2", "admin", ""]) expect(re.test(bad), bad).toBe(false);
  });
});
