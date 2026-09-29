// backend/services/priceService.js
// Service principal pour gérer les prix - Multi-provider avec fallback

const config = require("../config/providers");
const apiUsage = require("./apiUsage");
const { detectQuoteCurrency, normalizeQuoteUnits, toMajorUnit } = require("./currency");
const FMPProvider = require("./providers/fmp");
const AlphaVantageProvider = require("./providers/alphavantage");
const YahooProvider = require("./providers/yahoo");
const FinnhubProvider = require("./providers/finnhub");
// À ajouter plus tard :
// const TwelveDataProvider = require("./providers/twelvedata");
// const PolygonProvider = require("./providers/polygon");

const NOT_COVERED_TTL = 7 * 24 * 60 * 60 * 1000;

class PriceService {
  constructor() {
    this.providers = this.initializeProviders();
    this.cache = new Map(); // Cache en mémoire (sera remplacé par Redis si nécessaire)
  }

  /**
   * Initialise les providers actifs
   */
  initializeProviders() {
    const providers = {};

    // FMP
    if (config.fmp.enabled) {
      providers.fmp = new FMPProvider();
      console.log("✅ FMP Provider initialized");
    }

    // Alpha Vantage (EU stocks + Dividendes)
    if (config.alphavantage.enabled) {
      providers.alphavantage = new AlphaVantageProvider();
      console.log("✅ Alpha Vantage Provider initialized");
    }

    // Finnhub (optionnel, uniquement avec FINNHUB_API_KEY) : secours US avant Yahoo
    if (config.finnhub.enabled) {
      providers.finnhub = new FinnhubProvider();
      console.log("✅ Finnhub Provider initialized");
    }

    // Yahoo Finance (secours à couverture mondiale, sans clé)
    if (config.yahoo.enabled) {
      providers.yahoo = new YahooProvider();
      console.log("✅ Yahoo Provider initialized");
    }

    // Twelve Data (à activer plus tard)
    // if (config.twelvedata.enabled) {
    //   providers.twelvedata = new TwelveDataProvider();
    //   console.log("✅ Twelve Data Provider initialized");
    // }

    // Polygon (à activer plus tard)
    // if (config.polygon.enabled) {
    //   providers.polygon = new PolygonProvider();
    //   console.log("✅ Polygon Provider initialized");
    // }

    return providers;
  }

  /**
   * Récupère le quote d'un ticker avec fallback intelligent
   */
  async getQuote(ticker, options = {}) {
    const { forceRefresh = false, preferredProvider = null, previous = null, live = false } = options;

    // 1. Vérifier le cache d'abord (sauf si forceRefresh)
    if (!forceRefresh) {
      const cached = this.getFromCache(ticker);
      if (cached) {
        console.log(`💾 Cache hit for ${ticker} (age: ${this.getCacheAge(ticker)}ms)`);
        return cached;
      }
    }

    // 2. Déterminer l'ordre des providers à essayer
    let providersToTry = this.getProviderOrder(ticker, preferredProvider);
    // Actualisation intraday : uniquement les providers sans quota journalier (Yahoo)
    if (Array.isArray(options.providers)) providersToTry = providersToTry.filter((p) => options.providers.includes(p));
    if (!providersToTry.length) throw new Error(`Aucun provider disponible pour ${ticker}`);

    // Symbole que l'offre FMP ne couvre pas (402 constaté il y a moins de 7 jours) :
    // on ne gaspille plus de quota FMP dessus.
    const fmpRefusedAt = previous?.fmpNotCoveredAt ? new Date(previous.fmpNotCoveredAt).getTime() : 0;
    if (Date.now() - fmpRefusedAt < NOT_COVERED_TTL && providersToTry.length > 1) {
      providersToTry = providersToTry.filter((p) => p !== "fmp");
    }
    let fmpNotCovered = false;

    // 3. Essayer chaque provider dans l'ordre
    let quote = null;
    let usedProvider = null;

    for (const providerName of providersToTry) {
      const provider = this.providers[providerName];

      if (!provider) {
        console.warn(`⚠️ Provider ${providerName} not available`);
        continue;
      }

      // Vérifier si le provider supporte ce type de ticker
      if (!provider.supportsTickerType(ticker)) {
        console.log(`⏭️ ${providerName} doesn't support ${ticker}`);
        continue;
      }

      // Vérifier le rate limiting
      if (!this.checkRateLimit(providerName)) {
        console.warn(`⏸️ Rate limit reached for ${providerName}`);
        continue;
      }

      try {
        console.log(`🔄 Fetching ${ticker} from ${providerName}...`);

        quote = await provider.getQuote(ticker, { previous, live });
        usedProvider = providerName;

        console.log(`✅ ${ticker} fetched from ${providerName}`);
        break; // On a réussi, sortir de la boucle
      } catch (error) {
        console.error(`❌ ${providerName} failed for ${ticker}:`, error.message);
        if (providerName === "fmp" && error.code === "NOT_COVERED") fmpNotCovered = true;

        // Si c'est le dernier provider, throw l'erreur
        if (providerName === providersToTry[providersToTry.length - 1]) {
          throw new Error(
            `All providers failed for ${ticker}. Last error: ${error.message}`
          );
        }

        // Sinon, continuer avec le prochain provider
        console.log(`🔄 Trying next provider...`);
      }
    }

    if (!quote) {
      throw new Error(`No provider available for ${ticker}`);
    }
    if (!(Number(quote.price || quote.close) > 0)) {
      throw new Error(`Prix indisponible pour ${ticker}`);
    }

    // Providers qui ne convertissent pas eux-mêmes les sous-unités (pence → livres)
    if (quote.quoteCurrency === undefined) {
      quote = normalizeQuoteUnits(
        quote,
        detectQuoteCurrency({ ticker, apiCurrency: quote.currency, knownCurrency: previous?.quoteCurrency, exchange: quote.exchange })
      );
    }

    // 4. ENRICHISSEMENT : FMP n'a pas pu vérifier les dividendes d'une action
    //    → on tente Alpha Vantage, sauf si on a déjà une donnée de moins de 7 jours.
    //    (Quand Alpha Vantage est le provider, il récupère déjà les dividendes lui-même.)
    const dividendsChecked =
      quote.dividendsUpdatedAt ||
      (previous?.dividendsUpdatedAt && Date.now() - new Date(previous.dividendsUpdatedAt).getTime() < 7 * 86400000);

    if (
      usedProvider === "fmp" &&
      !quote.dividend &&
      !dividendsChecked &&
      quote.type === "Stock" &&
      this.providers.alphavantage?.config.enabled &&
      apiUsage.canCall("alphavantage")
    ) {
      try {
        const dividendInfo = await this.providers.alphavantage.getDividends(ticker);
        if (dividendInfo && dividendInfo.annualDividend) {
          // Alpha Vantage donne le dividende dans la devise de cotation (pence pour Londres)
          const { factor } = toMajorUnit(quote.quoteCurrency);
          quote.dividend = dividendInfo.annualDividend / factor;
          quote.dividendRate = quote.dividend;
          quote.dividendYield = dividendInfo.dividendYield;
          quote.exDividendDate = dividendInfo.exDividendDate;
          quote.dividendsUpdatedAt = new Date();
        }
      } catch (error) {
        console.log(`⚠️ Could not enrich dividends for ${ticker}: ${error.message}`);
      }
    }

    // FMP a donné le cours mais pas le profil ou les dividendes (souvent un 402 de l'offre gratuite),
    // ou Finnhub (cours seul) : on complète avec Yahoo, sans rien écraser du cours obtenu.
    const missingProfile = !quote.sector || quote.sector === "Unknown";
    const missingDividends = quote.type !== "Crypto" && !quote.dividendsUpdatedAt &&
      (!(previous?.dividendsUpdatedAt && Date.now() - new Date(previous.dividendsUpdatedAt).getTime() < 7 * 86400000) ||
        // dividende calculé par une ancienne version (sans fréquence) : on le recalcule
        (previous?.dividend > 0 && !previous?.dividendFrequency));
    if (!live && (usedProvider === "fmp" || usedProvider === "finnhub") && this.providers.yahoo && quote.type !== "Crypto" && (missingProfile || missingDividends)) {
      try {
        const extra = await this.providers.yahoo.getQuote(ticker, { previous });
        if (missingProfile) {
          for (const f of ["sector", "industry"]) if (extra[f]) quote[f] = extra[f];
          if (extra.name && (!quote.name || quote.name === ticker)) quote.name = extra.name;
          if (extra.type && extra.type !== "Stock") quote.type = extra.type;
          if (extra.profileUpdatedAt) quote.profileUpdatedAt = extra.profileUpdatedAt;
        }
        if (missingDividends && extra.dividendsUpdatedAt) {
          for (const f of ["dividend", "dividendRate", "dividendYield", "dividendFrequency", "exDividendDate", "dividendsUpdatedAt"]) quote[f] = extra[f];
        }
      } catch (error) {
        console.log(`⚠️ Could not enrich ${ticker} from Yahoo: ${error.message}`);
      }
    }

    // Mémoriser qu'FMP ne couvre pas ce symbole (ou qu'il le couvre à nouveau)
    if (fmpNotCovered) quote.fmpNotCoveredAt = new Date();
    else if (usedProvider === "fmp") quote.fmpNotCoveredAt = null;
    else if (previous?.fmpNotCoveredAt) quote.fmpNotCoveredAt = previous.fmpNotCoveredAt;

    // 5. Mettre en cache
    this.saveToCache(ticker, quote);

    return quote;
  }

  /**
   * Récupère plusieurs tickers en batch (plus efficace)
   */
  async getBatchQuotes(tickers, options = {}) {
    const results = {};
    const uncachedTickers = [];

    // 1. Récupérer ce qui est en cache
    for (const ticker of tickers) {
      const cached = this.getFromCache(ticker);
      if (cached && !options.forceRefresh) {
        results[ticker] = cached;
      } else {
        uncachedTickers.push(ticker);
      }
    }

    if (uncachedTickers.length === 0) {
      console.log(`💾 All ${tickers.length} tickers found in cache`);
      return results;
    }

    console.log(
      `📊 Fetching ${uncachedTickers.length}/${tickers.length} tickers from API...`
    );

    // 2. Grouper les tickers par provider optimal
    const tickersByProvider = this.groupTickersByProvider(uncachedTickers);

    // 3. Fetch chaque groupe avec son provider optimal
    for (const [providerName, tickerGroup] of Object.entries(tickersByProvider)) {
      const provider = this.providers[providerName];

      if (!provider) continue;

      try {
        // Utiliser batch si disponible, sinon faire des requêtes individuelles
        if (provider.getBatchQuotes && tickerGroup.length > 1) {
          console.log(`🔄 Batch fetching ${tickerGroup.length} tickers from ${providerName}...`);

          const quotes = await provider.getBatchQuotes(tickerGroup);

          quotes.forEach((quote) => {
            results[quote.symbol] = quote;
            this.saveToCache(quote.symbol, quote);
          });

        } else {
          // Requêtes individuelles
          for (const ticker of tickerGroup) {
            try {
              const quote = await this.getQuote(ticker, {
                preferredProvider: providerName,
              });
              results[ticker] = quote;

              // Petit délai pour respecter les rate limits
              await this.sleep(100);
            } catch (error) {
              console.error(`❌ Failed to fetch ${ticker}:`, error.message);
              results[ticker] = null;
            }
          }
        }
      } catch (error) {
        console.error(`❌ Batch fetch failed for ${providerName}:`, error.message);

        // Fallback : essayer individuellement avec d'autres providers
        for (const ticker of tickerGroup) {
          if (!results[ticker]) {
            try {
              results[ticker] = await this.getQuote(ticker);
            } catch (err) {
              results[ticker] = null;
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Détermine l'ordre des providers à essayer pour un ticker
   */
  getProviderOrder(ticker, preferredProvider = null) {
    const activeProviders = config.activeProviders.filter((p) => this.providers[p]);

    // Si un provider préféré est spécifié, le mettre en premier
    if (preferredProvider && this.providers[preferredProvider]) {
      return [
        preferredProvider,
        ...activeProviders.filter((p) => p !== preferredProvider),
      ];
    }

    // Sinon, l'ordre de config.activeProviders, puis Finnhub (secours US, si une clé est configurée),
    // puis Yahoo en dernier recours (couverture mondiale : symboles hors offre FMP, places européennes, ETF…)
    if (this.providers.finnhub && !activeProviders.includes("finnhub")) activeProviders.push("finnhub");
    if (this.providers.yahoo && !activeProviders.includes("yahoo")) activeProviders.push("yahoo");
    return activeProviders;
  }

  /**
   * Groupe les tickers par provider optimal
   */
  groupTickersByProvider(tickers) {
    const groups = {};

    for (const ticker of tickers) {
      // Choisir le meilleur provider pour ce ticker
      let bestProvider = config.primary;

      // EU stocks → FMP (meilleur gratuit pour EU)
      if (ticker.endsWith(".PA") || ticker.endsWith(".AS")) {
        bestProvider = "fmp";
      }

      // US stocks → FMP ou Twelve Data selon disponibilité
      else if (!ticker.includes("-") && !ticker.endsWith(".")) {
        bestProvider = this.providers.twelvedata ? "twelvedata" : "fmp";
      }

      // Crypto → Twelve Data si disponible, sinon FMP
      else if (ticker.includes("BTC") || ticker.includes("ETH") || ticker.endsWith("-USD")) {
        bestProvider = this.providers.twelvedata ? "twelvedata" : "fmp";
      }

      if (!groups[bestProvider]) {
        groups[bestProvider] = [];
      }

      groups[bestProvider].push(ticker);
    }

    return groups;
  }

  /**
   * Gestion du cache
   */
  getFromCache(ticker) {
    const cached = this.cache.get(ticker);

    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    const maxAge = config.cache.maxAge;

    // Si le cache est trop vieux, le considérer comme invalide
    if (age > maxAge) {
      console.log(`🗑️ Cache expired for ${ticker} (${age}ms > ${maxAge}ms)`);
      this.cache.delete(ticker);
      return null;
    }

    return cached.data;
  }

  saveToCache(ticker, data) {
    this.cache.set(ticker, {
      data,
      timestamp: Date.now(),
    });
  }

  getCacheAge(ticker) {
    const cached = this.cache.get(ticker);
    return cached ? Date.now() - cached.timestamp : null;
  }

  clearCache(ticker = null) {
    if (ticker) {
      this.cache.delete(ticker);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Rate limiting
   */
  checkRateLimit(providerName) {
    return apiUsage.canCall(providerName);
  }

  /**
   * Utilitaires
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Stats d'utilisation
   */
  getUsageStats() {
    return {
      providers: apiUsage.stats(),
      cacheSize: this.cache.size,
      cacheEntries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Health check de tous les providers
   */
  async healthCheckAll() {
    const results = {};

    for (const [name, provider] of Object.entries(this.providers)) {
      if (provider.healthCheck) {
        results[name] = await provider.healthCheck();
      }
    }

    return results;
  }
}

// Export en singleton
module.exports = new PriceService();