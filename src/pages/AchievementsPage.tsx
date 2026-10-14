import { ACHIEVEMENTS, POTIONS, type PotionId } from "../../shared";
import { Icon } from "../components/Icon";
import { useGame } from "../game/GameContext";
import { formatDate, formatNumber } from "../lib/format";
import "./AchievementsPage.css";

const HOUR = 3_600_000;

function formatProgress(id: string, cur: number, target: number): string {
  if (id.startsWith("playtime")) return `${(Math.min(cur, target) / HOUR).toFixed(1)} / ${target / HOUR} h`;
  if (target === 1) return cur >= 1 ? "Fait" : "À faire";
  return `${formatNumber(Math.min(cur, target))} / ${formatNumber(target)}`;
}

export function AchievementsPage() {
  const { state } = useGame();
  const unlocked = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Succès</h1>
          <p>
            {unlocked} / {ACHIEVEMENTS.length} débloqués. Les succès sont vérifiés et récompensés par le serveur.
          </p>
        </div>
      </header>

      <ul className="ach-list">
        {ACHIEVEMENTS.map((a) => {
          const at = state.achievements[a.id];
          const [cur, target] = a.progress(state);
          const hidden = a.secret && !at;
          const pct = Math.min(100, (cur / target) * 100);
          return (
            <li key={a.id} className={`ach panel ${at ? "is-done" : ""} ${hidden ? "is-secret" : ""}`}>
              <span className="ach__icon">
                <Icon name={at ? "achievements" : hidden ? "lock" : "star"} size={22} />
              </span>
              <div className="ach__body">
                <h3>{hidden ? "Succès secret" : a.name}</h3>
                <p>{hidden ? "Continue de jouer pour le découvrir…" : a.description}</p>
                {a.reward && !hidden && (
                  <div className="ach__reward" title="Récompense">
                    {Object.entries(a.reward).map(([id, n]) => (
                      <span key={id} style={{ color: POTIONS[id as PotionId].color }}>
                        <Icon name="flask" size={13} /> {n}× {POTIONS[id as PotionId].name.replace("Potion de ", "")}
                      </span>
                    ))}
                  </div>
                )}
                {!hidden && !at && (
                  <div className="ach__progress">
                    <div className="progress">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <span className="tabular">{formatProgress(a.id, cur, target)}</span>
                  </div>
                )}
                {at && <span className="ach__date">Débloqué le {formatDate(at)}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
