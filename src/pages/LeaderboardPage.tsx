import { useCallback, useEffect, useState } from "react";
import { ACHIEVEMENTS, AURAS, getAura } from "../../shared";
import { backend, type LeaderboardCategory, type LeaderboardRow } from "../backend";
import { AuraIcon } from "../components/AuraIcon";
import { Icon } from "../components/Icon";
import { RarityBadge } from "../components/RarityBadge";
import { useGame } from "../game/GameContext";
import { formatNumber, formatOddsN } from "../lib/format";
import "./LeaderboardPage.css";

const TABS: { id: LeaderboardCategory; label: string }[] = [
  { id: "rolls", label: "Rolls" },
  { id: "bestOdds", label: "Aura la plus rare" },
  { id: "collection", label: "Collection" },
  { id: "achievements", label: "Succès" },
];

const LIMIT = 50;

function MainValue({ row, tab }: { row: LeaderboardRow; tab: LeaderboardCategory }) {
  switch (tab) {
    case "rolls":
      return <>{formatNumber(row.rolls)} rolls</>;
    case "collection":
      return <>{row.collection} / {AURAS.length} auras</>;
    case "achievements":
      return <>{row.achievements} / {ACHIEVEMENTS.length} succès</>;
    case "bestOdds": {
      const aura = row.bestAuraId ? getAura(row.bestAuraId) : undefined;
      return aura ? (
        <span className="lb-best">
          <strong style={{ color: aura.visual.primary }}>{aura.name}</strong>
          <RarityBadge rarity={aura.rarity} />
          <span className="tabular">{formatOddsN(aura.odds)}</span>
        </span>
      ) : (
        <>—</>
      );
    }
  }
}

export function LeaderboardPage() {
  const { user } = useGame();
  const [tab, setTab] = useState<LeaderboardCategory>("rolls");
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (category: LeaderboardCategory) => {
    setRows(null);
    setError(null);
    try {
      setRows(await backend.leaderboard(category, LIMIT));
    } catch {
      setError("Impossible de charger le classement.");
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Classement</h1>
          <p>
            {backend.kind === "local"
              ? "Mode local : seuls les joueurs de ce navigateur apparaissent."
              : "Top 50 mondial. Les scores sont calculés uniquement par le serveur."}
          </p>
        </div>
        <button className="btn btn-sm" onClick={() => void load(tab)}>
          <Icon name="repeat" size={15} /> Actualiser
        </button>
      </header>

      <div className="lb-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`lb-tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel lb-panel" role="tabpanel">
        {error && <p className="empty">{error}</p>}
        {!error && rows === null && <p className="empty">Chargement…</p>}
        {rows?.length === 0 && <p className="empty">Personne n'est encore classé. Sois le premier !</p>}
        {rows && rows.length > 0 && (
          <ol className="lb-list">
            {rows.map((row, i) => {
              const equipped = row.equipped ? getAura(row.equipped) : undefined;
              const me = row.uid === user.uid;
              return (
                <li key={row.uid} className={`lb-row ${me ? "is-me" : ""} rank-${i + 1}`}>
                  <span className="lb-rank tabular">{i + 1}</span>
                  <span className="lb-avatar">
                    {equipped ? (
                      <AuraIcon aura={equipped} size={40} animated={i < 3} />
                    ) : (
                      <span className="lb-avatar__plain">{row.name.slice(0, 1).toUpperCase()}</span>
                    )}
                  </span>
                  <span className="lb-name">
                    {row.name}
                    {me && <span className="lb-me">toi</span>}
                    <span className="lb-sub tabular">
                      {formatNumber(row.rolls)} rolls · {row.collection} auras · {row.achievements} succès
                    </span>
                  </span>
                  <span className="lb-value tabular">
                    <MainValue row={row} tab={tab} />
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
