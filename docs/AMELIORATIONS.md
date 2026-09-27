# Amélioration continue de Nauticash

Ce fichier pilote les sessions automatiques d'amélioration (tâche planifiée).
Chaque session : prend **la première tâche non cochée**, la réalise, vérifie, coche, écrit une ligne au journal.

## Règles

- Travailler **uniquement** sur la branche `claude/amelioration-continue` (jamais de push sur `main`) ; Alex relit et merge.
- **Une seule tâche par session**, petite et terminée (sinon la découper ici en sous-tâches et ne faire que la première).
- Avant de pousser : `cd backend && npm test` doit passer, et le build du frontend doit compiler
  (Google Fonts peut être bloqué dans l'environnement : remplacer temporairement les polices dans `app/layout.js` pour le build, puis restaurer le fichier).
- Ne jamais changer : les variables d'environnement attendues sans le noter ici, le schéma des données existantes sans migration compatible, les pages légales (contenu juridique).
- Respecter `docs/DESIGN.md` (identité visuelle) ; les choix d'API sont documentés dans `docs/API.md`.
- Pas de nouvelle dépendance sans nécessité claire (préférer le natif), jamais de clé API dans le code.
- Toute nouvelle route backend est accompagnée de tests.
- Si une tâche est bloquée (info manquante, accès), la marquer `[!]` avec la raison et passer à la suivante.

## Tâches

- [x] Ajouter une suite de tests backend exécutable par `npm test` (node:test, base MongoDB simulée en mémoire, API FMP simulée) couvrant auth, reset mot de passe, portefeuille, cash, historique, admin, quotas
- [x] Mise en place : `docs/DESIGN.md` (direction artistique), `docs/API.md` (comparatif des API), backlog réordonné
- [ ] Design system selon DESIGN.md : tokens Tailwind/globals.css, mode sombre, composants de base (Card, Button, Stat, Badge, Modal, Toast) dans app/components/ui
- [ ] Migrer les pages analytics (`app/analytics/**`, `PortfolioHistoryChart.jsx`) vers `lib/api.js`
- [ ] Remplacer `alert()` / `window.confirm()` par les Toast / Modal du design system
- [ ] En-tête / navigation commune (portefeuille, analytics, compte) aux couleurs du design system
- [ ] Tableau de bord patrimoine : valeur totale en grand, variation du jour et depuis l'achat, courbe d'évolution, répartition par type d'actif / secteur / pays
- [ ] Pages 404 (`app/not-found.js`) et erreur (`app/error.js`) avec l'identité Nauticash
- [ ] Vue mobile du tableau des positions (cartes empilées sous 768 px)
- [ ] Taux de change servis par le backend via Frankfurter avec cache (fin des appels navigateur à exchangerate-api)
- [ ] Dividendes : calendrier des prochains versements et revenu annuel estimé
- [ ] Route admin qui mesure la couverture des tickers des portefeuilles par chaque provider ; résultats dans docs/API.md
- [ ] Provider Finnhub optionnel (variable FINNHUB_API_KEY) en fallback US, désactivé sans clé
- [ ] Page « Mon compte » : changer son mot de passe et supprimer son compte (RGPD)
- [ ] Export des données du compte en JSON/CSV (RGPD)
- [ ] En-têtes de sécurité dans `next.config.mjs`
- [ ] SEO : robots, sitemap (pages publiques), Open Graph, icônes
- [ ] Accessibilité : libellés, aria-*, focus visibles, contrastes
- [ ] États de chargement (squelettes) sur portefeuille et analytics
- [ ] Une seule librairie de graphiques au lieu de chart.js + echarts + recharts
- [ ] Vulnérabilités `npm audit` backend et frontend (sans --force ; tests et build doivent passer)
- [ ] Tests : renommer le test « quota atteint pendant l'enrichissement » (il vérifie que rien n'est enregistré) et faire que FMP_DAILY_LIMIT=0 bloque les appels au lieu de supprimer la limite
- [ ] ESLint (`npm run lint`) sans avertissement
- [ ] Refonte visuelle de l'accueil selon DESIGN.md + relecture des textes (ton professionnel, appel à l'action clair)

## Journal

<!-- Une ligne par session : date – tâche – résultat (commit) -->
- 2026-09-26 – Pages d'authentification robustes (message clair si le serveur renvoie du HTML) + réponses 404/erreurs en JSON côté backend
- 2026-09-26 – Suite de tests backend (`npm test`, node:test, MongoDB et API FMP/Resend simulées, 69 tests : auth, reset mot de passe, portefeuille, cash, historique, admin, quotas) – OK ; `server.js` ne démarre plus le serveur quand il est importé ; Node >= 18 requis
- 2026-09-27 – Mise en place : DESIGN.md (identité « abysse / lagon », tokens, composants, accessibilité), API.md (comparatif FMP, Alpha Vantage, Finnhub, Twelve Data, Frankfurter, Yahoo ; quotas à re-vérifier), backlog réordonné (22 tâches) – OK
