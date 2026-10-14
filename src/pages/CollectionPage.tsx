import { useState, type CSSProperties } from "react";
import { AURAS, RARITIES, type Aura } from "../../shared";
import { AuraDetail } from "../components/AuraDetail";
import { AuraIcon } from "../components/AuraIcon";
import { useGame } from "../game/GameContext";
import { formatOddsN } from "../lib/format";
import "./CollectionPage.css";

export function CollectionPage() {
  const { state } = useGame();
  const [selected, setSelected] = useState<Aura | null>(null);
  const discovered = Object.keys(state.inventory).length;
  const pct = (discovered / AURAS.length) * 100;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Collection</h1>
          <p>Toutes les auras du jeu. Les silhouettes attendent encore d'être découvertes.</p>
        </div>
        <div className="collection-total">
          <span className="collection-total__value tabular">
            {discovered}
            <small>/{AURAS.length}</small>
          </span>
          <div className="progress">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      {RARITIES.map((r) => {
        const auras = AURAS.filter((a) => a.rarity === r.id).sort((a, b) => a.odds - b.odds);
        const found = auras.filter((a) => state.inventory[a.id]).length;
        return (
          <section key={r.id} className="tier-section" style={{ "--rc": r.color } as CSSProperties}>
            <header className="tier-section__head">
              <h2>{r.label}</h2>
              <span className="tier-section__range">dès {formatOddsN(r.minOdds)}</span>
              <span className="tier-section__count tabular">
                {found}/{auras.length}
              </span>
            </header>
            <ul className="coll-grid">
              {auras.map((a) => {
                const owned = Boolean(state.inventory[a.id]);
                return (
                  <li key={a.id}>
                    <button
                      className={`coll-tile ${owned ? "" : "is-locked"}`}
                      onClick={() => setSelected(a)}
                      aria-label={owned ? a.name : `Aura ${r.label} non découverte`}
                    >
                      <AuraIcon aura={a} size={72} locked={!owned} />
                      <span className="coll-tile__name" style={{ color: owned ? a.visual.primary : undefined }}>
                        {owned ? a.name : "???"}
                      </span>
                      <span className="coll-tile__odds tabular">{a.fallback ? "Commune" : formatOddsN(a.odds)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {selected && <AuraDetail aura={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
