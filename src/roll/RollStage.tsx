import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getAura, getCosmetic, getRarity, probabilityOf, rollableAuras, type Aura } from "../../shared";
import { sound } from "../audio/sound";
import { Avatar } from "../components/Avatar";
import { RarityBadge } from "../components/RarityBadge";
import { FxEngine } from "../effects/fx";
import { useGame } from "../game/GameContext";
import { formatLuck, formatOddsN } from "../lib/format";
import { useSettings } from "../settings/SettingsContext";
import { vfxDensity } from "../settings/settings";
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

const GLYPHS = "▓▒░█▚▞#%&?¿§∆Ω∞⌘※";

/**
 * Nom illisible (Beyond) : les lettres se mélangent et changent de signe,
 * puis se fixent une à une. Sans animation, le nom s'affiche directement.
 */
export function ScrambleName({ text, durationMs }: { text: string; durationMs: number }) {
  const { settings } = useSettings();
  const chars = [...text];
  const [shown, setShown] = useState(() => (settings.reducedMotion ? text : chars.map(() => " ").join("")));
  useEffect(() => {
    if (settings.reducedMotion) {
      setShown(text);
      return;
    }
    const start = performance.now();
    const settle = durationMs * 0.6;
    const id = setInterval(() => {
      const t = performance.now() - start;
      const fixed = Math.floor((t / settle) * chars.length);
      if (fixed >= chars.length) {
        setShown(text);
        clearInterval(id);
        return;
      }
      setShown(
        chars
          .map((c, i) => (i < fixed || c === " " ? c : i % 3 === Math.floor(t / 90) % 3 ? chars[(i * 7 + Math.floor(t / 60)) % chars.length] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join(""),
      );
    }, 60);
    return () => clearInterval(id);
  }, [text, durationMs, settings.reducedMotion]);
  return (
    <span className="scramble-name" aria-label={text}>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}

function useRoulette(active: boolean, discovered: Record<string, unknown>, now: number) {
  const pool = rollableAuras(now);
  const [aura, setAura] = useState<Aura>(pool[0]);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setAura(pool[Math.floor(Math.random() * pool.length)]);
      sound.tick();
    }, 75);
    return () => clearInterval(id);
  }, [active, pool]);
  return { aura, known: Boolean(discovered[aura.id]) };
}

export function RollStage() {
  const { state, reveal, lastResult, skipReveal, look, now, shardBurst } = useGame();
  const { settings } = useSettings();
  const fxCanvas = useRef<HTMLCanvasElement>(null);
  const fx = useRef<FxEngine | null>(null);

  const equippedBase = state.equipped ? getAura(state.equipped) : undefined;
  const equipped = equippedBase ? look(equippedBase) : null;
  const extras = state.slots.map((id) => (id ? getAura(id) : undefined)).filter((a): a is Aura => Boolean(a)).map(look);
  const phase = reveal?.phase;
  const shown = phase === "burst" && reveal?.aura ? reveal.aura : phase ? null : equipped;
  const tier = reveal?.aura ? getRarity(reveal.aura.rarity).tier : -1;
  const roulette = useRoulette(phase === "charge", state.codex, now());

  useEffect(() => {
    const canvas = fxCanvas.current!;
    fx.current = new FxEngine(canvas, { reduced: settings.reducedMotion, noFlashes: settings.noFlashes, density: vfxDensity(settings) });
    const ro = new ResizeObserver(() => fx.current?.resize());
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      fx.current?.destroy();
    };
  }, [settings.reducedMotion, settings.noFlashes, settings.vfxQuality]);

  // Séquence de découverte dans la scène, sobre pour les communes, plus riche pour Rare et Epic
  // (les raretés supérieures passent en plein écran).
  useEffect(() => {
    if (phase !== "burst" || !reveal?.aura || tier >= FULLSCREEN_TIER) return;
    const { primary, secondary } = reveal.aura.visual;
    if (tier < 2) {
      fx.current?.burst([primary, secondary], 8 + tier * 8, 0.35);
      return;
    }
    fx.current?.shockwave(primary, 0, 0.7);
    fx.current?.burst([primary, secondary, "#ffffff"], 30 + tier * 25, 0.6);
    if (reveal.aura.reveal.includes("lightning")) fx.current?.lightning(primary, 4, 600);
  }, [reveal?.key, phase, tier, reveal?.aura]);

  // Confettis d'éclats quand le roll en rapporte (plus nombreux pour les gros gains).
  useEffect(() => {
    if (!shardBurst || shardBurst.amount <= 0) return;
    fx.current?.confetti(Math.min(60, 6 + Math.round(Math.log2(1 + shardBurst.amount) * 4)));
  }, [shardBurst?.key]);

  const showFlash = phase === "burst" && reveal?.aura?.reveal.includes("flash") && tier < FULLSCREEN_TIER;
  const lastBase = lastResult ? getAura(lastResult.auraId) : undefined;
  const lastAura = lastBase ? look(lastBase) : undefined;
  const frame = state.cosmetics.frame ? getCosmetic(state.cosmetics.frame) : null;
  const haloColor = shown ? getRarity(shown.rarity).color : "#9b6bff";
  const style = {
    "--rc": reveal?.aura ? getRarity(reveal.aura.rarity).color : "#9b6bff",
    "--halo": haloColor,
    ...(frame ? { "--f1": frame.colors[0], "--f2": frame.colors[1] ?? frame.colors[0] } : {}),
  } as CSSProperties;

  return (
    <div
      className={`stage panel phase-${phase ?? "idle"} tier-${tier} ${frame ? `has-frame frame-${frame.id}` : ""}`}
      style={style}
      onClick={phase === "burst" || phase === "omen" ? skipReveal : undefined}
    >
      <div className="stage__rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      {shown && <div className="stage__halo" aria-hidden="true" />}
      <div className="stage__avatar">
        {/* La clé relance l'effet d'entrée (fondu + éclat) à chaque changement d'aura. */}
        <div key={shown?.id ?? "none"} className="avatar-enter">
          <Avatar aura={shown} dimmed={phase === "charge" || phase === "omen"} extras={phase ? [] : extras} />
        </div>
      </div>

      <canvas ref={fxCanvas} className="stage__fx" aria-hidden="true" />
      {showFlash && <div key={reveal!.key} className={`stage__flash ${settings.noFlashes ? "is-soft" : ""}`} />}

      {phase === "omen" && tier < FULLSCREEN_TIER && (
        <div key={reveal!.key} className="stage__omen keep-motion" style={{ animationDuration: `${reveal!.durationMs}ms` }}>
          <span className="stage__star" />
        </div>
      )}

      <div className="stage__caption">
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
              {reveal.result.xp > 0 && <span className="tag tag--xp">+{reveal.result.xp} XP</span>}
              {reveal.result.shards > 0 && <span className="tag tag--shards">+{reveal.result.shards} ✦</span>}
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
                  {Math.round(
                    1 /
                      Math.max(
                        1e-12,
                        probabilityOf(reveal.aura.id, reveal.result.luck, {
                          now: now(),
                          focus: reveal.result.focus ? { rarity: reveal.result.focus, mul: 3 } : null,
                        }),
                      ),
                  ).toLocaleString("fr-FR")}
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
