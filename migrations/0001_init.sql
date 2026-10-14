-- RNG Aura — stockage serveur dans Cloudflare D1.
-- Ces tables ne sont accessibles qu'au Worker (binding DB) : le navigateur n'y a aucun accès direct.

-- État complet d'un joueur (même format JSON que v2/players/{uid} dans la Realtime Database).
-- `version` sert aux écritures atomiques : UPDATE … WHERE version = ? puis nouvel essai en cas de conflit.
CREATE TABLE IF NOT EXISTS players (
  uid        TEXT PRIMARY KEY,
  state      TEXT    NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

-- Classement, dérivé de l'état du joueur par le serveur uniquement.
CREATE TABLE IF NOT EXISTS leaderboard (
  uid          TEXT PRIMARY KEY,
  name         TEXT    NOT NULL,
  rolls        INTEGER NOT NULL,
  best_odds    INTEGER NOT NULL,
  best_aura_id TEXT,
  collection   INTEGER NOT NULL,
  achievements INTEGER NOT NULL,
  equipped     TEXT,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS leaderboard_rolls        ON leaderboard (rolls DESC, updated_at);
CREATE INDEX IF NOT EXISTS leaderboard_best_odds    ON leaderboard (best_odds DESC, updated_at);
CREATE INDEX IF NOT EXISTS leaderboard_collection   ON leaderboard (collection DESC, updated_at);
CREATE INDEX IF NOT EXISTS leaderboard_achievements ON leaderboard (achievements DESC, updated_at);

-- Pseudos réservés (en minuscules). L'unicité réelle est aussi garantie par Firebase Auth (pseudo@aurarng.local).
CREATE TABLE IF NOT EXISTS usernames (
  name       TEXT PRIMARY KEY,
  uid        TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

-- Bannissements, gérés par l'administrateur (wrangler d1 execute), jamais par le navigateur.
CREATE TABLE IF NOT EXISTS bans (
  uid    TEXT PRIMARY KEY,
  until  INTEGER NOT NULL,
  reason TEXT
);
