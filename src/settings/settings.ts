export const PAGES = [
  { id: "roll", label: "Roll" },
  { id: "inventory", label: "Inventaire" },
  { id: "collection", label: "Collection" },
  { id: "achievements", label: "Succès" },
  { id: "stats", label: "Statistiques" },
  { id: "leaderboard", label: "Classement" },
  { id: "settings", label: "Paramètres" },
] as const;

export type PageId = (typeof PAGES)[number]["id"];

export type KeyAction = "roll" | "auto" | "nav1" | "nav2" | "nav3" | "nav4" | "nav5" | "nav6" | "nav7";

export const KEY_ACTIONS: { id: KeyAction; label: string }[] = [
  { id: "roll", label: "Lancer un roll" },
  { id: "auto", label: "Activer / couper l'auto-roll" },
  ...PAGES.map((p, i) => ({ id: `nav${i + 1}` as KeyAction, label: `Aller à : ${p.label}` })),
];

export interface Settings {
  soundEnabled: boolean;
  volume: number;
  reducedMotion: boolean;
  /** Supprime flashs blancs, éclairs plein écran et clignotements (photosensibilité). */
  noFlashes: boolean;
  /** Révélation éclair pour les auras Common et Uncommon. */
  skipCommonReveal: boolean;
  /** KeyboardEvent.code par action. */
  keybinds: Record<KeyAction, string>;
}

export function defaultSettings(): Settings {
  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return {
    soundEnabled: true,
    volume: 0.5,
    reducedMotion: Boolean(prefersReduced),
    noFlashes: Boolean(prefersReduced),
    skipCommonReveal: false,
    keybinds: {
      roll: "Space",
      auto: "KeyA",
      nav1: "Digit1",
      nav2: "Digit2",
      nav3: "Digit3",
      nav4: "Digit4",
      nav5: "Digit5",
      nav6: "Digit6",
      nav7: "Digit7",
    },
  };
}

/** Fusionne des réglages partiels (locaux ou distants) avec les valeurs par défaut. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const bool = (k: keyof Settings) => (typeof r[k] === "boolean" ? (r[k] as boolean) : (d[k] as boolean));
  const keybinds = { ...d.keybinds };
  const kb = (r.keybinds ?? {}) as Record<string, unknown>;
  for (const a of KEY_ACTIONS) {
    const v = kb[a.id];
    if (typeof v === "string" && v.length <= 24) keybinds[a.id] = v; // "" = aucun raccourci
  }
  return {
    soundEnabled: bool("soundEnabled"),
    volume: typeof r.volume === "number" && r.volume >= 0 && r.volume <= 1 ? r.volume : d.volume,
    reducedMotion: bool("reducedMotion"),
    noFlashes: bool("noFlashes"),
    skipCommonReveal: bool("skipCommonReveal"),
    keybinds,
  };
}

/** Libellé lisible d'un KeyboardEvent.code. */
export function keyLabel(code: string): string {
  if (code === "Space") return "Espace";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Pavé " + code.slice(6);
  if (code.startsWith("Arrow")) return { Up: "↑", Down: "↓", Left: "←", Right: "→" }[code.slice(5)] ?? code;
  return code;
}
