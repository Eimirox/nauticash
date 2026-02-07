// backend/services/providers/fmp.js
// Provider pour Financial Modeling Prep (FMP)

const config = require("../../config/providers");

class FMPProvider {
  constructor() {
    this.name = "FMP";
    this.config = config.fmp;
    this.baseUrl = this.config.baseUrl;
    this.apiKey = this.config.apiKey;
  }

  /**
   * Récupère le quote d'une action
   */
  async getQuote(ticker) {
    if (!this.config.enabled || !this.apiKey) {
      throw new Error("FMP provider not configured");
    }

    // Mapping des tickers spéciaux (ex: BTC-USD → BTCUSD)
    const mappedTicker = this.config.tickerMapping[ticker] || ticker;

    try {
      const url = `${this.baseUrl}/quote?symbol=${mappedTicker}&apikey=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`FMP API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        throw new Error(`No data found for ${ticker}`);
      }

      // Normaliser les données au format standard
      const quote = this.normalizeQuote(data[0], ticker);

      // Enrichir avec le profil (secteur, industrie) si c'est un stock
      if (quote.type === "Stock" || quote.type === "ETF") {
        try {
          const profile = await this.getProfile(ticker);
          if (profile) {
            quote.sector = profile.sector;
            quote.industry = profile.industry;
          }
        } catch (error) {
          // Si le profil échoue, on continue quand même
          console.log(`⚠️ Could not fetch profile for ${ticker}: ${error.message}`);
        }

        // Enrichir avec les dividendes détaillés si l'action paie des dividendes
        if (quote.dividend || data[0].annualDividend) {
          try {
            const dividendInfo = await this.getDividends(ticker);
            if (dividendInfo) {
              quote.dividend = dividendInfo.annualDividend || dividendInfo.dividend || quote.dividend;
              quote.dividendYield = dividendInfo.dividendYield || quote.dividendYield;
              quote.exDividendDate = dividendInfo.exDividendDate || quote.exDividendDate;
              quote.paymentDate = dividendInfo.paymentDate || null;
              quote.recordDate = dividendInfo.recordDate || null;
            }
          } catch (error) {
            // Si les dividendes échouent, on continue avec les données du quote
            console.log(`⚠️ Could not fetch dividends for ${ticker}: ${error.message}`);
          }
        }
      }

      return quote;
    } catch (error) {
      console.error(`❌ FMP getQuote error for ${ticker}:`, error.message);
      throw error;
    }
  }

  /**
   * Récupère les dividendes d'une action
   */
  async getDividends(ticker) {
    try {
      // FMP a un endpoint dédié pour les dividendes historiques
      const url = `${this.baseUrl}/historical-price-full/stock_dividend/${ticker}?apikey=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        // Si l'endpoint dédié échoue, on essaie de récupérer depuis /quote
        return await this.getDividendsFromQuote(ticker);
      }

      const data = await response.json();

      if (!data || !data.historical || data.historical.length === 0) {
        return await this.getDividendsFromQuote(ticker);
      }

      // Prendre le dividende le plus récent
      const latestDividend = data.historical[0];

      return {
        dividend: latestDividend.dividend || null,
        annualDividend: latestDividend.adjDividend || null,
        exDividendDate: latestDividend.date || null,
        paymentDate: latestDividend.paymentDate || null,
        recordDate: latestDividend.recordDate || null,
        dividendYield: null, // Sera calculé par le quote
      };
    } catch (error) {
      console.error(`❌ FMP getDividends error for ${ticker}:`, error.message);
      return await this.getDividendsFromQuote(ticker);
    }
  }

  /**
   * Récupère les dividendes depuis l'endpoint /quote (fallback)
   */
  async getDividendsFromQuote(ticker) {
    try {
      const url = `${this.baseUrl}/quote?symbol=${ticker}&apikey=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        return null;
      }

      const quote = data[0];

      return {
        annualDividend: quote.annualDividend || null,
        dividend: quote.annualDividend || null,
        dividendYield: quote.dividendYield ? quote.dividendYield * 100 : null, // Convertir en pourcentage
        exDividendDate: quote.exDividendDate || null,
        dividendRate: quote.annualDividend || null,
        paymentDate: null,
        recordDate: null,
      };
    } catch (error) {
      console.error(`❌ FMP getDividendsFromQuote error for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Récupère les infos d'un profil d'entreprise
   */
  async getProfile(ticker) {
    try {
      const url = `${this.baseUrl}/profile?symbol=${ticker}&apikey=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`FMP API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        return null;
      }

      const profile = data[0];

      return {
        name: profile.companyName || ticker,
        sector: profile.sector || "Unknown",
        industry: profile.industry || "Unknown",
        country: profile.country || "Unknown",
        exchange: profile.exchangeShortName || "Unknown",
        currency: profile.currency || "USD",
        website: profile.website || null,
        description: profile.description || null,
      };
    } catch (error) {
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
      const tickerList = tickers.join(",");
      const url = `${this.baseUrl}/quote?symbol=${tickerList}&apikey=${this.apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`FMP API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        return [];
      }

      // Normaliser tous les quotes
      return data.map((quote) => this.normalizeQuote(quote, quote.symbol));
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
      price: fmpData.price || 0,
      close: fmpData.price || 0,
      open: fmpData.open || null,
      high: fmpData.dayHigh || null,
      low: fmpData.dayLow || null,
      volume: fmpData.volume || null,
      previousClose: fmpData.previousClose || null,
      change: fmpData.change || null,
      changePercent: fmpData.changesPercentage || null,
      marketCap: fmpData.marketCap || null,
      currency: this.detectCurrency(fmpData, originalTicker),
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
   * Détecte la devise d'un ticker
   */
  detectCurrency(fmpData, ticker) {
    // Utilise la devise renvoyée par FMP si disponible
    if (fmpData.currency) {
      return fmpData.currency;
    }

    // Sinon, devine selon l'exchange
    const exchange = (fmpData.exchange || fmpData.exchangeShortName || "").toUpperCase();

    if (exchange.includes("NASDAQ") || exchange.includes("NYSE") || exchange.includes("AMEX")) {
      return "USD";
    }

    if (exchange.includes("PA") || exchange === "EURONEXT") {
      return "EUR";
    }

    if (exchange.includes("AS") || exchange === "AMS") {
      return "EUR";
    }

    if (exchange.includes("LON") || exchange === "LSE") {
      return "GBP";
    }

    // Crypto
    if (ticker.includes("USD") || ticker.includes("USDT")) {
      return "USD";
    }

    if (ticker.includes("EUR")) {
      return "EUR";
    }

    // Par défaut
    return "USD";
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
      const url = `${this.baseUrl}/quote?symbol=AAPL&apikey=${this.apiKey}`;
      const response = await fetch(url);

      return {
        provider: this.name,
        healthy: response.ok,
        status: response.status,
        timestamp: new Date(),
      };
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
