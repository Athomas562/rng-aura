import { useMemo, useState } from "react";
import { AURAS, RARITIES, getRarity, type Aura, type RarityId } from "../../shared";
import { AuraDetail } from "../components/AuraDetail";
import { AuraIcon } from "../components/AuraIcon";
import { Icon } from "../components/Icon";
import { RarityBadge } from "../components/RarityBadge";
import { useGame } from "../game/GameContext";
import { formatDate, formatDay, formatNumber } from "../lib/format";
import "./InventoryPage.css";

type Sort = "rarity-desc" | "rarity-asc" | "first" | "recent" | "count" | "name";

const SORTS: { id: Sort; label: string }[] = [
  { id: "rarity-desc", label: "Rareté (plus rare d'abord)" },
  { id: "rarity-asc", label: "Rareté (plus commune d'abord)" },
  { id: "first", label: "Ordre d'obtention" },
  { id: "recent", label: "Obtenue récemment" },
  { id: "count", label: "Nombre d'obtentions" },
  { id: "name", label: "Nom" },
];

export function InventoryPage() {
  const { state } = useGame();
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState<RarityId | "all">("all");
  const [sort, setSort] = useState<Sort>("rarity-desc");
  const [showMissing, setShowMissing] = useState(false);
  const [selected, setSelected] = useState<Aura | null>(null);

  const ownedCount = Object.keys(state.inventory).length;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inv = state.inventory;
    const items = AURAS.filter((a) => {
      const owned = Boolean(inv[a.id]);
      if (!owned && !showMissing) return false;
      if (rarity !== "all" && a.rarity !== rarity) return false;
      // Le nom d'une aura non découverte reste secret : la recherche ne la révèle pas.
      if (q && !(owned && a.name.toLowerCase().includes(q))) return false;
      return true;
    });
    const tier = (a: Aura) => getRarity(a.rarity).tier;
    const cmp: Record<Sort, (a: Aura, b: Aura) => number> = {
      "rarity-desc": (a, b) => b.odds - a.odds,
      "rarity-asc": (a, b) => a.odds - b.odds,
      first: (a, b) => (inv[a.id]?.firstAt ?? Infinity) - (inv[b.id]?.firstAt ?? Infinity),
      recent: (a, b) => (inv[b.id]?.lastAt ?? 0) - (inv[a.id]?.lastAt ?? 0),
      count: (a, b) => (inv[b.id]?.count ?? 0) - (inv[a.id]?.count ?? 0),
      name: (a, b) => a.name.localeCompare(b.name, "fr"),
    };
    return items.sort((a, b) => cmp[sort](a, b) || tier(b) - tier(a));
  }, [state.inventory, search, rarity, sort, showMissing]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Inventaire</h1>
          <p>
            {ownedCount} aura{ownedCount > 1 ? "s" : ""} obtenue{ownedCount > 1 ? "s" : ""} sur {AURAS.length} ·{" "}
            {AURAS.length - ownedCount} manquante{AURAS.length - ownedCount > 1 ? "s" : ""}
          </p>
        </div>
      </header>

      <div className="filters panel">
        <label className="filters__search">
          <Icon name="search" size={16} />
          <input
            className="input"
            type="search"
            placeholder="Rechercher une aura…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher une aura par son nom"
          />
        </label>
        <select className="select" value={rarity} onChange={(e) => setRarity(e.target.value as RarityId | "all")} aria-label="Filtrer par rareté">
          <option value="all">Toutes les raretés</option>
          {RARITIES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Trier">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="toggle">
          <input type="checkbox" checked={showMissing} onChange={(e) => setShowMissing(e.target.checked)} />
          <span className="toggle__track" />
          Afficher les manquantes
        </label>
      </div>

      {list.length === 0 ? (
        <p className="empty">{ownedCount === 0 ? "Ton inventaire est vide. Lance un roll !" : "Aucune aura ne correspond à ces filtres."}</p>
      ) : (
        <ul className="inv-grid">
          {list.map((a) => {
            const entry = state.inventory[a.id];
            const equipped = state.equipped === a.id;
            return (
              <li key={a.id}>
                <button className={`inv-card ${entry ? "" : "is-missing"} ${equipped ? "is-equipped" : ""}`} onClick={() => setSelected(a)}>
                  {equipped && <span className="inv-card__equipped">Équipée</span>}
                  <AuraIcon aura={a} size={64} locked={!entry} />
                  <span className="inv-card__name" style={{ color: entry ? a.visual.primary : undefined }}>
                    {entry ? a.name : "???"}
                  </span>
                  <RarityBadge rarity={a.rarity} />
                  <span className="inv-card__meta tabular">
                    {entry ? (
                      <>
                        ×{formatNumber(entry.count)}
                        <span title={`Première obtention : ${formatDate(entry.firstAt)}`}> · {formatDay(entry.firstAt)}</span>
                      </>
                    ) : (
                      "Non découverte"
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && <AuraDetail aura={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
