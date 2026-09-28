// backend/services/apiUsage.js
// Compte chaque appel HTTP réel vers un provider (et pas seulement chaque getQuote)
// pour respecter les quotas journaliers et par minute des offres gratuites.

const config = require("../config/providers");

const calls = new Map(); // provider -> [timestamps]
const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

function limitsFor(provider) {
  const p = config[provider] || {};
  const free = p.limits?.free || {};
  const envDaily = parseInt(process.env[`${provider.toUpperCase()}_DAILY_LIMIT`], 10);
  return {
    perDay: Number.isFinite(envDaily) ? envDaily : free.requestsPerDay || null,
    perMinute: free.requestsPerMinute || null,
  };
}

function recent(provider, windowMs) {
  const now = Date.now();
  const list = (calls.get(provider) || []).filter((t) => now - t < DAY);
  calls.set(provider, list);
  return list.filter((t) => now - t < windowMs).length;
}

function canCall(provider) {
  if (!config.rateLimiting?.enabled) return true;
  const { perDay, perMinute } = limitsFor(provider);
  if (perDay && recent(provider, DAY) >= perDay) return false;
  if (perMinute && recent(provider, MINUTE) >= perMinute) return false;
  return true;
}

function record(provider) {
  const list = calls.get(provider) || [];
  list.push(Date.now());
  calls.set(provider, list);
}

class QuotaExceededError extends Error {
  constructor(provider) {
    super(`Quota API atteint pour ${provider}`);
    this.code = "QUOTA_EXCEEDED";
  }
}

/**
 * fetch() qui vérifie le quota, compte l'appel et renvoie le JSON.
 * Ne jamais logger l'URL : elle contient la clé API.
 */
async function trackedFetchJson(provider, url, init = undefined) {
  if (!canCall(provider)) throw new QuotaExceededError(provider);
  record(provider);
  const response = await fetch(url, init);
  if (!response.ok) {
    const err = new Error(`${provider} API returned ${response.status}`);
    err.status = response.status;
    // FMP : 402 = symbole hors de l'offre souscrite (l'offre gratuite ne couvre qu'environ 90 symboles)
    if (response.status === 402) err.code = "NOT_COVERED";
    throw err;
  }
  return response.json();
}

function stats() {
  const out = {};
  for (const provider of calls.keys()) {
    const { perDay, perMinute } = limitsFor(provider);
    out[provider] = {
      last24h: recent(provider, DAY),
      lastMinute: recent(provider, MINUTE),
      dailyLimit: perDay,
      minuteLimit: perMinute,
    };
  }
  return out;
}

module.exports = { canCall, record, trackedFetchJson, stats, QuotaExceededError };
