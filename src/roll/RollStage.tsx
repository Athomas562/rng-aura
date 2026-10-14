import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AURAS, getAura, getRarity, probabilityOf, type Aura } from "../../shared";
import { sound } from "../audio/sound";
import { Avatar } from "../components/Avatar";
import { RarityBadge } from "../components/RarityBadge";
import { FxEngine } from "../effects/fx";
import { useGame } from "../game/GameContext";
import { formatLuck, formatOddsN } from "../lib/format";
import { useSettings } from "../settings/SettingsContext";
import "./RollStage.css";

/** Au-delà de ce palier, la découverte passe en plein écran (RevealOverlay). */
export const FULLSCREEN_TIER = 4;

/** Nom qui s'écrit lettre par lettre. */
export function RevealName({ text, durationMs }: { text: string; durationMs: number }) {
  const chars = [...text];
  const stagger = Math.min(90, (durationMs * 0.35) / Math.max(1, chars.length));
  return (
    <span className="reveal-name" aria-label={text}>
      {chars.map((c, i) => (
        <span key={i} style={{ animationDelay: `${i * stagger}ms` }} aria-hidden="true">
          {c === " " ? " " : c}
        </span>
      ))}
    </span>
  );
}

function useRoulette(active: boolean, discovered: Record<string, unknown>) {
  const [aura, setAura] = useState<Aura>(AURAS[0]);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setAura(AURAS[Math.floor(Math.random() * AURAS.length)]);
      sound.tick();
    }, 75);
    return () => clearInterval(id);
  }, [active]);
  return { aura, known: Boolean(discovered[aura.id]) };
}

export function RollStage() {
  const { state, reveal, lastResult, skipReveal } = useGame();
  const { settings } = useSettings();
  const fxCanvas = useRef<HTMLCanvasElement>(null);
  const fx = useRef<FxEngine | null>(null);

  const equipped = state.equipped ? getAura(state.equipped) ?? null : null;
  const phase = reveal?.phase;
  const shown = phase === "burst" && reveal?.aura ? reveal.aura : phase ? null : equipped;
  const tier = reveal?.aura ? getRarity(reveal.aura.rarity).tier : -1;
  const roulette = useRoulette(phase === "charge", state.inventory);

  useEffect(() => {
    const canvas = fxCanvas.current!;
    fx.current = new FxEngine(canvas, { reduced: settings.reducedMotion, noFlashes: settings.noFlashes });
    const ro = new ResizeObserver(() => fx.current?.resize());
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      fx.current?.destroy();
    };
  }, [settings.reducedMotion, settings.noFlashes]);

  // Effets de découverte dans la scène pour Rare et Epic (les paliers supérieurs passent en plein écran).
  useEffect(() => {
    if (phase !== "burst" || !reveal?.aura || tier < 2 || tier >= FULLSCREEN_TIER) return;
    const { primary, secondary } = reveal.aura.visual;
    fx.current?.shockwave(primary, 0, 0.7);
    fx.current?.burst([primary, secondary, "#ffffff"], 30 + tier * 25, 0.6);
    if (reveal.aura.reveal.includes("lightning")) fx.current?.lightning(primary, 4, 600);
  }, [reveal?.key, phase, tier, reveal?.aura]);

  const showFlash = phase === "burst" && reveal?.aura?.reveal.includes("flash") && tier < FULLSCREEN_TIER;
  const lastAura = lastResult ? getAura(lastResult.auraId) : undefined;
  const style = { "--rc": reveal?.aura ? getRarity(reveal.aura.rarity).color : "#9b6bff" } as CSSProperties;

  return (
    <div
      className={`stage panel phase-${phase ?? "idle"} tier-${tier}`}
      style={style}
      onClick={phase === "burst" || phase === "omen" ? skipReveal : undefined}
    >
      <div className="stage__rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="stage__avatar">
        <Avatar aura={shown} dimmed={phase === "charge" || phase === "omen"} />
      </div>

      <canvas ref={fxCanvas} className="stage__fx" aria-hidden="true" />
      {showFlash && <div key={reveal!.key} className={`stage__flash ${settings.noFlashes ? "is-soft" : ""}`} />}

      {phase === "omen" && tier < FULLSCREEN_TIER && (
        <div key={reveal!.key} className="stage__omen keep-motion" style={{ animationDuration: `${reveal!.durationMs}ms` }}>
          <span className="stage__star" />
        </div>
      )}

      <div className="stage__caption" aria-live="polite">
        {phase === "charge" && (
          <div className="stage__roulette">
            <span
              className="stage__roulette-name"
              style={{ color: roulette.known ? roulette.aura.visual.primary : getRarity(roulette.aura.rarity).color }}
            >
              {roulette.known ? roulette.aura.name : "???"}
            </span>
          </div>
        )}
        {phase === "omen" && tier < FULLSCREEN_TIER && <div className="stage__omen-text">Quelque chose approche…</div>}
        {phase === "burst" && reveal?.aura && reveal.result && (
          <div key={reveal.key} className="stage__result">
            <div className="stage__tags">
              <RarityBadge rarity={reveal.aura.rarity} />
              {reveal.result.isNew && <span className="tag tag--new">Nouvelle !</span>}
              {reveal.result.blessed && <span className="tag tag--blessed">Roll béni</span>}
            </div>
            <h2 className="stage__name" style={{ color: reveal.aura.visual.primary }}>
              <RevealName text={reveal.aura.name} durationMs={reveal.durationMs} />
            </h2>
            <p className="stage__odds tabular">
              {formatOddsN(reveal.aura.odds)}
              {reveal.result.luck !== 1 && (
                <span>
                  {" "}
                  · chance {formatLuck(reveal.result.luck)} → 1 sur{" "}
                  {Math.round(1 / probabilityOf(reveal.aura.id, reveal.result.luck)).toLocaleString("fr-FR")}
                </span>
              )}
            </p>
          </div>
        )}
        {!phase && (
          <div className="stage__idle">
            {equipped ? (
              <>
                <span className="stage__idle-label">Aura équipée</span>
                <span className="stage__idle-name" style={{ color: equipped.visual.primary }}>
                  {equipped.name}
                </span>
                <RarityBadge rarity={equipped.rarity} />
              </>
            ) : (
              <span className="stage__idle-label">Lance ton premier roll pour éveiller une aura</span>
            )}
            {lastAura && lastAura.id !== equipped?.id && (
              <span className="stage__last">
                Dernier roll : <strong style={{ color: lastAura.visual.primary }}>{lastAura.name}</strong>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
