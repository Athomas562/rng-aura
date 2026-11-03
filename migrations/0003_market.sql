-- RNG Aura — marché (vente contre Éclats) et échanges directs.
-- Uniquement des CRÉATIONS de tables et d'index : aucune donnée existante n'est touchée.
-- Colonnes ajoutées au schéma demandé : seller_name, buyer_id, sold_at (annonces) ;
-- noms, confirmations et version (échanges). La version sert de verrou : une confirmation
-- ou un changement d'offre ne réussit que sur la version attendue.

CREATE TABLE IF NOT EXISTS market_listings (
  id          TEXT PRIMARY KEY,
  seller_id   TEXT    NOT NULL,
  seller_name TEXT    NOT NULL,
  aura_id     TEXT    NOT NULL,
  price       INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'active', -- active | sold | expired | cancelled
  buyer_id    TEXT,
  sold_at     INTEGER
);
CREATE INDEX IF NOT EXISTS market_active ON market_listings (status, expires_at);
CREATE INDEX IF NOT EXISTS market_aura   ON market_listings (aura_id, status);
CREATE INDEX IF NOT EXISTS market_seller ON market_listings (seller_id, created_at);

CREATE TABLE IF NOT EXISTS trades (
  id                  TEXT PRIMARY KEY,
  initiator_id        TEXT    NOT NULL,
  initiator_name      TEXT    NOT NULL,
  receiver_id         TEXT    NOT NULL,
  receiver_name       TEXT    NOT NULL,
  initiator_auras     TEXT    NOT NULL, -- JSON
  receiver_auras      TEXT    NOT NULL, -- JSON
  initiator_confirmed INTEGER NOT NULL DEFAULT 0,
  receiver_confirmed  INTEGER NOT NULL DEFAULT 0,
  status              TEXT    NOT NULL DEFAULT 'pending', -- pending | accepted | declined | cancelled | expired
  version             INTEGER NOT NULL DEFAULT 1,
  created_at          INTEGER NOT NULL,
  expires_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS trades_initiator ON trades (initiator_id, created_at);
CREATE INDEX IF NOT EXISTS trades_receiver  ON trades (receiver_id, created_at);

-- Virements entre joueurs (produit d'une vente, auras d'un échange), encaissés une seule fois.
CREATE TABLE IF NOT EXISTS transfers (
  id         TEXT PRIMARY KEY,
  to_uid     TEXT    NOT NULL,
  kind       TEXT    NOT NULL, -- shards | auras
  amount     INTEGER NOT NULL DEFAULT 0,
  auras      TEXT    NOT NULL DEFAULT '[]', -- JSON
  reason     TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER
);
CREATE INDEX IF NOT EXISTS transfers_pending ON transfers (to_uid, claimed_at);

-- Anti-mule : empreintes HACHÉES (jamais l'IP en clair) de l'IP et de l'appareil.
CREATE TABLE IF NOT EXISTS account_footprints (
  uid         TEXT    NOT NULL,
  ip_hash     TEXT    NOT NULL,
  device_hash TEXT    NOT NULL,
  seen_at     INTEGER NOT NULL,
  PRIMARY KEY (uid, ip_hash, device_hash)
);
CREATE INDEX IF NOT EXISTS footprints_ip     ON account_footprints (ip_hash, seen_at);
CREATE INDEX IF NOT EXISTS footprints_device ON account_footprints (device_hash, seen_at);
