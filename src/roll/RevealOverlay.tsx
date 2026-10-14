import { useEffect, useRef, type CSSProperties } from "react";
import { getRarity } from "../../shared";
import { RarityBadge } from "../components/RarityBadge";
import { AuraCanvas } from "../effects/AuraCanvas";
import { FxEngine } from "../effects/fx";
import { useGame } from "../game/GameContext";
import { formatOddsN } from "../lib/format";
import { useSettings } from "../settings/SettingsContext";
import { FULLSCREEN_TIER, RevealName } from "./RollStage";
import "./RevealOverlay.css";

/**
 * Découverte plein écran des auras Legendary et au-delà.
 * Chaque effet listé dans `aura.reveal` est joué ; distorsion et secousses
 * sont coupées en mode animations réduites, les flashs en mode sans flash.
 */
export function RevealOverlay() {
  const { reveal, skipReveal } = useGame();
  const { settings } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fx = useRef<FxEngine | null>(null);

  const aura = reveal?.aura;
  const tier = aura ? getRarity(aura.rarity).tier : -1;
  const active = Boolean(reveal && aura && tier >= FULLSCREEN_TIER && reveal.phase !== "charge");
  const has = (f: string) => Boolean(aura?.reveal.includes(f as never));

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current!;
    fx.current = new FxEngine(canvas, { reduced: settings.reducedMotion, noFlashes: settings.noFlashes });
    const onResize = () => fx.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      fx.current?.destroy();
      fx.current = null;
    };
  }, [active, settings.reducedMotion, settings.noFlashes]);

  useEffect(() => {
    const engine = fx.current;
    if (!active || !engine || !aura || !reveal) return;
    const { primary, secondary } = aura.visual;
    if (reveal.phase === "omen") {
      engine.converge(primary, reveal.durationMs);
      if (has("collapse")) engine.warp(primary, reveal.durationMs, true);
      return;
    }
    engine.clear();
    const strength = 0.8 + (tier - FULLSCREEN_TIER) * 0.15;
    if (has("shockwave") || has("collapse")) {
      engine.shockwave(primary, 0, strength);
      engine.shockwave(secondary, 0.18, strength);
      if (tier >= 6) engine.shockwave("#ffffff", 0.36, strength);
    }
    engine.burst([primary, secondary, "#ffffff"], 90 + tier * 30, 1 + (tier - 4) * 0.15);
    if (has("lightning")) engine.lightning(primary, 6 + tier * 2, Math.min(2500, reveal.durationMs * 0.6));
    if (has("warp") && !settings.reducedMotion) engine.warp(primary, Math.min(3000, reveal.durationMs * 0.7));
  }, [active, reveal?.key, reveal?.phase]);

  if (!active || !reveal || !aura) return null;

  const motion = !settings.reducedMotion;
  const classes = [
    "reveal",
    `phase-${reveal.phase}`,
    `tier-${tier}`,
    motion && has("shake") ? "fx-shake" : "",
    motion && has("distortion") ? "fx-distort" : "",
    has("glitch") ? "fx-glitch" : "",
    has("prismatic") && !settings.noFlashes ? "fx-prismatic" : "",
  ].join(" ");
  const style = {
    "--c1": aura.visual.primary,
    "--c2": aura.visual.secondary,
    "--rc": getRarity(aura.rarity).color,
    "--dur": `${reveal.durationMs}ms`,
  } as CSSProperties;

  return (
    <div className={classes} style={style} onClick={skipReveal} role="dialog" aria-label={`Découverte : ${aura.name}`}>
      <svg width="0" height="0" className="sr-only" aria-hidden="true">
        <filter id="reveal-distort">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="3">
            <animate attributeName="baseFrequency" dur="1.6s" values="0.012 0.03;0.02 0.06;0.012 0.03" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="28" />
        </filter>
      </svg>

      <div className="reveal__backdrop" />
      {reveal.phase === "omen" && (
        <div className="reveal__omen keep-motion">
          <span className="reveal__star" />
          <p className="reveal__whisper">{tier >= 7 ? "La réalité vacille…" : tier >= 6 ? "Le ciel se fend…" : "Quelque chose approche…"}</p>
        </div>
      )}

      {reveal.phase === "burst" && (
        <div className="reveal__content keep-motion" key={reveal.key}>
          <div className="reveal__aura">
            <AuraCanvas aura={aura} radius={0.2} density={1.3} />
          </div>
          <div className="reveal__text">
            <RarityBadge rarity={aura.rarity} />
            <h1 className="reveal__name" data-text={aura.name}>
              <RevealName text={aura.name} durationMs={reveal.durationMs} />
            </h1>
            <p className="reveal__desc">{aura.description}</p>
            <p className="reveal__odds tabular">
              {formatOddsN(aura.odds)}
              {reveal.result?.isNew && <span className="tag tag--new">Nouvelle !</span>}
            </p>
          </div>
          <p className="reveal__hint">Touche ou clique pour continuer</p>
        </div>
      )}

      {reveal.phase === "burst" && has("flash") && (
        <div className={`reveal__flash ${settings.noFlashes ? "is-soft" : ""}`} key={`f${reveal.key}`} />
      )}
      <canvas ref={canvasRef} className="reveal__fx" aria-hidden="true" />
    </div>
  );
}
