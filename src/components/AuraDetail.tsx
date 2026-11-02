import type { CSSProperties } from "react";
import {
  SPECIAL_LABELS,
  distributionFor,
  echoFormIndex,
  echoRollsUntilChange,
  fusionMissing,
  getAura,
  getEvent,
  getRarity,
  isEventActive,
  isRollable,
  livingRolls,
  livingStageIndex,
  previewNextLuck,
  slotsFor,
  type Aura,
  type LayerSpec,
} from "../../shared";
import { useGame } from "../game/GameContext";
import { formatCountdown, formatDate, formatNumber, formatOddsN } from "../lib/format";
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
  ripple: "Ondulations",
};

/** Explication de la mécanique spéciale, avec l'état actuel pour ce joueur. */
function SpecialInfo({ aura, owned }: { aura: Aura; owned: boolean }) {
  const { state, now, setMimic, fuse, rolling, look } = useGame();
  const sp = aura.special;
  if (!sp) return null;
  const ctx = { rolls: state.stats.rolls, inventory: state.inventory, mimicOf: state.mimicOf };
  let body: JSX.Element;
  switch (sp.kind) {
    case "echo": {
      const i = echoFormIndex(aura, state.stats.rolls);
      body = (
        <p>
          Change de forme tous les {sp.every} rolls ({sp.forms.length} formes). Forme actuelle : <strong>{sp.forms[i].name}</strong>, prochaine
          dans {echoRollsUntilChange(aura, state.stats.rolls)} rolls.
        </p>
      );
      break;
    }
    case "living": {
      const i = livingStageIndex(aura, ctx);
      const next = sp.stages[i + 1];
      body = (
        <p>
          Grandit avec tes rolls (stade {i + 1}/{sp.stages.length}).{" "}
          {owned
            ? next
              ? `Prochain stade dans ${formatNumber(next.at - livingRolls(aura, ctx))} rolls.`
              : "Stade final atteint."
            : "Les stades comptent à partir de son obtention."}
        </p>
      );
      break;
    }
    case "mimic": {
      const choices = Object.keys(state.inventory)
        .map((id) => getAura(id)!)
        .filter((a) => a.special?.kind !== "mimic")
        .sort((a, b) => b.odds - a.odds);
      body = (
        <>
          <p>Copie l'apparence d'une autre aura que tu possèdes.</p>
          {owned && (
            <select className="select select--sm" value={state.mimicOf ?? ""} onChange={(e) => void setMimic(e.target.value || null)} aria-label="Aura copiée">
              <option value="">— Apparence d'origine —</option>
              {choices.map((a) => (
                <option key={a.id} value={a.id}>
                  {look(a).name}
                </option>
              ))}
            </select>
          )}
        </>
      );
      break;
    }
    case "seasonal": {
      const e = getEvent(sp.event);
      const active = isEventActive(e, now());
      body = (
        <p>
          Ne tombe que pendant l'événement <strong>{e.name}</strong> ({active ? "en cours !" : "pas en ce moment"}).
        </p>
      );
      break;
    }
    case "cursed": {
      const t = now();
      body = (
        <p>
          À chaque obtention : +{Math.round(sp.boonLuck * 100)} % de chance pendant {sp.boonMs / 1000} s, puis chance ×{sp.baneMul} pendant{" "}
          {sp.baneMs / 1000} s. L'Eau bénite lève la malédiction.
          {state.curse && t < state.curse.baneUntil && <> Malédiction active encore {formatCountdown(state.curse.baneUntil - t)}.</>}
        </p>
      );
      break;
    }
    case "fusion": {
      const missing = fusionMissing(state, aura);
      body = (
        <>
          <p>
            Ne tombe jamais en roll. Recette :{" "}
            {sp.ingredients.map((i) => `${i.count}× ${state.codex[i.auraId] ? getAura(i.auraId)!.name : "???"}`).join(" + ")} (garde au moins un
            exemplaire de chaque).
          </p>
          <button className="btn btn-sm btn-primary" disabled={missing.length > 0 || rolling} onClick={() => void fuse(aura.id)}>
            Fusionner
          </button>
        </>
      );
      break;
    }
  }
  return (
    <div className="detail__special">
      <span className="tag tag--special">{SPECIAL_LABELS[sp.kind]}</span>
      {body}
    </div>
  );
}

export function AuraDetail({ aura: base, onClose }: { aura: Aura; onClose: () => void }) {
  const { state, now, equip, level, look } = useGame();
  const aura = look(base);
  const entry = state.inventory[base.id];
  const codex = state.codex[base.id];
  const known = Boolean(codex);
  const equipped = state.equipped === base.id;
  const slotIndex = state.slots.indexOf(base.id);
  const extraSlots = slotsFor(level.level) - 1;
  const t = now();
  const luck = previewNextLuck(state, t);
  const p = distributionFor(luck, t).find((e) => e.aura.id === base.id)?.p ?? 0;
  const effects = [...new Set(aura.visual.layers.map((l) => LAYER_LABELS[l.type]))];

  return (
    <Modal title={known ? aura.name : "Aura inconnue"} onClose={onClose}>
      <div className="detail" style={{ "--c1": aura.visual.primary } as CSSProperties}>
        <div className="detail__preview">
          {known ? (
            <Avatar aura={aura} />
          ) : (
            <div className="detail__unknown">
              <span>?</span>
            </div>
          )}
        </div>
        <div className="detail__info">
          <RarityBadge rarity={base.rarity} />
          <h2 className="detail__name" style={{ color: known ? aura.visual.primary : undefined }}>
            {known ? aura.name : "???"}
          </h2>
          <p className="detail__desc">{known ? aura.description : "Cette aura n'a pas encore été découverte."}</p>

          <dl className="detail__stats">
            <div>
              <dt>Chance de base</dt>
              <dd className="tabular">{base.fallback ? "Commune (part restante)" : formatOddsN(base.odds)}</dd>
            </div>
            <div>
              <dt>Avec ta chance actuelle</dt>
              <dd className="tabular">{p > 0 ? `1 sur ${formatNumber(Math.round(1 / p))}` : isRollable(base, t) ? "—" : "Pas en roll actuellement"}</dd>
            </div>
            <div>
              <dt>Palier</dt>
              <dd>{getRarity(base.rarity).label}</dd>
            </div>
            {known && (
              <>
                <div>
                  <dt>Possédée (partie en cours)</dt>
                  <dd className="tabular">{entry ? `${formatNumber(entry.count)} fois` : "Non (prestige)"}</dd>
                </div>
                <div>
                  <dt>Obtenue au total</dt>
                  <dd className="tabular">{formatNumber(codex.total)} fois</dd>
                </div>
                <div>
                  <dt>Première découverte</dt>
                  <dd>{formatDate(codex.firstAt)}</dd>
                </div>
              </>
            )}
          </dl>

          {(known || base.special?.kind === "fusion" || base.special?.kind === "seasonal") && <SpecialInfo aura={base} owned={Boolean(entry)} />}

          {known && (
            <div className="detail__effects">
              {effects.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </div>
          )}
          {entry && (
            <div className="detail__actions">
              <button className={`btn ${equipped ? "" : "btn-primary"}`} onClick={() => void equip(equipped ? null : base.id)}>
                {equipped ? "Déséquiper" : "Équiper (principale)"}
              </button>
              {Array.from({ length: extraSlots }, (_, i) => i + 1).map((slot) => {
                const here = slotIndex === slot - 1;
                return (
                  <button key={slot} className="btn btn-sm" disabled={equipped} onClick={() => void equip(here ? null : base.id, slot)}>
                    {here ? `Retirer de l'emplacement ${slot + 1}` : `Emplacement ${slot + 1}`}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
