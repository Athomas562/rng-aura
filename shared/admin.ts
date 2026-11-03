/**
 * Panneau d'administration : qui y a droit et comment un don s'applique à un état.
 * Le serveur est seul juge : l'UID vient du jeton Firebase vérifié, jamais du client.
 * Côté client, `isAdmin` ne sert qu'à afficher (ou non) la page.
 */
import { getAura } from "./auras";
import { SHARD_CAP, POTION_STOCK_LIMIT } from "./economy";
import { isBetter } from "./engine";
import { isPotionId, type PotionId } from "./potions";
import type { PlayerState } from "./state";

export const ADMIN_UIDS: readonly string[] = ["goIfApqT2iMCIQozX8unHuIv9wy2"];

export function isAdmin(uid: string | null | undefined): boolean {
  return typeof uid === "string" && ADMIN_UIDS.includes(uid);
}

/** Limites d'un don (valeurs signées : un nombre négatif retire). */
export const ADMIN_MAX_POTIONS = 9_999;
export const ADMIN_MAX_AURAS = 1_000;
export const ADMIN_MAX_XP = 1_000_000_000;

export interface AdminGrant {
  shards?: number;
  xp?: number;
  potions?: Partial<Record<PotionId, number>>;
  auras?: Record<string, number>;
}

/** Résumé d'un joueur pour le panneau. */
export interface AdminPlayerView {
  uid: string;
  name: string;
  shards: number;
  xp: number;
  rolls: number;
  prestige: number;
  potions: Partial<Record<PotionId, number>>;
  auras: Record<string, number>;
}

export function adminView(uid: string, s: PlayerState): AdminPlayerView {
  const potions: Partial<Record<PotionId, number>> = {};
  for (const [id, n] of Object.entries(s.potions.owned)) if (n) potions[id as PotionId] = n;
  const auras: Record<string, number> = {};
  for (const [id, e] of Object.entries(s.inventory)) auras[id] = e.count;
  return { uid, name: s.name, shards: s.shards, xp: s.xp, rolls: s.stats.rolls, prestige: s.prestige.level, potions, auras };
}

const isInt = (v: unknown, max: number): v is number => typeof v === "number" && Number.isInteger(v) && Math.abs(v) <= max;

/** Valide un don reçu du client. Renvoie un message d'erreur, ou null si tout est valide. */
export function validateGrant(raw: unknown): { grant: AdminGrant } | { error: string } {
  const g = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const grant: AdminGrant = {};
  if (g.shards !== undefined && g.shards !== 0) {
    if (!isInt(g.shards, SHARD_CAP)) return { error: "Montant d'éclats invalide" };
    grant.shards = g.shards;
  }
  if (g.xp !== undefined && g.xp !== 0) {
    if (!isInt(g.xp, ADMIN_MAX_XP)) return { error: "Montant d'XP invalide" };
    grant.xp = g.xp;
  }
  if (g.potions !== undefined) {
    if (!g.potions || typeof g.potions !== "object") return { error: "Potions invalides" };
    for (const [id, n] of Object.entries(g.potions)) {
      if (!isPotionId(id)) return { error: `Potion inconnue : ${id}` };
      if (!isInt(n, ADMIN_MAX_POTIONS)) return { error: `Quantité invalide pour ${id}` };
      if (n !== 0) (grant.potions ??= {})[id] = n;
    }
  }
  if (g.auras !== undefined) {
    if (!g.auras || typeof g.auras !== "object") return { error: "Auras invalides" };
    const entries = Object.entries(g.auras);
    if (entries.length > 100) return { error: "Trop d'auras en une fois" };
    for (const [id, n] of entries) {
      if (!getAura(id)) return { error: `Aura inconnue : ${id}` };
      if (!isInt(n, ADMIN_MAX_AURAS)) return { error: `Quantité invalide pour ${id}` };
      if (n !== 0) (grant.auras ??= {})[id] = n;
    }
  }
  if (!grant.shards && !grant.xp && !grant.potions && !grant.auras) return { error: "Rien à donner" };
  return { grant };
}

/**
 * Applique un don à un état (dans l'écriture atomique du joueur visé).
 * Les retraits s'arrêtent à zéro ; une aura retirée n'est jamais celle en dépôt (marché/échange).
 */
export function applyGrant(state: PlayerState, grant: AdminGrant, now: number): PlayerState {
  if (grant.shards) {
    const before = state.shards;
    state.shards = Math.max(0, Math.min(SHARD_CAP, state.shards + grant.shards));
    const delta = state.shards - before;
    if (delta !== 0) {
      state.ledger.unshift({ at: now, amount: delta, reason: "Administration", balance: state.shards });
      state.ledger = state.ledger.slice(0, 40);
    }
  }
  if (grant.xp) state.xp = Math.max(0, state.xp + grant.xp);
  for (const [id, n] of Object.entries(grant.potions ?? {})) {
    const owned = state.potions.owned[id as PotionId] ?? 0;
    // Un don peut dépasser le stock de boutique (99), dans la limite du don maximal.
    state.potions.owned[id as PotionId] = Math.max(0, Math.min(Math.max(POTION_STOCK_LIMIT, ADMIN_MAX_POTIONS), owned + (n ?? 0)));
  }
  for (const [id, n] of Object.entries(grant.auras ?? {})) {
    const entry = state.inventory[id];
    if (n > 0) {
      if (entry) {
        entry.count += n;
        entry.lastAt = now;
      } else {
        state.inventory[id] = { count: n, firstAt: now, lastAt: now, firstRoll: state.stats.rolls, traded: 0 };
      }
      const c = state.codex[id];
      if (c) c.total += n;
      else state.codex[id] = { firstAt: now, total: n };
      if (isBetter(id, state.stats.bestAuraId)) state.stats.bestAuraId = id;
      if (!state.equipped) state.equipped = id;
    } else if (entry) {
      entry.count = Math.max(0, entry.count + n);
      entry.traded = Math.min(entry.traded ?? 0, entry.count);
      if (entry.count === 0) {
        delete state.inventory[id];
        if (state.equipped === id) state.equipped = null;
        state.slots = state.slots.map((x) => (x === id ? null : x));
      }
    }
  }
  return state;
}
