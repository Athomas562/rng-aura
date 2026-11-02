import type { CSSProperties } from "react";
import {
  AURAS,
  EVENTS,
  MISSIONS,
  POTIONS,
  emptyPeriod,
  isEventActive,
  periodEndsAt,
  periodKey,
  questProgress,
  questsFor,
  type PotionId,
  type QuestScope,
  type Reward,
} from "../../shared";
import { AuraIcon } from "../components/AuraIcon";
import { Icon } from "../components/Icon";
import { useGame, useTick } from "../game/GameContext";
import { formatDuration, formatNumber } from "../lib/format";
import "./QuestsPage.css";

function RewardChips({ reward }: { reward: Reward }) {
  return (
    <span className="reward-chips">
      {Object.entries(reward).map(([id, n]) => {
        const p = POTIONS[id as PotionId];
        return (
          <span key={id} style={{ color: p.color }}>
            <Icon name="flask" size={12} /> {n}× {p.name}
          </span>
        );
      })}
    </span>
  );
}

function QuestColumn({ scope }: { scope: QuestScope }) {
  const { state, now, claim } = useGame();
  useTick(1000);
  const t = now();
  const key = periodKey(scope, t);
  // Si le serveur n'a pas encore vu la nouvelle période, la progression affichée repart de zéro.
  const period = state.quests[scope].key === key ? state.quests[scope] : emptyPeriod(key);
  const quests = questsFor(scope, key);

  return (
    <section className="panel quest-col">
      <header className="quest-col__head">
        <h2 className="panel-title">
          <Icon name={scope === "daily" ? "clock" : "calendar"} size={14} /> {scope === "daily" ? "Quêtes du jour" : "Quêtes de la semaine"}
        </h2>
        <span className="muted tabular">nouvelles dans {formatDuration(periodEndsAt(scope, t) - t)}</span>
      </header>
      <ul className="quest-list">
        {quests.map((q) => {
          const progress = questProgress(q, period);
          const done = progress >= q.target;
          const claimed = Boolean(period.claimed[q.id]);
          return (
            <li key={q.id} className={`quest ${done ? "is-done" : ""} ${claimed ? "is-claimed" : ""}`}>
              <div className="quest__body">
                <strong>{q.name}</strong>
                <span className="quest__desc">{q.description}</span>
                <div className="quest__progress">
                  <div className="progress">
                    <span style={{ width: `${(progress / q.target) * 100}%` }} />
                  </div>
                  <span className="tabular">
                    {formatNumber(progress)} / {formatNumber(q.target)}
                  </span>
                </div>
                <RewardChips reward={q.reward} />
              </div>
              <button className={`btn btn-sm ${done && !claimed ? "btn-primary" : ""}`} disabled={!done || claimed} onClick={() => void claim(scope, q.id)}>
                {claimed ? <Icon name="check" size={15} /> : <Icon name="gift" size={15} />}
                {claimed ? "Réclamée" : "Réclamer"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Missions() {
  const { state, claim } = useGame();
  return (
    <section className="panel quest-missions">
      <h2 className="panel-title">
        <Icon name="progression" size={14} /> Missions de longue haleine
      </h2>
      <ul className="mission-list">
        {MISSIONS.map((m) => {
          const stage = state.quests.missions[m.id] ?? 0;
          const next = m.stages[stage];
          const value = m.value(state);
          const prev = stage > 0 ? m.stages[stage - 1].target : 0;
          const pct = next ? Math.min(100, ((value - prev) / (next.target - prev)) * 100) : 100;
          const ready = next ? value >= next.target : false;
          return (
            <li key={m.id} className={`mission ${ready ? "is-ready" : ""} ${next ? "" : "is-complete"}`}>
              <div className="mission__head">
                <strong>{m.name}</strong>
                <span className="mission__stages" aria-label={`Étape ${stage} sur ${m.stages.length}`}>
                  {m.stages.map((_, i) => (
                    <span key={i} className={i < stage ? "is-on" : ""} />
                  ))}
                </span>
              </div>
              <span className="quest__desc">{m.description}</span>
              {next ? (
                <>
                  <div className="quest__progress">
                    <div className="progress">
                      <span style={{ width: `${Math.max(0, pct)}%` }} />
                    </div>
                    <span className="tabular">
                      {formatNumber(Math.min(value, next.target))} / {formatNumber(next.target)}
                    </span>
                  </div>
                  <div className="mission__foot">
                    <RewardChips reward={next.reward} />
                    <button className={`btn btn-sm ${ready ? "btn-primary" : ""}`} disabled={!ready} onClick={() => void claim("mission", m.id)}>
                      <Icon name="gift" size={15} /> Réclamer
                    </button>
                  </div>
                </>
              ) : (
                <span className="mission__done">
                  <Icon name="check" size={14} /> Mission accomplie
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EventsCalendar() {
  const { now, state } = useGame();
  const t = now();
  const fmt = ([m, d]: [number, number]) => new Date(Date.UTC(2000, m - 1, d)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
  return (
    <section className="panel quest-events">
      <h2 className="panel-title">
        <Icon name="calendar" size={14} /> Saisons et événements
      </h2>
      <p className="muted">Chaque année, pendant ces périodes, une aura exclusive entre dans la table de tirage et la chance gagne +10 %.</p>
      <ul className="event-list">
        {EVENTS.map((e) => {
          const active = isEventActive(e, t);
          const auras = AURAS.filter((a) => a.special?.kind === "seasonal" && a.special.event === e.id);
          return (
            <li key={e.id} className={`event-card ${active ? "is-active" : ""}`} style={{ "--ec": e.color } as CSSProperties}>
              <div className="event-card__head">
                <strong>{e.name}</strong>
                {active ? <span className="tag tag--new">En cours</span> : <span className="tag tag--muted">À venir</span>}
              </div>
              <span className="muted">
                Du {fmt(e.start)} au {fmt(e.end)}
              </span>
              <div className="event-card__auras">
                {auras.map((a) => {
                  const known = Boolean(state.codex[a.id]);
                  return (
                    <span key={a.id} className="event-card__aura">
                      <AuraIcon aura={a} size={36} locked={!known} animated={active} />
                      {known ? a.name : "???"}
                    </span>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function QuestsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Quêtes</h1>
          <p>La progression est comptée par le serveur ; chaque récompense ne peut être réclamée qu'une seule fois.</p>
        </div>
      </header>
      <div className="quests-grid">
        <QuestColumn scope="daily" />
        <QuestColumn scope="weekly" />
        <Missions />
        <EventsCalendar />
      </div>
    </div>
  );
}
