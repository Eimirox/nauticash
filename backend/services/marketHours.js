// backend/services/marketHours.js
// Heures d'ouverture des places (heure locale, jours ouvrés) pour n'actualiser en journée
// que les titres dont le marché est ouvert. Les jours fériés ne sont pas gérés : un appel
// inutile au plus par titre et par minute ces jours-là, sans conséquence sur les quotas.

const { isCryptoTicker, suffixOf } = require("./currency");

// Fuseau et horaires (HH:MM locale) ; 15 min de marge après la clôture pour le cours de clôture
const MARKETS = {
  US: { tz: "America/New_York", open: "09:30", close: "16:15" },
  EU: { tz: "Europe/Paris", open: "09:00", close: "17:45" },
  UK: { tz: "Europe/London", open: "08:00", close: "16:45" },
  CH: { tz: "Europe/Zurich", open: "09:00", close: "17:45" },
  CA: { tz: "America/Toronto", open: "09:30", close: "16:15" },
  JP: { tz: "Asia/Tokyo", open: "09:00", close: "15:45" },
  HK: { tz: "Asia/Hong_Kong", open: "09:30", close: "16:15" },
  AU: { tz: "Australia/Sydney", open: "10:00", close: "16:15" },
};

const SUFFIX_MARKET = {
  PA: "EU", AS: "EU", BR: "EU", LS: "EU", DE: "EU", F: "EU", MI: "EU", MC: "EU", HE: "EU", VI: "EU", IR: "EU",
  ST: "EU", OL: "EU", CO: "EU",
  L: "UK", IL: "UK", SW: "CH", TO: "CA", V: "CA", T: "JP", HK: "HK", AX: "AU",
};

/** Place de cotation d'un ticker : "CRYPTO", une clé de MARKETS, ou null (inconnue) */
function marketOf(ticker, type) {
  if (String(type || "").toLowerCase().startsWith("crypto") || isCryptoTicker(ticker)) return "CRYPTO";
  const suffix = suffixOf(ticker);
  if (!suffix) return "US";
  return SUFFIX_MARKET[suffix] || null;
}

function localParts(date, tz) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { weekday: get("weekday"), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** true si le marché du titre est ouvert à cette date (crypto : toujours) */
function isMarketOpen(ticker, type, date = new Date()) {
  const market = marketOf(ticker, type);
  if (market === "CRYPTO") return true;
  const def = MARKETS[market];
  if (!def) return false;
  const { weekday, minutes } = localParts(date, def.tz);
  if (weekday === "Sat" || weekday === "Sun") return false;
  return minutes >= toMinutes(def.open) && minutes <= toMinutes(def.close);
}

module.exports = { isMarketOpen, marketOf, MARKETS };
