import { Icon } from "../components/Icon";
import { useGame } from "../game/GameContext";
import "./Toasts.css";

const ICON = { achievement: "achievements", reward: "flask", error: "close", info: "star" } as const;

export function Toasts() {
  const { toasts, dismissToast } = useGame();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast toast--${t.kind}`} onClick={() => dismissToast(t.id)}>
          <span className="toast__icon">
            <Icon name={ICON[t.kind]} size={18} />
          </span>
          <span className="toast__text">
            <strong>{t.title}</strong>
            {t.body && <span>{t.body}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
