/**
 * Implémentation de `PlayerStore` sur Cloudflare D1 (aucune clé ni compte de service).
 *
 * Écritures atomiques : chaque joueur a un numéro de version. On lit (état, version),
 * on applique la logique serveur, puis `UPDATE … WHERE version = ?`. Si une autre requête
 * a écrit entre-temps, aucune ligne n'est modifiée et on recommence avec le nouvel état.
 */
import type { LeaderboardCategory, LeaderboardEntry, LeaderboardRow, PlayerState } from "../shared";
import type { Ban, PlayerStore } from "../functions/src/handlers";
import type { D1Database } from "./d1";

export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreError";
  }
}

/** Colonnes de tri autorisées (liste blanche : jamais de texte client dans le SQL). */
const ORDER_COLUMN: Record<LeaderboardCategory, string> = {
  rolls: "rolls",
  bestOdds: "best_odds",
  collection: "collection",
  achievements: "achievements",
};

interface LeaderboardSqlRow {
  uid: string;
  name: string;
  rolls: number;
  best_odds: number;
  best_aura_id: string | null;
  collection: number;
  achievements: number;
  equipped: string | null;
}

export interface D1Store extends PlayerStore {
  leaderboard(category: LeaderboardCategory, limit: number, viewerUid: string): Promise<LeaderboardRow[]>;
}

export function createD1Store(db: D1Database, options: { maxAttempts?: number; now?: () => number } = {}): D1Store {
  const maxAttempts = options.maxAttempts ?? 25;
  const now = options.now ?? Date.now;

  return {
    async getBan(uid): Promise<Ban | null> {
      const row = await db.prepare("SELECT until, reason FROM bans WHERE uid = ?").bind(uid).first<{ until: number; reason: string | null }>();
      return row ? { until: row.until, reason: row.reason ?? undefined } : null;
    },

    async updatePlayer(uid, mutate) {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const row = await db.prepare("SELECT state, version FROM players WHERE uid = ?").bind(uid).first<{ state: string; version: number }>();
        const current: unknown = row ? JSON.parse(row.state) : null;
        const next: PlayerState = mutate(current); // une erreur du moteur annule sans écrire
        const json = JSON.stringify(next);

        const res = row
          ? await db
              .prepare("UPDATE players SET state = ?, version = version + 1, updated_at = ? WHERE uid = ? AND version = ?")
              .bind(json, now(), uid, row.version)
              .run()
          : await db
              .prepare("INSERT INTO players (uid, state, version, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(uid) DO NOTHING")
              .bind(uid, json, now())
              .run();
        if (res.meta.changes === 1) return next;
        // conflit : quelqu'un a écrit entre la lecture et l'écriture → on recommence
      }
      throw new StoreError("Trop de conflits d'écriture, réessaie");
    },

    async writeLeaderboard(uid, entry: LeaderboardEntry) {
      // Ne remplace jamais une entrée plus récente (requêtes simultanées terminées dans le désordre).
      await db
        .prepare(
          `INSERT INTO leaderboard (uid, name, rolls, best_odds, best_aura_id, collection, achievements, equipped, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(uid) DO UPDATE SET
             name = excluded.name, rolls = excluded.rolls, best_odds = excluded.best_odds,
             best_aura_id = excluded.best_aura_id, collection = excluded.collection,
             achievements = excluded.achievements, equipped = excluded.equipped, updated_at = excluded.updated_at
           WHERE excluded.updated_at >= leaderboard.updated_at`,
        )
        .bind(uid, entry.name, entry.rolls, entry.bestOdds, entry.bestAuraId, entry.collection, entry.achievements, entry.equipped, entry.updatedAt)
        .run();
    },

    async claimUsername(lower, uid, at) {
      await db.prepare("INSERT INTO usernames (name, uid, created_at) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING").bind(lower, uid, at).run();
      const owner = await db.prepare("SELECT uid FROM usernames WHERE name = ?").bind(lower).first<{ uid: string }>();
      return owner?.uid === uid;
    },

    async leaderboard(category, limit, viewerUid) {
      const column = Object.hasOwn(ORDER_COLUMN, category) ? ORDER_COLUMN[category] : undefined;
      if (!column) throw new StoreError("Catégorie inconnue");
      const { results } = await db
        .prepare(
          `SELECT uid, name, rolls, best_odds, best_aura_id, collection, achievements, equipped
           FROM leaderboard ORDER BY ${column} DESC, updated_at ASC LIMIT ?`,
        )
        .bind(limit)
        .all<LeaderboardSqlRow>();
      return results.map((r, i) => ({
        rank: i + 1,
        me: r.uid === viewerUid,
        name: r.name,
        rolls: r.rolls,
        bestOdds: r.best_odds,
        bestAuraId: r.best_aura_id,
        collection: r.collection,
        achievements: r.achievements,
        equipped: r.equipped,
      }));
    },
  };
}
