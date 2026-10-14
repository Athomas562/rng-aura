import type { CSSProperties } from "react";
import { getRarity, previewNextLuck, probabilityOf, type Aura, type LayerSpec } from "../../shared";
import { useGame } from "../game/GameContext";
import { formatDate, formatNumber, formatOddsN } from "../lib/format";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import { RarityBadge } from "./RarityBadge";
import "./AuraDetail.css";

const LAYER_LABELS: Record<LayerSpec["type"], string> = {
  halo: "Halo",
  particles: "Particules",
  rings: "Anneaux",
  lightning: "Éclairs",
  rays: "Rayons",
  starfield: "Champ d'étoiles",
  void: "Vide",
  glitch: "Distorsion",
};

export function AuraDetail({ aura, onClose }: { aura: Aura; onClose: () => void }) {
  const { state, now, equip } = useGame();
  const entry = state.inventory[aura.id];
  const equipped = state.equipped === aura.id;
  const luck = previewNextLuck(state, now()).total;
  const p = probabilityOf(aura.id, luck);
  const effects = [...new Set(aura.visual.layers.map((l) => LAYER_LABELS[l.type]))];

  return (
    <Modal title={entry ? aura.name : "Aura inconnue"} onClose={onClose}>
      <div className="detail" style={{ "--c1": aura.visual.primary } as CSSProperties}>
        <div className="detail__preview">
          {entry ? (
            <Avatar aura={aura} />
          ) : (
            <div className="detail__unknown">
              <span>?</span>
            </div>
          )}
        </div>
        <div className="detail__info">
          <RarityBadge rarity={aura.rarity} />
          <h2 className="detail__name" style={{ color: entry ? aura.visual.primary : undefined }}>
            {entry ? aura.name : "???"}
          </h2>
          <p className="detail__desc">{entry ? aura.description : "Cette aura n'a pas encore été découverte."}</p>

          <dl className="detail__stats">
            <div>
              <dt>Chance de base</dt>
              <dd className="tabular">{aura.fallback ? "Commune (part restante)" : formatOddsN(aura.odds)}</dd>
            </div>
            <div>
              <dt>Avec ta chance actuelle</dt>
              <dd className="tabular">{p > 0 ? `1 sur ${formatNumber(Math.round(1 / p))}` : "—"}</dd>
            </div>
            <div>
              <dt>Palier</dt>
              <dd>{getRarity(aura.rarity).label}</dd>
            </div>
            {entry && (
              <>
                <div>
                  <dt>Obtenue</dt>
                  <dd className="tabular">{formatNumber(entry.count)} fois</dd>
                </div>
                <div>
                  <dt>Première obtention</dt>
                  <dd>{formatDate(entry.firstAt)}</dd>
                </div>
                <div>
                  <dt>Dernière obtention</dt>
                  <dd>{formatDate(entry.lastAt)}</dd>
                </div>
              </>
            )}
          </dl>

          {entry && (
            <>
              <div className="detail__effects">
                {effects.map((e) => (
                  <span key={e}>{e}</span>
                ))}
              </div>
              <button className={`btn ${equipped ? "" : "btn-primary"}`} onClick={() => void equip(equipped ? null : aura.id)}>
                {equipped ? "Déséquiper" : "Équiper cette aura"}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
