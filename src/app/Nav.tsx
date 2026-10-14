import { AURAS } from "../../shared";
import { Icon } from "../components/Icon";
import { useGame } from "../game/GameContext";
import { PAGES, keyLabel, type KeyAction, type PageId } from "../settings/settings";
import { useSettings } from "../settings/SettingsContext";
import "./Nav.css";

export function Nav({ page, onNavigate }: { page: PageId; onNavigate: (p: PageId) => void }) {
  const { state, user } = useGame();
  const { settings } = useSettings();
  const discovered = Object.keys(state.inventory).length;

  return (
    <nav className="nav" aria-label="Navigation principale">
      <div className="nav__brand">
        <span className="nav__logo" aria-hidden="true" />
        <span className="nav__title">
          RNG <strong>AURA</strong>
        </span>
      </div>
      <ul className="nav__list">
        {PAGES.map((p, i) => (
          <li key={p.id}>
            <button
              className={`nav__item ${page === p.id ? "is-active" : ""}`}
              onClick={() => onNavigate(p.id)}
              aria-current={page === p.id ? "page" : undefined}
              title={`${p.label} (${keyLabel(settings.keybinds[`nav${i + 1}` as KeyAction])})`}
            >
              <Icon name={p.id} size={20} />
              <span className="nav__label">{p.label}</span>
              {p.id === "collection" && (
                <span className="nav__count tabular">
                  {discovered}/{AURAS.length}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="nav__user">
        <span className="nav__avatar">{user.name.slice(0, 1).toUpperCase()}</span>
        <span className="nav__username">{state.name}</span>
      </div>
    </nav>
  );
}
