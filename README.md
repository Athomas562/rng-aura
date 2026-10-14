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
database.rules.json  Règles de sécurité
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
npm run dev           # contre le vrai Firebase (nécessite les Functions déployées)
npm test              # tests du moteur et de l'API
npm run build         # build de production dans dist/
```

## Déploiement

1. Passer le projet Firebase `rng-aura` au forfait **Blaze** (requis par Cloud Functions).
2. `npm i -g firebase-tools && firebase login`
3. `npm run deploy:backend` — déploie la fonction `api` et `database.rules.json`.
   ⚠️ Ces règles **remplacent** celles de la console : les anciennes données (`saves/`, chat, amis…) restent en base mais ne sont plus accessibles aux clients.
4. Front : Netlify (`netlify.toml` : `npm run build`, dossier `dist`).

Coût : la fonction est limitée à 10 instances ; l'auto-roll groupe ses rolls par 4 pour diviser le nombre d'appels.
