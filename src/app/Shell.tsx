import { useCallback, useEffect, useRef, useState } from "react";
import { CursorTrail } from "../effects/CursorTrail";
import { useGame } from "../game/GameContext";
import { AchievementsPage } from "../pages/AchievementsPage";
import { CollectionPage } from "../pages/CollectionPage";
import { InventoryPage } from "../pages/InventoryPage";
import { LeaderboardPage } from "../pages/LeaderboardPage";
import { ProgressionPage } from "../pages/ProgressionPage";
import { QuestsPage } from "../pages/QuestsPage";
import { RollPage } from "../pages/RollPage";
import { SettingsPage } from "../pages/SettingsPage";
import { ShopPage } from "../pages/ShopPage";
import { AdminPage } from "../pages/AdminPage";
import { StatsPage } from "../pages/StatsPage";
import { RevealOverlay } from "../roll/RevealOverlay";
import { EXTRA_PAGES, NAV_ORDER, PAGES, groupOf, type KeyAction, type PageId } from "../settings/settings";
import { useSettings } from "../settings/SettingsContext";
import { Nav, SubNav } from "./Nav";
import { Toasts } from "./Toasts";
import { TopBar } from "./TopBar";

const COMPONENTS: Record<PageId, () => JSX.Element> = {
  roll: RollPage,
  inventory: InventoryPage,
  collection: CollectionPage,
  achievements: AchievementsPage,
  stats: StatsPage,
  leaderboard: LeaderboardPage,
  settings: SettingsPage,
  progression: ProgressionPage,
  quests: QuestsPage,
  shop: ShopPage,
  admin: AdminPage,
};

function pageFromHash(): PageId {
  const id = window.location.hash.replace(/^#\/?/, "");
  return NAV_ORDER.find((p) => p === id) ?? "roll";
}

/** Navigation par hash (#/inventory) : le bouton retour du navigateur fonctionne. */
function useHashPage(): [PageId, (p: PageId) => void] {
  const [page, setPage] = useState<PageId>(pageFromHash);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = useCallback((p: PageId) => {
    if (p !== pageFromHash()) window.location.hash = `/${p}`;
    window.scrollTo({ top: 0 });
  }, []);
  return [page, navigate];
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el instanceof HTMLInputElement) return !["checkbox", "radio", "range", "button", "submit"].includes(el.type);
  return el.isContentEditable || ["TEXTAREA", "SELECT"].includes(el.tagName);
}

export function Shell() {
  const [page, navigate] = useHashPage();
  const { roll, toggleAuto, skipReveal, reveal, announcement } = useGame();
  const { settings } = useSettings();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  /** Dernière sous-page visitée par groupe (la navigation y revient). */
  const lastPages = useRef<Record<string, PageId>>({});
  lastPages.current[groupOf(page).id] = page;
  const lastOf = useCallback((g: string) => lastPages.current[g], []);

  // Après un changement de page, le focus va sur le titre de la nouvelle page (clavier, lecteurs d'écran).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const h1 = mainRef.current?.querySelector<HTMLElement>("h1");
    if (h1) {
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    }
  }, [page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.body.dataset.capturingKey || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Escape" && reveal) {
        skipReveal();
        return;
      }
      const kb = settings.keybinds;
      if (e.code === kb.roll) {
        e.preventDefault();
        // Maintenir la touche ne relance pas en boucle : un appui = une intention.
        if (e.repeat) return;
        if (reveal && reveal.phase !== "charge") skipReveal();
        else {
          if (page !== "roll") navigate("roll");
          roll();
        }
        return;
      }
      if (e.code === kb.auto && !e.repeat) {
        e.preventDefault();
        toggleAuto();
        return;
      }
      PAGES.forEach((p, i) => {
        if (e.code === kb[`nav${i + 1}` as KeyAction] && !e.repeat) {
          e.preventDefault();
          navigate(p.id);
        }
      });
      // Raccourcis fixes des nouvelles pages, sauf si la touche sert déjà à une action configurée.
      if (!Object.values(kb).includes(e.code)) {
        const extra = EXTRA_PAGES.find((p) => p.key === e.code);
        if (extra && !e.repeat) {
          e.preventDefault();
          navigate(extra.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings.keybinds, roll, toggleAuto, skipReveal, reveal, page, navigate]);

  const Page = COMPONENTS[page];
  return (
    <div className="shell">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <Nav page={page} onNavigate={navigate} lastOf={lastOf} />
      <main className="shell__main" id="contenu" ref={mainRef}>
        <TopBar />
        <SubNav page={page} onNavigate={navigate} />
        <div className="page-transition" key={page}>
          <Page />
        </div>
      </main>
      <RevealOverlay />
      <Toasts />
      <CursorTrail />
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
