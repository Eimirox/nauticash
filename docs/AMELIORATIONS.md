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
- Variables d'environnement du frontend documentées dans `frontend/.env.example` (dont `NEXT_PUBLIC_CONTACT_EMAIL`, ajoutée pour la bêta).
- Pas de nouvelle dépendance sans nécessité claire (préférer le natif), jamais de clé API dans le code.
- Toute nouvelle route backend est accompagnée de tests.
- Si une tâche est bloquée (info manquante, accès), la marquer `[!]` avec la raison et passer à la suivante.

## Tâches

- [x] Ajouter une suite de tests backend exécutable par `npm test` (node:test, base MongoDB simulée en mémoire, API FMP simulée) couvrant auth, reset mot de passe, portefeuille, cash, historique, admin, quotas
- [x] Mise en place : `docs/DESIGN.md` (direction artistique), `docs/API.md` (comparatif des API), backlog réordonné
- [x] Design system selon DESIGN.md : tokens Tailwind/globals.css, mode sombre, composants de base (Card, Button, Stat, Badge, Modal, Toast) dans app/components/ui
- [x] Migrer les pages analytics (`app/analytics/**`, `PortfolioHistoryChart.jsx`) vers `lib/api.js`
- [x] Remplacer `alert()` / `window.confirm()` par les Toast / Modal du design system
- [x] En-tête / navigation commune (portefeuille, analytics, compte) aux couleurs du design system

### Avant le lancement au cercle proche (prioritaire)

- [x] Supprimer les onglets internes des pages analytics, devenus redondants avec la navigation de l'en-tête
- [x] Pages 404 (`app/not-found.js`) et erreur (`app/error.js`) avec l'identité Nauticash
- [x] Vue mobile du tableau des positions (cartes empilées sous 768 px)
- [x] Page « Mon compte » : changer son mot de passe et supprimer son compte (RGPD)
- [x] En-têtes de sécurité dans `next.config.mjs`
- [x] Vulnérabilités `npm audit` backend et frontend (sans --force ; tests et build doivent passer)
- [x] Refonte visuelle de l'accueil selon DESIGN.md + relecture des textes (ton professionnel, appel à l'action clair)
- [x] Page « Bêta » : bandeau discret « Version bêta » dans l'en-tête + lien « Donner mon avis » (mailto vers l'adresse de contact) pour recueillir les retours du cercle proche

### Après le lancement

- [ ] Passer node-cron en v4 (supprime les 2 dernières alertes npm audit backend, dépendance uuid non exploitable ici) en vérifiant le cron d'actualisation des prix
- [ ] Tableau de bord patrimoine : valeur totale en grand, variation du jour et depuis l'achat, courbe d'évolution, répartition par type d'actif / secteur / pays
- [ ] Taux de change servis par le backend via Frankfurter avec cache (fin des appels navigateur à exchangerate-api)
- [ ] Dividendes : calendrier des prochains versements et revenu annuel estimé
- [ ] Route admin qui mesure la couverture des tickers des portefeuilles par chaque provider ; résultats dans docs/API.md
- [ ] Provider Finnhub optionnel (variable FINNHUB_API_KEY) en fallback US, désactivé sans clé
- [ ] Export des données du compte en JSON/CSV (RGPD)
- [ ] SEO : robots, sitemap (pages publiques), Open Graph, icônes
- [ ] Accessibilité : libellés, aria-*, focus visibles, contrastes
- [ ] États de chargement (squelettes) sur portefeuille et analytics
- [ ] Une seule librairie de graphiques au lieu de chart.js + recharts (echarts retiré, il n'était pas utilisé)
- [ ] Tests : renommer le test « quota atteint pendant l'enrichissement » (il vérifie que rien n'est enregistré) et faire que FMP_DAILY_LIMIT=0 bloque les appels au lieu de supprimer la limite
- [ ] ESLint (`npm run lint`) sans avertissement

## Journal

<!-- Une ligne par session : date – tâche – résultat (commit) -->
- 2026-09-26 – Pages d'authentification robustes (message clair si le serveur renvoie du HTML) + réponses 404/erreurs en JSON côté backend
- 2026-09-26 – Suite de tests backend (`npm test`, node:test, MongoDB et API FMP/Resend simulées, 69 tests : auth, reset mot de passe, portefeuille, cash, historique, admin, quotas) – OK ; `server.js` ne démarre plus le serveur quand il est importé ; Node >= 18 requis
- 2026-09-27 – Mise en place : DESIGN.md (identité « abysse / lagon », tokens, composants, accessibilité), API.md (comparatif FMP, Alpha Vantage, Finnhub, Twelve Data, Frankfurter, Yahoo ; quotas à re-vérifier), backlog réordonné (22 tâches) – OK
- 2026-09-27 – Design system : jetons de couleur (clair/sombre) dans globals.css + Tailwind, composants Card, Button, Badge, Stat/Delta, Modal/ConfirmModal, Toast, ThemeToggle et formats FR dans app/components/ui ; mode sombre par classe (clair par défaut tant que les pages ne sont pas migrées) – OK (build + 69 tests)
- 2026-09-27 – Pages analytics (vue d'ensemble, dividendes, géographie, performance, historique) passées sur lib/api.js : session expirée → retour à la connexion, message d'erreur visible au lieu d'un écran vide, enregistrements d'historique vérifiés (avant : échecs silencieux) ; appels exchangerate-api laissés pour la tâche « taux de change » – OK (build + 69 tests)
- 2026-09-27 – Fin des alert()/confirm() : suppression d'une position via fenêtre de confirmation (ConfirmModal), actualisation des prix et historique via notifications (Toast) ; vérifié dans le navigateur avec API simulée – OK (build + 69 tests)
- 2026-09-27 – En-tête commun (app/components/AppHeader.js) sur portefeuille et les 4 pages analytics : navigation avec page active, défilante sur mobile, bouton Actualiser intégré, Déconnexion partout (avant : absente des pages analytics) ; lien « Mon compte » à ajouter avec la page correspondante ; vérifié en capture bureau + mobile – OK (build + 69 tests)
- 2026-09-27 – [Demande d'Alex] Pays et carte du monde corrigés : normalisation des pays côté backend (services/countries.js : siège de l'entreprise via le profil FMP, suffixe du ticker, place de cotation, anciennes valeurs comme « NasdaqGS » ou « Amsterdam »), code ISO numérique renvoyé au frontend, profil re-téléchargé une fois pour les titres sans code pays, fond de carte servi par le site au lieu du CDN, continent principal calculé par valeur ; 14 nouveaux tests – OK (build + 83 tests)
- 2026-09-27 – Onglets internes des pages analytics supprimés (doublon avec l'en-tête) ; chaque page a son propre titre et sa description (Vue d'ensemble, Performance, Dividendes, Géographie) – OK (build + 83 tests)
- 2026-09-27 – Pages 404 « Cap perdu », erreur « Avis de gros temps » (bouton Réessayer) et global-error de secours ; composants Compass (boussole signature, animée) et DepthLines (lignes de niveau) réutilisables ; vérifié en clair, sombre et mobile – OK (build + 83 tests)
- 2026-09-27 – Vue mobile du portefeuille : une carte par position sous 768 px (montant, performance, prix, quantité/PRU éditables, dividende, suppression) + tri par liste déroulante, bouton plein écran masqué sur mobile ; badges « Action / Crypto » corrigés (le backend renvoie « Stock ») ; montants au format français ; vérifié à 375 px (aucun défilement horizontal, modification enregistrée) – OK (build + 83 tests)
- 2026-09-27 – Page « Mon compte » (/compte, lien dans l'en-tête) : changement de mot de passe (actuel requis, mêmes règles qu'à l'inscription) et suppression définitive du compte avec mot de passe + confirmation (portefeuille, cash, historique, transactions effacés) ; routes POST /api/auth/change-password et DELETE /api/auth/account limitées en tentatives ; 6 nouveaux tests. À faire par Alex : les CGU disent « demander la suppression à l'adresse de contact », on peut désormais mentionner la page Mon compte – OK (build + 89 tests)
- 2026-09-27 – En-têtes de sécurité : frontend (Content-Security-Policy limitée au site, au backend et à exchangerate-api, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS, sans en-tête « X-Powered-By ») et backend (nosniff, DENY, CSP stricte pour l'API) ; vérifié en build de production sur 8 pages sans aucune violation CSP ; historique protégé contre une réponse inattendue – OK (build + 90 tests)
- 2026-09-27 – Vulnérabilités : backend 16 → 2 (modérées, via node-cron/uuid, non exploitables ici : uuid v3/v5/v6 avec buffer non utilisés ; montée en node-cron 4 ajoutée au backlog), frontend 20 → 0 (npm audit fix, nodemon 3 en dev, overrides d3-color 3 et brace-expansion, echarts retiré car inutilisé) ; carte du monde revérifiée avec d3-color 3 – OK (build + 90 tests)
- 2026-09-27 – Accueil refondu selon DESIGN.md : hero « abysse » avec lignes de niveau, promesse « Gardez le cap sur votre patrimoine boursier », aperçu illustratif du tableau de bord (valeurs fictives signalées), 3 bénéfices, « Prêt en trois minutes », engagements (aucune connexion bancaire, HTTPS, gratuit en bêta), appel à l'action adapté si l'utilisateur est déjà connecté, pied de page légal ; bascule FR/EN et carrousel retirés (site 100 % français) ; vérifié bureau + 375 px sans défilement horizontal – OK (build + 90 tests)
- 2026-09-27 – Bêta : badge « Bêta » à côté du logo dans l'en-tête + lien « Donner mon avis » (email pré-rempli avec la page en cours) vers NEXT_PUBLIC_CONTACT_EMAIL (lien masqué tant que la variable n'est pas définie) ; sur mobile le lien passe dans la barre de navigation pour éviter le débordement ; frontend/.env.example créé ; cash du portefeuille protégé contre une valeur absente (affichait « NaN ») – OK (build + 90 tests). Toutes les tâches « avant lancement » sont faites.
