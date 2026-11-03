const nf = new Intl.NumberFormat("fr-FR");
const df = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

export const formatNumber = (n: number) => nf.format(n);

export function formatOddsN(odds: number): string {
  return `1 sur ${nf.format(Math.round(odds))}`;
}

export function formatDate(ts: number): string {
  return ts > 0 ? df.format(ts) : "—";
}

/** 3725000 → « 1 h 02 min » ; 42000 → « 42 s ». */
export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  return `${s} s`;
}

/** Compte à rebours court : « 4:59 ». */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Temps restant d'une potion : « 4:59 », « 2 h 15 min », « 3 j 04 h » (jamais de symbole ∞ :
 * les durées cumulées sont toujours affichées en clair).
 */
export function formatPotionTime(ms: number): string {
  if (ms >= 86_400_000) {
    const h = Math.floor(ms / 3_600_000);
    return `${Math.floor(h / 24)} j ${String(h % 24).padStart(2, "0")} h`;
  }
  if (ms >= 3_600_000) {
    const m = Math.floor(ms / 60_000);
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
  }
  return formatCountdown(ms);
}

/** Version longue, pour l'infobulle et les lecteurs d'écran (« 1 j 3 h 20 min »). */
export function formatPotionTimeLong(ms: number): string {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const parts = [d ? `${d} j` : "", h ? `${h} h` : "", `${m % 60} min`].filter(Boolean);
  return parts.join(" ");
}

export function formatLuck(l: number): string {
  return `×${l.toLocaleString("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: l % 1 ? 2 : 0 })}`;
}

const dayf = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });
export function formatDay(ts: number): string {
  return ts > 0 ? dayf.format(ts) : "—";
}
