/**
 * Conversion d'un export JSON de la Realtime Database (console Firebase → ⋮ → Exporter JSON)
 * en instructions SQL pour D1. Ne génère que des `INSERT OR IGNORE` : une ligne déjà présente
 * dans D1 n'est jamais écrasée, et rien n'est supprimé. Aucune dépendance (exécutable par Node seul).
 *
 * Importé : bans, usernames, v2/players, v2/leaderboard.
 * Ignoré  : les chemins de l'ancien jeu (players, saves, chat…) — ils restent intacts dans Firebase.
 */

export interface ImportCounts {
  bans: number;
  usernames: number;
  players: number;
  leaderboard: number;
  skipped: number;
}

export interface ImportResult {
  sql: string;
  counts: ImportCounts;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const NAME_RE = /^[a-z0-9_]{1,20}$/;

function str(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

function int(v: unknown): string | null {
  return typeof v === "number" && Number.isFinite(v) ? String(Math.trunc(v)) : null;
}

function optStr(v: unknown): string {
  return typeof v === "string" ? str(v) : "NULL";
}

/** Accepte l'export de toute la base ou celui d'un nœud déjà choisi. */
export function rtdbExportToSql(exported: unknown, now: number): ImportResult {
  const root = isObj(exported) ? exported : {};
  const v2 = isObj(root.v2) ? root.v2 : {};
  const counts: ImportCounts = { bans: 0, usernames: 0, players: 0, leaderboard: 0, skipped: 0 };
  const lines: string[] = ["-- Import RNG Aura (Realtime Database → D1) : INSERT OR IGNORE uniquement."];

  for (const [uid, ban] of Object.entries(isObj(root.bans) ? root.bans : {})) {
    const until = isObj(ban) ? int(ban.until) : null;
    if (!UID_RE.test(uid) || until === null) {
      counts.skipped++;
      continue;
    }
    lines.push(`INSERT OR IGNORE INTO bans (uid, until, reason) VALUES (${str(uid)}, ${until}, ${optStr(isObj(ban) ? ban.reason : null)});`);
    counts.bans++;
  }

  for (const [name, entry] of Object.entries(isObj(root.usernames) ? root.usernames : {})) {
    const uid = isObj(entry) ? entry.uid : null;
    if (!NAME_RE.test(name) || typeof uid !== "string" || !UID_RE.test(uid)) {
      counts.skipped++;
      continue;
    }
    const created = int(isObj(entry) ? entry.createdAt : null) ?? String(now);
    lines.push(`INSERT OR IGNORE INTO usernames (name, uid, created_at) VALUES (${str(name)}, ${str(uid)}, ${created});`);
    counts.usernames++;
  }

  for (const [uid, state] of Object.entries(isObj(v2.players) ? v2.players : {})) {
    if (!UID_RE.test(uid) || !isObj(state)) {
      counts.skipped++;
      continue;
    }
    lines.push(`INSERT OR IGNORE INTO players (uid, state, version, updated_at) VALUES (${str(uid)}, ${str(JSON.stringify(state))}, 1, ${now});`);
    counts.players++;
  }

  for (const [uid, e] of Object.entries(isObj(v2.leaderboard) ? v2.leaderboard : {})) {
    const nums = isObj(e) ? [int(e.rolls), int(e.bestOdds), int(e.collection), int(e.achievements)] : [null];
    if (!UID_RE.test(uid) || !isObj(e) || typeof e.name !== "string" || nums.some((n) => n === null)) {
      counts.skipped++;
      continue;
    }
    const [rolls, bestOdds, collection, achievements] = nums;
    lines.push(
      `INSERT OR IGNORE INTO leaderboard (uid, name, rolls, best_odds, best_aura_id, collection, achievements, equipped, updated_at) VALUES (` +
        `${str(uid)}, ${str(e.name)}, ${rolls}, ${bestOdds}, ${optStr(e.bestAuraId)}, ${collection}, ${achievements}, ${optStr(e.equipped)}, ${int(e.updatedAt) ?? now});`,
    );
    counts.leaderboard++;
  }

  return { sql: lines.join("\n") + "\n", counts };
}
