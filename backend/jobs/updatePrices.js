// backend/jobs/updatePrices.js
// Cron job pour actualiser automatiquement les prix de tous les tickers

// IMPORTANT : Charger dotenv en premier !
require("dotenv").config();

const cron = require("node-cron");
const mongoose = require("mongoose");
const priceStore = require("../services/priceStore");
const config = require("../config/providers");

class PriceUpdater {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalRuns: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      lastRunDuration: 0,
    };
  }

  /**
   * Démarre le cron job
   */
  start() {
    if (!config.cron.updatePrices.enabled) {
      console.log("⏸️ Cron job disabled in config");
      return null;
    }

    const schedule = config.cron.updatePrices.schedule;

    if (!cron.validate(schedule)) {
      console.error(`❌ CRON_UPDATE_SCHEDULE invalide : "${schedule}" — actualisation automatique désactivée`);
      return null;
    }

    console.log(`⏰ Starting price update cron job with schedule: ${schedule}`);

    // Cron job principal (node-cron v4 : noOverlap évite deux actualisations simultanées)
    this.task = cron.schedule(
      schedule,
      async () => {
        await this.run();
      },
      { name: "update-prices", noOverlap: true }
    );

    // Info : afficher le prochain run
    console.log(`✅ Cron job started. Next run will be according to: ${schedule}`);
    console.log(`   Example: "0 */6 * * *" = every 6 hours`);
    return this.task;
  }

  /**
   * Arrête le cron job (tests, arrêt propre du serveur)
   */
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }

  /**
   * Exécute une actualisation complète
   */
  async run() {
    if (this.isRunning) {
      console.log("⏭️ Price update already running, skipping...");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    this.stats.totalRuns++;

    console.log("\n" + "=".repeat(60));
    console.log(`🚀 PRICE UPDATE STARTED at ${new Date().toISOString()}`);
    console.log("=".repeat(60) + "\n");

    try {
      // 1. Récupérer tous les tickers uniques de tous les users
      const allTickers = await this.getAllUniqueTickers();

      console.log(`📊 Found ${allTickers.length} unique tickers across all users`);

      if (allTickers.length === 0) {
        console.log("⚠️ No tickers to update");
        return;
      }

      // 2. Prioriser les tickers (les plus populaires en premier)
      let prioritizedTickers = await this.prioritizeTickers(allTickers);

      // Titres sans cours daté ou dont la dernière actualisation a échoué : en premier
      const docs = await priceStore.getCachedMany(prioritizedTickers);
      const byTicker = new Map(docs.map((d) => [d.symbol, d]));
      const needsFix = (t) => {
        const d = byTicker.get(t);
        return !d || !d.lastUpdate || !d.marketTime || Boolean(d.lastError);
      };
      prioritizedTickers = [...prioritizedTickers.filter(needsFix), ...prioritizedTickers.filter((t) => !needsFix(t))];

      // 3. Limiter au batch size si nécessaire
      const batchSize = config.cron.updatePrices.batchSize;
      const tickersToUpdate = prioritizedTickers.slice(0, batchSize);

      if (tickersToUpdate.length < allTickers.length) {
        console.log(`⚠️ Limiting to ${batchSize} tickers (${allTickers.length} total)`);
      }

      // 4. Actualiser les prix
      await this.updatePrices(tickersToUpdate);

      // 5. Nettoyer le cache des tickers non utilisés
      await this.cleanupUnusedCache(allTickers);

      const duration = Date.now() - startTime;
      this.stats.lastRunDuration = duration;
      this.lastRun = new Date();

      console.log("\n" + "=".repeat(60));
      console.log(`✅ PRICE UPDATE COMPLETED in ${(duration / 1000).toFixed(2)}s`);
      console.log(`   - Successful: ${this.stats.successfulUpdates}`);
      console.log(`   - Failed: ${this.stats.failedUpdates}`);
      console.log("=".repeat(60) + "\n");
    } catch (error) {
      console.error("❌ Price update failed:", error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Récupère tous les tickers uniques de tous les users
   */
  async getAllUniqueTickers() {
    try {
      const User = mongoose.connection.collection("users");

      // Utiliser aggregation pour extraire tous les tickers
      const result = await User.aggregate([
        { $unwind: "$portfolio" },
        { $group: { _id: "$portfolio.ticker" } },
      ]).toArray();

      return result.map((r) => r._id).filter(Boolean);
    } catch (error) {
      console.error("❌ Error fetching tickers:", error);
      return [];
    }
  }

  /**
   * Priorise les tickers par popularité (nombre d'users qui les possèdent)
   */
  async prioritizeTickers(tickers) {
    try {
      const User = mongoose.connection.collection("users");

      // Compter combien d'users ont chaque ticker
      const popularity = await User.aggregate([
        { $unwind: "$portfolio" },
        {
          $group: {
            _id: "$portfolio.ticker",
            userCount: { $sum: 1 },
          },
        },
        { $sort: { userCount: -1 } },
      ]).toArray();

      const popularityMap = new Map(
        popularity.map((p) => [p._id, p.userCount])
      );

      // Trier les tickers par popularité
      const sorted = tickers.sort((a, b) => {
        const countA = popularityMap.get(a) || 0;
        const countB = popularityMap.get(b) || 0;
        return countB - countA;
      });

      // Afficher le top 10
      console.log("\n📈 Top 10 most popular tickers:");
      sorted.slice(0, 10).forEach((ticker, i) => {
        const count = popularityMap.get(ticker);
        console.log(`   ${i + 1}. ${ticker} (${count} users)`);
      });
      console.log("");

      return sorted;
    } catch (error) {
      console.error("❌ Error prioritizing tickers:", error);
      return tickers;
    }
  }

  /**
   * Actualise les prix de tous les tickers
   */
  async updatePrices(tickers) {
    const delay = config.cron.updatePrices.delayBetweenRequests;
    // Un peu moins que l'intervalle du cron, pour ne pas sauter un run sur deux
    const maxAgeMs = Math.round(config.cache.maxAge * 0.8);
    const isWeekend = [0, 6].includes(new Date().getUTCDay());

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    console.log(`🔄 Updating ${tickers.length} tickers...\n`);

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      const progress = `[${i + 1}/${tickers.length}]`;

      try {
        // Le week-end, seules les cryptos bougent : inutile de consommer du quota pour les actions
        if (isWeekend) {
          const cached = await priceStore.getCached(ticker);
          if (cached && cached.type !== "Crypto") {
            skippedCount++;
            continue;
          }
        }

        // L'âge se mesure sur la dernière actualisation complète : les cours intraday
        // (jobs/livePrices.js) ne dispensent pas de vérifier profil et dividendes le soir.
        const { doc, fromCache } = await priceStore.refreshTicker(ticker, { maxAgeMs, ageField: "fullUpdateAt" });
        if (fromCache) {
          skippedCount++;
          continue;
        }

        console.log(`${progress} ✅ ${ticker} - ${doc.close} ${doc.currency}`);
        successCount++;
        this.stats.successfulUpdates++;
      } catch (error) {
        console.log(`${progress} ❌ ${ticker} - ${error.message}`);
        failCount++;
        this.stats.failedUpdates++;

        // Quota atteint sur tous les providers : inutile de continuer, les anciens prix restent en base
        if (/quota|rate limit/i.test(error.message)) {
          console.log("⏸️ Quota atteint, arrêt de l'actualisation (les prix en cache sont conservés).");
          break;
        }
      }

      if (i < tickers.length - 1) {
        await this.sleep(delay);
      }
    }

    console.log(`\n📊 Results: ${successCount} updated, ${failCount} failed, ${skippedCount} skipped (still fresh)`);
  }

  /**
   * Nettoie le cache des tickers qui ne sont plus utilisés
   */
  async cleanupUnusedCache(activeTickers) {
    try {
      const Prices = mongoose.connection.collection("prices");

      // Trouver les tickers en cache qui ne sont plus dans aucun portfolio
      const cachedTickers = await Prices.distinct("symbol");
      const unusedTickers = cachedTickers.filter((t) => !activeTickers.includes(t));

      if (unusedTickers.length > 0) {
        console.log(`\n🗑️ Cleaning up ${unusedTickers.length} unused tickers from cache:`);
        console.log(`   ${unusedTickers.join(", ")}`);

        // Supprimer les entrées non utilisées depuis plus de 7 jours
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const result = await Prices.deleteMany({
          symbol: { $in: unusedTickers },
          lastUpdate: { $lt: sevenDaysAgo },
        });

        console.log(`   Deleted ${result.deletedCount} old entries`);
      }
    } catch (error) {
      console.error("❌ Error cleaning up cache:", error);
    }
  }

  /**
   * Exécution manuelle (pour tester)
   */
  async runManual() {
    console.log("🔧 Running manual price update...");
    await this.run();
  }

  /**
   * Stats du cron job
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun: this.getNextRun(),
      schedule: config.cron.updatePrices.schedule,
    };
  }

  /**
   * Calcule la prochaine exécution (approximatif)
   */
  getNextRun() {
    if (!this.lastRun) return "Not yet run";

    const schedule = config.cron.updatePrices.schedule;

    // Parser "0 */6 * * *" pour trouver l'intervalle
    const parts = schedule.split(" ");
    const hours = parts[1];

    if (hours.startsWith("*/")) {
      const interval = parseInt(hours.replace("*/", ""));
      const nextRun = new Date(this.lastRun.getTime() + interval * 60 * 60 * 1000);
      return nextRun;
    }

    return "Unknown";
  }

  /**
   * Utilitaire sleep
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export en singleton
const updater = new PriceUpdater();

// Si le script est exécuté directement (node jobs/updatePrices.js)
if (require.main === module) {
  console.log("🔧 Running manual price update...");
  
  // Connexion à MongoDB (dotenv déjà chargé en haut du fichier)
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ MongoDB connected");
      return updater.run();
    })
    .then(() => {
      console.log("✅ Manual update completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Manual update failed:", error);
      process.exit(1);
    });
}

module.exports = updater;