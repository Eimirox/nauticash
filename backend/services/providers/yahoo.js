// backend/services/providers/yahoo.js
// Provider Yahoo Finance (endpoints publics, sans clé) :
//   - v8/finance/chart : cours, clôture de la veille, devise, place de cotation, dividendes sur 1 an ;
//   - v1/finance/search : nom, type, secteur et industrie (+ autocomplétion des tickers).
// Couvre les symboles que l'offre gratuite FMP refuse (402), avec les mêmes conventions
// de tickers (AIR.PA, VUSA.AS, CSPX.L, BTC-USD…).

const config = require("../../config/providers");
const { trackedFetchJson } = require("../apiUsage");
const { detectQuoteCurrency, normalizeQuoteUnits } = require("../currency");
const { annualizeDividends } = require("../dividends");

const DAY = 24 * 60 * 60 * 1000;
const PROFILE_TTL = 30 * DAY;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; Nauticash/1.0; +https://nauticash-1hjk.vercel.app)",
  Accept: "application/json",
};

// Types Yahoo → types de l'app
const TYPES = { EQUITY: "Stock", ETF: "ETF", MUTUALFUND: "ETF", CRYPTOCURRENCY: "Crypto", INDEX: "Index" };

// Codes de place Yahoo → libellé lisible
const EXCHANGES = {
  NMS: "NASDAQ", NGM: "NASDAQ", NCM: "NASDAQ", NAS: "NASDAQ", NYQ: "NYSE", ASE: "AMEX", PCX: "NYSE Arca", BTS: "BATS",
  PAR: "Euronext Paris", AMS: "Euronext Amsterdam", BRU: "Euronext Bruxelles", LIS: "Euronext Lisbonne",
  GER: "XETRA", FRA: "Francfort", LSE: "Londres", MIL: "Milan", MCE: "Madrid", EBS: "SIX Suisse",
  TOR: "Toronto", JPX: "Tokyo", HKG: "Hong Kong", CCC: "Crypto",
};

const isStale = (date, ttl) => !date || Date.now() - new Date(date).getTime() > ttl;
const num = (v) => (Number.isFinite(Number(v)) && v !== null ? Number(v) : null);

class YahooProvider {
  constructor() {
    this.name = "Yahoo";
    this.config = config.yahoo;
    this.baseUrl = this.config.baseUrl;
  }

  request(path, params) {
    const query = new URLSearchParams(params).toString();
    return trackedFetchJson("yahoo", `${this.baseUrl}/${path}?${query}`, { headers: HEADERS });
  }

  /** Résultats de recherche bruts (quotes Yahoo) */
  async searchRaw(query, count = 8) {
    const data = await this.request("v1/finance/search", {
      q: query,
      quotesCount: String(count),
      newsCount: "0",
      listsCount: "0",
      enableFuzzyQuery: "false",
    });
    return Array.isArray(data?.quotes) ? data.quotes : [];
  }

  /** Suggestions normalisées pour l'autocomplétion */
  async search(query, count = 8) {
    const quotes = await this.searchRaw(query, count);
    return quotes
      .filter((q) => q.symbol && TYPES[q.quoteType] && q.quoteType !== "INDEX")
      .map((q) => ({
        symbol: String(q.symbol).toUpperCase(),
        name: q.longname || q.shortname || q.symbol,
        type: TYPES[q.quoteType],
        exchange: EXCHANGES[q.exchange] || q.exchDisp || q.exchange || null,
        sector: q.sectorDisp || q.sector || null,
      }));
  }

  /** Nom, type, secteur, industrie d'un symbole (1 appel de recherche) */
  async getProfile(ticker) {
    try {
      const quotes = await this.searchRaw(ticker, 5);
      const q = quotes.find((x) => String(x.symbol).toUpperCase() === ticker.toUpperCase());
      if (!q) return null;
      return {
        name: q.longname || q.shortname || null,
        type: TYPES[q.quoteType] || null,
        sector: q.sector || q.sectorDisp || null,
        industry: q.industry || q.industryDisp || null,
      };
    } catch (error) {
      if (error.code === "QUOTA_EXCEEDED") throw error;
      return null;
    }
  }

  async getQuote(ticker, { previous = null } = {}) {
    if (!this.config.enabled) throw new Error("Yahoo provider disabled");

    const data = await this.request(`v8/finance/chart/${encodeURIComponent(ticker)}`, {
      range: "1y",
      interval: "1d",
      events: "div",
    });
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const price = num(meta?.regularMarketPrice);
    if (!meta || !(price > 0)) {
      const msg = data?.chart?.error?.description || `No data found for ${ticker}`;
      throw new Error(msg);
    }

    // Clôture de la veille : avant-dernière clôture quotidienne (chartPreviousClose = début de la période)
    const closes = (result.indicators?.quote?.[0]?.close || []).filter((c) => Number(c) > 0);
    const lastBar = closes[closes.length - 1];
    const previousClose =
      num(meta.previousClose) ||
      (closes.length >= 2 ? (Math.abs(lastBar - price) / price < 1e-6 ? closes[closes.length - 2] : lastBar) : null);

    const type = TYPES[meta.instrumentType] || (/-(USD|EUR)$/.test(ticker) ? "Crypto" : "Stock");

    const quote = {
      symbol: ticker,
      name: meta.longName || meta.shortName || previous?.name || ticker,
      price,
      close: price,
      open: null,
      high: num(meta.regularMarketDayHigh),
      low: num(meta.regularMarketDayLow),
      volume: num(meta.regularMarketVolume),
      previousClose,
      change: previousClose ? price - previousClose : null,
      changePercent: previousClose ? ((price - previousClose) / previousClose) * 100 : null,
      marketCap: null,
      currency: meta.currency || null,
      marketTime: Number(meta.regularMarketTime) > 0 ? new Date(Number(meta.regularMarketTime) * 1000) : null,
      exchange: EXCHANGES[meta.exchangeName] || meta.fullExchangeName || meta.exchangeName || "Unknown",
      country: previous?.country || "Unknown",
      countryCode: previous?.countryCode || null,
      sector: previous?.sector || null,
      industry: previous?.industry || null,
      type: previous?.type && previous.type !== "Stock" ? previous.type : type,
      dividend: null,
      dividendYield: null,
      dividendRate: null,
      exDividendDate: null,
      paymentDate: null,
      recordDate: null,
      lastUpdate: new Date(),
      source: "yahoo",
    };

    // Profil (secteur, industrie, nom complet) : 1 appel de recherche tous les 30 jours
    if (type !== "Crypto" && (isStale(previous?.profileUpdatedAt, PROFILE_TTL) || !previous?.sector || previous.sector === "Unknown")) {
      const profile = await this.getProfile(ticker);
      if (profile) {
        quote.name = profile.name || quote.name;
        if (profile.sector) quote.sector = profile.sector;
        if (profile.industry) quote.industry = profile.industry;
        if (profile.type) quote.type = profile.type;
        quote.profileUpdatedAt = new Date();
      }
    }
    if (quote.type === "ETF" && !quote.sector) quote.sector = "ETF";

    // Dividendes des 12 derniers mois, fournis par le même appel (events=div)
    if (quote.type === "Stock" || quote.type === "ETF") {
      const events = Object.values(result.events?.dividends || {})
        .map((d) => ({ date: new Date(Number(d.date) * 1000).toISOString().slice(0, 10), dividend: Number(d.amount) }))
        .filter((d) => d.dividend > 0);
      const { annual, latest } = annualizeDividends(events);
      quote.dividend = annual;
      quote.dividendRate = annual;
      quote.dividendYield = annual && price > 0 ? (annual / price) * 100 : null;
      quote.exDividendDate = latest?.date || null;
      quote.dividendsUpdatedAt = new Date();
    }

    const rawCurrency = detectQuoteCurrency({
      ticker,
      apiCurrency: meta.currency,
      knownCurrency: previous?.quoteCurrency,
      exchange: meta.exchangeName,
    });
    return normalizeQuoteUnits(quote, rawCurrency);
  }

  supportsTickerType() {
    return true;
  }

  async healthCheck() {
    try {
      await this.getQuote("AAPL");
      return { provider: this.name, healthy: true, timestamp: new Date() };
    } catch (error) {
      return { provider: this.name, healthy: false, error: error.message, timestamp: new Date() };
    }
  }
}

module.exports = YahooProvider;
