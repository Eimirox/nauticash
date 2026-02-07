// backend/services/providers/alphavantage.js
// Provider pour Alpha Vantage (EU stocks + Dividendes)

const config = require("../../config/providers");

class AlphaVantageProvider {
  constructor() {
    this.name = "Alpha Vantage";
    this.config = config.alphavantage;
    this.baseUrl = this.config.baseUrl;
    this.apiKey = this.config.apiKey;

    // Mapping manuel des secteurs pour les actions EU (Alpha Vantage gratuit ne les fournit pas)
    this.euSectorMapping = {
      // Actions françaises (Euronext Paris)
      "GTT.PA": { sector: "Producer Manufacturing", industry: "Trucks/Construction/Farm Machinery", name: "GTT" },
      "TTE.PA": { sector: "Energy", industry: "Oil & Gas Integrated", name: "TotalEnergies SE" },
      "AIR.PA": { sector: "Industrials", industry: "Aerospace & Defense", name: "Airbus SE" },
      "MC.PA": { sector: "Consumer Cyclical", industry: "Luxury Goods", name: "LVMH" },
      "OR.PA": { sector: "Industrials", industry: "Luxury Goods", name: "L'Oréal" },
      "SAN.PA": { sector: "Healthcare", industry: "Drug Manufacturers", name: "Sanofi" },
      "BNP.PA": { sector: "Financial Services", industry: "Banks", name: "BNP Paribas" },
      "ACA.PA": { sector: "Financial Services", industry: "Insurance", name: "Crédit Agricole" },
      "ENGI.PA": { sector: "Utilities", industry: "Utilities - Regulated Electric", name: "Engie" },
      "DG.PA": { sector: "Industrials", industry: "Conglomerates", name: "Vinci" },
      "CS.PA": { sector: "Financial Services", industry: "Insurance", name: "AXA" },
      "CAP.PA": { sector: "Technology", industry: "Information Technology Services", name: "Capgemini" },
      "RMS.PA": { sector: "Consumer Cyclical", industry: "Luxury Goods", name: "Hermès" },
      "BN.PA": { sector: "Consumer Defensive", industry: "Packaged Foods", name: "Danone" },
      "RI.PA": { sector: "Consumer Cyclical", industry: "Luxury Goods", name: "Kering" },
      
      // ETFs populaires
      "VUSA.AS": { sector: "ETF", industry: "S&P 500 ETF", name: "Vanguard S&P 500 UCITS ETF" },
      "IWDA.AS": { sector: "ETF", industry: "World Index ETF", name: "iShares Core MSCI World" },
      "CSPX.L": { sector: "ETF", industry: "S&P 500 ETF", name: "iShares Core S&P 500" },
      "VWCE.DE": { sector: "ETF", industry: "World Index ETF", name: "Vanguard FTSE All-World" },
      
      // Actions néerlandaises (Euronext Amsterdam)
      "ASML.AS": { sector: "Technology", industry: "Semiconductor Equipment", name: "ASML Holding" },
      "INGA.AS": { sector: "Financial Services", industry: "Banks", name: "ING Group" },
      "PHIA.AS": { sector: "Healthcare", industry: "Medical Devices", name: "Philips" },
      "HEIA.AS": { sector: "Consumer Cyclical", industry: "Beverages", name: "Heineken" },
      
      // Actions allemandes (XETRA)
      "SAP.DE": { sector: "Technology", industry: "Software", name: "SAP SE" },
      "SIE.DE": { sector: "Industrials", industry: "Industrial Equipment", name: "Siemens AG" },
      "BMW.DE": { sector: "Consumer Cyclical", industry: "Auto Manufacturers", name: "BMW" },
      "VOW3.DE": { sector: "Consumer Cyclical", industry: "Auto Manufacturers", name: "Volkswagen" },
    };
  }

  /**
   * Récupère le quote d'une action
   */
  async getQuote(ticker) {
    if (!this.config.enabled || !this.apiKey) {
      throw new Error("Alpha Vantage provider not configured");
    }

    try {
      // Alpha Vantage utilise GLOBAL_QUOTE
      const url = `${this.baseUrl}/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Alpha Vantage API returned ${response.status}`);
      }

      const data = await response.json();

      // Alpha Vantage renvoie les erreurs dans le JSON
      if (data["Error Message"]) {
        throw new Error(data["Error Message"]);
      }

      if (data["Note"]) {
        throw new Error("API rate limit reached");
      }

      if (!data["Global Quote"] || Object.keys(data["Global Quote"]).length === 0) {
        throw new Error(`No data found for ${ticker}`);
      }

      const quote = data["Global Quote"];

      // Normaliser les données
      const normalized = this.normalizeQuote(quote, ticker);

      // Enrichir avec les dividendes
      try {
        const dividendInfo = await this.getDividends(ticker);
        if (dividendInfo) {
          normalized.dividend = dividendInfo.annualDividend;
          normalized.dividendYield = dividendInfo.dividendYield;
          normalized.exDividendDate = dividendInfo.exDividendDate;
        }
      } catch (error) {
        console.log(`⚠️ Could not fetch dividends for ${ticker}: ${error.message}`);
      }

      // Enrichir avec le profil pour secteur/industrie
      try {
        const profile = await this.getProfile(ticker);
        if (profile) {
          normalized.sector = profile.sector;
          normalized.industry = profile.industry;
          normalized.name = profile.name || normalized.name;
        }
      } catch (error) {
        console.log(`⚠️ Could not fetch profile for ${ticker}: ${error.message}`);
      }

      return normalized;
    } catch (error) {
      console.error(`❌ Alpha Vantage getQuote error for ${ticker}:`, error.message);
      throw error;
    }
  }

  /**
   * Récupère les dividendes d'une action
   */
  async getDividends(ticker) {
    try {
      // Utiliser TIME_SERIES_MONTHLY_ADJUSTED pour avoir les dividendes
      const url = `${this.baseUrl}/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${ticker}&apikey=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Alpha Vantage API returned ${response.status}`);
      }

      const data = await response.json();

      if (data["Error Message"] || data["Note"]) {
        throw new Error("Could not fetch dividends");
      }

      const timeSeries = data["Monthly Adjusted Time Series"];
      if (!timeSeries) {
        return null;
      }

      // Récupérer les dividendes des 12 derniers mois
      const dates = Object.keys(timeSeries).slice(0, 12);
      let totalDividends = 0;
      let latestDividendDate = null;

      for (const date of dates) {
        const dividend = parseFloat(timeSeries[date]["7. dividend amount"]);
        if (dividend > 0) {
          totalDividends += dividend;
          if (!latestDividendDate) {
            latestDividendDate = date;
          }
        }
      }

      if (totalDividends === 0) {
        return null;
      }

      // Calculer le yield basé sur le prix actuel
      const currentPrice = parseFloat(timeSeries[dates[0]]["4. close"]);
      const dividendYield = currentPrice > 0 ? (totalDividends / currentPrice) * 100 : null;

      return {
        annualDividend: totalDividends,
        dividend: totalDividends,
        dividendYield: dividendYield,
        exDividendDate: latestDividendDate,
        dividendRate: totalDividends,
      };
    } catch (error) {
      console.error(`❌ Alpha Vantage getDividends error for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Récupère le profil d'une entreprise
   */
  async getProfile(ticker) {
    // Pour les actions EU, utiliser le mapping manuel (Alpha Vantage gratuit ne les fournit pas)
    if (this.euSectorMapping[ticker]) {
      console.log(`📋 Using manual sector mapping for ${ticker}`);
      return this.euSectorMapping[ticker];
    }

    // Pour les US stocks, essayer l'API (peut échouer avec rate limit)
    try {
      const url = `${this.baseUrl}/query?function=OVERVIEW&symbol=${ticker}&apikey=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Alpha Vantage API returned ${response.status}`);
      }

      const data = await response.json();

      if (data["Error Message"] || data["Note"] || Object.keys(data).length === 0) {
        return null;
      }

      return {
        name: data.Name || ticker,
        sector: data.Sector || "Unknown",
        industry: data.Industry || "Unknown",
        country: data.Country || "Unknown",
        description: data.Description || null,
      };
    } catch (error) {
      console.error(`❌ Alpha Vantage getProfile error for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Batch quotes (Alpha Vantage ne supporte pas le batch, donc appel individuel)
   */
  async getBatchQuotes(tickers) {
    const results = [];

    for (const ticker of tickers) {
      try {
        const quote = await this.getQuote(ticker);
        results.push(quote);

        // Respecter le rate limit (5 req/min max)
        await this.sleep(12000); // 12 secondes entre chaque requête
      } catch (error) {
        console.error(`❌ Failed to fetch ${ticker}:`, error.message);
      }
    }

    return results;
  }

  /**
   * Normalise les données Alpha Vantage au format standard
   */
  normalizeQuote(avData, originalTicker) {
    return {
      symbol: originalTicker,
      name: originalTicker, // Sera enrichi par getProfile
      price: parseFloat(avData["05. price"]) || 0,
      close: parseFloat(avData["05. price"]) || 0,
      open: parseFloat(avData["02. open"]) || null,
      high: parseFloat(avData["03. high"]) || null,
      low: parseFloat(avData["04. low"]) || null,
      volume: parseInt(avData["06. volume"]) || null,
      previousClose: parseFloat(avData["08. previous close"]) || null,
      change: parseFloat(avData["09. change"]) || null,
      changePercent: parseFloat(avData["10. change percent"]?.replace("%", "")) || null,
      marketCap: null,
      currency: this.detectCurrency(originalTicker),
      exchange: this.detectExchange(originalTicker),
      country: this.detectCountry(originalTicker),
      sector: null, // Sera enrichi par getProfile
      industry: null, // Sera enrichi par getProfile
      type: this.detectType(originalTicker),
      dividend: null, // Sera enrichi par getDividends
      dividendYield: null, // Sera enrichi par getDividends
      dividendRate: null,
      exDividendDate: null,
      paymentDate: null,
      recordDate: null,
      lastUpdate: new Date(),
      source: "alphavantage",
    };
  }

  /**
   * Détecte la devise selon le ticker
   */
  detectCurrency(ticker) {
    if (ticker.endsWith(".PA")) return "EUR";
    if (ticker.endsWith(".AS")) return "EUR";
    if (ticker.endsWith(".L")) return "GBP";
    if (ticker.endsWith(".DE")) return "EUR";
    return "USD";
  }

  /**
   * Détecte l'exchange selon le ticker
   */
  detectExchange(ticker) {
    if (ticker.endsWith(".PA")) return "EPA";
    if (ticker.endsWith(".AS")) return "AMS";
    if (ticker.endsWith(".L")) return "LON";
    if (ticker.endsWith(".DE")) return "ETR";
    return "NYSE/NASDAQ";
  }

  /**
   * Détecte le pays selon le ticker
   */
  detectCountry(ticker) {
    if (ticker.endsWith(".PA")) return "France";
    if (ticker.endsWith(".AS")) return "Pays-Bas";
    if (ticker.endsWith(".L")) return "Royaume-Uni";
    if (ticker.endsWith(".DE")) return "Allemagne";
    return "États-Unis";
  }

  /**
   * Détecte le type d'actif
   */
  detectType(ticker) {
    if (ticker.includes("BTC") || ticker.includes("ETH")) {
      return "Crypto";
    }
    if (ticker.includes("VUSA") || ticker.includes("SPY")) {
      return "ETF";
    }
    return "Stock";
  }

  /**
   * Vérifie si ce provider supporte un ticker
   */
  supportsTickerType(ticker) {
    // Alpha Vantage supporte tout sauf crypto
    if (ticker.includes("BTC") || ticker.includes("ETH") || ticker.endsWith("-USD")) {
      return false; // Pas de crypto
    }

    // EU stocks
    if (ticker.endsWith(".PA") || ticker.endsWith(".AS")) {
      return this.config.supports.euStocks;
    }

    // US stocks
    return this.config.supports.usStocks;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const url = `${this.baseUrl}/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${this.apiKey}`;
      const response = await fetch(url);

      const data = await response.json();
      const healthy = response.ok && !data["Error Message"] && !data["Note"];

      return {
        provider: this.name,
        healthy,
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

  /**
   * Utilitaire sleep
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = AlphaVantageProvider;
