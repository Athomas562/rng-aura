# RNG Aura

Jeu web de collection d'auras : React + TypeScript + Vite, Firebase Authentication, et un Worker Cloudflare (données dans D1) pour toute la logique qui touche aux récompenses.

## Architecture

```
shared/        Moteur pur, partagé client/serveur (aucune dépendance)
  auras.ts       Catalogue de 75 auras (données, apparence déclarative, mécaniques spéciales)
  rarities.ts    15 paliers, de Common (1/2) à Beyond (1/1 000 000 000), dont 3 « branches »
  events.ts      Saisons et événements annuels (auras exclusives, bonus de chance)
  appearance.ts  Apparence dérivée (formes d'Écho, stades d'Yggdrasil, copie de Mimique)
  probability.ts Distribution exacte d'un roll (saisonnières, potion ciblée)
  luck.ts        Calcul de la chance, temps de recharge (seau à jetons)
  potions.ts     8 potions et objets
  talents.ts     Arbre de talents (3 branches, 7 talents)
  progression.ts XP, niveaux, emplacements d'aura, titres, prestige
  quests.ts      Quêtes journalières / hebdomadaires, missions
  achievements.ts Succès (condition + progression + récompense)
  engine.ts      Actions : rolls, potions, équipement, fusion, prestige, talents, titres, quêtes
functions/     Cloud Function `api` (europe-west1)
  handlers.ts    Logique serveur, testable sans Firebase
  index.ts       Branchement Firebase (transactions RTDB, bans)
src/
  backend/       Interface GameBackend : Firebase (prod) ou locale (dev)
  game/          GameContext : pipeline de roll, auto-roll, toasts
  effects/       Rendu Canvas : registre de couches d'aura, effets de révélation
  roll/          Scène centrale, révélation plein écran, panneaux
  pages/         Inventaire, Collection, Succès, Statistiques, Classement, Paramètres
worker/         Worker Cloudflare : API /api et /api/leaderboard, données dans D1
migrations/     Schéma SQL de la base D1
database.rules.candidate.json  Règles de sécurité approuvées (seul fichier publié, via firebase.json)
database.rules.json            Ancienne version, conservée mais publiée par aucune commande
```

### Probabilités

Chaque aura tirable non commune reçoit `chance / N` de probabilité, servie de la plus rare à la plus commune (plafonnée à ce qui reste) ; les cinq auras communes se partagent le reste. Les auras de fusion ne sont jamais tirées ; les saisonnières seulement pendant leur événement (horloge du serveur).

Équilibrage vérifié par les tests : à chance ×1 la somme des « 1/N » des auras rares vaut environ 0,47, les communes représentent donc ~52 % des tirages ; elles restent présentes sur un roll béni (×2). Pour cela, Brise, Rosée et Givre sont passées de 1/7, 1/11, 1/16 à 1/8, 1/12, 1/18.

La chance vaut `(1 + bonus additifs) × multiplicateurs` :

| Source | Effet |
| --- | --- |
| Potion de chance | +100 % pendant 5 min |
| Potion de super chance | +400 % pendant 2 min |
| Sablier du destin | ×2 pendant 3 min |
| Élixir de célérité | recharge ÷ 2 pendant 5 min |
| Potion de chance ciblée | ×3 pour une rareté choisie, 3 min |
| Potion de série | la série ne retombe pas pendant 10 min |
| Bénédiction garantie | le prochain roll est béni |
| Eau bénite | lève la Marque maudite |
| Série | +2 % tous les 10 rolls enchaînés (max +30 %, +50 % avec Endurance) |
| Prestige | +5 % par prestige (max 10) |
| Talent Fortune | +3 % par rang (max 5) |
| Événement en cours | +10 % |
| Marque maudite | +300 % pendant 90 s, puis ×0,5 pendant 60 s |
| Roll béni | ×2 un roll sur 10 (sur 7 avec Bénédiction) |

Chance maximale théorique : ×41 (×123 pour la rareté ciblée). Oméga (1/2 Md) demande alors encore plus de 16 millions de rolls.

### Progression

- **Niveau** : XP à chaque roll (selon la rareté), ×10 à la première découverte. Emplacements d'aura supplémentaires aux niveaux 10, 25 et 50.
- **Talents** : 1 point par niveau, +2 par prestige ; réinitialisation gratuite.
- **Prestige** : à 10 000 rolls depuis la dernière renaissance. Remet à zéro l'inventaire et les auras équipées ; conserve le codex, le niveau, les talents, les potions, les succès et le record de rareté.
- **Quêtes** : 3 par jour et 3 par semaine (identiques pour tous, minuit UTC / lundi), 6 missions à étapes. Chaque récompense est réclamable une fois, dans la même écriture atomique que la récompense.

### Ajouter une aura ou un effet

- Aura : ajouter une entrée dans `shared/auras.ts` (le test vérifie que `odds` est dans la plage du palier et que les communes restent majoritaires).
- Effet visuel : déclarer le type dans `shared/visuals.ts`, puis `registerLayer(...)` dans `src/effects/registry.ts`.

## Sécurité

Le navigateur n'envoie que des intentions (`roll`, `potion`, `equip`, `fuse`, `prestige`, `talent`, `claim`…). Le tirage (RNG cryptographique), les récompenses, l'XP, les quêtes, les succès et l'entrée du classement sont calculés par le serveur dans une écriture atomique (D1, numéro de version). Les règles interdisent toute écriture client sur `v2/players` et `v2/leaderboard` ; seuls les paramètres (`v2/settings/{uid}`) sont modifiables par leur propriétaire. Le rythme des rolls est limité côté serveur. Les bans existants (`bans/{uid}`) sont appliqués.

## Développement

```bash
npm install && npm --prefix functions install
npm run dev:offline   # jeu complet sans Firebase (moteur exécuté dans le navigateur)
npm run dev           # frontend ; /api est relayé vers npm run dev:api
npm run dev:api       # Worker en local — ⚠️ avec un .dev.vars réel, écrit dans la VRAIE base
npm test              # tests du moteur et de l'API
npm run build         # build de production dans dist/
```

## Déploiement (forfait Spark, sans facturation)

- **Site + API** : Cloudflare Workers. Build command vide (`wrangler.jsonc` lance `npm run build`), Deploy command `npx wrangler deploy`.
- **Données serveur** : Cloudflare D1 (binding `DB`), aucun secret ni compte de service. Une seule fois :
  1. `npx wrangler d1 create rng-aura`, puis copier l'identifiant affiché dans `database_id` de `wrangler.jsonc` ;
  2. `npx wrangler d1 migrations apply rng-aura --remote` (crée les tables, ne supprime rien). La migration `0002_progression.sql` ajoute seulement des colonnes au classement (niveau, prestige, auras spéciales, titre).
  En local : `npm run db:migrate:local` puis `npm run dev:api` (base D1 locale dans `.wrangler/`, aucune donnée réelle).
- **Bans** : `npx wrangler d1 execute rng-aura --remote --command "INSERT INTO bans (uid, until, reason) VALUES ('<uid>', <timestamp_ms>, '<raison>')"`.
- **Reprise des données Firebase** (bans, pseudos, `v2`) : exporter le JSON depuis la console Firebase, puis
  `npm run db:import:convert -- export.json import.sql` et `npx wrangler d1 execute rng-aura --remote --file import.sql` (INSERT OR IGNORE uniquement).
- **Règles** : `npm run deploy:rules` — vérifie puis publie **uniquement** `database.rules.candidate.json` (⚠️ remplace les règles de la console).
- **Cloud Function** (alternative, forfait Blaze uniquement) : `npm run deploy:backend` — ne publie plus aucune règle.

Ne téléchargez jamais la clé du compte de service dans ce dossier ; elle est de toute façon exclue par `.gitignore`.
