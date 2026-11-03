import { useState, type CSSProperties } from "react";
import {
  COSMETICS,
  CURRENCY,
  MAX_POTIONS_PER_PURCHASE,
  POTIONS,
  POTION_IDS,
  POTION_PACKS,
  POTION_PRICES,
  potionPrice,
  POTION_STOCK_LIMIT,
  UPGRADES,
  blessedEvery,
  computeLuck,
  getRollCooldownMs,
  slotCount,
  streakCap,
  upgradePotionDurationMul,
  talentPotionDurationMul,
  type Cosmetic,
  type PlayerState,
  type PotionId,
  type ShopCategory,
  type Upgrade,
} from "../../shared";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { useGame } from "../game/GameContext";
import { useSettings } from "../settings/SettingsContext";
import { formatNumber } from "../lib/format";
import "./ShopPage.css";

const CATEGORIES: { id: ShopCategory | "all"; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "recharge", label: "Recharge" },
  { id: "chance", label: "Chance" },
  { id: "potions", label: "Potions" },
  { id: "cosmetique", label: "Cosmétique" },
];

const fmt = (n: number, digits = 2) => n.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/**
 * Effet chiffré « avant → après » d'un niveau d'amélioration, calculé avec les
 * mêmes fonctions que le serveur (aucune formule dupliquée).
 */
export function upgradeEffect(u: Upgrade, s: PlayerState, now: number): { label: string; before: string; after: string | null } {
  const level = s.upgrades[u.id] ?? 0;
  const next: PlayerState | null = level < u.maxLevel ? { ...s, upgrades: { ...s.upgrades, [u.id]: level + 1 } } : null;
  switch (u.id) {
    case "clockwork": {
      const v = (x: PlayerState) => `${fmt(getRollCooldownMs(x, 0) / 1000)} s`;
      return { label: "Recharge", before: v(s), after: next && v(next) };
    }
    case "clover": {
      const v = (x: PlayerState) => `×${fmt(computeLuck({ ...x, potions: { ...x.potions, active: {}, pendingBlessings: 0 }, curse: null }, now, 1, 1).total)}`;
      return { label: "Chance de base", before: v(s), after: next && v(next) };
    }
    case "tenacity": {
      const v = (x: PlayerState) => `+${Math.round(streakCap(x) * 100)} %`;
      return { label: "Plafond de série", before: v(s), after: next && v(next) };
    }
    case "halo": {
      const v = (x: PlayerState) => `1 roll sur ${blessedEvery(x)}`;
      return { label: "Roll béni", before: v(s), after: next && v(next) };
    }
    case "alembic": {
      const v = (x: PlayerState) => `×${fmt(talentPotionDurationMul(x.talents) * upgradePotionDurationMul(x.upgrades))}`;
      return { label: "Durée des potions", before: v(s), after: next && v(next) };
    }
    case "slot": {
      const v = (x: PlayerState) => `${slotCount(x)} emplacement${slotCount(x) > 1 ? "s" : ""}`;
      return { label: "Emplacements d'aura", before: v(s), after: next && v(next) };
    }
  }
}

type Feedback = Record<string, "ok" | "fail" | undefined>;

/** Bouton d'achat : flash vert si le serveur accepte, secousse rouge sinon. */
function BuyButton({
  id,
  price,
  disabled,
  reason,
  feedback,
  onBuy,
  label = "Acheter",
}: {
  id: string;
  price: number;
  disabled: boolean;
  reason?: string;
  feedback: Feedback;
  onBuy: () => void;
  label?: string;
}) {
  const state = feedback[id];
  return (
    <button
      className={`btn btn-sm buy-btn ${state === "ok" ? "is-success" : state === "fail" ? "is-fail" : ""} ${disabled ? "" : "btn-primary"}`}
      onClick={onBuy}
      aria-disabled={disabled}
      title={reason}
    >
      {label} · <span className="tabular">{formatNumber(price)}</span> <span aria-hidden="true">✦</span>
      <span className="sr-only"> {CURRENCY.plural}</span>
    </button>
  );
}

export function ShopPage() {
  const { state, now, buy, wear } = useGame();
  const { settings } = useSettings();
  const [category, setCategory] = useState<ShopCategory | "all">("all");
  const [feedback, setFeedback] = useState<Feedback>({});
  const [qty, setQty] = useState<Partial<Record<PotionId, number>>>({});
  const t = now();

  /** Lance l'achat ; un achat impossible (solde, maximum) secoue le bouton sans appeler le serveur. */
  const attempt = async (key: string, blocked: boolean, run: () => Promise<boolean>) => {
    const ok = blocked ? false : await run();
    setFeedback((f) => ({ ...f, [key]: ok ? "ok" : "fail" }));
    setTimeout(() => setFeedback((f) => ({ ...f, [key]: undefined })), 700);
  };

  const show = (c: ShopCategory) => category === "all" || category === c;
  const trailOff = state.cosmetics.trail
    ? settings.reducedMotion
      ? "« Réduire les animations » est activé"
      : settings.calmMode
        ? "le mode calme est activé"
        : !settings.cursorTrail
          ? "le réglage « Traînée du curseur » est désactivé"
          : null
    : null;
  const upgrades = UPGRADES.filter((u) => show(u.category));

  return (
    <div className="page shop-page">
      <header className="page-header">
        <div>
          <h1>Boutique</h1>
          <p>
            Dépense tes {CURRENCY.plural}, gagnés à chaque roll, en améliorations permanentes, potions et cosmétiques. Le serveur vérifie chaque
            achat.
          </p>
        </div>
        <div className="shop-balance" aria-label={`Solde : ${formatNumber(state.shards)} ${CURRENCY.plural}`}>
          <span className="shop-balance__gem" aria-hidden="true">
            ✦
          </span>
          <AnimatedNumber value={state.shards} className="shop-balance__value tabular" />
          <span className="shop-balance__unit">{CURRENCY.plural}</span>
        </div>
      </header>

      <div className="shop-filters" role="group" aria-label="Filtrer par catégorie">
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`chip ${category === c.id ? "is-active" : ""}`} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {upgrades.length > 0 && (
        <section aria-labelledby="shop-upgrades">
          <h2 id="shop-upgrades" className="shop-heading">
            Améliorations permanentes
          </h2>
          <p className="muted shop-note">Remises à zéro par la renaissance (prestige), comme le solde d'{CURRENCY.plural}.</p>
          <ul className="shop-grid">
            {upgrades.map((u) => {
              const level = state.upgrades[u.id] ?? 0;
              const maxed = level >= u.maxLevel;
              const cost = maxed ? 0 : u.cost(level);
              const poor = !maxed && state.shards < cost;
              const effect = upgradeEffect(u, state, t);
              const status = maxed ? "Niveau maximal" : poor ? `Il manque ${formatNumber(cost - state.shards)} ✦` : "Achetable";
              return (
                <li key={u.id} className={`shop-card panel ${maxed ? "is-maxed" : poor ? "is-poor" : "is-ready"}`}>
                  <div className="shop-card__head">
                    <h3>{u.name}</h3>
                    <span className="shop-card__level tabular" aria-label={`Niveau ${level} sur ${u.maxLevel}`}>
                      {level}/{u.maxLevel}
                    </span>
                  </div>
                  <p className="shop-card__desc">{u.description}</p>
                  <div className="shop-card__pips" aria-hidden="true">
                    {Array.from({ length: Math.min(u.maxLevel, 20) }, (_, i) => (
                      <span key={i} className={i < level ? "is-on" : ""} />
                    ))}
                  </div>
                  <p className="shop-card__effect">
                    {effect.label} : <strong>{effect.before}</strong>
                    {effect.after && (
                      <>
                        {" "}
                        <span aria-hidden="true">→</span>
                        <span className="sr-only"> passe à </span> <strong className="shop-card__next">{effect.after}</strong>
                      </>
                    )}
                  </p>
                  <div className="shop-card__foot">
                    <span className={`shop-card__status ${poor ? "is-poor" : ""}`}>{status}</span>
                    {!maxed && (
                      <BuyButton
                        id={u.id}
                        price={cost}
                        disabled={poor}
                        reason={status}
                        feedback={feedback}
                        onBuy={() => void attempt(u.id, poor, () => buy("upgrade", u.id))}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {show("potions") && (
        <section aria-labelledby="shop-potions">
          <h2 id="shop-potions" className="shop-heading">
            Potions à l'unité
          </h2>
          <ul className="shop-grid shop-grid--compact">
            {POTION_IDS.map((id) => {
              const p = POTIONS[id];
              const n = qty[id] ?? 1;
              const price = potionPrice(id, n);
              const pack = POTION_PACKS[id];
              const owned = state.potions.owned[id];
              const full = owned + n > POTION_STOCK_LIMIT;
              const poor = state.shards < price;
              const key = `potion-${id}`;
              return (
                <li key={id} className={`shop-card panel ${full || poor ? "is-poor" : "is-ready"}`} style={{ "--pc": p.color } as CSSProperties}>
                  <div className="shop-card__head">
                    <h3 style={{ color: p.color }}>{p.name}</h3>
                    <span className="shop-card__level tabular" aria-label={`En stock : ${owned}`}>
                      ×{owned}
                    </span>
                  </div>
                  <p className="shop-card__desc">{p.description}</p>
                  <p className="shop-card__effect">
                    {formatNumber(POTION_PRICES[id])} ✦ l'unité
                    {pack && (
                      <>
                        {" "}
                        · lot de {pack.quantity} : <strong className="shop-card__next">{formatNumber(pack.price)} ✦</strong> (−
                        {Math.round((1 - pack.price / (POTION_PRICES[id] * pack.quantity)) * 100)} %)
                      </>
                    )}
                  </p>
                  <div className="shop-card__foot">
                    <label className="qty">
                      <span className="sr-only">Quantité</span>
                      <select className="select select--sm" value={n} onChange={(e) => setQty((q) => ({ ...q, [id]: Number(e.target.value) }))}>
                        {Array.from({ length: MAX_POTIONS_PER_PURCHASE }, (_, i) => i + 1).map((v) => (
                          <option key={v} value={v}>
                            ×{v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <BuyButton
                      id={key}
                      price={price}
                      disabled={poor || full}
                      reason={full ? `Stock maximal : ${POTION_STOCK_LIMIT}` : poor ? `Il manque ${formatNumber(price - state.shards)} ✦` : undefined}
                      feedback={feedback}
                      onBuy={() => void attempt(key, poor || full, () => buy("potion", id, n))}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {show("cosmetique") && (
        <section aria-labelledby="shop-cosmetics">
          <h2 id="shop-cosmetics" className="shop-heading">
            Cosmétiques
          </h2>
          <p className="muted shop-note">Achetés une fois pour toutes : ils ne sont pas remis à zéro par la renaissance.</p>
          {trailOff && (
            <p className="shop-warning" role="note">
              Ta traînée est portée mais invisible : {trailOff}. Tu peux changer ça dans les Paramètres (Affichage et accessibilité). Elle ne
              s'affiche qu'à la souris, pas sur écran tactile.
            </p>
          )}
          <ul className="shop-grid shop-grid--compact">
            {COSMETICS.map((c: Cosmetic) => {
              const owned = Boolean(state.cosmetics.owned[c.id]);
              const worn = state.cosmetics[c.kind] === c.id;
              const poor = !owned && state.shards < c.price;
              return (
                <li key={c.id} className={`shop-card panel cosmetic ${owned ? "is-owned" : poor ? "is-poor" : "is-ready"}`}>
                  <span
                    className={`cosmetic__preview cosmetic__preview--${c.kind}`}
                    style={{ "--c1": c.colors[0], "--c2": c.colors[1] ?? c.colors[0], "--c3": c.colors[2] ?? c.colors[0] } as CSSProperties}
                    aria-hidden="true"
                  />
                  <div className="shop-card__head">
                    <h3>{c.name}</h3>
                    <span className="tag tag--muted">{c.kind === "trail" ? "Traînée" : "Cadre"}</span>
                  </div>
                  <p className="shop-card__desc">{c.description}</p>
                  <div className="shop-card__foot">
                    {owned ? (
                      <button className={`btn btn-sm ${worn ? "" : "btn-primary"}`} aria-pressed={worn} onClick={() => void wear(c.kind, worn ? null : c.id)}>
                        {worn ? "Retirer" : "Porter"}
                      </button>
                    ) : (
                      <BuyButton
                        id={c.id}
                        price={c.price}
                        disabled={poor}
                        reason={poor ? `Il manque ${formatNumber(c.price - state.shards)} ✦` : undefined}
                        feedback={feedback}
                        onBuy={() => void attempt(c.id, poor, () => buy("cosmetic", c.id))}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
