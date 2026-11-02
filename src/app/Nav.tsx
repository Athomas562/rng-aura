import { AURAS, claimableCount, getTitle } from "../../shared";
import { Icon } from "../components/Icon";
import { useGame } from "../game/GameContext";
import { NAV_ORDER, PAGE_LABELS, keyLabel, pageShortcut, type PageId } from "../settings/settings";
import { useSettings } from "../settings/SettingsContext";
import "./Nav.css";

export function Nav({ page, onNavigate }: { page: PageId; onNavigate: (p: PageId) => void }) {
  const { state, user, now, level } = useGame();
  const { settings } = useSettings();
  const discovered = Object.keys(state.codex).length;
  const claimable = claimableCount(state, now());
  const title = state.title ? getTitle(state.title) : undefined;

  return (
    <nav className="nav" aria-label="Navigation principale">
      <div className="nav__brand">
        <span className="nav__logo" aria-hidden="true" />
        <span className="nav__title">
          RNG <strong>AURA</strong>
        </span>
      </div>
      <ul className="nav__list">
        {NAV_ORDER.map((id) => {
          const key = pageShortcut(id, settings.keybinds);
          return (
            <li key={id}>
              <button
                className={`nav__item ${page === id ? "is-active" : ""}`}
                onClick={() => onNavigate(id)}
                aria-current={page === id ? "page" : undefined}
                title={key ? `${PAGE_LABELS[id]} (${keyLabel(key)})` : PAGE_LABELS[id]}
              >
                <Icon name={id} size={20} />
                <span className="nav__label">{PAGE_LABELS[id]}</span>
                {id === "collection" && (
                  <span className="nav__count tabular">
                    {discovered}/{AURAS.length}
                  </span>
                )}
                {id === "quests" && claimable > 0 && (
                  <span className="nav__badge tabular" aria-label={`${claimable} récompense(s) à réclamer`}>
                    {claimable}
                  </span>
                )}
                {id === "progression" && <span className="nav__count tabular">niv. {level.level}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="nav__user">
        <span className="nav__avatar">{user.name.slice(0, 1).toUpperCase()}</span>
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
