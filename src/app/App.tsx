import { useCallback, useEffect, useState } from "react";
import type { ApiResponse } from "../../shared";
import { BackendError, backend, type AuthUser } from "../backend";
import { Backdrop } from "../effects/Backdrop";
import { GameProvider } from "../game/GameContext";
import { formatDate } from "../lib/format";
import { SettingsProvider } from "../settings/SettingsContext";
import { AuthScreen } from "./AuthScreen";
import { Shell } from "./Shell";
import "./App.css";

type Boot =
  | { status: "loading" }
  | { status: "ready"; initial: ApiResponse }
  | { status: "error"; message: string }
  | { status: "banned"; until: number; reason: string };

function GameBoot({ user }: { user: AuthUser }) {
  const [boot, setBoot] = useState<Boot>({ status: "loading" });

  const load = useCallback(() => {
    setBoot({ status: "loading" });
    backend.call({ action: "load" }).then(
      (initial) => setBoot({ status: "ready", initial }),
      (e) => {
        if (e instanceof BackendError && e.code === "banned") {
          setBoot({ status: "banned", until: e.info.until ?? 0, reason: e.message });
        } else {
          setBoot({ status: "error", message: e instanceof Error ? e.message : "Erreur inattendue" });
        }
      },
    );
  }, []);

  useEffect(load, [load, user.uid]);

  const onBanned = useCallback((until: number, reason: string) => setBoot({ status: "banned", until, reason }), []);

  switch (boot.status) {
    case "loading":
      return <Splash text="Synchronisation de ta progression…" />;
    case "error":
      return (
        <CenterCard title="Connexion au serveur impossible">
          <p>{boot.message}</p>
          <div className="center-card__actions">
            <button className="btn btn-primary" onClick={load}>
              Réessayer
            </button>
            <button className="btn" onClick={() => void backend.signOut()}>
              Se déconnecter
            </button>
          </div>
        </CenterCard>
      );
    case "banned":
      return (
        <CenterCard title="Compte suspendu">
          <p>{boot.reason}</p>
          <p className="muted">Jusqu'au {formatDate(boot.until)}</p>
          <div className="center-card__actions">
            <button className="btn" onClick={() => void backend.signOut()}>
              Se déconnecter
            </button>
          </div>
        </CenterCard>
      );
    case "ready":
      return (
        <GameProvider user={user} initial={boot.initial} onBanned={onBanned}>
          <Shell />
        </GameProvider>
      );
  }
}

function Splash({ text }: { text: string }) {
  return (
    <div className="splash">
      <span className="splash__orb" />
      <p>{text}</p>
    </div>
  );
}

function CenterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="splash">
      <div className="center-card panel">
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function App() {
  // undefined = état d'authentification pas encore connu
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  useEffect(() => backend.onAuthChange(setUser), []);

  return (
    <SettingsProvider uid={user?.uid ?? null}>
      <Backdrop />
      {user === undefined ? <Splash text="Chargement…" /> : user === null ? <AuthScreen /> : <GameBoot key={user.uid} user={user} />}
      {backend.kind === "local" && <div className="local-badge">Mode local</div>}
    </SettingsProvider>
  );
}
