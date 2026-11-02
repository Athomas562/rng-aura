/**
 * Apparence dérivée des auras à mécanique spéciale (Écho, Vivante, Mimique).
 * Purement visuel : calculé à partir de l'état du joueur, jamais envoyé par le client.
 * Les objets renvoyés sont mis en cache pour rester identiques d'un rendu à l'autre
 * (les canvas d'effets ne sont ainsi pas recréés inutilement).
 */
import { getAura, type Aura } from "./auras";

export interface LookContext {
  /** Rolls totaux du joueur. */
  rolls: number;
  /** Numéro du roll de première obtention, par aura (auras vivantes). */
  inventory?: Record<string, { firstRoll: number }>;
  mimicOf?: string | null;
}

/** Index de la forme actuelle d'une aura Écho. */
export function echoFormIndex(aura: Aura, rolls: number): number {
  const sp = aura.special;
  if (sp?.kind !== "echo") return 0;
  return Math.floor(Math.max(0, rolls) / sp.every) % sp.forms.length;
}

/** Rolls restants avant le prochain changement de forme d'une aura Écho. */
export function echoRollsUntilChange(aura: Aura, rolls: number): number {
  const sp = aura.special;
  if (sp?.kind !== "echo") return 0;
  return sp.every - (Math.max(0, rolls) % sp.every);
}

/** Rolls lancés depuis l'obtention d'une aura vivante (0 si non possédée). */
export function livingRolls(aura: Aura, ctx: LookContext): number {
  const entry = ctx.inventory?.[aura.id];
  return entry ? Math.max(0, ctx.rolls - entry.firstRoll) : 0;
}

/** Index (0-based) du stade actuel d'une aura vivante. */
export function livingStageIndex(aura: Aura, ctx: LookContext): number {
  const sp = aura.special;
  if (sp?.kind !== "living") return 0;
  const grown = livingRolls(aura, ctx);
  let stage = 0;
  sp.stages.forEach((s, i) => {
    if (grown >= s.at) stage = i;
  });
  return stage;
}

const cache = new Map<string, Aura>();

function cached(key: string, build: () => Aura): Aura {
  let v = cache.get(key);
  if (!v) {
    v = build();
    cache.set(key, v);
  }
  return v;
}

/** Aura telle qu'elle apparaît pour ce joueur (nom, description et visuel éventuellement remplacés). */
export function lookOf(aura: Aura, ctx?: LookContext): Aura {
  const sp = aura.special;
  if (!sp || !ctx) return aura;
  switch (sp.kind) {
    case "echo": {
      const i = echoFormIndex(aura, ctx.rolls);
      const form = sp.forms[i];
      return cached(`${aura.id}|echo|${i}`, () => ({ ...aura, name: form.name, description: form.description ?? aura.description, visual: form.visual }));
    }
    case "living": {
      const i = livingStageIndex(aura, ctx);
      const stage = sp.stages[i];
      return cached(`${aura.id}|living|${i}`, () => ({
        ...aura,
        name: stage.name,
        description: stage.description ?? aura.description,
        visual: stage.visual,
      }));
    }
    case "mimic": {
      const target = ctx.mimicOf ? getAura(ctx.mimicOf) : undefined;
      if (!target || target.special?.kind === "mimic") return aura;
      // La copie d'une aura spéciale reprend son apparence actuelle.
      const copied = lookOf(target, ctx);
      return cached(`${aura.id}|mimic|${copied.id}|${copied.name}`, () => ({
        ...aura,
        name: `Mimique · ${copied.name}`,
        description: `Copie parfaite de ${copied.name}. ${aura.description}`,
        visual: { ...copied.visual, hueShift: copied.visual.hueShift },
      }));
    }
    default:
      return aura;
  }
}
