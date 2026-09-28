# API de données de marché

Comparatif des sources gratuites utilisables par Nauticash et stratégie retenue.

> ⚠️ Les quotas et couvertures des offres gratuites changent souvent. Les valeurs ci-dessous sont celles connues au 27/09/2026 et **n'ont pas été re-vérifiées en direct** sur les sites des fournisseurs : les confirmer avant toute décision (abonnement, changement de provider).

## Comparatif

| Fournisseur | Offre gratuite (indicatif) | Points forts | Limites | Usage dans Nauticash |
|---|---|---|---|---|
| **Financial Modeling Prep (FMP)** | ~250 appels/jour | Cours, profil (secteur, pays, ETF), dividendes ; API `/stable` | Couverture gratuite surtout US, données de fin de journée pour une partie des marchés | **Provider principal** (`services/providers/fmp.js`) |
| **Alpha Vantage** | ~25 appels/jour, ~5/min | Actions européennes, historique mensuel ajusté (dividendes) | Quota très faible | Secours et enrichissement des dividendes (`services/providers/alphavantage.js`) |
| **Finnhub** | ~60 appels/min | Cours US temps réel, profil, dividendes, actualités | International surtout payant | Candidat : fallback US optionnel (clé `FINNHUB_API_KEY`) |
| **Twelve Data** | ~800 appels/jour, ~8/min | Bonne API, crypto, forex | Europe et ETF plutôt payants | Configuré mais non branché (`config/providers.js`) |
| **Frankfurter** | Gratuit, sans clé | Taux de change de référence BCE, simple et fiable | Taux quotidiens uniquement | **Utilisé** : `GET /api/fx` (`services/fx.js`), cache 6 h, base EUR |
| **Yahoo Finance (non officiel)** | Pas d'offre officielle | Couverture mondiale très large | Non documenté, peut casser ou bloquer sans préavis | Dernier recours uniquement, à éviter en production |

## Stratégie actuelle

1. **Cache en base** (collection `prices`) : la page portefeuille ne lit que la base, jamais l'API directement.
2. **Cron** toutes les 6 h (`jobs/updatePrices.js`) : réutilise les prix encore frais, ne rafraîchit pas les actions le week-end, s'arrête proprement quand le quota est atteint.
3. **Coût par action** : 1 appel FMP (cours) dans la plupart des cas ; profil re-téléchargé tous les 30 jours, dividendes tous les 7 jours.
4. **Quotas** comptés par appel HTTP réel (`services/apiUsage.js`), surchargeables par `FMP_DAILY_LIMIT` / `ALPHAVANTAGE_DAILY_LIMIT`.
5. **Fallback** : ordre de `ACTIVE_PROVIDERS`, avec enrichissement des dividendes par Alpha Vantage si FMP n'a rien trouvé.

## Cohérence des données (vérifiée le 27/09/2026)

- `/stable/quote` ne renvoie pas la devise : elle vient du profil FMP, sinon du suffixe du ticker (`.DE` → EUR, `.SW` → CHF, `.L` → GBp…), sinon de la place de cotation (`services/currency.js`).
- Les cotations en sous-unités (GBp/GBX de Londres, ZAc, ILA) sont converties en devise principale avant l'enregistrement : la base ne contient que des GBP, ZAR, ILS.
- Dividende annuel = somme des N derniers versements, N = fréquence annuelle (`services/dividends.js`), et non « tout ce qui tombe dans 365 jours ».
- Un prix nul n'est jamais enregistré ; l'heure de cotation FMP est conservée (`marketTime`).

## Historique quotidien (depuis le 28/09/2026)

Chaque soir à 21:45 UTC (`CRON_HISTORY_SCHEDULE`, désactivable avec `CRON_DAILY_HISTORY=false`), `jobs/dailySnapshot.js` enregistre pour chaque utilisateur la valeur du portefeuille en euros (cours en cache × quantités + cash, taux BCE du jour) dans la collection `history_daily` (`{ userId, date: "AAAA-MM-JJ", value, invested, cash, missing }`). Aucun appel aux API de cotation : seuls les cours déjà en base sont utilisés. Le relevé mensuel (`history`) est tenu à jour automatiquement (`auto: true`), sauf si l'utilisateur a saisi une valeur à la main pour ce mois. Lecture : `GET /api/user/history/daily?days=365`.

## Indices de référence (depuis le 28/09/2026)

`GET /api/market/benchmarks/:key` (CAC40 = `^FCHI`, SP500 = `^GSPC`, MSCIWORLD = ETF `URTH`) renvoie ≈ 400 jours de clôtures via l'endpoint FMP `historical-price-eod/light`. Les points sont gardés en base (collection `benchmarks`) 12 h et partagés entre tous les utilisateurs : au plus 2 appels par indice et par jour, soit 6 appels/jour au maximum. En cas d'échec FMP, les dernières données connues sont renvoyées avec `stale: true`.

## Couverture des symboles (28/09/2026)

**Constat** : l'offre gratuite FMP ne couvre qu'environ 90 symboles (« Symbol limited to AAPL, TSLA, AMZN and 84 more » sur la grille tarifaire). Pour les autres (GOOG, la plupart des actions européennes…), FMP répond `402` : le titre ne pouvait pas être ajouté, ou le cours arrivait sans profil ni dividendes (secteur « Unknown », pays deviné, analyse faussée). V (Visa) fait partie des symboles couverts, d'où la différence.

**Correctif** : 402 = `NOT_COVERED` (et non quota). `services/providers/yahoo.js` (Yahoo Finance, sans clé, couverture mondiale) prend le relais :
- cours absent chez FMP → cours, veille, devise, place, dividendes 1 an (`v8/finance/chart`) + nom, type, secteur, industrie (`v1/finance/search`) ; le refus FMP est mémorisé 7 jours (`fmpNotCoveredAt`) pour ne plus gaspiller le quota ;
- cours FMP mais profil/dividendes refusés → complétés par Yahoo sans écraser le cours FMP.
Yahoo est ajouté automatiquement en dernier recours (`YAHOO_ENABLED=false` pour le couper). API non officielle : si elle devenait indisponible, l'alternative est l'offre FMP Starter (tous les symboles US) ou supérieure.

**Autocomplétion** : `GET /api/market/search?q=` fusionne une liste locale de titres courants (`services/popularTickers.js`, instantanée, sans appel) et la recherche Yahoo mise en cache 7 jours par requête ; indices exclus ; 60 recherches/min/IP.

## Mesure de la couverture (route admin, depuis le 28/09/2026)

`GET /api/admin/coverage` (compte listé dans `ADMIN_EMAILS`) teste, pour chaque ticker réellement détenu (les plus détenus d'abord), si chaque provider actif renvoie un cours. Lecture seule : rien n'est enregistré.

- Paramètres : `limit` (1 à 200 tickers, 50 par défaut) et `providers` (ex. `fmp,yahoo` ; par défaut tous les providers actifs).
- Coût : **1 appel par provider et par ticker** (FMP `quote`, Alpha Vantage `GLOBAL_QUOTE`, Yahoo `chart` léger), compté dans les quotas ; un provider dont le quota est atteint n'est plus appelé (statut `quota`). Avec 50 tickers, compter 50 appels FMP sur 250/jour : à lancer hors du créneau de 21:15 UTC, ou avec `providers=yahoo`.
- Statuts par ticker : `ok` (cours reçu), `not_covered` (402 FMP, 404 ou aucune donnée), `unsupported` (type non géré, ex. crypto chez Alpha Vantage), `quota`, `error`.
- Réponse : `summary.<provider>` (compteurs + `coverage` en % = ok / (ok + not_covered)), `uncovered` (tickers qu'aucun provider ne cote), `tickers[]` (détenteurs, source actuelle en base, résultat par provider).

### Résultats en production

À remplir après un appel en production (l'environnement de test n'a ni la base réelle ni les clés API) :

| Date | Tickers testés | FMP | Yahoo | Alpha Vantage | Non couverts |
|---|---|---|---|---|---|
| _à mesurer_ | | | | | |

## Rythme d'actualisation (28/09/2026)

| Quand | Job | Source | Coût |
|---|---|---|---|
| Chaque minute, marché ouvert | `jobs/livePrices.js` | Yahoo (appel léger `range=1d`, sans dividendes ni profil) | 0 appel FMP ; au plus `LIVE_MAX_PER_RUN` (30) titres/min, un titre rafraîchi il y a < 55 s est ignoré ; titres détenus uniquement ; rien la nuit et le week-end sauf crypto (`services/marketHours.js`) |
| 21:15 UTC chaque soir | `jobs/updatePrices.js` | FMP (symboles couverts) puis Yahoo | actualisation complète : cours de clôture, profil (30 j), dividendes (7 j) ; l'âge se mesure sur `fullUpdateAt` pour ne pas être masqué par les cours intraday |
| 21:45 UTC chaque soir | `jobs/dailySnapshot.js` | base uniquement | 0 appel |
| Toutes les 60 s, onglet ouvert | page Portefeuille | lit la base (`GET /api/user/portfolio`) | 0 appel fournisseur |

**Veille (variation du jour) chez Yahoo** : en séance, la dernière barre quotidienne est celle du jour ; la clôture de la veille est la dernière barre d'un jour antérieur à `regularMarketTime` (corrige la variation ≈ 0 constatée sur NVDA).

**Place de cotation et logo** : `exchange` (libellé lisible : NASDAQ, NYSE, Euronext Paris, XETRA…) et `logo` (images publiques FMP, initiales en secours) sont renvoyés pour chaque position et chaque suggestion de recherche.

## Pistes (voir `docs/AMELIORATIONS.md`)

- Reporter ci-dessus les résultats de `GET /api/admin/coverage` en production.
- Finnhub en fallback US, désactivé sans clé.
- Fallback par région : suffixes `.PA`, `.AS`, `.DE`, `.L` → provider adapté à l'Europe.
