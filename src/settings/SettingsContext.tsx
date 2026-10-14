import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { backend } from "../backend";
import { sound } from "../audio/sound";
import { sanitizeSettings, type Settings } from "./settings";

const LOCAL_KEY = "aura-rng:settings";

function readLocal(): Settings {
  try {
    return sanitizeSettings(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "null"));
  } catch {
    return sanitizeSettings(null);
  }
}

interface SettingsValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<SettingsValue | null>(null);

export function SettingsProvider({ uid, children }: { uid: string | null; children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(readLocal);
  const saveTimer = useRef<number>(undefined);

  // Charge les réglages du compte une fois connecté (ils priment sur les réglages locaux).
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    backend
      .loadSettings(uid)
      .then((remote) => {
        if (!cancelled && remote) setSettings(sanitizeSettings({ ...readLocal(), ...remote }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    sound.configure(settings.soundEnabled, settings.volume);
    const root = document.documentElement;
    root.dataset.reducedMotion = String(settings.reducedMotion);
    root.dataset.noFlashes = String(settings.noFlashes);
  }, [settings]);

  const current = useRef(settings);
  current.current = settings;

  const update = useCallback(
    (patch: Partial<Settings>) => {
      const next = sanitizeSettings({ ...current.current, ...patch });
      current.current = next;
      setSettings(next);
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      } catch {
        /* stockage indisponible */
      }
      if (uid) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => backend.saveSettings(uid, next).catch(() => {}), 800);
      }
    },
    [uid],
  );

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSettings hors de SettingsProvider");
  return v;
}
