// backend/services/popularTickers.js
// Liste locale des titres les plus courants : suggestions instantanées sans appel API,
// et secours si la recherche en ligne est indisponible.
// Format : [symbole, nom, type, place]

const LIST = [
  // États-Unis
  ["AAPL", "Apple Inc.", "Stock", "NASDAQ"], ["MSFT", "Microsoft Corporation", "Stock", "NASDAQ"],
  ["NVDA", "NVIDIA Corporation", "Stock", "NASDAQ"], ["GOOGL", "Alphabet Inc. (classe A)", "Stock", "NASDAQ"],
  ["GOOG", "Alphabet Inc. (Google, classe C)", "Stock", "NASDAQ"], ["AMZN", "Amazon.com Inc.", "Stock", "NASDAQ"],
  ["META", "Meta Platforms Inc. (Facebook)", "Stock", "NASDAQ"], ["TSLA", "Tesla Inc.", "Stock", "NASDAQ"],
  ["BRK-B", "Berkshire Hathaway (classe B)", "Stock", "NYSE"], ["V", "Visa Inc.", "Stock", "NYSE"],
  ["MA", "Mastercard Inc.", "Stock", "NYSE"], ["JPM", "JPMorgan Chase & Co.", "Stock", "NYSE"],
  ["JNJ", "Johnson & Johnson", "Stock", "NYSE"], ["WMT", "Walmart Inc.", "Stock", "NYSE"],
  ["PG", "Procter & Gamble", "Stock", "NYSE"], ["KO", "Coca-Cola Company", "Stock", "NYSE"],
  ["PEP", "PepsiCo Inc.", "Stock", "NASDAQ"], ["MCD", "McDonald's Corporation", "Stock", "NYSE"],
  ["DIS", "Walt Disney Company", "Stock", "NYSE"], ["NFLX", "Netflix Inc.", "Stock", "NASDAQ"],
  ["AMD", "Advanced Micro Devices", "Stock", "NASDAQ"], ["INTC", "Intel Corporation", "Stock", "NASDAQ"],
  ["AVGO", "Broadcom Inc.", "Stock", "NASDAQ"], ["ORCL", "Oracle Corporation", "Stock", "NYSE"],
  ["CRM", "Salesforce Inc.", "Stock", "NYSE"], ["ADBE", "Adobe Inc.", "Stock", "NASDAQ"],
  ["COST", "Costco Wholesale", "Stock", "NASDAQ"], ["NKE", "Nike Inc.", "Stock", "NYSE"],
  ["XOM", "Exxon Mobil", "Stock", "NYSE"], ["UNH", "UnitedHealth Group", "Stock", "NYSE"],
  ["LLY", "Eli Lilly and Company", "Stock", "NYSE"], ["PFE", "Pfizer Inc.", "Stock", "NYSE"],
  ["BAC", "Bank of America", "Stock", "NYSE"], ["O", "Realty Income", "Stock", "NYSE"],
  ["PLTR", "Palantir Technologies", "Stock", "NASDAQ"], ["UBER", "Uber Technologies", "Stock", "NYSE"],
  // France (Euronext Paris)
  ["AI.PA", "Air Liquide", "Stock", "Euronext Paris"], ["AIR.PA", "Airbus SE", "Stock", "Euronext Paris"],
  ["MC.PA", "LVMH Moët Hennessy Louis Vuitton", "Stock", "Euronext Paris"], ["OR.PA", "L'Oréal", "Stock", "Euronext Paris"],
  ["RMS.PA", "Hermès International", "Stock", "Euronext Paris"], ["TTE.PA", "TotalEnergies", "Stock", "Euronext Paris"],
  ["SAN.PA", "Sanofi", "Stock", "Euronext Paris"], ["BNP.PA", "BNP Paribas", "Stock", "Euronext Paris"],
  ["SU.PA", "Schneider Electric", "Stock", "Euronext Paris"], ["DG.PA", "Vinci", "Stock", "Euronext Paris"],
  ["SAF.PA", "Safran", "Stock", "Euronext Paris"], ["EL.PA", "EssilorLuxottica", "Stock", "Euronext Paris"],
  ["KER.PA", "Kering", "Stock", "Euronext Paris"], ["BN.PA", "Danone", "Stock", "Euronext Paris"],
  ["CS.PA", "AXA", "Stock", "Euronext Paris"], ["GLE.PA", "Société Générale", "Stock", "Euronext Paris"],
  ["ACA.PA", "Crédit Agricole", "Stock", "Euronext Paris"], ["ENGI.PA", "Engie", "Stock", "Euronext Paris"],
  ["ORA.PA", "Orange", "Stock", "Euronext Paris"], ["CAP.PA", "Capgemini", "Stock", "Euronext Paris"],
  ["DSY.PA", "Dassault Systèmes", "Stock", "Euronext Paris"], ["RI.PA", "Pernod Ricard", "Stock", "Euronext Paris"],
  ["SGO.PA", "Saint-Gobain", "Stock", "Euronext Paris"], ["STLAP.PA", "Stellantis", "Stock", "Euronext Paris"],
  ["RNO.PA", "Renault", "Stock", "Euronext Paris"], ["ML.PA", "Michelin", "Stock", "Euronext Paris"],
  ["HO.PA", "Thales", "Stock", "Euronext Paris"], ["VIE.PA", "Veolia", "Stock", "Euronext Paris"],
  ["LR.PA", "Legrand", "Stock", "Euronext Paris"], ["PUB.PA", "Publicis Groupe", "Stock", "Euronext Paris"],
  ["ASML.AS", "ASML Holding", "Stock", "Euronext Amsterdam"],
  // ETF
  ["CW8.PA", "Amundi MSCI World UCITS ETF", "ETF", "Euronext Paris"], ["EWLD.PA", "Amundi PEA MSCI World UCITS ETF", "ETF", "Euronext Paris"],
  ["ESE.PA", "BNP Paribas Easy S&P 500 UCITS ETF", "ETF", "Euronext Paris"], ["PE500.PA", "Amundi PEA S&P 500 UCITS ETF", "ETF", "Euronext Paris"],
  ["PAEEM.PA", "Amundi PEA Emerging Markets UCITS ETF", "ETF", "Euronext Paris"], ["PANX.PA", "Amundi PEA Nasdaq-100 UCITS ETF", "ETF", "Euronext Paris"],
  ["WPEA.PA", "iShares MSCI World Swap PEA UCITS ETF", "ETF", "Euronext Paris"], ["CAC.PA", "Amundi CAC 40 UCITS ETF", "ETF", "Euronext Paris"],
  ["IWDA.AS", "iShares Core MSCI World UCITS ETF", "ETF", "Euronext Amsterdam"], ["VUSA.AS", "Vanguard S&P 500 UCITS ETF", "ETF", "Euronext Amsterdam"],
  ["VWCE.DE", "Vanguard FTSE All-World UCITS ETF", "ETF", "XETRA"], ["CSPX.L", "iShares Core S&P 500 UCITS ETF", "ETF", "Londres"],
  ["SPY", "SPDR S&P 500 ETF Trust", "ETF", "NYSE Arca"], ["VOO", "Vanguard S&P 500 ETF", "ETF", "NYSE Arca"],
  ["QQQ", "Invesco QQQ Trust (Nasdaq-100)", "ETF", "NASDAQ"], ["VT", "Vanguard Total World Stock ETF", "ETF", "NYSE Arca"],
  // Crypto
  ["BTC-USD", "Bitcoin", "Crypto", "Crypto"], ["ETH-USD", "Ethereum", "Crypto", "Crypto"],
  ["BTC-EUR", "Bitcoin (en euros)", "Crypto", "Crypto"], ["ETH-EUR", "Ethereum (en euros)", "Crypto", "Crypto"],
  ["SOL-USD", "Solana", "Crypto", "Crypto"],
];

// Mots-clés supplémentaires (noms courants → symbole)
const KEYWORDS = { GOOG: ["google"], GOOGL: ["google"], META: ["facebook", "instagram"], "BRK-B": ["berkshire", "buffett"], "MC.PA": ["lvmh"], "OR.PA": ["loreal"] };

const strip = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Suggestions locales : symbole qui commence par la saisie, puis nom ou mot-clé qui la contient */
function searchLocal(query, limit = 8) {
  const q = strip(query).trim();
  if (!q) return [];
  const scored = [];
  for (const [symbol, name, type, exchange] of LIST) {
    const s = strip(symbol);
    const n = strip(name);
    const words = (KEYWORDS[symbol] || []).map(strip);
    let score = 0;
    if (s === q || s.split(/[.-]/)[0] === q) score = 100;
    else if (s.startsWith(q)) score = 80;
    else if (q.length >= 2 && (n.startsWith(q) || words.some((w) => w.startsWith(q)))) score = 60;
    else if (q.length >= 3 && (n.includes(q) || words.some((w) => w.includes(q)))) score = 40;
    if (score) scored.push({ score, item: { symbol, name, type, exchange, sector: null } });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.symbol.length - b.item.symbol.length)
    .slice(0, limit)
    .map((x) => x.item);
}

module.exports = { searchLocal, LIST };
