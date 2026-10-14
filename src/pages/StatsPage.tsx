import type { CSSProperties } from "react";
import {
  ACHIEVEMENTS,
  AURAS,
  RARITIES,
  computeDistribution,
  getAura,
  getRarity,
  previewNextLuck,
} from "../../shared";
import { AuraIcon } from "../components/AuraIcon";
import { RarityBadge } from "../components/RarityBadge";
import { useGame, useTick } from "../game/GameContext";
import { formatDate, formatDuration, formatLuck, formatNumber, formatOddsN } from "../lib/format";
import "./StatsPage.css";

export function StatsPage() {
  const { state, now } = useGame();
  useTick(1000);
  const { stats } = state;
  const best = stats.bestAuraId ? getAura(stats.bestAuraId) : undefined;
  const discovered = Object.keys(state.inventory).length;
  const luck = previewNextLuck(state, now());

  // Répartition des obtentions par palier
  const perTier = RARITIES.map((r) => ({
    rarity: r,
    count: AURAS.filter((a) => a.rarity === r.id).reduce((s, a) => s + (state.inventory[a.id]?.count ?? 0), 0),
  }));
  const maxCount = Math.max(1, ...perTier.map((t) => t.count));

  // Probabilité de chaque palier avec la chance actuelle
  const dist = computeDistribution(luck.total);
  const tierP = RARITIES.map((r) => dist.filter((e) => e.aura.rarity === r.id).reduce((s, e) => s + e.p, 0));

  const cards = [
    { label: "Rolls totaux", value: formatNumber(stats.rolls) },
    { label: "Auras découvertes", value: `${discovered} / ${AURAS.length}` },
    { label: "Temps de jeu", value: formatDuration(stats.playTimeMs) },
    { label: "Succès", value: `${Object.keys(state.achievements).length} / ${ACHIEVEMENTS.length}` },
    { label: "Série actuelle", value: formatNumber(stats.streak) },
    { label: "Meilleure série", value: formatNumber(stats.maxStreak) },
    { label: "Potions bues", value: formatNumber(stats.potionsUsed) },
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
                <span className="muted">Obtenue le {formatDate(state.inventory[best.id]?.firstAt ?? 0)}</span>
              </div>
            </div>
          ) : (
            <p className="muted">Aucune aura pour l'instant.</p>
          )}

          <h2 className="panel-title" style={{ marginTop: 26 }}>
            Obtentions par rareté
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
              {RARITIES.map((r, i) => {
                const base = computeDistribution(1)
                  .filter((e) => e.aura.rarity === r.id)
                  .reduce((s, e) => s + e.p, 0);
                return (
                  <tr key={r.id}>
                    <td>
                      <RarityBadge rarity={r.id} />
                    </td>
                    <td className="tabular">{base > 0 ? `1 sur ${formatNumber(Math.round(1 / base))}` : "—"}</td>
                    <td className="tabular">{tierP[i] > 0 ? `1 sur ${formatNumber(Math.max(1, Math.round(1 / tierP[i])))}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted">
            Chaque aura rare reçoit « chance ÷ N ». Les auras communes se partagent ce qui reste : plus ta chance est élevée,
            moins tu en obtiens.
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
          <p className="muted">
            Palier le plus élevé atteint : {best ? getRarity(best.rarity).label : "—"}
          </p>
        </section>
      </div>
    </div>
  );
}
