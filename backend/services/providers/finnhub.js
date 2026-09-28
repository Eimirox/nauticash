// backend/services/providers/finnhub.js
// Provider Finnhub (optionnel) : secours pour les actions américaines que l'offre gratuite FMP
// ne couvre pas, avant Yahoo. Activé uniquement si FINNHUB_API_KEY est renseignée
// (FINNHUB_ENABLED=false pour le couper même avec une clé).
//
// Endpoint utilisé : /api/v1/quote → { c: cours, pc: clôture veille, d, dp, h, l, o, t }.
// L'offre gratuite ne couvre que les places américaines : les tickers avec suffixe de place
// (AIR.PA, CSPX.L…), les cryptos (BTC-USD) et les indices (^GSPC) ne sont jamais envoyés.
// Pas de profil ni de dividendes ici : ils sont conservés depuis la base ou complétés par Yahoo.

const config = require("../../config/providers");
const { trackedFetchJson } = require("../apiUsage");
const { normalizeQuoteUnits } = require("../currency");

// Tickers américains : 1 à 5 lettres, éventuellement une classe d'action (BRK.B)
const US_TICKER = /^[A-Z]{1,5}(\.[A-Z])?$/;
const num = (v) => (v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);

class FinnhubProvider {
  constructor() {
    this.name = "Finnhub";
    this.config = config.finnhub;
    this.baseUrl = this.config.baseUrl;
    this.apiKey = this.config.apiKey;
  }

  /** Appel HTTP compté dans le quota (ne jamais logger l'URL : elle contient la clé) */
  request(path, params) {
    const query = new URLSearchParams({ ...params, token: this.apiKey }).toString();
    return trackedFetchJson("finnhub", `${this.baseUrl}/${path}?${query}`);
  }

  async getQuote(ticker, { previous = null, live = false } = {}) {
    if (!this.config.enabled || !this.apiKey) throw new Error("Finnhub provider not configured");
    if (!this.supportsTickerType(ticker)) throw new Error(`Finnhub ne cote pas ${ticker}`);

    const data = await this.request("quote", { symbol: ticker });
    const price = num(data?.c);
    // Symbole inconnu : Finnhub répond 200 avec des zéros
    if (!(price > 0)) {
      const err = new Error(`No data found for ${ticker}`);
      err.code = "NOT_COVERED";
      throw err;
    }
    const previousClose = num(data.pc) > 0 ? num(data.pc) : null;

    const quote = {
      symbol: ticker,
      name: previous?.name || ticker,
      price,
      close: price,
      open: num(data.o) || null,
      high: num(data.h) || null,
      low: num(data.l) || null,
      volume: null,
      previousClose,
      change: previousClose ? price - previousClose : null,
      changePercent: previousClose ? ((price - previousClose) / previousClose) * 100 : null,
      marketCap: null,
      currency: "USD",
      marketTime: num(data.t) > 0 ? new Date(num(data.t) * 1000) : null,
      exchange: previous?.exchange || null,
      country: previous?.country || null,
      countryCode: previous?.countryCode || null,
      sector: previous?.sector || null,
      industry: previous?.industry || null,
      type: previous?.type || "Stock",
      dividend: null,
      dividendYield: null,
      dividendRate: null,
      exDividendDate: null,
      paymentDate: null,
      recordDate: null,
      lastUpdate: new Date(),
      source: "finnhub",
      live,
    };
    return normalizeQuoteUnits(quote, "USD");
  }

  supportsTickerType(ticker) {
    return US_TICKER.test(String(ticker || "").toUpperCase());
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

module.exports = FinnhubProvider;
