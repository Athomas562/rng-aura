import type { CSSProperties } from "react";
import {
  AURAS,
  BLESSED_EVERY,
  POTIONS,
  POTION_IDS,
  getAura,
  getRollCooldownMs,
  previewNextLuck,
  type PotionId,
} from "../../shared";
import { AuraIcon } from "../components/AuraIcon";
import { Icon } from "../components/Icon";
import { RarityBadge } from "../components/RarityBadge";
import { useGame, useTick } from "../game/GameContext";
import { formatCountdown, formatDuration, formatLuck, formatNumber, formatOddsN } from "../lib/format";
import { keyLabel } from "../settings/settings";
import { useSettings } from "../settings/SettingsContext";

export function StatsPanel() {
  const { state } = useGame();
  const best = state.stats.bestAuraId ? getAura(state.stats.bestAuraId) : undefined;
  const discovered = Object.keys(state.inventory).length;
  const pct = Math.round((discovered / AURAS.length) * 100);

  return (
    <section className="panel side-panel" aria-label="Statistiques essentielles">
      <h2 className="panel-title">
        <Icon name="stats" size={14} /> Progression
      </h2>
      <dl className="kv">
        <div>
          <dt>Rolls</dt>
          <dd className="tabular">{formatNumber(state.stats.rolls)}</dd>
        </div>
        <div>
          <dt>Série</dt>
          <dd className="tabular">
            {state.stats.streak} <small>max {state.stats.maxStreak}</small>
          </dd>
        </div>
        <div>
          <dt>Temps de jeu</dt>
          <dd className="tabular">{formatDuration(state.stats.playTimeMs)}</dd>
        </div>
        <div>
          <dt>Succès</dt>
          <dd className="tabular">{Object.keys(state.achievements).length}</dd>
        </div>
      </dl>

      <div className="collection-meter">
        <div className="collection-meter__head">
          <span>Collection</span>
          <span className="tabular">
            {discovered} / {AURAS.length} · {pct}%
          </span>
        </div>
        <div className="progress">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="best-aura">
        <span className="best-aura__label">Aura la plus rare</span>
        {best ? (
          <div className="best-aura__row">
            <AuraIcon aura={best} size={44} />
            <div>
              <strong style={{ color: best.visual.primary }}>{best.name}</strong>
              <div className="best-aura__meta">
                <RarityBadge rarity={best.rarity} /> <span className="tabular">{formatOddsN(best.odds)}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="muted">Aucune pour l'instant</p>
        )}
      </div>
    </section>
  );
}

export function LuckPanel() {
  const { state, now } = useGame();
  useTick(1000);
  const luck = previewNextLuck(state, now());
  const untilBlessed = BLESSED_EVERY - (state.stats.rolls % BLESSED_EVERY);

  return (
    <section className="panel side-panel" aria-label="Chance">
      <h2 className="panel-title">
        <Icon name="clover" size={14} /> Chance du prochain roll
      </h2>
      <div className={`luck-value tabular ${luck.total > 1 ? "is-boosted" : ""}`}>{formatLuck(luck.total)}</div>
      <ul className="luck-parts">
        <li>
          <span>Base</span>
          <span className="tabular">×1</span>
        </li>
        {luck.parts.map((p) => (
          <li key={p.label} className={p.kind === "mul" ? "is-mul" : ""}>
            <span>{p.label}</span>
            <span className="tabular">{p.kind === "add" ? `+${Math.round(p.value * 100)} %` : `×${p.value}`}</span>
          </li>
        ))}
      </ul>
      <div className="blessed">
        <div className="blessed__head">
          <span>Roll béni (chance ×2)</span>
          <span className="tabular">{untilBlessed === 1 ? "prochain !" : `dans ${untilBlessed}`}</span>
        </div>
        <div className="blessed__pips" aria-hidden="true">
          {Array.from({ length: BLESSED_EVERY }, (_, i) => (
            <span key={i} className={i < state.stats.rolls % BLESSED_EVERY ? "is-on" : ""} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function PotionPanel() {
  const { state, now, drink } = useGame();
  useTick(1000);
  const t = now();

  return (
    <section className="panel side-panel" aria-label="Potions">
      <h2 className="panel-title">
        <Icon name="flask" size={14} /> Potions
      </h2>
      <ul className="potions">
        {POTION_IDS.map((id: PotionId) => {
          const p = POTIONS[id];
          const owned = state.potions.owned[id];
          const until = state.potions.active[id] ?? 0;
          const remaining = until - t;
          const active = remaining > 0;
          return (
            <li key={id} className={`potion ${active ? "is-active" : ""}`} style={{ "--pc": p.color } as CSSProperties}>
              <span className="potion__icon">
                <Icon name="flask" size={18} />
              </span>
              <div className="potion__body">
                <div className="potion__name">
                  {p.name} <span className="potion__count tabular">×{owned}</span>
                </div>
                <div className="potion__desc">{p.description}</div>
                {active && (
                  <div className="potion__timer tabular">
                    <span className="progress">
                      <span style={{ width: `${Math.min(100, (remaining / p.durationMs) * 100)}%` }} />
                    </span>
                    {formatCountdown(remaining)}
                  </div>
                )}
              </div>
              <button className="btn btn-sm" disabled={owned <= 0} onClick={() => void drink(id)}>
                Boire
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint">Gagne des potions tous les 100 rolls, en découvrant des auras Epic+ et via les succès.</p>
    </section>
  );
}

export function RollControls() {
  const { rolling, auto, roll, toggleAuto, state, now } = useGame();
  const { settings } = useSettings();
  const fast = getRollCooldownMs(state, now()) < 900;

  return (
    <div className="roll-controls">
      <button
        className={`roll-btn ${rolling ? "is-rolling" : ""} ${auto ? "is-auto" : ""}`}
        onClick={roll}
        disabled={rolling || auto}
        aria-keyshortcuts={settings.keybinds.roll}
      >
        <span className="roll-btn__ring" aria-hidden="true" />
        <span className="roll-btn__label">{auto ? "AUTO" : rolling ? "…" : "ROLL"}</span>
        <span className="roll-btn__key">{keyLabel(settings.keybinds.roll)}</span>
      </button>
      <div className="roll-controls__side">
        <button className={`btn btn-sm ${auto ? "is-active" : ""}`} onClick={toggleAuto} aria-pressed={auto}>
          <Icon name="repeat" size={16} /> Auto-roll {auto ? "ON" : "OFF"}
          <kbd>{keyLabel(settings.keybinds.auto)}</kbd>
        </button>
        {fast && (
          <span className="speed-chip">
            <Icon name="bolt" size={14} /> Célérité
          </span>
        )}
      </div>
    </div>
  );
}

export function RecentRolls() {
  const { state } = useGame();
  if (state.recent.length === 0) return null;
  return (
    <section className="recent" aria-label="Derniers rolls">
      <span className="recent__label">Derniers rolls</span>
      <ol className="recent__list">
        {state.recent.map((r, i) => {
          const aura = getAura(r.auraId)!;
          return (
            <li key={`${r.at}-${i}`} title={`${aura.name} — ${formatOddsN(aura.odds)}`}>
              <AuraIcon aura={aura} size={34} animated={false} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
