import { useState } from "react";
import { ACHIEVEMENTS, CURRENCY, HINT_LABELS, HINT_LEVELS, POTIONS, nextHintCost, type Achievement, type PotionId } from "../../shared";
import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";
import { useGame } from "../game/GameContext";
import { formatDate, formatNumber } from "../lib/format";
import "./AchievementsPage.css";

const HOUR = 3_600_000;

function formatProgress(id: string, cur: number, target: number): string {
  if (id.startsWith("playtime")) return `${(Math.min(cur, target) / HOUR).toFixed(1)} / ${target / HOUR} h`;
  if (target === 1) return cur >= 1 ? "Fait" : "À faire";
  return `${formatNumber(Math.min(cur, target))} / ${formatNumber(target)}`;
}

function Rewards({ a }: { a: Achievement }) {
  if (!a.reward) return null;
  return (
    <div className="ach__reward" title="Récompense">
      {Object.entries(a.reward).map(([id, n]) => (
        <span key={id} style={{ color: POTIONS[id as PotionId].color }}>
          <Icon name="flask" size={13} /> {n}× {POTIONS[id as PotionId].name.replace("Potion de ", "")}
        </span>
      ))}
    </div>
  );
}

/** Indices d'un succès secret encore verrouillé : textes révélés + bouton pour le suivant. */
function HintBlock({ a, onAsk }: { a: Achievement; onAsk: (a: Achievement, cost: number) => void }) {
  const { state, hints } = useGame();
  const level = state.hints[a.id] ?? 0;
  const texts = hints[a.id] ?? [];
  const cost = nextHintCost(level);
  return (
    <div className="hints">
      {texts.length > 0 && (
        <ol className="hints__list">
          {texts.map((t, i) => (
            <li key={i}>
              <span className="hints__label">{HINT_LABELS[i]}</span> {t}
            </li>
          ))}
        </ol>
      )}
      <div className="hints__foot">
        <span className="hints__count tabular" aria-label={`${level} indice(s) révélé(s) sur ${HINT_LEVELS}`}>
          {Array.from({ length: HINT_LEVELS }, (_, i) => (
            <span key={i} className={i < level ? "is-on" : ""} aria-hidden="true" />
          ))}
        </span>
        {cost !== null ? (
          <button className={`btn btn-sm ${cost === 0 ? "btn-primary" : ""}`} onClick={() => onAsk(a, cost)} disabled={state.shards < cost}>
            <Icon name="lock" size={14} /> Révéler un indice · {cost === 0 ? "gratuit" : `${formatNumber(cost)} ✦`}
          </button>
        ) : (
          <span className="muted">Tous les indices sont révélés</span>
        )}
      </div>
    </div>
  );
}

export function AchievementsPage() {
  const { state, revealHint } = useGame();
  const [tab, setTab] = useState<"all" | "secret">("all");
  const [confirm, setConfirm] = useState<{ a: Achievement; cost: number } | null>(null);
  const unlocked = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
  const secrets = ACHIEVEMENTS.filter((a) => a.secret);
  const secretsFound = secrets.filter((a) => state.achievements[a.id]).length;
  const list = tab === "secret" ? secrets : ACHIEVEMENTS;

  // Un indice gratuit se révèle directement ; un indice payant demande confirmation (pas de remboursement).
  const ask = (a: Achievement, cost: number) => (cost === 0 ? void revealHint(a.id) : setConfirm({ a, cost }));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Succès</h1>
          <p>
            {unlocked} / {ACHIEVEMENTS.length} débloqués · {secretsFound} / {secrets.length} succès secrets découverts. Les succès sont vérifiés et
            récompensés par le serveur.
          </p>
        </div>
      </header>

      <div className="subnav__tabs ach-tabs" role="tablist" aria-label="Filtrer les succès">
        <button role="tab" aria-selected={tab === "all"} className={`subnav__tab ${tab === "all" ? "is-active" : ""}`} onClick={() => setTab("all")}>
          Tous
        </button>
        <button role="tab" aria-selected={tab === "secret"} className={`subnav__tab ${tab === "secret" ? "is-active" : ""}`} onClick={() => setTab("secret")}>
          Secrets <span className="tabular">{secretsFound}/{secrets.length}</span>
        </button>
      </div>

      {tab === "secret" && (
        <p className="muted ach-note">
          Chaque succès secret a 3 indices : le premier est gratuit, puis {HINT_LABELS[1].toLowerCase()} ({formatNumber(nextHintCost(1)!)} ✦) et{" "}
          {HINT_LABELS[2].toLowerCase()} ({formatNumber(nextHintCost(2)!)} ✦). Un indice n'est jamais la solution exacte.
        </p>
      )}

      <ul className="ach-list">
        {list.map((a) => {
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
                {!hidden && <Rewards a={a} />}
                {!hidden && !at && (
                  <div className="ach__progress">
                    <div className="progress">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <span className="tabular">{formatProgress(a.id, cur, target)}</span>
                  </div>
                )}
                {hidden && tab === "secret" && <HintBlock a={a} onAsk={ask} />}
                {at && <span className="ach__date">Débloqué le {formatDate(at)}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      {confirm && (
        <Modal title="Révéler un indice" onClose={() => setConfirm(null)}>
          <div className="confirm">
            <p>
              {HINT_LABELS[state.hints[confirm.a.id] ?? 0]} pour ce succès secret, contre{" "}
              <strong>
                {formatNumber(confirm.cost)} {CURRENCY.plural}
              </strong>{" "}
              (solde : {formatNumber(state.shards)}). L'achat est définitif : pas de remboursement.
            </p>
            <div className="confirm__actions">
              <button className="btn" onClick={() => setConfirm(null)}>
                Annuler
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const { a } = confirm;
                  setConfirm(null);
                  await revealHint(a.id);
                }}
              >
                Révéler
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
