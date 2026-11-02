-- RNG Aura — extension : niveau, prestige, auras spéciales et titre dans le classement.
-- Uniquement des AJOUTS de colonnes et d'index : aucune donnée existante n'est supprimée ni modifiée.
-- Les lignes déjà présentes reçoivent les valeurs par défaut, puis sont recalculées par le serveur
-- à la prochaine action du joueur. (L'état des joueurs est un JSON : il n'a pas besoin de migration.)
ALTER TABLE leaderboard ADD COLUMN level    INTEGER NOT NULL DEFAULT 1;
ALTER TABLE leaderboard ADD COLUMN prestige INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leaderboard ADD COLUMN special  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leaderboard ADD COLUMN title    TEXT;

CREATE INDEX IF NOT EXISTS leaderboard_level    ON leaderboard (level DESC, updated_at);
CREATE INDEX IF NOT EXISTS leaderboard_prestige ON leaderboard (prestige DESC, updated_at);
CREATE INDEX IF NOT EXISTS leaderboard_special  ON leaderboard (special DESC, updated_at);
