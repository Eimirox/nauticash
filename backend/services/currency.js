// backend/services/currency.js
// Devise de cotation d'un titre et conversion des sous-unités.
//
// Certaines places cotent en centièmes de devise : Londres en pence (GBp / GBX),
// Johannesburg en cents (ZAc), Tel-Aviv en agorot (ILA). Sans conversion, une action
// à 27,00 £ apparaît à « 2 700 £ » et la valeur de la ligne est multipliée par 100.
// On enregistre donc toujours les prix dans la devise principale (GBP, ZAR, ILS).

// Sous-unité → [devise principale, diviseur]
const MINOR_UNITS = {
  GBp: ["GBP", 100], GBX: ["GBP", 100], GBx: ["GBP", 100],
  ZAc: ["ZAR", 100], ZAC: ["ZAR", 100],
  ILA: ["ILS", 100], ILa: ["ILS", 100],
};

// Suffixe du ticker (convention Yahoo / FMP) → devise de cotation habituelle
const SUFFIX_CURRENCY = {
  PA: "EUR", AS: "EUR", BR: "EUR", LS: "EUR", DE: "EUR", F: "EUR", MI: "EUR", MC: "EUR",
  HE: "EUR", VI: "EUR", IR: "EUR",
  L: "GBp", IL: "GBp",
  SW: "CHF", ST: "SEK", OL: "NOK", CO: "DKK",
  TO: "CAD", V: "CAD", T: "JPY", HK: "HKD", SS: "CNY", SZ: "CNY", AX: "AUD",
  NS: "INR", BO: "INR", TA: "ILA", JO: "ZAc",
};

// Place de cotation → devise (quand le ticker n'a pas de suffixe explicite)
const EXCHANGE_CURRENCY = {
  NASDAQ: "USD", NYSE: "USD", AMEX: "USD", NYSEARCA: "USD", BATS: "USD", CBOE: "USD", OTC: "USD",
  EURONEXT: "EUR", XETRA: "EUR", FRA: "EUR", MIL: "EUR", BME: "EUR",
  LSE: "GBp", SIX: "CHF", TSX: "CAD", JPX: "JPY", HKSE: "HKD", ASX: "AUD",
};

const isCryptoTicker = (ticker) => /(^|-)(BTC|ETH)|-USD$|USDT$/.test(ticker);

function suffixOf(ticker) {
  const m = /\.([A-Z]{1,2})$/.exec(String(ticker || "").toUpperCase());
  return m ? m[1] : null;
}

/**
 * Devise de cotation brute (peut être une sous-unité comme « GBp »).
 * Priorité : devise renvoyée par l'API > devise déjà connue > suffixe > place de cotation.
 */
function detectQuoteCurrency({ ticker, apiCurrency, knownCurrency, exchange }) {
  if (apiCurrency) return apiCurrency;
  if (knownCurrency) return knownCurrency;

  if (isCryptoTicker(ticker)) return /EUR$/.test(ticker) ? "EUR" : "USD";

  const suffix = suffixOf(ticker);
  if (suffix && SUFFIX_CURRENCY[suffix]) return SUFFIX_CURRENCY[suffix];

  const ex = String(exchange || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (EXCHANGE_CURRENCY[ex]) return EXCHANGE_CURRENCY[ex];

  // Sans suffixe : convention US
  return suffix ? null : "USD";
}

/** { currency: devise principale, factor: diviseur à appliquer aux prix } */
function toMajorUnit(currency) {
  if (currency && MINOR_UNITS[currency]) {
    const [major, factor] = MINOR_UNITS[currency];
    return { currency: major, factor };
  }
  return { currency: currency ? currency.toUpperCase() : null, factor: 1 };
}

const PRICE_FIELDS = ["price", "close", "open", "high", "low", "previousClose", "change", "dividend", "dividendRate"];

/**
 * Convertit les champs de prix d'un quote en devise principale.
 * `quoteCurrency` garde la devise d'origine (utile pour les rafraîchissements suivants).
 */
function normalizeQuoteUnits(quote, rawCurrency) {
  const { currency, factor } = toMajorUnit(rawCurrency);
  const out = { ...quote, currency: currency || quote.currency || null, quoteCurrency: rawCurrency || null };
  if (factor !== 1) {
    for (const field of PRICE_FIELDS) {
      if (typeof out[field] === "number") out[field] = out[field] / factor;
    }
  }
  return out;
}

module.exports = { detectQuoteCurrency, toMajorUnit, normalizeQuoteUnits, isCryptoTicker, suffixOf, MINOR_UNITS };
