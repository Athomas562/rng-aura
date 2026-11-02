import { useEffect, useState } from "react";
import { sound } from "../audio/sound";
import { backend } from "../backend";
import { Icon } from "../components/Icon";
import { useGame } from "../game/GameContext";
import { EXTRA_PAGES, KEY_ACTIONS, defaultSettings, keyLabel, type KeyAction, type VfxQuality } from "../settings/settings";
import { useSettings } from "../settings/SettingsContext";
import "./SettingsPage.css";

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="setting-row">
      <span>
        <span className="setting-row__label">{label}</span>
        {hint && <span className="setting-row__hint">{hint}</span>}
      </span>
      <span className="toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle__track" />
      </span>
    </label>
  );
}

export function SettingsPage() {
  const { settings, update } = useSettings();
  const { user } = useGame();
  const [capturing, setCapturing] = useState<KeyAction | null>(null);

  // Capture de la prochaine touche pour un raccourci.
  useEffect(() => {
    if (!capturing) return;
    document.body.dataset.capturingKey = "true";
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== "Escape") {
        const keybinds = { ...settings.keybinds };
        // une touche ne peut servir qu'à une action : on libère l'ancienne
        for (const a of KEY_ACTIONS) if (keybinds[a.id] === e.code) keybinds[a.id] = "";
        keybinds[capturing] = e.code;
        update({ keybinds });
      }
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      delete document.body.dataset.capturingKey;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [capturing, settings.keybinds, update]);

  return (
    <div className="page settings-page">
      <header className="page-header">
        <div>
          <h1>Paramètres</h1>
          <p>Enregistrés sur ton compte et sur cet appareil.</p>
        </div>
      </header>

      <section className="panel settings-section">
        <h2 className="panel-title">
          <Icon name="volume" size={14} /> Son
        </h2>
        <Toggle label="Effets sonores" checked={settings.soundEnabled} onChange={(v) => update({ soundEnabled: v })} />
        <div className="setting-row">
          <span className="setting-row__label">Volume</span>
          <span className="volume">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              disabled={!settings.soundEnabled}
              onChange={(e) => update({ volume: Number(e.target.value) })}
              aria-label="Volume des effets sonores"
            />
            <span className="tabular">{Math.round(settings.volume * 100)} %</span>
            <button className="btn btn-sm" disabled={!settings.soundEnabled} onClick={() => sound.reveal(4)}>
              Tester
            </button>
          </span>
        </div>
      </section>

      <section className="panel settings-section">
        <h2 className="panel-title">
          <Icon name="star" size={14} /> Affichage et accessibilité
        </h2>
        <Toggle
          label="Réduire les animations"
          hint="Coupe secousses et distorsions, raccourcit les découvertes, moins de particules."
          checked={settings.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
        />
        <Toggle
          label="Désactiver les effets lumineux intenses"
          hint="Supprime flashs blancs, clignotements et éclairs plein écran (photosensibilité)."
          checked={settings.noFlashes}
          onChange={(v) => update({ noFlashes: v })}
        />
        <Toggle
          label="Découverte éclair des auras communes"
          hint="Common et Uncommon s'affichent instantanément."
          checked={settings.skipCommonReveal}
          onChange={(v) => update({ skipCommonReveal: v })}
        />
        <Toggle
          label="Mode calme"
          hint="Fond statique, pas de transitions de page, de halo animé ni de traînée. Activé automatiquement si tu réduis les animations."
          checked={settings.calmMode}
          onChange={(v) => update({ calmMode: v })}
        />
        <Toggle
          label="Traînée du curseur"
          hint="Affiche la traînée achetée en boutique (souris uniquement)."
          checked={settings.cursorTrail}
          onChange={(v) => update({ cursorTrail: v })}
        />
        <div className="setting-row">
          <span>
            <span className="setting-row__label" id="vfx-label">
              Qualité des effets visuels
            </span>
            <span className="setting-row__hint">Faible : moins de particules, idéal pour les petits appareils.</span>
          </span>
          <span className="segmented" role="radiogroup" aria-labelledby="vfx-label">
            {(
              [
                ["low", "Faible"],
                ["normal", "Normale"],
                ["high", "Élevée"],
              ] as [VfxQuality, string][]
            ).map(([q, label]) => (
              <button key={q} role="radio" aria-checked={settings.vfxQuality === q} className={`chip ${settings.vfxQuality === q ? "is-active" : ""}`} onClick={() => update({ vfxQuality: q })}>
                {label}
              </button>
            ))}
          </span>
        </div>
        <div className="setting-row">
          <span>
            <span className="setting-row__label" id="scale-label">
              Taille du texte et de l'interface
            </span>
            <span className="setting-row__hint">De 90 % à 130 %.</span>
          </span>
          <span className="volume">
            <input
              type="range"
              min={0.9}
              max={1.3}
              step={0.05}
              value={settings.uiScale}
              onChange={(e) => update({ uiScale: Number(e.target.value) })}
              aria-labelledby="scale-label"
              aria-valuetext={`${Math.round(settings.uiScale * 100)} %`}
            />
            <span className="tabular">{Math.round(settings.uiScale * 100)} %</span>
          </span>
        </div>
        <p className="setting-row__hint settings-note">
          Ces quatre derniers réglages restent sur cet appareil ; le son, les animations, les flashs, la découverte éclair et les raccourcis sont
          synchronisés avec ton compte.
        </p>
      </section>

      <section className="panel settings-section">
        <h2 className="panel-title">
          <Icon name="settings" size={14} /> Raccourcis clavier
        </h2>
        <ul className="keybinds">
          {KEY_ACTIONS.map((a) => (
            <li key={a.id}>
              <span>{a.label}</span>
              <button className={`btn btn-sm keybind ${capturing === a.id ? "is-active" : ""}`} onClick={() => setCapturing(a.id)}>
                {capturing === a.id ? "Appuie sur une touche…" : settings.keybinds[a.id] ? keyLabel(settings.keybinds[a.id]) : "Aucun"}
              </button>
            </li>
          ))}
        </ul>
        <ul className="keybinds keybinds--fixed" aria-label="Raccourcis fixes">
          {EXTRA_PAGES.map((p) => (
            <li key={p.id}>
              <span>Aller à : {p.label}</span>
              <kbd className="keybind-fixed">{keyLabel(p.key)}</kbd>
            </li>
          ))}
          <li>
            <span>Passer une découverte</span>
            <kbd className="keybind-fixed">Échap</kbd>
          </li>
        </ul>
        <button className="btn btn-sm" onClick={() => update({ keybinds: defaultSettings().keybinds })}>
          Rétablir les raccourcis par défaut
        </button>
      </section>

      <section className="panel settings-section">
        <h2 className="panel-title">
          <Icon name="logout" size={14} /> Compte
        </h2>
        <div className="setting-row">
          <span>
            <span className="setting-row__label">{user.name}</span>
            <span className="setting-row__hint">
              {backend.kind === "local"
                ? "Mode local : progression enregistrée dans ce navigateur uniquement."
                : "Progression sauvegardée sur le serveur et validée par lui."}
            </span>
          </span>
          <button className="btn btn-danger" onClick={() => void backend.signOut()}>
            Se déconnecter
          </button>
        </div>
      </section>
    </div>
  );
}
