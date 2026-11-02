import type { CSSProperties } from "react";
import { CURRENCY, POTIONS, TIMED_POTION_IDS } from "../../shared";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { Icon } from "../components/Icon";
import { useGame, useTick } from "../game/GameContext";
import { formatCountdown } from "../lib/format";
import "./TopBar.css";

/** Barre du haut : éclats, niveau/XP, série et potions actives, lisibles d'un coup d'œil. */
export function TopBar() {
  const { state, level, now } = useGame();
  useTick(1000);
  const t = now();
  const active = TIMED_POTION_IDS.filter((id) => (state.potions.active[id] ?? 0) > t);
  const xpPct = level.need ? Math.round((level.into / level.need) * 100) : 100;

  return (
    <header className="topbar" aria-label="Ressources">
      <div className="topbar__item topbar__shards" title={`${CURRENCY.name} : monnaie gagnée en jouant`}>
        <span className="topbar__gem" aria-hidden="true">
          ✦
        </span>
        <span className="topbar__value tabular">
          <AnimatedNumber value={state.shards} />
        </span>
        <span className="topbar__unit">{CURRENCY.plural}</span>
      </div>

      <div className="topbar__item topbar__level" title={level.need ? `${level.into} / ${level.need} XP` : "Niveau maximal"}>
        <span className="topbar__label">Niv.</span>
        <span className="topbar__value tabular">
          <AnimatedNumber value={level.level} />
        </span>
        <span
          className="topbar__xp"
          role="progressbar"
          aria-label="Expérience vers le niveau suivant"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={xpPct}
        >
          <span style={{ width: `${xpPct}%` }} />
        </span>
      </div>

      <div className="topbar__item" title="Rolls enchaînés sans pause">
        <Icon name="fire" size={15} />
        <span className="topbar__label">Série</span>
        <span className="topbar__value tabular">
          <AnimatedNumber value={state.stats.streak} />
        </span>
      </div>

      <ul className="topbar__potions" aria-label="Potions actives">
        {active.length === 0 && <li className="topbar__none">Aucune potion active</li>}
        {active.map((id) => (
          <li key={id} className="topbar__potion" style={{ "--pc": POTIONS[id].color } as CSSProperties} title={POTIONS[id].name}>
            <Icon name="flask" size={13} />
            <span className="sr-only">{POTIONS[id].name}, encore </span>
            <span className="tabular">{formatCountdown((state.potions.active[id] ?? 0) - t)}</span>
          </li>
        ))}
      </ul>
    </header>
  );
}
