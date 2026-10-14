import { useState, type FormEvent } from "react";
import { USERNAME_RE, requireAura } from "../../shared";
import { BackendError, backend } from "../backend";
import { Avatar } from "../components/Avatar";
import "./AuthScreen.css";

const SHOWCASE = requireAura("constellation");

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const local = backend.kind === "local";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!USERNAME_RE.test(trimmed)) {
      setError("Pseudo : 3 à 20 caractères (lettres, chiffres, _).");
      return;
    }
    if (!local && password.length < 6) {
      setError("Mot de passe : 6 caractères minimum.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") await backend.signIn(trimmed, password);
      else await backend.register(trimmed, password);
    } catch (err) {
      setError(err instanceof BackendError ? err.message : "Erreur inattendue.");
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__hero" aria-hidden="true">
        <Avatar aura={SHOWCASE} />
      </div>
      <div className="auth__card panel">
        <h1 className="auth__title">
          RNG <span>AURA</span>
        </h1>
        <p className="auth__tagline">Lance le destin. Éveille des auras de plus en plus rares.</p>

        <div className="auth__tabs" role="tablist">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? "is-active" : ""}
              onClick={() => {
                setMode(m);
                setError("");
              }}
            >
              {m === "login" ? "Connexion" : "Créer un compte"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="auth__form">
          <div className="field">
            <label htmlFor="auth-name">Pseudo</label>
            <input
              id="auth-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoComplete="username"
              placeholder="Ton pseudo"
              required
            />
          </div>
          {!local && (
            <div className="field">
              <label htmlFor="auth-pass">Mot de passe</label>
              <input
                id="auth-pass"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="6 caractères minimum"
                required
              />
            </div>
          )}
          {error && (
            <p className="auth__error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary auth__submit" disabled={loading}>
            {loading ? "Patiente…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>
        <p className="auth__hint">
          {local
            ? "Mode local de développement : pas de mot de passe, progression stockée dans ce navigateur."
            : "Les comptes de l'ancienne version fonctionnent avec le même pseudo et mot de passe."}
        </p>
      </div>
    </div>
  );
}
