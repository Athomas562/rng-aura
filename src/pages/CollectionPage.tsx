import { useState, type CSSProperties } from "react";
import { AURAS, RARITIES, SPECIAL_LABELS, oddsRange, type Aura } from "../../shared";
import { AuraDetail } from "../components/AuraDetail";
import { AuraIcon } from "../components/AuraIcon";
import { useGame } from "../game/GameContext";
import { formatOddsN } from "../lib/format";
import "./CollectionPage.css";

export function CollectionPage() {
  const { state, look } = useGame();
  const [selected, setSelected] = useState<Aura | null>(null);
  const discovered = Object.keys(state.codex).length;
  const pct = (discovered / AURAS.length) * 100;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Collection</h1>
          <p>Toutes les auras du jeu. Le codex garde tes découvertes, même après un prestige ; les silhouettes attendent encore.</p>
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
        const found = auras.filter((a) => state.codex[a.id]).length;
        const [min, max] = oddsRange(r.id);
        return (
          <section key={r.id} className={`tier-section rarity-${r.id}`} style={{ "--rc": r.color } as CSSProperties}>
            <header className="tier-section__head">
              <h2>{r.label}</h2>
              <span className="tier-section__range">
                {r.branch ? `de ${formatOddsN(min)} à ${formatOddsN(max)}` : `dès ${formatOddsN(r.minOdds)}`}
              </span>
              <span className="tier-section__count tabular">
                {found}/{auras.length}
              </span>
            </header>
            <ul className="coll-grid">
              {auras.map((base) => {
                const known = Boolean(state.codex[base.id]);
                const owned = Boolean(state.inventory[base.id]);
                const a = look(base);
                return (
                  <li key={a.id}>
                    <button
                      className={`coll-tile ${known ? "" : "is-locked"} ${known && !owned ? "is-past" : ""}`}
                      onClick={() => setSelected(base)}
                      aria-label={known ? a.name : `Aura ${r.label} non découverte`}
                    >
                      <AuraIcon aura={a} size={72} locked={!known} />
                      <span className="coll-tile__name" style={{ color: known ? a.visual.primary : undefined }}>
                        {known ? a.name : "???"}
                      </span>
                      <span className="coll-tile__odds tabular">
                        {a.special?.kind === "fusion" ? "Fusion" : a.fallback ? "Commune" : formatOddsN(a.odds)}
                      </span>
                      {a.special && <span className="coll-tile__special">{SPECIAL_LABELS[a.special.kind]}</span>}
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
