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

## Pistes (voir `docs/AMELIORATIONS.md`)

- Route admin qui mesure, pour les tickers réellement détenus, quel provider les couvre (résultats à reporter ici).
- Finnhub en fallback US, désactivé sans clé.
- Fallback par région : suffixes `.PA`, `.AS`, `.DE`, `.L` → provider adapté à l'Europe.
