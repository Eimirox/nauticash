// backend/services/exchanges.js
// Libellé lisible de la place de cotation (évite la confusion entre, par exemple,
// Airbus à Paris « AIR.PA » et d'autres cotations du même titre) et URL du logo.

const { isCryptoTicker, suffixOf } = require("./currency");

const BY_SUFFIX = {
  PA: "Euronext Paris", AS: "Euronext Amsterdam", BR: "Euronext Bruxelles", LS: "Euronext Lisbonne",
  IR: "Euronext Dublin", MI: "Borsa Italiana (Milan)", MC: "Bourse de Madrid", DE: "XETRA (Francfort)",
  F: "Bourse de Francfort", HE: "Nasdaq Helsinki", ST: "Nasdaq Stockholm", CO: "Nasdaq Copenhague",
  OL: "Bourse d'Oslo", VI: "Bourse de Vienne", SW: "SIX (Zurich)", L: "Bourse de Londres", IL: "Bourse de Londres",
  TO: "Bourse de Toronto", V: "TSX Venture", T: "Bourse de Tokyo", HK: "Bourse de Hong Kong", AX: "ASX (Sydney)",
  SS: "Bourse de Shanghai", SZ: "Bourse de Shenzhen", NS: "NSE (Inde)", BO: "BSE (Inde)",
};

const strip = (s) => String(s || "").toUpperCase().replace(/[^A-Z]/g, "");
const BY_CODE = {
  NASDAQ: "NASDAQ", NMS: "NASDAQ", NGM: "NASDAQ", NCM: "NASDAQ", NAS: "NASDAQ", NASDAQGS: "NASDAQ", NASDAQGM: "NASDAQ", NASDAQCM: "NASDAQ",
  NYSE: "NYSE", NYQ: "NYSE", AMEX: "NYSE American", ASE: "NYSE American", NYSEAMERICAN: "NYSE American",
  NYSEARCA: "NYSE Arca", PCX: "NYSE Arca", ARCA: "NYSE Arca", BATS: "Cboe BZX", BTS: "Cboe BZX", CBOE: "Cboe",
  OTC: "OTC (hors cote)", PNK: "OTC (hors cote)", OTCMARKETS: "OTC (hors cote)",
  EURONEXT: "Euronext", PAR: "Euronext Paris", EURONEXTPARIS: "Euronext Paris", AMS: "Euronext Amsterdam",
  XETRA: "XETRA (Francfort)", GER: "XETRA (Francfort)", LSE: "Bourse de Londres", LON: "Bourse de Londres",
};

/** Libellé de la place de cotation, déduit du suffixe du ticker puis du code renvoyé par l'API */
function exchangeLabel(ticker, rawExchange, type) {
  if (String(type || "").toLowerCase().startsWith("crypto") || isCryptoTicker(ticker)) return "Crypto";
  const suffix = suffixOf(ticker);
  if (suffix && BY_SUFFIX[suffix]) return BY_SUFFIX[suffix];
  const code = strip(rawExchange);
  if (BY_CODE[code]) return BY_CODE[code];
  if (!suffix && !code) return "États-Unis";
  return rawExchange && rawExchange !== "Unknown" ? String(rawExchange) : null;
}

/** URL du logo (images publiques FMP, sans clé) ; le navigateur affiche des initiales si elle échoue */
function logoUrl(ticker) {
  const t = String(ticker || "").toUpperCase();
  if (!t) return null;
  const symbol = isCryptoTicker(t) ? t.replace("-", "") : t;
  return `https://images.financialmodelingprep.com/symbol/${encodeURIComponent(symbol)}.png`;
}

module.exports = { exchangeLabel, logoUrl };
