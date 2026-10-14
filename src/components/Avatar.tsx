import { useId, type CSSProperties } from "react";
import { getRarity, type Aura } from "../../shared";
import { AuraCanvas } from "../effects/AuraCanvas";
import { Sigil } from "./Sigil";
import "./Avatar.css";

interface Props {
  aura: Aura | null;
  /** Atténue le personnage (pendant le tirage). */
  dimmed?: boolean;
}

const NEUTRAL = { primary: "#8a93c9", secondary: "#2a2f5a" };

/**
 * Personnage stylisé entouré de son aura : les couches « back » sont dessinées
 * derrière lui, les particules et éclairs devant. L'aura recolore aussi
 * le personnage (liseré, yeux, emblème) et ajoute couronne/halo aux paliers élevés.
 */
export function Avatar({ aura, dimmed = false }: Props) {
  const colors = aura?.visual ?? NEUTRAL;
  const tier = aura ? getRarity(aura.rarity).tier : -1;
  const id = useId().replace(/:/g, "");
  const style = { "--c1": colors.primary, "--c2": colors.secondary } as CSSProperties;

  return (
    <div className={`avatar tier-${tier} ${dimmed ? "is-dimmed" : ""}`} style={style}>
      {aura && <AuraCanvas key={`b-${aura.id}`} aura={aura} part="back" radius={0.3} centerY={0.5} />}
      <svg className="avatar__figure keep-motion" viewBox="0 0 200 260" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}cloak`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a1f45" />
            <stop offset="1" stopColor="#07081a" />
          </linearGradient>
          <radialGradient id={`${id}eye`}>
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.35" stopColor={colors.primary} />
            <stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}rim`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={colors.primary} />
            <stop offset="1" stopColor={colors.secondary} />
          </linearGradient>
        </defs>

        <ellipse cx="100" cy="246" rx="52" ry="8" fill={colors.primary} opacity="0.18" />

        {tier >= 6 && (
          <ellipse className="avatar__halo" cx="100" cy="30" rx="30" ry="7" fill="none" stroke={colors.primary} strokeWidth="3" />
        )}

        <g className="avatar__body">
          {/* cape */}
          <path
            d="M100 70c-30 0-48 26-54 60l-14 104c22 10 46 14 68 14s46-4 68-14l-14-104c-6-34-24-60-54-60z"
            fill={`url(#${id}cloak)`}
            stroke={`url(#${id}rim)`}
            strokeWidth="2.5"
          />
          {/* plis */}
          <path d="M78 120l-10 110M122 120l10 110M100 130v112" stroke={colors.secondary} strokeOpacity="0.35" strokeWidth="1.5" />
          {/* capuche */}
          <path
            d="M100 26c-26 0-42 20-42 46c0 16 6 28 14 36h56c8-8 14-20 14-36c0-26-16-46-42-46z"
            fill={`url(#${id}cloak)`}
            stroke={`url(#${id}rim)`}
            strokeWidth="2.5"
          />
          {/* visage dans l'ombre */}
          <path d="M100 48c-16 0-26 13-26 28c0 12 6 22 12 26h28c6-4 12-14 12-26c0-15-10-28-26-28z" fill="#02030a" />
          {/* yeux */}
          <g className="avatar__eyes">
            <circle cx="90" cy="80" r="9" fill={`url(#${id}eye)`} />
            <circle cx="110" cy="80" r="9" fill={`url(#${id}eye)`} />
            <ellipse cx="90" cy="80" rx="3.2" ry="2.2" fill="#fff" />
            <ellipse cx="110" cy="80" rx="3.2" ry="2.2" fill="#fff" />
          </g>
          {/* emblème */}
          <circle cx="100" cy="150" r="17" fill="#05061a" stroke={`url(#${id}rim)`} strokeWidth="2" />
          {aura && (
            <g style={{ color: colors.primary }} className="avatar__emblem">
              <svg x="86" y="136" width="28" height="28">
                <Sigil id={aura.visual.sigil} size={28} />
              </svg>
            </g>
          )}
          {tier >= 4 && (
            <path
              className="avatar__crown"
              d="M80 30l6-14l8 10l6-14l6 14l8-10l6 14"
              fill="none"
              stroke={colors.primary}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          )}
        </g>
      </svg>
      {aura && <AuraCanvas key={`f-${aura.id}`} aura={aura} part="front" radius={0.3} centerY={0.5} />}
    </div>
  );
}
