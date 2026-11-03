import type { CSSProperties } from "react";
import { CURRENCY, POTIONS, TIMED_POTION_IDS, nextStreak, streakBonus, streakCap, streakExpiresAt } from "../../shared";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { Icon } from "../components/Icon";
import { useGame, useTick } from "../game/GameContext";
import { formatPotionTime, formatPotionTimeLong } from "../lib/format";
import "./TopBar.css";

/** Barre du haut : éclats, niveau/XP, série et potions actives, lisibles d'un coup d'œil. */
export function TopBar() {
  const { state, level, now } = useGame();
  useTick(1000);
  const t = now();
  const active = TIMED_POTION_IDS.filter((id) => (state.potions.active[id] ?? 0) > t);
  const xpPct = level.need ? Math.round((level.into / level.need) * 100) : 100;
  const frozen = (state.potions.active.streakGuard ?? 0) > t && state.stats.streak > 0;
  // Si la fenêtre est dépassée, la série affichée est celle que le prochain roll aurait (1).
  const streakLeft = state.stats.streak > 0 ? streakExpiresAt(state) - t : 0;
  const displayedStreak = state.stats.streak > 0 && nextStreak(state, t) === 1 ? 0 : state.stats.streak;

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

      <div
        className={`topbar__item ${frozen ? "is-frozen" : ""}`}
        title={`Série : +2 % de chance tous les 10 rolls (max +${Math.round(streakCap(state) * 100)} %). Bonus actuel : +${Math.round(
          streakBonus(state.stats.streak, streakCap(state)) * 100,
        )} %. ${frozen ? "Gelée par la potion de série." : streakLeft > 0 ? `Retombe si aucun roll pendant ${Math.ceil(streakLeft / 1000)} s.` : ""}`}
      >
        <Icon name={frozen ? "shield" : "fire"} size={15} />
        <span className="topbar__label">Série</span>
        <span className="topbar__value tabular">
          <AnimatedNumber value={displayedStreak} />
        </span>
      </div>

      {/* Au-delà de 5 potions actives, la liste défile horizontalement (pas de repli « +3 »). */}
      <ul className={`topbar__potions ${active.length > 5 ? "is-scroll" : ""}`} aria-label="Potions actives" tabIndex={active.length > 5 ? 0 : undefined}>
        {active.length === 0 && <li className="topbar__none">Aucune potion active</li>}
        {active.map((id) => {
          const left = (state.potions.active[id] ?? 0) - t;
          return (
            <li key={id} className="topbar__potion" style={{ "--pc": POTIONS[id].color } as CSSProperties} title={`${POTIONS[id].name} : encore ${formatPotionTimeLong(left)}`}>
              <Icon name="flask" size={13} />
              <span className="sr-only">
                {POTIONS[id].name}, encore {formatPotionTimeLong(left)}
              </span>
              <span className="tabular" aria-hidden="true">
                {formatPotionTime(left)}
              </span>
            </li>
          );
        })}
      </ul>
    </header>
  );
}
