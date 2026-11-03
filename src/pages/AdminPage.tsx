import { useMemo, useState } from "react";
import {
  ADMIN_MAX_AURAS,
  AURAS,
  CURRENCY,
  POTIONS,
  POTION_IDS,
  getAura,
  getRarity,
  isAdmin,
  type AdminGrant,
  type AdminPlayerView,
  type PotionId,
} from "../../shared";
import { useGame } from "../game/GameContext";
import { formatNumber } from "../lib/format";
import "./AdminPage.css";

/** Auras triées de la plus rare à la plus commune (liste de choix). */
const AURA_CHOICES = [...AURAS].sort((a, b) => b.odds - a.odds);

const toInt = (v: string): number => {
  const n = Number(v.replace(/[\s_]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

/**
 * Panneau d'administration. Il n'est affiché qu'aux comptes admin, mais c'est le serveur qui
 * vérifie l'UID à chaque requête : un joueur qui ouvrirait #/admin ne pourrait rien faire.
 */
export function AdminPage() {
  const { user, state, send } = useGame();
  const [target, setTarget] = useState("");
  const [player, setPlayer] = useState<AdminPlayerView | null>(null);
  const [shards, setShards] = useState("");
  const [xp, setXp] = useState("");
  const [potions, setPotions] = useState<Partial<Record<PotionId, string>>>({});
  const [auras, setAuras] = useState<Record<string, number>>({});
  const [auraPick, setAuraPick] = useState(AURA_CHOICES[0]?.id ?? "");
  const [auraQty, setAuraQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const grant = useMemo<AdminGrant>(() => {
    const g: AdminGrant = {};
    if (toInt(shards)) g.shards = toInt(shards);
    if (toInt(xp)) g.xp = toInt(xp);
    for (const id of POTION_IDS) {
      const n = toInt(potions[id] ?? "");
      if (n) (g.potions ??= {})[id] = n;
    }
    if (Object.keys(auras).length) g.auras = auras;
    return g;
  }, [shards, xp, potions, auras]);
  const empty = !grant.shards && !grant.xp && !grant.potions && !grant.auras;

  if (!isAdmin(user.uid)) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Accès refusé</h1>
        </header>
      </div>
    );
  }

  const lookup = async (who = target) => {
    if (!who.trim()) return;
    setBusy(true);
    setStatus("");
    const res = await send({ action: "adminLookup", target: who.trim() });
    setBusy(false);
    if (res?.admin) {
      setPlayer(res.admin);
      setTarget(res.admin.name);
    }
  };

  const give = async () => {
    if (!player || empty) return;
    setBusy(true);
    setStatus("");
    const res = await send({ action: "adminGive", target: player.uid, grant });
    setBusy(false);
    if (res?.admin) {
      setPlayer(res.admin);
      setShards("");
      setXp("");
      setPotions({});
      setAuras({});
      setStatus(`Fait : compte de ${res.admin.name} mis à jour.`);
    }
  };

  const addAura = (sign: 1 | -1) => {
    const n = Math.min(ADMIN_MAX_AURAS, Math.max(1, toInt(auraQty))) * sign;
    if (!getAura(auraPick)) return;
    setAuras((prev) => {
      const next = { ...prev, [auraPick]: (prev[auraPick] ?? 0) + n };
      if (next[auraPick] === 0) delete next[auraPick];
      return next;
    });
  };

  return (
    <div className="page admin-page">
      <header className="page-header">
        <div>
          <h1>Administration</h1>
          <p>Donne ou retire des {CURRENCY.plural}, de l'XP, des potions et des auras à n'importe quel joueur. Un nombre négatif retire.</p>
        </div>
      </header>

      <section className="panel admin-section" aria-labelledby="admin-target">
        <h2 className="panel-title" id="admin-target">
          Joueur
        </h2>
        <form
          className="admin-row"
          onSubmit={(e) => {
            e.preventDefault();
            void lookup();
          }}
        >
          <input
            className="input"
            placeholder="Pseudo ou UID"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Pseudo ou UID du joueur"
            autoComplete="off"
          />
          <button className="btn btn-primary" type="submit" disabled={busy || !target.trim()}>
            Chercher
          </button>
          <button className="btn" type="button" disabled={busy} onClick={() => void lookup(state.name)}>
            Moi
          </button>
        </form>

        {player && (
          <div className="admin-player">
            <div className="admin-player__head">
              <strong>{player.name}</strong>
              <code className="admin-player__uid">{player.uid}</code>
            </div>
            <dl className="admin-stats">
              <div>
                <dt>{CURRENCY.plural}</dt>
                <dd className="tabular">{formatNumber(player.shards)}</dd>
              </div>
              <div>
                <dt>XP</dt>
                <dd className="tabular">{formatNumber(player.xp)}</dd>
              </div>
              <div>
                <dt>Rolls</dt>
                <dd className="tabular">{formatNumber(player.rolls)}</dd>
              </div>
              <div>
                <dt>Prestige</dt>
                <dd className="tabular">{player.prestige}</dd>
              </div>
            </dl>
            <p className="admin-muted">
              Potions :{" "}
              {Object.entries(player.potions)
                .map(([id, n]) => `${POTIONS[id as PotionId].name} ×${n}`)
                .join(", ") || "aucune"}
            </p>
            <p className="admin-muted">
              Auras : {Object.keys(player.auras).length} différentes,{" "}
              {formatNumber(Object.values(player.auras).reduce((a, b) => a + b, 0))} exemplaires
            </p>
          </div>
        )}
      </section>

      {player && (
        <section className="panel admin-section" aria-labelledby="admin-give">
          <h2 className="panel-title" id="admin-give">
            Donner à {player.name}
          </h2>

          <div className="admin-grid">
            <label className="admin-field">
              <span>{CURRENCY.plural}</span>
              <input className="input tabular" inputMode="numeric" placeholder="ex. 1000000 ou -500" value={shards} onChange={(e) => setShards(e.target.value)} />
            </label>
            <label className="admin-field">
              <span>XP</span>
              <input className="input tabular" inputMode="numeric" placeholder="ex. 50000" value={xp} onChange={(e) => setXp(e.target.value)} />
            </label>
          </div>

          <h3 className="admin-sub">Potions</h3>
          <div className="admin-grid admin-grid--potions">
            {POTION_IDS.map((id) => (
              <label key={id} className="admin-field">
                <span style={{ color: POTIONS[id].color }}>
                  {POTIONS[id].name} <em className="admin-muted">(a {player.potions[id] ?? 0})</em>
                </span>
                <input
                  className="input tabular"
                  inputMode="numeric"
                  placeholder="0"
                  value={potions[id] ?? ""}
                  onChange={(e) => setPotions((p) => ({ ...p, [id]: e.target.value }))}
                />
              </label>
            ))}
          </div>

          <h3 className="admin-sub">Auras</h3>
          <div className="admin-row">
            <select className="select" value={auraPick} onChange={(e) => setAuraPick(e.target.value)} aria-label="Aura">
              {AURA_CHOICES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {getRarity(a.rarity).label} (1/{formatNumber(a.odds)}) · a {player.auras[a.id] ?? 0}
                </option>
              ))}
            </select>
            <input className="input tabular admin-qty" inputMode="numeric" value={auraQty} onChange={(e) => setAuraQty(e.target.value)} aria-label="Quantité" />
            <button className="btn" type="button" onClick={() => addAura(1)}>
              + Ajouter
            </button>
            <button className="btn" type="button" onClick={() => addAura(-1)}>
              − Retirer
            </button>
          </div>
          {Object.keys(auras).length > 0 && (
            <ul className="admin-list">
              {Object.entries(auras).map(([id, n]) => (
                <li key={id}>
                  <span style={{ color: getRarity(getAura(id)!.rarity).color }}>{getAura(id)!.name}</span>
                  <span className="tabular">{n > 0 ? `+${n}` : n}</span>
                  <button
                    className="btn btn-sm"
                    type="button"
                    aria-label={`Enlever ${getAura(id)!.name} de la liste`}
                    onClick={() =>
                      setAuras((prev) => {
                        const next = { ...prev };
                        delete next[id];
                        return next;
                      })
                    }
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="admin-actions">
            <button className="btn btn-primary" type="button" disabled={busy || empty} onClick={() => void give()}>
              Appliquer
            </button>
            <span className="admin-muted" role="status" aria-live="polite">
              {status}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
