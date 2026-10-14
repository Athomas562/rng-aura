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

export function formatLuck(l: number): string {
  return `×${l.toLocaleString("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: l % 1 ? 2 : 0 })}`;
}

const dayf = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });
export function formatDay(ts: number): string {
  return ts > 0 ? dayf.format(ts) : "—";
}
