/**
 * Logique serveur de l'API, indépendante de Firebase (testable avec un store en mémoire).
 * Toute décision qui touche aux récompenses (rolls, potions, succès, classement)
 * est prise ici, à partir de l'état stocké — jamais à partir de ce qu'envoie le client.
 */
import {
  GameError,
  claimMission,
  claimQuest,
  createPlayerState,
  doPrestige,
  drinkPotion,
  equipAura,
  fuseAura,
  getAura,
  heartbeat,
  isPotionId,
  isTalentId,
  isSecretAchievement,
  revealHint,
  isUpgradeId,
  isCosmeticId,
  buyUpgrade,
  buyPotion,
  buyCosmetic,
  wearCosmetic,
  learnTalent,
  normalizePlayerState,
  performRolls,
  resetTalents,
  setMimic,
  setTitle,
  toLeaderboardEntry,
  type ActionOutcome,
  adminView,
  applyGrant,
  isAdmin,
  validateGrant,
  EMAIL_DOMAIN,
  REQUEST_ID_LIMIT,
  REQUEST_ID_RE,
  USERNAME_RE,
  type ApiResponse,
  type LeaderboardEntry,
  type PlayerState,
  type Rng,
} from "../../shared/index";
import { ApiError, type ApiErrorCode } from "./errors";
import { revealedHints } from "./hints";
import {
  browseMarket,
  buyListing,
  cancelListing,
  cancelTrade,
  confirmTrade,
  createListing,
  createTrade,
  listTrades,
  partnerInventory,
  settle,
  updateTradeOffer,
  type MarketContext,
  type MarketStore,
} from "./market";

export interface Ban {
  until: number;
  reason?: string;
}

export interface PlayerStore {
  getBan(uid: string): Promise<Ban | null>;
  /**
   * Applique `mutate` de façon atomique sur l'état stocké (brut, éventuellement absent).
   * `mutate` peut lever une erreur : l'écriture est alors annulée et l'erreur propagée.
   */
  updatePlayer(uid: string, mutate: (raw: unknown) => PlayerState): Promise<PlayerState>;
  writeLeaderboard(uid: string, entry: LeaderboardEntry): Promise<void>;
  /** Réserve un pseudo (en minuscules) pour `uid`. Renvoie false s'il appartient à un autre joueur. */
  claimUsername(lower: string, uid: string, now: number): Promise<boolean>;
  /** Lecture seule de l'état brut d'un joueur (marché : dénouements, inventaire d'un partenaire). */
  readPlayer?(uid: string): Promise<unknown>;
}

export { ApiError, type ApiErrorCode } from "./errors";

export interface Caller {
  uid: string;
  /** E-mail du compte Firebase (pseudo@aurarng.local). */
  email?: string;
  displayName?: string;
  /** Empreintes hachées (jamais l'IP en clair), pour l'anti-mule du marché. */
  ipHash?: string;
  deviceHash?: string;
}

/** Nom générique des comptes qui ne suivent pas le format pseudo@aurarng.local. */
export const GENERIC_NAME = "Joueur";

/**
 * Nom affiché (classement compris), dérivé uniquement de l'e-mail du compte,
 * unique par construction (pseudo@aurarng.local). Le `displayName` du jeton est
 * modifiable par le joueur : il ne sert qu'à conserver la casse du même pseudo.
 */
export function nameFromCaller(c: Caller): string {
  const email = c.email?.toLowerCase() ?? "";
  const local = email.endsWith(EMAIL_DOMAIN) ? email.slice(0, -EMAIL_DOMAIN.length) : "";
  if (!USERNAME_RE.test(local)) return GENERIC_NAME;
  if (c.displayName && USERNAME_RE.test(c.displayName) && c.displayName.toLowerCase() === local) return c.displayName;
  return local;
}

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

export async function handleApi(
  caller: Caller,
  data: unknown,
  deps: {
    store: PlayerStore;
    rng: Rng;
    now: () => number;
    log?: (entry: Record<string, unknown>) => void;
    /** Tables du marché (absent : les actions de marché sont refusées). */
    market?: MarketStore;
    newId?: () => string;
  },
): Promise<ApiResponse> {
  const { store, rng } = deps;
  const { uid } = caller;
  const input = asRecord(data);
  const action = input.action;

  const ban = await store.getBan(uid);
  if (ban && ban.until > deps.now()) {
    throw new ApiError("permission-denied", ban.reason || "Compte banni", { until: ban.until });
  }

  const fallbackName = nameFromCaller(caller);
  const load = (raw: unknown, now: number) => {
    const s = normalizePlayerState(raw, fallbackName, now);
    // Un nom stocké qui ne correspond pas au compte (ancien nom usurpé) est corrigé.
    if (s.name.toLowerCase() !== fallbackName.toLowerCase()) s.name = fallbackName;
    return s;
  };

  // Chaque action renvoie l'état final + des informations annexes calculées dans la même transaction.
  let extra: Omit<ApiResponse, "state" | "serverNow"> = {};
  let leaderboard = true;
  /** Retient les informations annexes d'une action (une transaction rejouée les remplace). */
  const withOutcome = (out: ActionOutcome) => {
    extra = {
      achievements: out.achievements,
      rewards: out.rewards,
      ...(out.levelUp ? { levelUp: out.levelUp } : {}),
      ...(out.shards > 0 ? { shards: out.shards } : {}),
    };
    return out.state;
  };
  const run = (fn: (s: PlayerState, now: number) => PlayerState) =>
    store.updatePlayer(uid, (raw) => {
      const now = deps.now();
      const current = raw ? load(raw, now) : createPlayerState(fallbackName, now);
      const next = fn(current, now);
      // Révision monotone : le client ignore toute réponse plus ancienne que l'état affiché.
      return { ...next, rev: current.rev + 1 };
    });

  // ── Marché : contexte, empreintes anti-mule, dénouements en suspens ──
  const market = deps.market;
  const readState = async (u: string) => {
    const raw = await store.readPlayer?.(u);
    return raw ? normalizePlayerState(raw, u === uid ? fallbackName : "Joueur", deps.now()) : null;
  };
  const mctx: MarketContext | null =
    market && store.readPlayer ? { uid, market, now: deps.now, run, read: readState, newId: deps.newId ?? (() => crypto.randomUUID()) } : null;
  const needMarket = (): MarketContext => {
    if (!mctx) throw new ApiError("failed-precondition", "Marché indisponible");
    return mctx;
  };
  if (market && caller.ipHash) await market.recordFootprint(uid, caller.ipHash, caller.deviceHash ?? "", deps.now());
  if (mctx && (action === "load" || action === "heartbeat")) await settle(mctx);
  /** État final après une action de marché (lecture, sans écriture supplémentaire). */
  const current = async () => (await readState(uid)) ?? (await run((s) => s));

  /** Retrouve un joueur par pseudo (ou par UID) pour le panneau d'administration. */
  const adminTarget = async (target: unknown): Promise<string> => {
    if (!isAdmin(uid)) throw new ApiError("permission-denied", "Réservé à l'administrateur");
    if (typeof target !== "string" || !target.trim()) throw new ApiError("invalid-argument", "Joueur manquant");
    const t = target.trim();
    if (USERNAME_RE.test(t)) {
      const found = await market?.uidByName(t.toLowerCase());
      if (found) return found;
    }
    if (/^[A-Za-z0-9]{10,64}$/.test(t) && (await store.readPlayer?.(t))) return t;
    throw new ApiError("not-found", "Joueur introuvable : " + t);
  };

  let state: PlayerState;
  switch (action) {
    case "adminLookup": {
      const target = await adminTarget(input.target);
      const raw = await store.readPlayer?.(target);
      if (!raw) throw new ApiError("not-found", "Ce joueur n'a pas encore de partie");
      extra.admin = adminView(target, normalizePlayerState(raw, "Joueur", deps.now()));
      state = await current();
      leaderboard = false;
      break;
    }

    case "adminGive": {
      const target = await adminTarget(input.target);
      const checked = validateGrant(input.grant);
      if ("error" in checked) throw new ApiError("invalid-argument", checked.error);
      const updated = await store.updatePlayer(target, (raw) => {
        if (!raw) throw new ApiError("not-found", "Ce joueur n'a pas encore de partie");
        const now = deps.now();
        const s = normalizePlayerState(raw, "Joueur", now);
        return { ...applyGrant(s, checked.grant, now), rev: s.rev + 1 };
      });
      deps.log?.({ event: "admin_give", admin: uid, target, grant: checked.grant, server_ts: deps.now() });
      await store.writeLeaderboard(target, toLeaderboardEntry(updated, deps.now()));
      extra.admin = adminView(target, updated);
      state = await current();
      leaderboard = false;
      break;
    }

    case "load":
      state = await run((s) => s);
      break;

    case "market": {
      const ctx = needMarket();
      await settle(ctx);
      extra.market = await browseMarket(ctx, input.auraId);
      state = await current();
      leaderboard = false;
      break;
    }

    case "list": {
      const ctx = needMarket();
      await settle(ctx);
      state = await createListing(ctx, input.auraId, input.price);
      extra.market = await browseMarket(ctx, undefined);
      leaderboard = false;
      break;
    }

    case "unlist": {
      const ctx = needMarket();
      await cancelListing(ctx, input.listingId);
      extra.market = await browseMarket(ctx, undefined);
      state = await current();
      leaderboard = false;
      break;
    }

    case "buyListing": {
      const ctx = needMarket();
      await settle(ctx);
      state = await buyListing(ctx, input.listingId);
      extra.market = await browseMarket(ctx, undefined);
      leaderboard = false;
      break;
    }

    case "trades": {
      const ctx = needMarket();
      await settle(ctx);
      extra.trades = await listTrades(ctx);
      state = await current();
      leaderboard = false;
      break;
    }

    case "tradeCreate": {
      const ctx = needMarket();
      await settle(ctx);
      await createTrade(ctx, input.receiver, input.auras);
      extra.trades = await listTrades(ctx);
      state = await current();
      leaderboard = false;
      break;
    }

    case "tradeOffer": {
      const ctx = needMarket();
      await updateTradeOffer(ctx, input.tradeId, input.auras);
      extra.trades = await listTrades(ctx);
      state = await current();
      leaderboard = false;
      break;
    }

    case "tradeConfirm": {
      const ctx = needMarket();
      await confirmTrade(ctx, input.tradeId, input.version);
      extra.trades = await listTrades(ctx);
      state = await current();
      leaderboard = false;
      break;
    }

    case "tradeCancel": {
      const ctx = needMarket();
      await cancelTrade(ctx, input.tradeId);
      extra.trades = await listTrades(ctx);
      state = await current();
      leaderboard = false;
      break;
    }

    case "tradePartner": {
      const ctx = needMarket();
      extra.partner = await partnerInventory(ctx, input.tradeId);
      state = await current();
      leaderboard = false;
      break;
    }

    case "register": {
      const name = input.name;
      if (typeof name !== "string" || !USERNAME_RE.test(name)) {
        throw new ApiError("invalid-argument", "Pseudo invalide (3-20 caractères : lettres, chiffres, _)");
      }
      // Le pseudo doit correspondre au compte authentifié : impossible d'usurper celui d'un autre.
      if (caller.email?.toLowerCase() !== name.toLowerCase() + EMAIL_DOMAIN) {
        throw new ApiError("permission-denied", "Le pseudo ne correspond pas au compte");
      }
      if (!(await store.claimUsername(name.toLowerCase(), uid, deps.now()))) {
        throw new ApiError("already-exists", "Ce pseudo est déjà pris");
      }
      state = await run((s) => ({ ...s, name }));
      break;
    }

    case "roll": {
      const count = Number.isFinite(input.count) ? (input.count as number) : 1;
      const requestId = input.requestId;
      if (requestId !== undefined && (typeof requestId !== "string" || !REQUEST_ID_RE.test(requestId))) {
        throw new ApiError("invalid-argument", "Identifiant de requête invalide");
      }
      let entry: Record<string, unknown> = {};
      state = await run((s, now) => {
        // Doublon (requête renvoyée) : rien n'est rejoué, l'état courant est renvoyé tel quel.
        if (requestId && s.requestIds.includes(requestId)) {
          extra = { results: [], duplicate: true };
          entry = { roll_id: requestId, server_ts: now, duplicate: true, streak_before: s.stats.streak, streak_after: s.stats.streak };
          return s;
        }
        const out = performRolls(s, now, count, rng);
        withOutcome(out);
        extra.results = out.results;
        if (requestId) out.state.requestIds = [requestId, ...out.state.requestIds].slice(0, REQUEST_ID_LIMIT);
        entry = {
          roll_id: requestId ?? null,
          server_ts: now,
          granted: out.results.length,
          streak_before: s.stats.streak,
          streak_after: out.state.stats.streak,
        };
        return out.state;
      });
      deps.log?.({ event: "roll", uid, ...entry });
      leaderboard = !extra.duplicate;
      break;
    }

    case "potion": {
      const id = input.potionId;
      if (!isPotionId(id)) throw new ApiError("invalid-argument", "Potion inconnue");
      state = await run((s, now) => withOutcome(drinkPotion(s, id, now, input.target)));
      break;
    }

    case "equip": {
      const auraId = input.auraId;
      const slot = input.slot ?? 0;
      if (auraId !== null && (typeof auraId !== "string" || !getAura(auraId))) {
        throw new ApiError("invalid-argument", "Aura inconnue");
      }
      if (typeof slot !== "number" || !Number.isInteger(slot)) throw new ApiError("invalid-argument", "Emplacement invalide");
      state = await run((s) => equipAura(s, auraId, slot));
      break;
    }

    case "heartbeat":
      state = await run((s, now) => withOutcome(heartbeat(s, now)));
      leaderboard = (extra.achievements?.length ?? 0) > 0 || extra.levelUp !== undefined;
      break;

    case "fuse": {
      const auraId = input.auraId;
      if (typeof auraId !== "string" || !getAura(auraId)) throw new ApiError("invalid-argument", "Aura inconnue");
      state = await run((s, now) => {
        const out = fuseAura(s, auraId, now);
        withOutcome(out);
        extra.fused = { auraId: out.auraId, isNew: out.isNew, xp: out.xp };
        return out.state;
      });
      break;
    }

    case "prestige":
      state = await run((s, now) => withOutcome(doPrestige(s, now)));
      break;

    case "talent": {
      const talentId = input.talentId;
      if (!isTalentId(talentId)) throw new ApiError("invalid-argument", "Talent inconnu");
      state = await run((s) => learnTalent(s, talentId));
      leaderboard = false;
      break;
    }

    case "respec":
      state = await run((s) => resetTalents(s));
      leaderboard = false;
      break;

    case "title": {
      const titleId = input.titleId;
      if (titleId !== null && (typeof titleId !== "string" || titleId.length > 40)) throw new ApiError("invalid-argument", "Titre invalide");
      state = await run((s) => setTitle(s, titleId));
      break;
    }

    case "mimic": {
      const auraId = input.auraId;
      if (auraId !== null && (typeof auraId !== "string" || !getAura(auraId))) throw new ApiError("invalid-argument", "Aura inconnue");
      state = await run((s) => setMimic(s, auraId));
      leaderboard = false;
      break;
    }

    case "claim": {
      const { scope, id } = input;
      if (typeof id !== "string" || id.length > 40) throw new ApiError("invalid-argument", "Quête invalide");
      if (scope === "daily" || scope === "weekly") state = await run((s, now) => withOutcome(claimQuest(s, scope, id, now)));
      else if (scope === "mission") state = await run((s, now) => withOutcome(claimMission(s, id, now)));
      else throw new ApiError("invalid-argument", "Type de quête invalide");
      break;
    }

    case "buy": {
      const { kind, id } = input;
      if (kind === "upgrade") {
        if (!isUpgradeId(id)) throw new ApiError("invalid-argument", "Amélioration inconnue");
        state = await run((s, now) => withOutcome(buyUpgrade(s, id, now)));
      } else if (kind === "potion") {
        const quantity = input.quantity ?? 1;
        if (!isPotionId(id)) throw new ApiError("invalid-argument", "Potion inconnue");
        if (typeof quantity !== "number" || !Number.isInteger(quantity)) throw new ApiError("invalid-argument", "Quantité invalide");
        state = await run((s, now) => withOutcome(buyPotion(s, id, quantity, now)));
      } else if (kind === "cosmetic") {
        if (!isCosmeticId(id)) throw new ApiError("invalid-argument", "Cosmétique inconnu");
        state = await run((s, now) => withOutcome(buyCosmetic(s, id, now)));
      } else throw new ApiError("invalid-argument", "Type d'achat invalide");
      leaderboard = (extra.achievements?.length ?? 0) > 0;
      break;
    }

    case "wear": {
      const { kind, id } = input;
      if (kind !== "trail" && kind !== "frame") throw new ApiError("invalid-argument", "Type de cosmétique invalide");
      if (id !== null && !isCosmeticId(id)) throw new ApiError("invalid-argument", "Cosmétique inconnu");
      state = await run((s) => wearCosmetic(s, kind, id));
      leaderboard = false;
      break;
    }

    case "hint": {
      const achievementId = input.achievementId;
      if (!isSecretAchievement(achievementId)) throw new ApiError("invalid-argument", "Succès secret inconnu");
      state = await run((s, now) => withOutcome(revealHint(s, achievementId, now)));
      leaderboard = false;
      break;
    }

    default:
      throw new ApiError("invalid-argument", "Action inconnue");
  }

  const serverNow = deps.now();
  if (leaderboard) await store.writeLeaderboard(uid, toLeaderboardEntry(state, serverNow));
  // Les textes d'indices ne quittent le serveur qu'une fois révélés.
  const hints = revealedHints(state);
  return { state, serverNow, ...extra, ...(Object.keys(hints).length ? { hints } : {}) };
}

/** Convertit une erreur du moteur en erreur d'API. */
export function toApiError(e: unknown): unknown {
  if (e instanceof GameError) {
    const code: ApiErrorCode = e.code === "cooldown" ? "resource-exhausted" : "failed-precondition";
    return new ApiError(code, e.message, { reason: e.code, retryInMs: e.retryInMs });
  }
  return e;
}
