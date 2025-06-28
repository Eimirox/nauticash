const yf = require("yahoo-finance2").default;

// --- Infos générales sur une action ou ETF ---
async function getQuote(ticker) {
  try {
    const data = await yf.quoteSummary(ticker, {
      modules: [ "price", "summaryProfile", "summaryDetail", "defaultKeyStatistics" ]
    });

    return {
      price: data.price.regularMarketPrice,
      open: data.price.regularMarketOpen,
      high: data.price.regularMarketDayHigh,
      low: data.price.regularMarketDayLow,
      volume: data.price.regularMarketVolume,
      currency: data.price.currency,
      exchange: data.price.exchangeName,
      sector: data.summaryProfile?.sector ?? "Unknown",
      industry: data.summaryProfile?.industry ?? "Unknown",
      quoteType: data.price.quoteType,
      longName: data.price.longName,
      dividendRate: data.summaryDetail?.dividendRate ?? null,  // montant annuel par action
      dividendYield: data.summaryDetail?.dividendYield ?? null, // % annualisé
    };
  } catch (err) {
    console.error("Erreur getQuote pour", ticker, ":", err.message);
    return null;
  }
}

// --- Composition d'un ETF ---
// --- Composition d'un ETF ---
// ⚠️ Cette fonction renvoie toujours un tableau vide pour le moment car l'API ne supporte pas etfHoldings
async function getETFComposition(ticker) {
  console.warn(`getETFComposition est indisponible pour ${ticker} (fonction non supportée par l'API actuelle).`);
  return [];
}

module.exports = {
  getQuote,
  getETFComposition
};
