# RNG Aura — Roadmap v1.0.x → v2.0

Effort : **S** ≤ ½ jour · **M** 1–2 jours · **L** 3–5 jours · **XL** 1–2 semaines (code + tests).
⚖️ = point d'équilibrage économique : **à valider avant implémentation**.

## Vue d'ensemble

| Version | Contenu | Effort |
| --- | --- | --- |
| **v1.0.1** ✅ | P0 — bug de la série (fait) | M |
| **v1.1** | Potion d'érudition · potions sans plafond · indices des succès secrets | M + S + M |
| **v1.2** | Mutations cosmétiques | L |
| **v1.3** | Pity · événements limités · recherche Ctrl+K · Roll rapide | M + M + S + S |
| **v1.4** | Amis + profil public · Moments forts · feed global · parrainage | L + M + M + M |
| **v1.5** | Marketplace (vente contre Éclats) | XL |
| **v1.6** | Trades directs aura ↔ aura | L |
| **v2.0** | P3 (fusions étendues, auras à condition, presets de talents, graphiques, biomes, héritage, légendes, quête communautaire) + PWA, passe de saison, comptes liés | 4–6 sem. |

Le marché est en P1 dans la demande, mais c'est le chantier le plus risqué (deux joueurs par transaction, escrow, taxe, anti-fraude). Je propose de livrer d'abord les éléments courts de P1 (v1.1–v1.2), puis le marché seul (v1.5).

---

## P0 — Série de rolls ✅ (v1.0.1)

**Diagnostic**

| Cause auditée | Constat | Correction |
| --- | --- | --- |
| Horloge client | Non concernée : le serveur n'utilisait déjà que son horloge | Test : un horodatage, un `lastRollAt` ou un `streak` envoyés par le client sont ignorés |
| Onglet en arrière-plan | Fenêtre de 20 s trop courte | Fenêtre portée à **25 s** |
| Potion de série | **Bug** : la potion expirée était effacée au début de l'action suivante, donc la série retombait dès le premier roll après l'expiration | Nouveau champ `stats.streakGuardEnd`. La série est gelée jusqu'à la fin de la potion, puis la fenêtre repart de cet instant |
| Requêtes simultanées et doublons | Écritures déjà atomiques, mais aucune idempotence | `requestId` par roll (UUID) ; le serveur garde les 32 derniers et ignore un doublon |
| Resets involontaires | Seule la renaissance écrivait `streak = 0` (Marque maudite et biomes non concernés) | Supprimé : la renaissance ne touche plus la série |
| Affichage (trouvé en plus) | Le client ordonnait les réponses par heure serveur : un heartbeat revenu après un roll pouvait afficher une série plus ancienne | Champ `rev` (+1 à chaque écriture) ; le client n'applique jamais une révision inférieure |

- **Fichiers** : `shared/luck.ts`, `shared/state.ts`, `shared/engine.ts`, `shared/api.ts`, `functions/src/handlers.ts`, `worker/http.ts`, `worker/index.ts`, `src/game/GameContext.tsx`, `src/app/TopBar.tsx`.
- **Journal** : chaque roll écrit une ligne JSON dans les logs du Worker : `{event, uid, roll_id, server_ts, granted, streak_before, streak_after}`.
- **Interface** : l'infobulle de la série affiche « +2 % de chance tous les 10 rolls », le bonus actuel et le temps restant avant qu'elle retombe ; une icône de bouclier apparaît quand la série est gelée.
- **Migration D1** : aucune (état JSON).
- **Tests** : `functions/src/streak.test.ts` (14 tests), dont « 100 rolls espacés de 15 s → 100 » et « onglet gelé 2 min puis 10 rolls → 1…10 ».

---

## P1

### 1. Potions sans plafond de 30 min — S ⚖️
- **Fichiers** : `shared/potions.ts` (`POTION_MAX_STACK_MS`), `shared/engine.ts` (`drinkPotion`), `shared/economy.ts` (`POTION_STOCK_LIMIT`), `src/lib/format.ts` (format « 2 h 15 min »), `src/app/TopBar.tsx`, `src/roll/Panels.tsx`.
- **Migration D1** : aucune.
- **Tests** : cumul > 30 min accepté ; durée correcte après 20 prises ; affichage des longues durées.
- **Équilibrage** ⚖️ : cumuler la durée n'augmente pas la puissance par roll (le ×2 reste ×2), cela permet seulement de faire des réserves. **Recommandation : retirer le plafond et garder le stock à 99, sans autre limite.** Si tu veux un garde-fou : stock 99 → 30.

### 2. Marketplace et trades — XL + L ⚖️
- **Nouveaux fichiers** : `shared/market.ts` (règles : frais, taxe, durée, éligibilité), `worker/marketStore.ts`, `src/pages/MarketPage.tsx`, `src/pages/TradePage.tsx`.
- **Fichiers modifiés** : `functions/src/handlers.ts` (actions `list`, `unlist`, `buyListing`, `tradeOffer`, `tradeAccept`, `tradeCancel`), `worker/http.ts` (lecture `GET /api/market`).
- **Migration** `0003_market.sql` : tes deux tables, plus `buyer_id`, `sold_at`, `aura_mutation` dans les annonces ; une table `payouts(seller_id, amount, listing_id, claimed)` ; des index sur `(status, expires_at)`, `(aura_id, status)`, `seller_id`.
- **Atomicité** (deux joueurs par opération ; D1 n'a pas de transaction conditionnelle sur plusieurs lignes) :
  - **Mise en vente** : une seule écriture sur le vendeur (l'aura passe en dépôt dans l'annonce, frais débités), puis insertion de l'annonce.
  - **Achat** :
    1. `UPDATE market_listings SET status='sold', buyer_id=? WHERE id=? AND status='active'` sert de verrou : une seule requête peut réussir.
    2. Écriture atomique sur l'acheteur (débit, ajout de l'aura). Si le solde est insuffisant, l'annonce repasse en `active`.
    3. Le vendeur est crédité via `payouts`, réclamé à sa prochaine action. Pas d'écriture croisée concurrente.
  - **Trade** : les deux inventaires sont mis en dépôt à l'acceptation, puis libérés vers l'autre joueur. Une expiration ou une annulation rend les auras.
- **Tests** : double achat simultané (un seul réussit) ; solde insuffisant ; annonce expirée qui rend l'aura ; aura équipée, de fusion ou saisonnière hors saison refusée ; taxe exacte ; trade avec double confirmation, délai de 3 min, 5 auras par côté au maximum ; noms jamais en « ??? » ; aucune duplication d'aura en cas de panne entre deux étapes.
- **Équilibrage** ⚖️ :
  - frais de mise en vente de 1 % (minimum 10) et taxe de 5 % : OK pour moi ;
  - ajouter un **prix plancher par rareté**, pour éviter les transferts entre comptes d'un même joueur à 1 Éclat ;
  - les mutations (§4) se vendent avec l'aura.
- **Classement** ⚖️ : recommandation, une aura achetée compte, avec un badge « obtenue par échange ». Risque : quelqu'un peut acheter sa place en tête de « l'aura la plus rare ». Alternative : seules les auras obtenues en roll comptent pour cette catégorie.

### 3. Potion d'érudition — S ⚖️ (spec complète fournie, à confirmer)
- **Fichiers** : `shared/potions.ts` (`xpBoost`, nouvel effet `xpMul`), `shared/engine.ts` (`obtain` : XP × multiplicateur Érudit × 2), `shared/economy.ts` (prix 150), `shared/quests.ts` et `shared/achievements.ts` (sources), `ROLL_MILESTONE_REWARDS`.
- **Migration D1** : aucune.
- **Tests** : potion active → XP ×2 ; potion + Érudit 1 → ×2,2 ; potion expirée → normal ; achat de 10 au maximum ; stock 99.
- **Note** : avec Érudit au rang 5 (+50 %), la multiplication donne ×3 avec la potion.

### 4. Mutations cosmétiques — L ⚖️
- **Fichiers** :
  - `shared/mutations.ts` : 3 types (`golden`, `void`, `prismatic`), avec palettes et couches visuelles ;
  - `shared/state.ts` : `inventory[id].mutations` et `codex[id].mutations` ;
  - `shared/engine.ts` : tirage de la mutation après celui de l'aura, avec le même RNG serveur ;
  - `shared/appearance.ts` : apparence mutée ;
  - `src/components/AuraIcon.tsx` (bordure animée), `AuraDetail.tsx` (badge MUTÉE), `CollectionPage.tsx` (sous-collection, 150 entrées).
- **Migration D1** : aucune.
- **Tests** : taux statistique (100 000 tirages) ; aucun effet sur la chance ni sur la distribution ; succès de codex muté ; normalisation d'une sauvegarde sans mutation ; bonus de taux pendant un événement.
- **Équilibrage** ⚖️ : 5 % est un taux élevé (1 roll sur 20 serait muté, ce qui banalise). Recommandation : **1 %**, réparti golden 0,6 % / void 0,3 % / prismatic 0,1 %, et ×2 pendant les événements.

### 5. Indices des succès secrets — M ⚖️
- **Fichiers** : `shared/achievements.ts` (3 indices par succès secret : 8 succès secrets × 3 = 24 indices), `shared/state.ts` (`hints: Record<id, niveau>`), `shared/engine.ts` (action `hint`), `src/pages/AchievementsPage.tsx` (onglet Secrets, compteur, cadenas, avertissement avant achat).
- **Migration D1** : aucune.
- **Tests** : niveau 1 gratuit ; niveau 2 à 50, niveau 3 à 200 ; pas de saut de niveau ; pas de double achat (concurrence) ; refus si le succès est déjà débloqué ; l'indice n'est jamais renvoyé avant d'être acheté (le texte reste côté serveur).
- **Équilibrage** ⚖️ : 50 et 200 Éclats. Un niveau 2 obtenable par quête implique d'ajouter une quête hebdomadaire « Archéologue ».

---

## P2

### 7. Pity — M ⚖️
- **Fichiers** : `shared/state.ts` (`stats.sinceEpic`, `stats.sinceLegendary`), `shared/luck.ts` (soft pity ×2 dans `computeLuck`), `shared/engine.ts` (hard pity : forcer une Legendary au roll N), `src/roll/Panels.tsx` (compteurs visibles).
- **Tests** : soft pity au seuil exact ; hard pity garantie ; compteurs remis à zéro ; transparence (la ligne de chance affiche la pity).
- **Équilibrage** ⚖️ : soft pity après **200** rolls sans Epic ou mieux (une Epic ou mieux tombe en moyenne 1 roll sur 39) ; hard pity Legendary à **4 000** rolls (une Legendary ou mieux tombe en moyenne 1 roll sur 394). Les 50 000 rolls proposés ne servent presque jamais.

### 8. Amis et profil public — L
- **Migration** `0004_social.sql` : `friends(uid, friend_uid, status, created_at)`, `friend_codes(code, uid)`, `profiles(uid, public_json, updated_at)` (vue publique dérivée par le serveur, sans uid exposé).
- **Fichiers** : `worker/socialStore.ts`, actions `friendAdd/Accept/Remove`, `GET /api/profile/:name`, `src/pages/FriendsPage.tsx`, `ProfilePage.tsx`.
- **Tests** : demande en double ; accepter sa propre demande ; profil d'un non-ami (champs limités) ; limite de 200 amis ; aucun uid dans les réponses.

### 9. Événements limités — M ⚖️
- **Fichiers** : `shared/events.ts` (événements ponctuels définis par dates absolues), `shared/luck.ts` (roll béni 1 sur 5 en week-end), `shared/engine.ts` (Éclats ×2), `src/roll/Panels.tsx` (compte à rebours).
- **Événement communautaire** : table `community_goals(id, target, progress, ends_at)` dans `0004`, incrémentée de façon atomique par lots (pas à chaque roll).
- **Équilibrage** ⚖️ : Ruée d'Éclats ×2 au maximum 2 week-ends par mois.

### 10. Moments forts — M
- Table `highlights(uid, aura_id, at, luck)` dans `0004`, écrite par le serveur pour chaque Legendary ou mieux.
- Image générée côté client (canvas vers PNG), pas de capture d'écran serveur.
- Bouton Partager avec la Web Share API, ou un lien.

### 11. Feed global — M
- Lecture `GET /api/feed` (50 dernières Mythical ou mieux, issues de `highlights`), rafraîchie toutes les 15 s. Le vrai temps réel demanderait Durable Objects, payants : je ne le propose pas.
- Option de confidentialité : « ne pas apparaître dans le feed ».

### 12. Parrainage — M ⚖️
- Table `referrals(code, owner_uid, referee_uid, rewarded_at)`.
- Récompense versée seulement quand le filleul atteint **1 000 rolls**, pour éviter les faux comptes.
- **Équilibrage** ⚖️ : 500 Éclats au parrain, 250 au filleul, plafonné à 20 filleuls par parrain.

---

## P3 → v2.0 (estimation globale)

| Item | Effort | Points de vigilance |
| --- | --- | --- |
| 13 Fusions étendues + page recettes | L | Recettes Rare → Epic : vérifier que ça ne vide pas l'intérêt des rolls |
| 14 Auras à condition secrète | M | Minuit UTC + roll béni + absence de 24 h : conditions évaluées par le serveur uniquement |
| 15 Presets de talents + talent caché | S | Le changement de preset reste gratuit (comme la réinitialisation) |
| 16 Statistiques graphiques | M | Nécessite une table `daily_stats(uid, day, rolls)` (migration) |
| 17 Biomes / météo | M | Cycle de 2 h déterministe (comme les quêtes), même biome pour tous |
| 18 Aura héritage | S ⚖️ | +1 % par aura scellée × 10 renaissances = +10 % : à valider |
| 19 Duel de chance | L ⚖️ | Pari en Éclats entre joueurs : à encadrer (mise maximale, pas de duel entre comptes liés) |
| 20 Codex légendes | M | Textes à écrire (75 auras) |
| 21 Quête communautaire | S | Réutilise `community_goals` |

## P4 et bonus (à arbitrer)
- **Cosmétiques et passe de saison** : conformes aux règles (aucune aura payante, une seule monnaie).
- **Roll rapide, Ctrl+K, PWA** : S à M chacun.
- **Comptes liés Google/Discord** : M, côté Firebase Auth uniquement.
- **Anti-triche avancé** : un shadowban qui coupe les Éclats est faisable côté serveur. La détection de mouvements de souris réguliers est facile à contourner et donne des faux positifs ; je la déconseille.
- **À éviter ou à encadrer** :
  - « multi-lancers 10/100 » contredit le correctif anti-spam d'un roll par recharge ; possible seulement en consommant le temps réellement écoulé ;
  - « coffres / roulette » : avec des Éclats uniquement et des taux affichés, mais cela ressemble à des loot boxes, à éviter si le jeu vise des mineurs ;
  - chat global : demande de la modération.
