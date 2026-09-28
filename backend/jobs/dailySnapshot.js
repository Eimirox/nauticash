// backend/jobs/dailySnapshot.js
// Enregistre chaque jour la valeur du portefeuille de chaque utilisateur (services/dailyHistory.js).

const cron = require("node-cron");
const config = require("../config/providers");
const dailyHistory = require("../services/dailyHistory");

class DailySnapshot {
  constructor() {
    this.task = null;
    this.isRunning = false;
    this.lastRun = null;
    this.lastResult = null;
  }

  start() {
    const { enabled, schedule } = config.cron.dailyHistory;
    if (!enabled) {
      console.log("⏸️ Historique quotidien désactivé");
      return null;
    }
    if (!cron.validate(schedule)) {
      console.error(`❌ CRON_HISTORY_SCHEDULE invalide : "${schedule}" — historique quotidien désactivé`);
      return null;
    }
    this.task = cron.schedule(schedule, () => this.run(), { name: "daily-history", noOverlap: true, timezone: "UTC" });
    console.log(`📅 Historique quotidien planifié : ${schedule} (UTC)`);
    return this.task;
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }

  async run() {
    if (this.isRunning) return null;
    this.isRunning = true;
    try {
      const result = await dailyHistory.snapshotAll();
      this.lastRun = new Date();
      this.lastResult = result;
      console.log(`📅 Historique du ${result.date} : ${result.users} portefeuille(s) enregistré(s)`);
      return result;
    } catch (err) {
      console.error("❌ Historique quotidien :", err.message);
      return null;
    } finally {
      this.isRunning = false;
    }
  }

  getStats() {
    return { lastRun: this.lastRun, lastResult: this.lastResult, schedule: config.cron.dailyHistory.schedule };
  }
}

module.exports = new DailySnapshot();
