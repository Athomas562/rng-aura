import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  POTIONS,
  getAchievement,
  getRarity,
  msUntilNextRoll,
  requireAura,
  type ApiResponse,
  type Aura,
  type PlayerState,
  type PotionId,
  type PotionReward,
  type RollResult,
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
  kind: "achievement" | "reward" | "error" | "info";
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
  drink: (id: PotionId) => Promise<void>;
  equip: (auraId: string | null) => Promise<void>;
  dismissToast: (id: number) => void;
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
          const aura = requireAura(result.auraId);
          const rarity = getRarity(aura.rarity);
          const k = ++revealKey.current;

          if (rarity.tier >= 3) {
            const omenMs = s.reducedMotion ? 400 : 700 + (rarity.tier - 3) * 380;
            sound.riser(omenMs);
            setReveal({ key: k, phase: "omen", result, aura, durationMs: omenMs });
            await wait(omenMs);
          }

          let burstMs = rarity.revealMs;
          if (s.reducedMotion) burstMs = Math.min(burstMs, 1400);
          if (rarity.tier <= 1 && (s.skipCommonReveal || isAuto)) burstMs = 420;
          sound.reveal(rarity.tier);
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

  const drink = useCallback(
    async (id: PotionId) => {
      try {
        apply(await backend.call({ action: "potion", potionId: id }));
        sound.potion();
      } catch (e) {
        handleError(e);
      }
    },
    [apply, handleError],
  );

  const equip = useCallback(
    async (auraId: string | null) => {
      try {
        apply(await backend.call({ action: "equip", auraId }));
        sound.click();
      } catch (e) {
        handleError(e);
      }
    },
    [apply, handleError],
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
    }),
    [user, state, now, rolling, auto, reveal, lastResult, toasts, roll, toggleAuto, skipReveal, drink, equip, dismissToast],
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
