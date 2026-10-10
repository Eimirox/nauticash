// backend/jobs/priceCheck.js
// Contrôle quotidien de cohérence des cours (étape 2/2), lancé après l'actualisation du soir.
// Pour chaque titre détenu : cours enregistré comparé au cours d'un second fournisseur
// (appel « léger », sans profil ni dividendes), puis classement par services/priceConsistency.js.
// Économie d'appels :
//   - jamais FMP (son quota journalier reste réservé à l'actualisation du soir) ;
//   - second fournisseur = Yahoo, ou Finnhub (actions US) quand le cours enregistré vient déjà de Yahoo ;
//   - quota respecté (apiUsage.canCall) : un fournisseur à court de quota n'est plus appelé (« non vérifié ») ;
//   - au plus PRICE_CHECK_MAX titres, les plus détenus d'abord.
// Le dernier résumé est enregistré (collection « jobRuns », _id « priceCheck »), exposé dans
// /api/admin/stats et écrit au journal serveur.

const cron = require("node-cron");
const mongoose = require("mongoose");
const config = require("../config/providers");
const priceStore = require("../services/priceStore");
const priceService = require("../services/priceService");
const apiUsage = require("../services/apiUsage");
const { heldTickers } = require("../services/coverage");
const { checkPrice, summarize, formatLog } = require("../services/priceConsistency");

/** Fournisseurs de contrôle, par ordre de préférence (FMP exclu volontairement) */
const REFERENCE_PROVIDERS = ["yahoo", "finnhub"];
const RUN_ID = "priceCheck";

const jobRuns = () => mongoose.connection.collection("jobRuns");

/**
 * Choisit le second fournisseur pour un titre : un fournisseur actif, qui cote ce ticker,
 * dont le quota n'est pas atteint, et différent de la source du cours enregistré.
 * @returns {string|null}
 */
function pickReference(ticker, source, { providers = priceService.providers, exhausted = new Set() } = {}) {
  for (const name of REFERENCE_PROVIDERS) {
    const provider = providers[name];
    if (!provider || name === source || exhausted.has(name)) continue;
    if (typeof provider.supportsTickerType === "function" && !provider.supportsTickerType(ticker)) continue;
    if (!apiUsage.canCall(name)) continue;
    return name;
  }
  return null;
}

class PriceCheck {
  constructor() {
    this.task = null;
    this.isRunning = false;
    this.lastRun = null;
    this.lastSummary = null;
  }

  start() {
    const { enabled, schedule } = config.cron.priceCheck;
    if (!enabled) {
      console.log("⏸️ Contrôle de cohérence des cours désactivé");
      return null;
    }
    if (!cron.validate(schedule)) {
      console.error(`❌ CRON_PRICE_CHECK_SCHEDULE invalide : "${schedule}" — contrôle de cohérence désactivé`);
      return null;
    }
    this.task = cron.schedule(schedule, () => this.run(), { name: "price-check", noOverlap: true, timezone: "UTC" });
    console.log(`🔎 Contrôle de cohérence des cours planifié : ${schedule} (UTC)`);
    return this.task;
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }

  /** Cours du second fournisseur (null s'il ne répond pas) */
  async referenceQuote(name, ticker, doc, exhausted) {
    try {
      const quote = await priceService.providers[name].getQuote(ticker, { previous: doc, live: true });
      const price = Number(quote?.price ?? quote?.close);
      return price > 0 ? price : null;
    } catch (err) {
      if (err.code === "QUOTA_EXCEEDED" || /quota|rate limit|429/i.test(err.message)) exhausted.add(name);
      return null;
    }
  }

  async run({ now = new Date() } = {}) {
    if (this.isRunning) return null;
    this.isRunning = true;
    try {
      const { maxTickers, delayMs, threshold } = config.cron.priceCheck;
      const tickers = (await heldTickers()).slice(0, maxTickers).map((h) => h.ticker);
      const docs = await priceStore.getCachedMany(tickers);
      const bySymbol = new Map(docs.map((d) => [d.symbol, d]));
      const exhausted = new Set();
      const results = [];

      for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        const doc = bySymbol.get(ticker) || null;
        let referencePrice = null;
        let referenceSource = null;
        // Inutile d'appeler un fournisseur pour un titre sans aucun cours : il est déjà « en échec »
        const name = Number(doc?.close) > 0 ? pickReference(ticker, doc?.source, { exhausted }) : null;
        if (name) {
          referencePrice = await this.referenceQuote(name, ticker, doc, exhausted);
          referenceSource = priceService.providers[name].name || name;
          if (delayMs && i < tickers.length - 1) await new Promise((r) => setTimeout(r, delayMs));
        }
        const result = checkPrice(doc, { referencePrice, referenceSource, threshold, now });
        results.push({ ticker, source: doc?.source || null, ...result });
      }

      const summary = summarize(results, { checkedAt: now });
      this.lastSummary = summary;
      this.lastRun = new Date();
      console.log(formatLog(summary));
      try {
        await jobRuns().updateOne({ _id: RUN_ID }, { $set: { ...summary, results } }, { upsert: true });
      } catch (err) {
        console.error("❌ Contrôle de cohérence : enregistrement impossible :", err.message);
      }
      return summary;
    } catch (err) {
      console.error("❌ Contrôle de cohérence des cours :", err.message);
      return null;
    } finally {
      this.isRunning = false;
    }
  }

  /** Dernier résumé : en mémoire, sinon celui enregistré en base (après un redémarrage) */
  async getLastSummary() {
    if (this.lastSummary) return this.lastSummary;
    try {
      const saved = await jobRuns().findOne({ _id: RUN_ID });
      if (!saved) return null;
      const { checkedAt, total, counts, issues } = saved;
      return { checkedAt, total, counts, issues };
    } catch {
      return null;
    }
  }

  async getStats() {
    const { enabled, schedule, maxTickers, threshold } = config.cron.priceCheck;
    return { enabled, schedule, maxTickers, threshold, isRunning: this.isRunning, lastSummary: await this.getLastSummary() };
  }
}

const priceCheck = new PriceCheck();
priceCheck.pickReference = pickReference;
module.exports = priceCheck;
