export const PAGES = [
  { id: "roll", label: "Roll" },
  { id: "inventory", label: "Inventaire" },
  { id: "collection", label: "Collection" },
  { id: "achievements", label: "Succès" },
  { id: "stats", label: "Statistiques" },
  { id: "leaderboard", label: "Classement" },
  { id: "settings", label: "Paramètres" },
] as const;

/**
 * Pages ajoutées par l'extension. Leurs raccourcis (8 et 9) sont fixes : les règles
 * Firebase des paramètres synchronisés n'acceptent que roll, auto et nav1 à nav7.
 */
export const EXTRA_PAGES = [
  { id: "progression", label: "Progression", key: "Digit8" },
  { id: "quests", label: "Quêtes", key: "Digit9" },
  { id: "shop", label: "Boutique", key: "Digit0" },
] as const;

export type PageId = (typeof PAGES)[number]["id"] | (typeof EXTRA_PAGES)[number]["id"];

/** Ordre des pages (raccourcis, hash). */
export const NAV_ORDER: PageId[] = [
  "roll",
  "inventory",
  "collection",
  "shop",
  "progression",
  "quests",
  "achievements",
  "stats",
  "leaderboard",
  "settings",
];

export type NavGroupId = "play" | "shop" | "progress" | "leaderboard" | "settings";

/** Navigation regroupée : 5 entrées, chacune avec ses sous-pages. */
export const NAV_GROUPS: { id: NavGroupId; label: string; icon: PageId; pages: PageId[] }[] = [
  { id: "play", label: "Jouer", icon: "roll", pages: ["roll", "inventory", "collection"] },
  { id: "shop", label: "Boutique", icon: "shop", pages: ["shop"] },
  { id: "progress", label: "Progression", icon: "progression", pages: ["progression", "quests", "achievements", "stats"] },
  { id: "leaderboard", label: "Classement", icon: "leaderboard", pages: ["leaderboard"] },
  { id: "settings", label: "Paramètres", icon: "settings", pages: ["settings"] },
];

export function groupOf(page: PageId) {
  return NAV_GROUPS.find((g) => g.pages.includes(page)) ?? NAV_GROUPS[0];
}

export const PAGE_LABELS: Record<PageId, string> = Object.fromEntries(
  [...PAGES, ...EXTRA_PAGES].map((p) => [p.id, p.label]),
) as Record<PageId, string>;

/** Raccourci d'une page : configurable pour les 7 pages d'origine, fixe pour les nouvelles. */
export function pageShortcut(page: PageId, keybinds: Record<KeyAction, string>): string {
  const i = PAGES.findIndex((p) => p.id === page);
  if (i >= 0) return keybinds[`nav${i + 1}` as KeyAction];
  return EXTRA_PAGES.find((p) => p.id === page)?.key ?? "";
}

export type KeyAction = "roll" | "auto" | "nav1" | "nav2" | "nav3" | "nav4" | "nav5" | "nav6" | "nav7";

export const KEY_ACTIONS: { id: KeyAction; label: string }[] = [
  { id: "roll", label: "Lancer un roll" },
  { id: "auto", label: "Activer / couper l'auto-roll" },
  ...PAGES.map((p, i) => ({ id: `nav${i + 1}` as KeyAction, label: `Aller à : ${p.label}` })),
];

export type VfxQuality = "low" | "normal" | "high";

/**
 * Réglages synchronisés avec le compte (Firebase `v2/settings/{uid}`) : uniquement ces six clés,
 * les seules acceptées par les règles publiées. Les autres réglages restent sur l'appareil.
 */
export const SYNCED_KEYS = ["soundEnabled", "volume", "reducedMotion", "noFlashes", "skipCommonReveal", "keybinds"] as const;

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
  // ── Réglages locaux (non synchronisés) ──
  /** Densité des effets visuels. */
  vfxQuality: VfxQuality;
  /** Mode calme : fond statique, pas de transitions ni de traînée. */
  calmMode: boolean;
  /** Traînée de particules du curseur (cosmétique acheté). */
  cursorTrail: boolean;
  /** Échelle du texte et de l'interface (0,9 à 1,3). */
  uiScale: number;
}

/** Ne garde que les clés synchronisables (envoyées à Firebase). */
export function syncedPart(s: Settings): Pick<Settings, (typeof SYNCED_KEYS)[number]> {
  return {
    soundEnabled: s.soundEnabled,
    volume: s.volume,
    reducedMotion: s.reducedMotion,
    noFlashes: s.noFlashes,
    skipCommonReveal: s.skipCommonReveal,
    keybinds: s.keybinds,
  };
}

/** Animations décoratives autorisées (fond, transitions, traînée) : ni réduites ni en mode calme. */
export const decorativeMotion = (s: Settings) => !s.reducedMotion && !s.calmMode;

/** Multiplicateur de densité des particules. */
export function vfxDensity(s: Settings): number {
  const q = s.vfxQuality === "low" ? 0.45 : s.vfxQuality === "high" ? 1.35 : 1;
  return s.reducedMotion ? Math.min(q, 0.5) : q;
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
    vfxQuality: "normal",
    calmMode: Boolean(prefersReduced),
    cursorTrail: true,
    uiScale: 1,
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
    vfxQuality: r.vfxQuality === "low" || r.vfxQuality === "high" || r.vfxQuality === "normal" ? r.vfxQuality : d.vfxQuality,
    calmMode: bool("calmMode"),
    cursorTrail: bool("cursorTrail"),
    uiScale: typeof r.uiScale === "number" && r.uiScale >= 0.9 && r.uiScale <= 1.3 ? r.uiScale : d.uiScale,
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
