/**
 * Saisons et événements temporaires.
 *
 * Chaque événement revient tous les ans entre deux dates (UTC, bornes incluses,
 * la période peut chevaucher le 1er janvier). Pendant l'événement, ses auras
 * exclusives entrent dans la table de tirage et la chance reçoit un petit bonus.
 * C'est le serveur qui décide, avec sa propre horloge, si un événement est actif.
 */
export type EventId = "halloween" | "winter" | "spring" | "summer";

export interface GameEvent {
  id: EventId;
  name: string;
  description: string;
  color: string;
  /** [mois (1-12), jour] de début et de fin, inclus. */
  start: [number, number];
  end: [number, number];
  /** Bonus additif de chance pendant l'événement. */
  luckBonus: number;
}

export const EVENTS: readonly GameEvent[] = [
  {
    id: "halloween",
    name: "Nuit des Spectres",
    description: "Les citrouilles s'illuminent et les esprits rôdent. Aura exclusive : Citrouille spectrale.",
    color: "#ff8a1f",
    start: [10, 15],
    end: [11, 10],
    luckBonus: 0.1,
  },
  {
    id: "winter",
    name: "Solstice d'hiver",
    description: "Le givre recouvre le monde. Aura exclusive : Flocon royal.",
    color: "#bfe9ff",
    start: [12, 10],
    end: [1, 10],
    luckBonus: 0.1,
  },
  {
    id: "spring",
    name: "Éveil du printemps",
    description: "Tout refleurit. Aura exclusive : Floraison.",
    color: "#ff9ed8",
    start: [3, 20],
    end: [4, 20],
    luckBonus: 0.1,
  },
  {
    id: "summer",
    name: "Nuits d'été",
    description: "Le soleil ne se couche plus. Aura exclusive : Soleil de minuit.",
    color: "#ffd36b",
    start: [6, 20],
    end: [7, 31],
    luckBonus: 0.1,
  },
];

const BY_ID = new Map(EVENTS.map((e) => [e.id, e]));

export function getEvent(id: EventId): GameEvent {
  const e = BY_ID.get(id);
  if (!e) throw new Error(`Événement inconnu : ${id}`);
  return e;
}

/** Valeur comparable mois/jour (ex. 10/15 → 1015). */
const md = (m: number, d: number) => m * 100 + d;

export function isEventActive(e: GameEvent, now: number): boolean {
  const date = new Date(now);
  const today = md(date.getUTCMonth() + 1, date.getUTCDate());
  const start = md(...e.start);
  const end = md(...e.end);
  return start <= end ? today >= start && today <= end : today >= start || today <= end;
}

export function activeEvents(now: number): GameEvent[] {
  return EVENTS.filter((e) => isEventActive(e, now));
}

/** Fin (exclue, en ms UTC) de l'occurrence en cours d'un événement actif. */
export function eventEndsAt(e: GameEvent, now: number): number {
  const year = new Date(now).getUTCFullYear();
  const [m, d] = e.end;
  let end = Date.UTC(year, m - 1, d + 1);
  if (end <= now) end = Date.UTC(year + 1, m - 1, d + 1);
  return end;
}
