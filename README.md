# RNG Aura

Jeu web de collection d'auras : React + TypeScript + Vite, Firebase Auth + Realtime Database, Cloud Functions pour toute la logique qui touche aux récompenses.

## Architecture

```
shared/        Moteur pur, partagé client/serveur (aucune dépendance)
  auras.ts       Catalogue des 32 auras (données + apparence déclarative)
  rarities.ts    10 paliers, de Common (1/2) à Infinity (1/100 000 000)
  probability.ts Distribution exacte d'un roll pour une chance donnée
  luck.ts        Calcul de la chance, temps de recharge (seau à jetons)
  potions.ts     Définition des potions et de leurs effets
  achievements.ts Succès (condition + progression + récompense)
  engine.ts      Actions : rolls, potions, équipement, heartbeat
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

Chaque aura non commune reçoit `chance / N` de probabilité, servie de la plus rare à la plus commune (plafonnée à ce qui reste) ; les trois auras communes se partagent le reste. La chance vaut `(1 + bonus additifs) × multiplicateurs` :

| Source | Effet |
| --- | --- |
| Potion de chance | +100 % pendant 5 min |
| Potion de super chance | +400 % pendant 2 min |
| Sablier du destin | ×2 pendant 3 min |
| Élixir de célérité | recharge ÷ 2 pendant 5 min |
| Série | +2 % tous les 10 rolls enchaînés (max +30 %) |
| Roll béni | ×2 un roll sur 10 |

### Ajouter une aura ou un effet

- Aura : ajouter une entrée dans `shared/auras.ts` (le test vérifie que `odds` correspond au palier).
- Effet visuel : déclarer le type dans `shared/visuals.ts`, puis `registerLayer(...)` dans `src/effects/registry.ts`.

## Sécurité

Le navigateur n'envoie que des intentions (`roll`, `potion`, `equip`…). Le tirage (RNG cryptographique), les récompenses, les succès et l'entrée du classement sont calculés par la fonction dans une transaction. Les règles interdisent toute écriture client sur `v2/players` et `v2/leaderboard` ; seuls les paramètres (`v2/settings/{uid}`) sont modifiables par leur propriétaire. Le rythme des rolls est limité côté serveur. Les bans existants (`bans/{uid}`) sont appliqués.

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
  2. `npx wrangler d1 migrations apply rng-aura --remote` (crée les tables, ne supprime rien).
  En local : `npm run db:migrate:local` puis `npm run dev:api` (base D1 locale dans `.wrangler/`, aucune donnée réelle).
- **Bans** : `npx wrangler d1 execute rng-aura --remote --command "INSERT INTO bans (uid, until, reason) VALUES ('<uid>', <timestamp_ms>, '<raison>')"`.
- **Reprise des données Firebase** (bans, pseudos, `v2`) : exporter le JSON depuis la console Firebase, puis
  `npm run db:import:convert -- export.json import.sql` et `npx wrangler d1 execute rng-aura --remote --file import.sql` (INSERT OR IGNORE uniquement).
- **Règles** : `npm run deploy:rules` — vérifie puis publie **uniquement** `database.rules.candidate.json` (⚠️ remplace les règles de la console).
- **Cloud Function** (alternative, forfait Blaze uniquement) : `npm run deploy:backend` — ne publie plus aucune règle.

Ne téléchargez jamais la clé du compte de service dans ce dossier ; elle est de toute façon exclue par `.gitignore`.
