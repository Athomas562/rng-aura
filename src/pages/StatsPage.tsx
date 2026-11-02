import { useMemo, useState, type CSSProperties } from "react";
import {
  ACHIEVEMENTS,
  AURAS,
  CURRENCY,
  PRESTIGE_LUCK,
  RARITIES,
  computeDistribution,
  distributionFor,
  getAura,
  getRarity,
  previewNextLuck,
  type RarityId,
} from "../../shared";
import { AuraIcon } from "../components/AuraIcon";
import { RarityBadge } from "../components/RarityBadge";
import { useGame, useTick } from "../game/GameContext";
import { formatDate, formatDuration, formatLuck, formatNumber, formatOddsN } from "../lib/format";
import "./StatsPage.css";

export function StatsPage() {
  const { state, now, level, look } = useGame();
  useTick(1000);
  const { stats } = state;
  const t = now();
  const bestBase = stats.bestAuraId ? getAura(stats.bestAuraId) : undefined;
  const best = bestBase ? look(bestBase) : undefined;
  const discovered = Object.keys(state.codex).length;
  const luck = previewNextLuck(state, t);
  const [auraFilter, setAuraFilter] = useState<RarityId | "all">("all");

  // Obtentions par palier, toutes parties confondues (codex)
  const perTier = RARITIES.map((r) => ({
    rarity: r,
    count: AURAS.filter((a) => a.rarity === r.id).reduce((s, a) => s + (state.codex[a.id]?.total ?? 0), 0),
  }));
  const maxCount = Math.max(1, ...perTier.map((x) => x.count));

  // Probabilité de chaque palier avec la chance actuelle (saisonnières et potion ciblée comprises)
  const dist = distributionFor(luck, t);
  const base = computeDistribution(1, { now: t });
  const tierP = (d: typeof dist, id: RarityId) => d.filter((e) => e.aura.rarity === id).reduce((s, e) => s + e.p, 0);

  const perAura = useMemo(
    () =>
      AURAS.filter((a) => state.codex[a.id] && (auraFilter === "all" || a.rarity === auraFilter))
        .map((a) => ({ aura: a, ...state.codex[a.id], owned: state.inventory[a.id]?.count ?? 0 }))
        .sort((a, b) => b.aura.odds - a.aura.odds),
    [state.codex, state.inventory, auraFilter],
  );

  const cards = [
    { label: "Rolls totaux", value: formatNumber(stats.rolls) },
    { label: "Niveau", value: `${level.level}` },
    { label: "Prestige", value: `${state.prestige.level} (+${Math.round(state.prestige.level * PRESTIGE_LUCK * 100)} %)` },
    { label: "Auras découvertes", value: `${discovered} / ${AURAS.length}` },
    { label: "Temps de jeu", value: formatDuration(stats.playTimeMs) },
    { label: "Succès", value: `${Object.keys(state.achievements).length} / ${ACHIEVEMENTS.length}` },
    { label: "Série actuelle", value: formatNumber(stats.streak) },
    { label: "Meilleure série", value: formatNumber(stats.maxStreak) },
    { label: "Rolls bénis", value: formatNumber(stats.blessedRolls) },
    { label: "Potions bues", value: formatNumber(stats.potionsUsed) },
    { label: "Fusions", value: formatNumber(stats.fusions) },
    { label: "Quêtes réclamées", value: formatNumber(stats.questsClaimed) },
    { label: "XP totale", value: formatNumber(state.xp) },
    { label: `${CURRENCY.name} (solde)`, value: formatNumber(state.shards) },
    { label: `${CURRENCY.name} gagnés`, value: formatNumber(stats.shardsEarned) },
    { label: `${CURRENCY.name} dépensés`, value: formatNumber(stats.shardsSpent) },
    { label: "Chance actuelle", value: formatLuck(luck.total) },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Statistiques</h1>
          <p>Compte créé le {formatDate(state.createdAt)}</p>
        </div>
      </header>

      <div className="stats-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card panel">
            <span className="stat-card__label">{c.label}</span>
            <span className="stat-card__value tabular">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="stats-cols">
        <section className="panel stats-section">
          <h2 className="panel-title">Aura la plus rare obtenue</h2>
          {best ? (
            <div className="stats-best">
              <AuraIcon aura={best} size={84} />
              <div>
                <strong style={{ color: best.visual.primary }}>{best.name}</strong>
                <RarityBadge rarity={best.rarity} />
                <span className="tabular">{formatOddsN(best.odds)}</span>
                <span className="muted">Découverte le {formatDate(state.codex[best.id]?.firstAt ?? 0)}</span>
              </div>
            </div>
          ) : (
            <p className="muted">Aucune aura pour l'instant.</p>
          )}

          <h2 className="panel-title" style={{ marginTop: 26 }}>
            Obtentions par rareté (toutes parties)
          </h2>
          <ul className="bars">
            {perTier.map(({ rarity, count }) => (
              <li key={rarity.id} style={{ "--rc": rarity.color } as CSSProperties}>
                <span className="bars__label">{rarity.label}</span>
                <span className="bars__track">
                  <span style={{ width: `${(count / maxCount) * 100}%` }} />
                </span>
                <span className="bars__value tabular">{formatNumber(count)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel stats-section">
          <h2 className="panel-title">Probabilités avec ta chance ({formatLuck(luck.total)})</h2>
          <table className="odds-table">
            <thead>
              <tr>
                <th>Palier</th>
                <th>Chance de base</th>
                <th>Avec bonus</th>
              </tr>
            </thead>
            <tbody>
              {RARITIES.map((r) => {
                const b = tierP(base, r.id);
                const cur = tierP(dist, r.id);
                return (
                  <tr key={r.id} className={luck.focus?.rarity === r.id ? "is-focus" : ""}>
                    <td>
                      <RarityBadge rarity={r.id} />
                    </td>
                    <td className="tabular">{b > 0 ? `1 sur ${formatNumber(Math.round(1 / b))}` : "—"}</td>
                    <td className="tabular">{cur > 0 ? `1 sur ${formatNumber(Math.max(1, Math.round(1 / cur)))}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted">
            Chaque aura rare reçoit « chance ÷ N ». Les auras communes se partagent ce qui reste : plus ta chance est élevée, moins tu en obtiens.
            Les fusions ne tombent jamais en roll, les saisonnières seulement pendant leur événement.
          </p>
          {luck.parts.length > 0 && (
            <ul className="luck-parts">
              {luck.parts.map((p) => (
                <li key={p.label}>
                  <span>{p.label}</span>
                  <span className="tabular">{p.kind === "add" ? `+${Math.round(p.value * 100)} %` : `×${p.value}`}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted">Palier le plus élevé atteint : {best ? getRarity(best.rarity).label : "—"}</p>
        </section>

        <section className="panel stats-section stats-section--wide">
          <header className="stats-section__head">
            <h2 className="panel-title">Détail par aura</h2>
            <select className="select select--sm" value={auraFilter} onChange={(e) => setAuraFilter(e.target.value as RarityId | "all")} aria-label="Filtrer par rareté">
              <option value="all">Toutes les raretés</option>
              {RARITIES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </header>
          {perAura.length === 0 ? (
            <p className="muted">Aucune aura découverte pour ce filtre.</p>
          ) : (
            <div className="table-scroll">
              <table className="odds-table aura-table">
                <thead>
                  <tr>
                    <th>Aura</th>
                    <th>Total</th>
                    <th>Partie en cours</th>
                    <th>Découverte</th>
                  </tr>
                </thead>
                <tbody>
                  {perAura.map(({ aura, total, owned, firstAt }) => {
                    const a = look(aura);
                    return (
                      <tr key={aura.id}>
                        <td>
                          <span className="aura-cell">
                            <AuraIcon aura={a} size={28} animated={false} />
                            <span style={{ color: a.visual.primary }}>{a.name}</span>
                          </span>
                        </td>
                        <td className="tabular">{formatNumber(total)}</td>
                        <td className="tabular">{formatNumber(owned)}</td>
                        <td>{formatDate(firstAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel stats-section stats-section--wide" aria-labelledby="ledger-title">
          <h2 className="panel-title" id="ledger-title">
            Historique des {CURRENCY.plural}
          </h2>
          {state.ledger.length === 0 ? (
            <p className="muted">Aucun mouvement pour l'instant : chaque roll rapporte des {CURRENCY.plural}.</p>
          ) : (
            <div className="table-scroll">
              <table className="odds-table ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Motif</th>
                    <th>Montant</th>
                    <th>Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {state.ledger.map((e, i) => (
                    <tr key={`${e.at}-${i}`}>
                      <td>{formatDate(e.at)}</td>
                      <td>{e.reason}</td>
                      <td className={`tabular ${e.amount >= 0 ? "is-gain" : "is-spend"}`}>
                        {e.amount >= 0 ? "+" : "−"}
                        {formatNumber(Math.abs(e.amount))} ✦
                      </td>
                      <td className="tabular">{formatNumber(e.balance)} ✦</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {state.prestige.history.length > 0 && (
          <section className="panel stats-section stats-section--wide">
            <h2 className="panel-title">Historique des prestiges</h2>
            <div className="table-scroll">
              <table className="odds-table">
                <thead>
                  <tr>
                    <th>Prestige</th>
                    <th>Date</th>
                    <th>Rolls de la partie</th>
                    <th>Auras possédées</th>
                    <th>Meilleure aura</th>
                  </tr>
                </thead>
                <tbody>
                  {[...state.prestige.history].reverse().map((h) => {
                    const a = h.bestAuraId ? getAura(h.bestAuraId) : undefined;
                    return (
                      <tr key={h.at}>
                        <td className="tabular">{h.level}</td>
                        <td>{formatDate(h.at)}</td>
                        <td className="tabular">{formatNumber(h.runRolls)}</td>
                        <td className="tabular">{h.collection}</td>
                        <td>{a ? <span style={{ color: a.visual.primary }}>{a.name}</span> : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
