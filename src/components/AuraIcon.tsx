import type { CSSProperties } from "react";
import { getRarity, type Aura } from "../../shared";
import { Sigil } from "./Sigil";
import "./AuraIcon.css";

interface Props {
  aura: Aura;
  size?: number;
  /** Silhouette mystérieuse pour une aura non découverte. */
  locked?: boolean;
  animated?: boolean;
}

/** Représentation compacte d'une aura : orbe en dégradé + sigil, lueur selon la rareté. */
export function AuraIcon({ aura, size = 56, locked = false, animated = true }: Props) {
  const tier = getRarity(aura.rarity).tier;
  const style = {
    "--c1": aura.visual.primary,
    "--c2": aura.visual.secondary,
    "--size": `${size}px`,
  } as CSSProperties;
  return (
    <div
      className={`aura-icon tier-${tier} ${locked ? "is-locked" : ""} ${animated ? "is-animated" : ""} ${
        aura.visual.hueShift && !locked ? "is-prismatic" : ""
      }`}
      style={style}
      aria-hidden="true"
    >
      <div className="aura-icon__glow" />
      <div className="aura-icon__orb">
        {locked ? <span className="aura-icon__q">?</span> : <Sigil id={aura.visual.sigil} size={size * 0.46} />}
      </div>
    </div>
  );
}
