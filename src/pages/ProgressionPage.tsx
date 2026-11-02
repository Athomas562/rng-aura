import { useState, type CSSProperties } from "react";
import {
  FUSION_AURAS,
  PRESTIGE_LUCK,
  PRESTIGE_MAX,
  PRESTIGE_REWARD,
  PRESTIGE_ROLLS,
  POTIONS,
  SLOT_LEVELS,
  TALENTS,
  TALENT_BRANCHES,
  TITLES,
  fusionMissing,
  getAura,
  getRarity,
  getTalent,
  runRolls,
  slotsFor,
  spentTalentPoints,
  talentPointsFor,
  type Aura,
  type PotionId,
} from "../../shared";
import { AuraIcon } from "../components/AuraIcon";
import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";
import { RarityBadge } from "../components/RarityBadge";
import { useGame } from "../game/GameContext";
import { formatDate, formatNumber } from "../lib/format";
import "./ProgressionPage.css";

function rewardList(r: Partial<Record<PotionId, number>>) {
  return Object.entries(r)
    .map(([id, n]) => `${n}× ${POTIONS[id as PotionId].name}`)
    .join(", ");
}

/** Emplacements d'aura : principale + emplacements débloqués par le niveau. */
function SlotsSection() {
  const { state, level, equip, look } = useGame();
  const total = slotsFor(level.level);
  const owned = Object.keys(state.inventory)
    .map((id) => getAura(id)!)
    .sort((a, b) => b.odds - a.odds);
  const slots = [state.equipped, ...Array.from({ length: 3 }, (_, i) => state.slots[i] ?? null)];

  return (
    <section className="panel prog-section">
      <h2 className="panel-title">
        <Icon name="collection" size={14} /> Emplacements d'aura
      </h2>
      <p className="muted">L'aura principale habille ton avatar. Les emplacements supplémentaires gravitent autour de lui.</p>
      <ul className="slot-list">
        {slots.map((id, i) => {
          const locked = i >= total;
          const aura = id ? getAura(id) : undefined;
          return (
            <li key={i} className={`slot ${locked ? "is-locked" : ""}`}>
              <span className="slot__icon">{aura && !locked ? <AuraIcon aura={look(aura)} size={48} /> : <Icon name={locked ? "lock" : "star"} size={20} />}</span>
              <div className="slot__body">
                <strong>{i === 0 ? "Aura principale" : `Emplacement ${i + 1}`}</strong>
                {locked ? (
                  <span className="muted">Débloqué au niveau {SLOT_LEVELS[i - 1]}</span>
                ) : (
                  <select
                    className="select select--sm"
                    value={id ?? ""}
                    onChange={(e) => void equip(e.target.value || null, i)}
                    aria-label={i === 0 ? "Aura principale" : `Emplacement ${i + 1}`}
                  >
                    <option value="">— Vide —</option>
                    {owned.map((a) => (
                      <option key={a.id} value={a.id} disabled={i > 0 && a.id === state.equipped}>
                        {look(a).name} ({getRarity(a.rarity).label})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TitlesSection() {
  const { state, setTitle } = useGame();
  return (
    <section className="panel prog-section">
      <h2 className="panel-title">
        <Icon name="crown" size={14} /> Titres
      </h2>
      <p className="muted">Ton titre s'affiche sous ton pseudo et dans le classement.</p>
      <ul className="title-grid">
        {TITLES.map((t) => {
          const unlocked = t.unlocked(state);
          const active = state.title === t.id;
          return (
            <li key={t.id}>
              <button
                className={`title-chip ${active ? "is-active" : ""} ${unlocked ? "" : "is-locked"}`}
                style={{ "--tc": t.color } as CSSProperties}
                disabled={!unlocked}
                onClick={() => void setTitle(active ? null : t.id)}
                title={unlocked ? (active ? "Retirer ce titre" : "Porter ce titre") : t.requirement}
              >
                <span className="title-chip__name">{unlocked ? t.name : "???"}</span>
                <span className="title-chip__req">{unlocked ? (active ? "Porté" : "Disponible") : t.requirement}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TalentsSection() {
  const { state, learnTalent, respec } = useGame();
  const points = talentPointsFor(state);
  const spent = spentTalentPoints(state.talents);
  const free = points - spent;

  return (
    <section className="panel prog-section prog-section--wide">
      <header className="prog-section__head">
        <h2 className="panel-title">
          <Icon name="tree" size={14} /> Arbre de talents
        </h2>
        <span className="talent-points tabular">
          {free} point{free > 1 ? "s" : ""} disponible{free > 1 ? "s" : ""} · {spent}/{points} dépensés
        </span>
        <button className="btn btn-sm" onClick={() => void respec()} disabled={spent === 0}>
          Réinitialiser
        </button>
      </header>
      <p className="muted">1 point par niveau, +2 par prestige. La réinitialisation est gratuite.</p>
      <div className="talent-tree">
        {TALENT_BRANCHES.map((b) => (
          <div key={b.id} className="talent-branch" style={{ "--bc": b.color } as CSSProperties}>
            <h3>{b.name}</h3>
            {TALENTS.filter((t) => t.branch === b.id).map((t) => {
              const rank = state.talents[t.id] ?? 0;
              const req = t.requires;
              const blocked = req ? (state.talents[req.talent] ?? 0) < req.rank : false;
              const maxed = rank >= t.maxRank;
              return (
                <div key={t.id} className={`talent ${maxed ? "is-max" : ""} ${blocked ? "is-blocked" : ""}`}>
                  <div className="talent__head">
                    <strong>{t.name}</strong>
                    <span className="tabular">
                      {rank}/{t.maxRank}
                    </span>
                  </div>
                  <div className="talent__pips" aria-hidden="true">
                    {Array.from({ length: t.maxRank }, (_, i) => (
                      <span key={i} className={i < rank ? "is-on" : ""} />
                    ))}
                  </div>
                  <p>Par rang : {t.perRank}.</p>
                  {req && <p className="talent__req">Nécessite {getTalent(req.talent).name} rang {req.rank}</p>}
                  <button className="btn btn-sm" disabled={maxed || blocked || free <= 0} onClick={() => void learnTalent(t.id)}>
                    {maxed ? "Maximum" : "+1 rang"}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function PrestigeSection() {
  const { state, prestige } = useGame();
  const [confirm, setConfirm] = useState(false);
  const done = runRolls(state);
  const pct = Math.min(100, (done / PRESTIGE_ROLLS) * 100);
  const maxed = state.prestige.level >= PRESTIGE_MAX;
  const ready = !maxed && done >= PRESTIGE_ROLLS;

  return (
    <section className="panel prog-section prestige">
      <h2 className="panel-title">
        <Icon name="fire" size={14} /> Prestige · Renaissance
      </h2>
      <div className="prestige__level">
        <span className="prestige__value tabular">{state.prestige.level}</span>
        <span>
          / {PRESTIGE_MAX} · bonus permanent <strong>+{Math.round(state.prestige.level * PRESTIGE_LUCK * 100)} %</strong> de chance
        </span>
      </div>
      {!maxed && (
        <>
          <div className="prestige__progress">
            <div className="progress">
              <span style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular">
              {formatNumber(Math.min(done, PRESTIGE_ROLLS))} / {formatNumber(PRESTIGE_ROLLS)} rolls depuis la dernière renaissance
            </span>
          </div>
          <ul className="prestige__rules">
            <li>
              <strong>Repart de zéro :</strong> inventaire (auras possédées), auras équipées, série.
            </li>
            <li>
              <strong>Conservé :</strong> codex, niveau et XP, talents, titres, succès, potions, quêtes, record de rareté.
            </li>
            <li>
              <strong>Gagné :</strong> +5 % de chance pour toujours, 2 points de talent, {rewardList(PRESTIGE_REWARD)}.
            </li>
          </ul>
          <button className="btn btn-primary" disabled={!ready} onClick={() => setConfirm(true)}>
            Renaître (prestige {state.prestige.level + 1})
          </button>
        </>
      )}
      {maxed && <p className="muted">Prestige maximal atteint. Tu es une légende.</p>}

      {state.prestige.history.length > 0 && (
        <>
          <h3 className="prestige__history-title">Historique</h3>
          <table className="odds-table">
            <thead>
              <tr>
                <th>Prestige</th>
                <th>Date</th>
                <th>Rolls</th>
                <th>Meilleure aura</th>
              </tr>
            </thead>
            <tbody>
              {[...state.prestige.history].reverse().map((h) => {
                const best = h.bestAuraId ? getAura(h.bestAuraId) : undefined;
                return (
                  <tr key={h.at}>
                    <td className="tabular">{h.level}</td>
                    <td>{formatDate(h.at)}</td>
                    <td className="tabular">{formatNumber(h.runRolls)}</td>
                    <td>{best ? <span style={{ color: best.visual.primary }}>{best.name}</span> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {confirm && (
        <Modal title="Confirmer la renaissance" onClose={() => setConfirm(false)}>
          <div className="confirm">
            <p>
              Ton inventaire actuel ({Object.keys(state.inventory).length} auras différentes) va repartir de zéro. Ton codex, ton niveau, tes talents
              et tes potions sont conservés.
            </p>
            <div className="confirm__actions">
              <button className="btn" onClick={() => setConfirm(false)}>
                Annuler
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  setConfirm(false);
                  await prestige();
                }}
              >
                Renaître
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function FusionCard({ aura }: { aura: Aura }) {
  const { state, fuse, rolling } = useGame();
  const sp = aura.special;
  if (sp?.kind !== "fusion") return null;
  const missing = fusionMissing(state, aura);
  const known = Boolean(state.codex[aura.id]);
  return (
    <li className="fusion panel" style={{ "--c1": aura.visual.primary } as CSSProperties}>
      <div className="fusion__result">
        <AuraIcon aura={aura} size={64} locked={!known} />
        <div>
          <strong style={{ color: known ? aura.visual.primary : undefined }}>{known ? aura.name : "Fusion inconnue"}</strong>
          <RarityBadge rarity={aura.rarity} />
          {state.inventory[aura.id] && <span className="muted">Possédée ×{state.inventory[aura.id].count}</span>}
        </div>
      </div>
      <ul className="fusion__ingredients">
        {sp.ingredients.map((ing) => {
          const a = getAura(ing.auraId)!;
          const have = state.inventory[ing.auraId]?.count ?? 0;
          const ok = have >= ing.count + 1;
          const seen = Boolean(state.codex[ing.auraId]);
          return (
            <li key={ing.auraId} className={ok ? "is-ok" : ""}>
              <AuraIcon aura={a} size={34} animated={false} locked={!seen} />
              <span>
                {ing.count}× {seen ? a.name : "???"}
              </span>
              <span className="tabular">
                {have}/{ing.count + 1}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="muted">Consomme les ingrédients indiqués ; il faut en garder au moins un exemplaire.</p>
      <button className="btn btn-primary btn-sm" disabled={missing.length > 0 || rolling} onClick={() => void fuse(aura.id)}>
        <Icon name="fusion" size={15} /> Fusionner
      </button>
    </li>
  );
}

export function ProgressionPage() {
  const { state, level } = useGame();
  const xpPct = level.need ? (level.into / level.need) * 100 : 100;

  return (
    <div className="page progression-page">
      <header className="page-header">
        <div>
          <h1>Progression</h1>
          <p>Niveau, titres, emplacements, talents, prestige et fusions — tout est validé par le serveur.</p>
        </div>
        <div className="level-card">
          <span className="level-card__value tabular">{level.level}</span>
          <div>
            <span className="level-card__label">Niveau</span>
            <div className="progress progress--xp">
              <span style={{ width: `${xpPct}%` }} />
            </div>
            <span className="muted tabular">{level.need ? `${formatNumber(level.into)} / ${formatNumber(level.need)} XP` : "Niveau maximal"}</span>
          </div>
          {state.prestige.level > 0 && <span className="level-card__prestige">✦ {state.prestige.level}</span>}
        </div>
      </header>

      <div className="prog-grid">
        <SlotsSection />
        <TitlesSection />
        <TalentsSection />
        <PrestigeSection />
        <section className="panel prog-section prog-section--wide">
          <h2 className="panel-title">
            <Icon name="fusion" size={14} /> Atelier de fusion
          </h2>
          <p className="muted">Les auras de fusion ne tombent jamais en roll : combine deux auras pour les créer.</p>
          <ul className="fusion-list">
            {FUSION_AURAS.map((a) => (
              <FusionCard key={a.id} aura={a} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
