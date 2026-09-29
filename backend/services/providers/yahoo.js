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

  /**
   * Appel Yahoo ; si le serveur principal refuse (401/403/429, 5xx ou coupure réseau),
   * nouvel essai sur le second serveur (query2), qui applique ses propres limites.
   */
  async request(path, params) {
    const query = new URLSearchParams(params).toString();
    try {
      return await trackedFetchJson("yahoo", `${this.baseUrl}/${path}?${query}`, { headers: HEADERS });
    } catch (error) {
      const retriable = !error.status || [401, 403, 429].includes(error.status) || error.status >= 500;
      if (!retriable || error.code === "QUOTA_EXCEEDED" || !this.config.fallbackUrl) throw error;
      return trackedFetchJson("yahoo", `${this.config.fallbackUrl}/${path}?${query}`, { headers: HEADERS });
    }
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

  /**
   * live = true : actualisation intraday légère (1 appel, sans dividendes ni profil,
   * la clôture de la veille vient de chartPreviousClose sur la période « 1d »).
   */
  async getQuote(ticker, { previous = null, live = false } = {}) {
    if (!this.config.enabled) throw new Error("Yahoo provider disabled");

    const data = await this.request(
      `v8/finance/chart/${encodeURIComponent(ticker)}`,
      live ? { range: "1d", interval: "1d" } : { range: "1y", interval: "1d", events: "div" }
    );
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const price = num(meta?.regularMarketPrice);
    if (!meta || !(price > 0)) {
      const msg = data?.chart?.error?.description || `No data found for ${ticker}`;
      throw new Error(msg);
    }

    // Clôture de la veille : dernière barre quotidienne d'un jour ANTÉRIEUR à la séance du cours.
    // (En séance, la dernière barre est celle du jour : la prendre donnerait une variation ≈ 0.)
    const stamps = result.timestamp || [];
    const rawCloses = result.indicators?.quote?.[0]?.close || [];
    const offset = Number(meta.gmtoffset) || 0;
    const dayOf = (t) => new Date((Number(t) + offset) * 1000).toISOString().slice(0, 10);
    const sessionDay = dayOf(Number(meta.regularMarketTime) || stamps[stamps.length - 1] || Date.now() / 1000);
    let closeBefore = null;
    for (let i = stamps.length - 1; i >= 0; i--) {
      if (Number(rawCloses[i]) > 0 && dayOf(stamps[i]) < sessionDay) {
        closeBefore = Number(rawCloses[i]);
        break;
      }
    }
    const previousClose =
      num(meta.previousClose) || (live ? num(meta.chartPreviousClose) : null) || closeBefore;

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
      live,
    };

    // Profil (secteur, industrie, nom complet) : 1 appel de recherche tous les 30 jours
    if (!live && type !== "Crypto" && (isStale(previous?.profileUpdatedAt, PROFILE_TTL) || !previous?.sector || previous.sector === "Unknown")) {
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
    if (!live && (quote.type === "Stock" || quote.type === "ETF")) {
      const events = Object.values(result.events?.dividends || {})
        .map((d) => ({ date: new Date(Number(d.date) * 1000).toISOString().slice(0, 10), dividend: Number(d.amount) }))
        .filter((d) => d.dividend > 0);
      const { annual, latest, frequency } = annualizeDividends(events);
      quote.dividend = annual;
      quote.dividendRate = annual;
      quote.dividendYield = annual && price > 0 ? (annual / price) * 100 : null;
      quote.exDividendDate = latest?.date || null;
      quote.dividendFrequency = annual ? frequency : null;
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
