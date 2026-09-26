# Amélioration continue de Nauticash

Ce fichier pilote les sessions automatiques d'amélioration (tâche planifiée).
Chaque session : prend **la première tâche non cochée**, la réalise, vérifie, coche, écrit une ligne au journal.

## Règles

- Travailler **uniquement** sur la branche `amelioration-continue` (jamais de push sur `main`) ; Alex relit et merge.
- **Une seule tâche par session**, petite et terminée (sinon la découper ici en sous-tâches et ne faire que la première).
- Avant de pousser : `cd backend && npm test` doit passer, et le build du frontend doit compiler
  (Google Fonts peut être bloqué dans l'environnement : remplacer temporairement les polices dans `app/layout.js` pour le build, puis restaurer le fichier).
- Ne jamais changer : les variables d'environnement attendues sans le noter ici, le schéma des données existantes sans migration compatible, les pages légales (contenu juridique).
- Pas de nouvelle dépendance sans nécessité claire (préférer le natif).
- Si une tâche est bloquée (info manquante, accès), la marquer `[!]` avec la raison et passer à la suivante.

## Tâches

- [ ] Ajouter une suite de tests backend exécutable par `npm test` (node:test, base MongoDB simulée en mémoire, API FMP simulée) couvrant auth, reset mot de passe, portefeuille, cash, historique, admin, quotas
- [ ] Migrer les pages analytics (`app/analytics/**`, `PortfolioHistoryChart.jsx`) vers `lib/api.js` (gestion session expirée et erreurs)
- [ ] Remplacer les `alert()` / `window.confirm()` par des notifications et une fenêtre de confirmation intégrées au design
- [ ] Créer un composant d'en-tête / navigation commun (portefeuille, analytics) au lieu des en-têtes dupliqués
- [ ] Ajouter une page 404 (`app/not-found.js`) et une page d'erreur (`app/error.js`) aux couleurs du site
- [ ] Vue mobile du tableau des positions (cartes empilées sous 768 px, sans défilement horizontal)
- [ ] Page « Mon compte » : changer son mot de passe (route backend protégée) et supprimer son compte (RGPD)
- [ ] Export des données du compte en JSON/CSV depuis « Mon compte » (RGPD, portabilité)
- [ ] En-têtes de sécurité dans `next.config.mjs` (X-Frame-Options, Referrer-Policy, X-Content-Type-Options, Permissions-Policy)
- [ ] SEO : `app/robots.js`, `app/sitemap.js` (pages publiques uniquement), métadonnées Open Graph, favicon/icônes
- [ ] Accessibilité : libellés de formulaires, `aria-*` sur les boutons icônes, focus visibles, contrastes
- [ ] États de chargement (squelettes) sur portefeuille et analytics
- [ ] Réduire les librairies de graphiques (chart.js, echarts et recharts sont toutes présentes) : en garder une seule si possible
- [ ] Taux de change : servir les taux depuis le backend avec cache (au lieu d'un appel direct du navigateur à exchangerate-api)
- [ ] Passer ESLint (`npm run lint`) et corriger les avertissements
- [ ] Relecture des textes de l'accueil : cohérence FR/EN, ton professionnel, appel à l'action clair

## Journal

<!-- Une ligne par session : date – tâche – résultat (commit) -->
- 2026-09-26 – Pages d'authentification robustes (message clair si le serveur renvoie du HTML) + réponses 404/erreurs en JSON côté backend
