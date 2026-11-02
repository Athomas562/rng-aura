import type { CSSProperties } from "react";
import { claimableCount, getCosmetic, getTitle } from "../../shared";
import { Icon } from "../components/Icon";
import { useGame } from "../game/GameContext";
import { NAV_GROUPS, PAGE_LABELS, groupOf, keyLabel, pageShortcut, type PageId } from "../settings/settings";
import { useSettings } from "../settings/SettingsContext";
import "./Nav.css";

/** Navigation regroupée en 5 entrées : Jouer, Boutique, Progression, Classement, Paramètres. */
export function Nav({ page, onNavigate, lastOf }: { page: PageId; onNavigate: (p: PageId) => void; lastOf: (g: string) => PageId | undefined }) {
  const { state, user, now } = useGame();
  const { settings } = useSettings();
  const claimable = claimableCount(state, now());
  const title = state.title ? getTitle(state.title) : undefined;
  const current = groupOf(page).id;
  const frame = state.cosmetics.frame ? getCosmetic(state.cosmetics.frame) : null;

  return (
    <nav className="nav" aria-label="Navigation principale">
      <div className="nav__brand">
        <span className="nav__logo" aria-hidden="true" />
        <span className="nav__title">
          RNG <strong>AURA</strong>
        </span>
      </div>
      <ul className="nav__list">
        {NAV_GROUPS.map((g) => {
          const target = lastOf(g.id) ?? g.pages[0];
          const active = current === g.id;
          const key = pageShortcut(g.pages[0], settings.keybinds);
          return (
            <li key={g.id}>
              <button
                className={`nav__item ${active ? "is-active" : ""}`}
                onClick={() => onNavigate(active ? g.pages[0] : target)}
                aria-current={active ? "page" : undefined}
                title={key ? `${g.label} (${keyLabel(key)})` : g.label}
              >
                <Icon name={g.icon} size={20} />
                <span className="nav__label">{g.label}</span>
                {g.id === "progress" && claimable > 0 && (
                  <span className="nav__badge tabular" aria-label={`${claimable} récompense(s) à réclamer`}>
                    {claimable}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="nav__user">
        <span
          className={`nav__avatar ${frame ? `has-frame frame-${frame.id}` : ""}`}
          style={frame ? ({ "--f1": frame.colors[0], "--f2": frame.colors[1] ?? frame.colors[0] } as CSSProperties) : undefined}
        >
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="nav__who">
          <span className="nav__username">{state.name}</span>
          {title && (
            <span className="nav__title-tag" style={{ color: title.color }}>
              {title.name}
            </span>
          )}
        </span>
        {state.prestige.level > 0 && (
          <span className="nav__prestige tabular" title={`Prestige ${state.prestige.level}`}>
            ✦{state.prestige.level}
          </span>
        )}
      </div>
    </nav>
  );
}

/** Sous-onglets du groupe courant + titre d'écran (fil d'Ariane). */
export function SubNav({ page, onNavigate }: { page: PageId; onNavigate: (p: PageId) => void }) {
  const { settings } = useSettings();
  const group = groupOf(page);
  return (
    <div className="subnav">
      <nav className="breadcrumb" aria-label="Fil d'Ariane">
        <span>{group.label}</span>
        {group.pages.length > 1 && (
          <>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{PAGE_LABELS[page]}</span>
          </>
        )}
      </nav>
      {group.pages.length > 1 && (
        <div className="subnav__tabs" role="tablist" aria-label={`Sections : ${group.label}`}>
          {group.pages.map((p) => {
            const key = pageShortcut(p, settings.keybinds);
            return (
              <button
                key={p}
                role="tab"
                aria-selected={p === page}
                className={`subnav__tab ${p === page ? "is-active" : ""}`}
                onClick={() => onNavigate(p)}
                title={key ? `${PAGE_LABELS[p]} (${keyLabel(key)})` : PAGE_LABELS[p]}
              >
                {PAGE_LABELS[p]}
                {key && <kbd>{keyLabel(key)}</kbd>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
