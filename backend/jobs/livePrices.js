// backend/jobs/livePrices.js
// Actualisation intraday : toutes les minutes, les cours des titres détenus dont le marché
// est ouvert (crypto : 24 h/24) sont rafraîchis via Yahoo Finance (pas de quota journalier).
// Économie d'appels :
//   - uniquement les tickers présents dans au moins un portefeuille ;
//   - uniquement si leur marché est ouvert (rien la nuit ni le week-end, sauf crypto) ;
//   - un titre n'est pas rafraîchi s'il l'a été il y a moins de LIVE_MIN_AGE_SECONDS ;
//   - au plus LIVE_MAX_PER_RUN appels par minute, les cours les plus anciens d'abord ;
//   - appel « léger » (période 1 jour, sans dividendes ni profil) ;
//   - le quota FMP (250/jour) n'est jamais utilisé ici : il reste pour l'actualisation du soir.

const cron = require("node-cron");
const mongoose = require("mongoose");
const config = require("../config/providers");
const priceStore = require("../services/priceStore");
const { isMarketOpen } = require("../services/marketHours");

class LivePrices {
  constructor() {
    this.task = null;
    this.isRunning = false;
    this.stats = { runs: 0, refreshed: 0, failed: 0, skippedClosed: 0, lastRun: null, lastRefreshed: 0 };
    // Diagnostic : dernière erreur par ticker (effacée au prochain succès), visible dans /api/admin/stats.
    // Permet de voir pourquoi un cours reste figé (ex. symbole refusé par Yahoo).
    this.errors = new Map(); // ticker -> { message, at, count }
  }

  start() {
    const { enabled, schedule } = config.cron.livePrices;
    if (!enabled) {
      console.log("⏸️ Actualisation intraday désactivée");
      return null;
    }
    if (!cron.validate(schedule)) {
      console.error(`❌ LIVE_PRICES_SCHEDULE invalide : "${schedule}" — actualisation intraday désactivée`);
      return null;
    }
    this.task = cron.schedule(schedule, () => this.run(), { name: "live-prices", noOverlap: true });
    console.log(`⚡ Actualisation intraday planifiée : ${schedule}`);
    return this.task;
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }

  /** Tickers détenus avec leur type (pour reconnaître les cryptos) */
  async heldTickers() {
    const users = await mongoose.connection.collection("users").find({}).toArray();
    return [...new Set(users.flatMap((u) => (u.portfolio || []).map((p) => p.ticker)).filter(Boolean))];
  }

  async run(now = new Date()) {
    if (this.isRunning) return null;
    this.isRunning = true;
    const { maxPerRun, minAgeMs, delayMs } = config.cron.livePrices;
    let refreshed = 0;
    let failed = 0;
    try {
      const tickers = await this.heldTickers();
      if (!tickers.length) return { refreshed: 0, candidates: 0 };

      const cached = await priceStore.getCachedMany(tickers);
      const bySymbol = new Map(cached.map((d) => [d.symbol, d]));

      const candidates = tickers
        .map((t) => ({ ticker: t, doc: bySymbol.get(t) }))
        .filter(({ ticker, doc }) => {
          if (!isMarketOpen(ticker, doc?.type, now)) {
            this.stats.skippedClosed++;
            return false;
          }
          const age = doc?.lastUpdate ? now.getTime() - new Date(doc.lastUpdate).getTime() : Infinity;
          return age >= minAgeMs;
        })
        .sort((a, b) => new Date(a.doc?.lastUpdate || 0) - new Date(b.doc?.lastUpdate || 0))
        .slice(0, maxPerRun);

      for (const { ticker } of candidates) {
        try {
          await priceStore.refreshTicker(ticker, { live: true, providers: ["yahoo", "finnhub"] });
          refreshed++;
          this.errors.delete(ticker);
        } catch (err) {
          failed++;
          const prev = this.errors.get(ticker);
          this.errors.set(ticker, { message: err.message, at: new Date(), count: (prev?.count || 0) + 1 });
          // Limite Yahoo atteinte : on s'arrête pour cette minute
          if (/quota|429|rate/i.test(err.message)) break;
        }
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      }
      return { refreshed, failed, candidates: candidates.length };
    } catch (err) {
      console.error("❌ Actualisation intraday :", err.message);
      return null;
    } finally {
      this.stats.runs++;
      this.stats.refreshed += refreshed;
      this.stats.failed += failed;
      this.stats.lastRefreshed = refreshed;
      this.stats.lastRun = new Date();
      this.isRunning = false;
    }
  }

  getStats() {
    return {
      ...this.stats,
      schedule: config.cron.livePrices.schedule,
      enabled: config.cron.livePrices.enabled,
      errors: Object.fromEntries(this.errors),
    };
  }
}

module.exports = new LivePrices();
