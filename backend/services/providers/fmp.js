// backend/services/providers/fmp.js
// Provider pour Financial Modeling Prep (FMP)

const config = require("../../config/providers");
const { trackedFetchJson } = require("../apiUsage");
const { detectQuoteCurrency, normalizeQuoteUnits } = require("../currency");
const { annualizeDividends } = require("../dividends");

const DAY = 24 * 60 * 60 * 1000;
const PROFILE_TTL = 30 * DAY;
const DIVIDENDS_TTL = 7 * DAY;
const isStale = (date, ttl) => !date || Date.now() - new Date(date).getTime() > ttl;

// Pays renvoyé par le profil FMP (code ISO) → libellé utilisé par l'app
const ISO_TO_COUNTRY = {
  US: "États-Unis", FR: "France", NL: "Pays-Bas", GB: "Royaume-Uni", DE: "Allemagne",
  CH: "Suisse", IE: "Irlande", LU: "Luxembourg", BE: "Belgique", ES: "Espagne",
  IT: "Italie", CA: "Canada", JP: "Japon", CN: "Chine", DK: "Danemark", SE: "Suède",
};

class FMPProvider {
  constructor() {
    this.name = "FMP";
    this.config = config.fmp;
    this.baseUrl = this.config.baseUrl;
    this.apiKey = this.config.apiKey;
  }

  /**
   * Appel HTTP compté dans le quota (voir services/apiUsage.js)
   */
  async request(path, params) {
    const query = new URLSearchParams({ ...params, apikey: this.apiKey }).toString();
    return trackedFetchJson("fmp", `${this.baseUrl}/${path}?${query}`);
  }

  /**
   * Récupère le quote d'une action.
   * `previous` = données déjà en base : le profil (30 j) et les dividendes (7 j)
   * ne sont re-téléchargés que s'ils sont périmés → 1 seul appel API dans la plupart des cas.
   */
  async getQuote(ticker, { previous = null } = {}) {
    if (!this.config.enabled || !this.apiKey) {
      throw new Error("FMP provider not configured");
    }

    const mappedTicker = this.config.tickerMapping[ticker] || ticker;

    const data = await this.request("quote", { symbol: mappedTicker });
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No data found for ${ticker}`);
    }

    const raw = data[0];
    if (!(Number(raw.price) > 0)) {
      // Ne jamais enregistrer un prix à 0 : l'ancien prix reste en base
      throw new Error(`Prix indisponible pour ${ticker}`);
    }

    const quote = this.normalizeQuote(raw, ticker);
    let profileCurrency = null;

    if (quote.type !== "Crypto") {
      // Profil (nom, secteur, industrie, type ETF, devise) : rarement modifié
      if (
        isStale(previous?.profileUpdatedAt, PROFILE_TTL) ||
        !previous?.sector ||
        previous.sector === "Unknown" ||
        !previous?.countryCode || // pays du siège jamais récupéré (données antérieures)
        !previous?.quoteCurrency // devise de cotation jamais vérifiée (données antérieures)
      ) {
        const profile = await this.getProfile(mappedTicker);
        if (profile) {
          quote.name = profile.name || quote.name;
          quote.sector = profile.sector;
          quote.industry = profile.industry;
          if (profile.isEtf || profile.isFund) quote.type = "ETF";
          if (profile.countryCode) quote.countryCode = profile.countryCode;
          if (profile.country) quote.country = profile.country;
          profileCurrency = profile.currency;
          if (!quote.dividend && profile.lastDividend) quote.dividend = profile.lastDividend;
          quote.profileUpdatedAt = new Date();
        }
      } else if (previous) {
        quote.name = previous.name || quote.name;
        quote.sector = previous.sector;
        quote.industry = previous.industry;
        quote.type = previous.type || quote.type;
        if (previous.countryCode) quote.countryCode = previous.countryCode;
        if (quote.country === "Unknown") quote.country = previous.country || quote.country;
      }

      // Dividendes : un changement par trimestre au plus
      if (quote.type !== "ETF" && (isStale(previous?.dividendsUpdatedAt, DIVIDENDS_TTL) || !previous?.quoteCurrency)) {
        const div = await this.getDividends(mappedTicker, quote.price);
        if (div) {
          Object.assign(quote, div);
          quote.dividendsUpdatedAt = new Date();
        }
      }
    }

    // Devise de cotation (l'endpoint /stable/quote ne la renvoie pas) puis conversion
    // des sous-unités (pence → livres) : tous les prix enregistrés sont en devise principale.
    const rawCurrency = detectQuoteCurrency({
      ticker,
      apiCurrency: raw.currency || profileCurrency,
      knownCurrency: previous?.quoteCurrency,
      exchange: raw.exchange || raw.exchangeShortName,
    });
    return normalizeQuoteUnits(quote, rawCurrency);
  }

  /**
   * Dividendes des 12 derniers mois (endpoint /stable/dividends)
   */
  async getDividends(ticker, price = null) {
    try {
      const data = await this.request("dividends", { symbol: ticker });
      if (!Array.isArray(data)) return null;

      if (data.length === 0) {
        // Action sans dividende : on le mémorise pour ne pas redemander avant 7 jours
        return { dividend: null, dividendYield: null, exDividendDate: null, paymentDate: null, recordDate: null };
      }

      const { annual, latest, frequency } = annualizeDividends(data);

      return {
        dividend: annual,
        dividendRate: annual,
        dividendYield: annual && price > 0 ? (annual / price) * 100 : null,
        dividendFrequency: annual ? frequency : null,
        exDividendDate: latest?.date || null,
        paymentDate: latest?.paymentDate || null,
        recordDate: latest?.recordDate || null,
      };
    } catch (error) {
      if (error.code === "QUOTA_EXCEEDED") throw error;
      console.error(`❌ FMP getDividends error for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Profil d'entreprise (endpoint /stable/profile)
   */
  async getProfile(ticker) {
    try {
      const data = await this.request("profile", { symbol: ticker });
      if (!Array.isArray(data) || data.length === 0) return null;

      const profile = data[0];
      return {
        name: profile.companyName || ticker,
        sector: profile.sector || "Unknown",
        industry: profile.industry || "Unknown",
        country: ISO_TO_COUNTRY[profile.country] || null,
        countryCode: typeof profile.country === "string" && /^[A-Z]{2}$/i.test(profile.country) ? profile.country.toUpperCase() : null,
        currency: profile.currency || null,
        isEtf: Boolean(profile.isEtf),
        isFund: Boolean(profile.isFund),
        lastDividend: Number(profile.lastDividend) || null,
      };
    } catch (error) {
      if (error.code === "QUOTA_EXCEEDED") throw error;
      console.error(`❌ FMP getProfile error for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Batch request - récupère plusieurs tickers en une seule requête
   */
  async getBatchQuotes(tickers) {
    if (!this.config.enabled || !this.apiKey) {
      throw new Error("FMP provider not configured");
    }

    try {
      // FMP supporte jusqu'à ~50 tickers par requête
      const data = await this.request("quote", { symbol: tickers.join(",") });

      if (!data || data.length === 0) {
        return [];
      }

      // Normaliser tous les quotes
      return data
        .filter((raw) => Number(raw.price) > 0)
        .map((raw) =>
          normalizeQuoteUnits(
            this.normalizeQuote(raw, raw.symbol),
            detectQuoteCurrency({ ticker: raw.symbol, apiCurrency: raw.currency, exchange: raw.exchange })
          )
        );
    } catch (error) {
      console.error(`❌ FMP getBatchQuotes error:`, error.message);
      throw error;
    }
  }

  /**
   * Normalise les données FMP au format standard de l'app
   */
  normalizeQuote(fmpData, originalTicker) {
    return {
      symbol: originalTicker,
      name: fmpData.name || originalTicker,
      price: Number(fmpData.price) || 0,
      close: Number(fmpData.price) || 0,
      open: fmpData.open || null,
      high: fmpData.dayHigh || null,
      low: fmpData.dayLow || null,
      volume: fmpData.volume || null,
      previousClose: fmpData.previousClose || null,
      change: fmpData.change || null,
      changePercent: fmpData.changePercentage ?? fmpData.changesPercentage ?? null,
      marketCap: fmpData.marketCap || null,
      currency: fmpData.currency || null, // devise définitive fixée dans getQuote
      marketTime: Number(fmpData.timestamp) > 0 ? new Date(Number(fmpData.timestamp) * 1000) : null,
      exchange: fmpData.exchange || fmpData.exchangeShortName || "Unknown",
      country: this.detectCountry(fmpData),
      sector: null, // Sera enrichi par getProfile
      industry: null, // Sera enrichi par getProfile
      type: this.detectType(originalTicker, fmpData),
      dividend: fmpData.annualDividend || null,
      dividendYield: fmpData.dividendYield || null,
      dividendRate: fmpData.annualDividend || null,
      exDividendDate: fmpData.exDividendDate || null,
      paymentDate: null, // Sera enrichi par getDividends
      recordDate: null, // Sera enrichi par getDividends
      lastUpdate: new Date(),
      source: "fmp",
    };
  }

  /**
   * Détecte le pays d'un ticker
   */
  detectCountry(fmpData) {
    const exchange = (fmpData.exchange || fmpData.exchangeShortName || "").toUpperCase();

    const exchangeToCountry = {
      NASDAQ: "États-Unis",
      NYSE: "États-Unis",
      AMEX: "États-Unis",
      PA: "France",
      EURONEXT: "France",
      AS: "Pays-Bas",
      AMS: "Amsterdam",
      LSE: "Royaume-Uni",
      LON: "Royaume-Uni",
      FRA: "Allemagne",
      XETRA: "Allemagne",
    };

    for (const [key, country] of Object.entries(exchangeToCountry)) {
      if (exchange.includes(key)) {
        return country;
      }
    }

    return "Unknown";
  }

  /**
   * Détecte le type d'actif
   */
  detectType(ticker, fmpData) {
    // Crypto
    if (
      ticker.includes("BTC") ||
      ticker.includes("ETH") ||
      ticker.includes("USDT") ||
      ticker.endsWith("-USD")
    ) {
      return "Crypto";
    }

    // ETF (FMP renvoie parfois le type)
    if (fmpData.type === "etf" || ticker.includes("VUSA") || ticker.includes("SPY")) {
      return "ETF";
    }

    // Stock par défaut
    return "Stock";
  }

  /**
   * Vérifie si ce provider supporte un ticker donné
   */
  supportsTickerType(ticker) {
    // Détermine le type de ticker
    if (ticker.includes("BTC") || ticker.includes("ETH") || ticker.endsWith("-USD")) {
      return this.config.supports.crypto;
    }

    if (ticker.endsWith(".PA") || ticker.endsWith(".AS")) {
      return this.config.supports.euStocks;
    }

    // Stocks US par défaut
    return this.config.supports.usStocks;
  }

  /**
   * Vérifie l'état de santé de l'API
   */
  async healthCheck() {
    try {
      await this.request("quote", { symbol: "AAPL" });
      return { provider: this.name, healthy: true, timestamp: new Date() };
    } catch (error) {
      return {
        provider: this.name,
        healthy: false,
        error: error.message,
        timestamp: new Date(),
      };
    }
  }
}

module.exports = FMPProvider;
