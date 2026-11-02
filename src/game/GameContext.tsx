import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  POTIONS,
  getAchievement,
  getRarity,
  levelInfo,
  lookOf,
  msUntilNextRoll,
  requireAura,
  type ApiRequest,
  type ApiResponse,
  type Aura,
  type LevelInfo,
  type PlayerState,
  type PotionId,
  type PotionReward,
  type QuestScope,
  type RarityId,
  type RollResult,
  type TalentId,
} from "../../shared";
import { sound } from "../audio/sound";
import { BackendError, backend, type AuthUser } from "../backend";
import { useSettings } from "../settings/SettingsContext";

export type RevealPhase = "charge" | "omen" | "burst";

export interface RevealState {
  key: number;
  phase: RevealPhase;
  result: RollResult | null;
  aura: Aura | null;
  /** Durée de la phase en cours (ms). */
  durationMs: number;
}

export interface Toast {
  id: number;
  kind: "achievement" | "reward" | "error" | "info" | "level";
  title: string;
  body?: string;
}

interface GameValue {
  user: AuthUser;
  state: PlayerState;
  /** Horloge synchronisée sur le serveur. */
  now: () => number;
  rolling: boolean;
  auto: boolean;
  reveal: RevealState | null;
  lastResult: RollResult | null;
  toasts: Toast[];
  roll: () => void;
  toggleAuto: () => void;
  skipReveal: () => void;
  drink: (id: PotionId, target?: RarityId) => Promise<void>;
  equip: (auraId: string | null, slot?: number) => Promise<void>;
  dismissToast: (id: number) => void;
  /** Niveau, XP dans le niveau et XP nécessaire. */
  level: LevelInfo;
  /** Apparence d'une aura pour ce joueur (Écho, Vivante, Mimique). */
  look: (aura: Aura) => Aura;
  fuse: (auraId: string) => Promise<boolean>;
  prestige: () => Promise<boolean>;
  learnTalent: (id: TalentId) => Promise<void>;
  respec: () => Promise<void>;
  setTitle: (id: string | null) => Promise<void>;
  setMimic: (auraId: string | null) => Promise<void>;
  claim: (scope: QuestScope | "mission", id: string) => Promise<void>;
}

const Ctx = createContext<GameValue | null>(null);

/** Rolls demandés par requête en auto-roll (le serveur n'accorde que le crédit disponible). */
const AUTO_BATCH = 4;
const HEARTBEAT_MS = 60_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function rewardText(r: PotionReward): string {
  return Object.entries(r)
    .map(([id, n]) => `${n}× ${POTIONS[id as PotionId].name}`)
    .join(", ");
}

interface ProviderProps {
  user: AuthUser;
  initial: ApiResponse;
  onBanned: (until: number, reason: string) => void;
  children: ReactNode;
}

export function GameProvider({ user, initial, onBanned, children }: ProviderProps) {
  const { settings } = useSettings();
  const [state, setState] = useState(initial.state);
  const [rolling, setRolling] = useState(false);
  const [auto, setAuto] = useState(false);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const offset = useRef(initial.serverNow - Date.now());
  const lastApplied = useRef(initial.serverNow);
  const stateRef = useRef(state);
  const busy = useRef(false);
  const autoRef = useRef(false);
  const skipRef = useRef<(() => void) | null>(null);
  const revealKey = useRef(0);
  const toastId = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const now = useCallback(() => Date.now() + offset.current, []);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), t.kind === "error" ? 3500 : 5000);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((prev) => prev.filter((x) => x.id !== id)), []);

  /** Applique une réponse serveur si elle n'est pas plus ancienne que l'état affiché. */
  const apply = useCallback(
    (res: ApiResponse) => {
      offset.current = res.serverNow - Date.now();
      if (res.serverNow >= lastApplied.current) {
        lastApplied.current = res.serverNow;
        stateRef.current = res.state;
        setState(res.state);
      }
      for (const id of res.achievements ?? []) {
        const a = getAchievement(id);
        if (a) pushToast({ kind: "achievement", title: `Succès : ${a.name}`, body: a.description });
      }
      if (res.achievements?.length) sound.achievement();
      if (res.rewards && Object.keys(res.rewards).length) {
        pushToast({ kind: "reward", title: "Potions obtenues", body: rewardText(res.rewards) });
      }
      if (res.levelUp) {
        pushToast({ kind: "level", title: `Niveau ${res.levelUp} !`, body: "Nouveau point de talent disponible." });
        sound.levelUp();
      }
    },
    [pushToast],
  );

  const handleError = useCallback(
    (e: unknown) => {
      if (e instanceof BackendError && e.code === "banned") {
        onBanned(e.info.until ?? 0, e.message);
        return;
      }
      sound.error();
      pushToast({ kind: "error", title: e instanceof Error ? e.message : "Erreur inattendue" });
    },
    [onBanned, pushToast],
  );

  /** Attend `ms` ou un appel à skipReveal. */
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(done, ms);
      function done() {
        clearTimeout(timer);
        skipRef.current = null;
        resolve();
      }
      skipRef.current = done;
    });

  const runRoll = useCallback(
    async (count: number) => {
      if (busy.current) return;
      busy.current = true;
      setRolling(true);
      const s = settingsRef.current;
      const isAuto = autoRef.current;

      try {
        // Respecte la recharge connue localement pour éviter un aller-retour inutile.
        const pending = msUntilNextRoll(stateRef.current, now());
        if (pending > 0) await sleep(pending);

        const key = ++revealKey.current;
        const chargeMs = s.reducedMotion ? 250 : isAuto ? 300 : 520;
        setReveal({ key, phase: "charge", result: null, aura: null, durationMs: chargeMs });

        let res: ApiResponse;
        try {
          [res] = await Promise.all([backend.call({ action: "roll", count }), sleep(chargeMs)]);
        } catch (e) {
          if (e instanceof BackendError && e.code === "cooldown") {
            await sleep(Math.max(100, e.info.retryInMs ?? 500));
            res = await backend.call({ action: "roll", count });
          } else throw e;
        }

        for (const result of res.results ?? []) {
          const aura = lookOf(requireAura(result.auraId), { rolls: res.state.stats.rolls, inventory: res.state.inventory, mimicOf: res.state.mimicOf });
          const rarity = getRarity(aura.rarity);
          const k = ++revealKey.current;

          if (rarity.tier >= 3) {
            const omenMs = s.reducedMotion ? 400 : Math.min(3600, 700 + (rarity.tier - 3) * 300);
            sound.riser(omenMs);
            setReveal({ key: k, phase: "omen", result, aura, durationMs: omenMs });
            await wait(omenMs);
          }

          let burstMs = rarity.revealMs;
          if (s.reducedMotion) burstMs = Math.min(burstMs, 1400);
          if (rarity.tier <= 1 && (s.skipCommonReveal || isAuto)) burstMs = 420;
          sound.reveal(rarity.tier);
          sound.rarityAccent(aura.rarity);
          setReveal({ key: k, phase: "burst", result, aura, durationMs: burstMs });
          setLastResult(result);
          await wait(burstMs);
        }
        apply(res);
      } catch (e) {
        handleError(e);
        autoRef.current = false;
        setAuto(false);
      } finally {
        setReveal(null);
        busy.current = false;
        setRolling(false);
      }

      if (autoRef.current) setTimeout(() => void runRoll(AUTO_BATCH), 0);
    },
    [apply, handleError, now],
  );

  const roll = useCallback(() => {
    if (!autoRef.current) void runRoll(1);
  }, [runRoll]);

  const toggleAuto = useCallback(() => {
    autoRef.current = !autoRef.current;
    setAuto(autoRef.current);
    sound.click();
    if (autoRef.current) void runRoll(AUTO_BATCH);
  }, [runRoll]);

  const skipReveal = useCallback(() => skipRef.current?.(), []);

  /** Envoie une intention au serveur ; renvoie la réponse, ou null en cas d'erreur (déjà signalée). */
  const send = useCallback(
    async (req: ApiRequest, onOk?: () => void): Promise<ApiResponse | null> => {
      try {
        const res = await backend.call(req);
        apply(res);
        onOk?.();
        return res;
      } catch (e) {
        handleError(e);
        return null;
      }
    },
    [apply, handleError],
  );

  const drink = useCallback(
    async (id: PotionId, target?: RarityId) => {
      await send({ action: "potion", potionId: id, ...(target ? { target } : {}) }, () => sound.potion());
    },
    [send],
  );

  const equip = useCallback(
    async (auraId: string | null, slot = 0) => {
      await send({ action: "equip", auraId, ...(slot ? { slot } : {}) }, () => sound.click());
    },
    [send],
  );

  /** Fusion : le serveur consomme les ingrédients ; l'aura obtenue est révélée comme un roll. */
  const fuse = useCallback(
    async (auraId: string) => {
      if (busy.current) return false;
      busy.current = true;
      try {
        const res = await backend.call({ action: "fuse", auraId });
        const aura = lookOf(requireAura(auraId), { rolls: res.state.stats.rolls, inventory: res.state.inventory, mimicOf: res.state.mimicOf });
        const rarity = getRarity(aura.rarity);
        const k = ++revealKey.current;
        const s = settingsRef.current;
        const burstMs = s.reducedMotion ? Math.min(rarity.revealMs, 1400) : rarity.revealMs;
        const result: RollResult = {
          auraId,
          luck: 1,
          blessed: false,
          isNew: res.fused?.isNew ?? false,
          rollNumber: 0,
          xp: res.fused?.xp ?? 0,
        };
        sound.fusion();
        sound.reveal(rarity.tier);
        setReveal({ key: k, phase: "burst", result, aura, durationMs: burstMs });
        await wait(burstMs);
        apply(res);
        pushToast({ kind: "reward", title: `Fusion réussie : ${aura.name}`, body: `+${result.xp} XP` });
        return true;
      } catch (e) {
        handleError(e);
        return false;
      } finally {
        setReveal(null);
        busy.current = false;
      }
    },
    [apply, handleError, pushToast],
  );

  const prestige = useCallback(async () => {
    const res = await send({ action: "prestige" }, () => sound.prestige());
    if (res) {
      pushToast({
        kind: "level",
        title: `Prestige ${res.state.prestige.level} !`,
        body: "Bonus de chance permanent : +5 %. Ton codex est conservé.",
      });
    }
    return res !== null;
  }, [send, pushToast]);

  const learnTalent = useCallback(async (id: TalentId) => void (await send({ action: "talent", talentId: id }, () => sound.click())), [send]);
  const respec = useCallback(async () => void (await send({ action: "respec" }, () => sound.click())), [send]);
  const setTitle = useCallback(async (id: string | null) => void (await send({ action: "title", titleId: id }, () => sound.click())), [send]);
  const setMimic = useCallback(async (auraId: string | null) => void (await send({ action: "mimic", auraId }, () => sound.click())), [send]);
  const claim = useCallback(
    async (scope: QuestScope | "mission", id: string) => void (await send({ action: "claim", scope, id }, () => sound.achievement())),
    [send],
  );

  const level = useMemo(() => levelInfo(state.xp), [state.xp]);
  const look = useCallback(
    (aura: Aura) => lookOf(aura, { rolls: state.stats.rolls, inventory: state.inventory, mimicOf: state.mimicOf }),
    [state.stats.rolls, state.inventory, state.mimicOf],
  );

  // Signal d'activité : compte le temps de jeu côté serveur tant que l'onglet est visible.
  useEffect(() => {
    const beat = () => {
      if (document.hidden || busy.current) return;
      backend.call({ action: "heartbeat" }).then(apply, handleError);
    };
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [apply, handleError]);

  // Arrête l'auto-roll en quittant le jeu.
  useEffect(
    () => () => {
      autoRef.current = false;
    },
    [],
  );

  const value = useMemo<GameValue>(
    () => ({
      user,
      state,
      now,
      rolling,
      auto,
      reveal,
      lastResult,
      toasts,
      roll,
      toggleAuto,
      skipReveal,
      drink,
      equip,
      dismissToast,
      level,
      look,
      fuse,
      prestige,
      learnTalent,
      respec,
      setTitle,
      setMimic,
      claim,
    }),
    [
      user,
      state,
      now,
      rolling,
      auto,
      reveal,
      lastResult,
      toasts,
      roll,
      toggleAuto,
      skipReveal,
      drink,
      equip,
      dismissToast,
      level,
      look,
      fuse,
      prestige,
      learnTalent,
      respec,
      setTitle,
      setMimic,
      claim,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGame hors de GameProvider");
  return v;
}

/** Re-rend le composant à intervalle régulier (minuteurs). */
export function useTick(ms = 1000): void {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}
