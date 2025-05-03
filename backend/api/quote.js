const express = require("express");
const router = express.Router();
const axios = require("axios");

const apiConfigs = [
  {
    key: process.env.RAPIDAPI_KEY,
    host: "yh-finance.p.rapidapi.com",
    url: "https://yh-finance.p.rapidapi.com/market/v2/get-quotes",
    extract: (res) => res.data?.quoteResponse?.result || []
  },
  {
    key: process.env.RAPIDAPI_KEY,
    host: "real-time-finance-data.p.rapidapi.com",
    url: "https://real-time-finance-data.p.rapidapi.com/search",
    extract: (res, ticker) => {
      const matches = res.data?.data?.stock || [];
      return matches.filter(stock =>
        stock.symbol?.toUpperCase().includes(ticker.toUpperCase())
      );
    }
  }
];

// GET /api/quotes?ticker=AAPL
router.get("/", async (req, res) => {
  const ticker = req.query.ticker?.toUpperCase() || "AAPL";

  for (const { key, host, url, extract } of apiConfigs) {
    try {
      console.log(`📡 Appel API : ${host} pour ${ticker}`);

      const response = await axios.get(url, {
        params: host.includes("yh-finance")
          ? { region: "US", symbols: ticker }
          : { query: ticker, language: "en" },
        headers: {
          "X-RapidAPI-Key": key,
          "X-RapidAPI-Host": host
        }
      });

      const results = extract(response, ticker);

      if (!Array.isArray(results) || results.length === 0 || !results[0]) {
        console.warn(`⚠️ Pas de données valides pour ${ticker} depuis ${host}`);
        continue;
      }

      const stock = results[0];
      const stockData = {
        ticker: stock.symbol || ticker,
        price: typeof stock.price === "number"
          ? stock.price
          : stock.regularMarketPrice || "N/A",
        currency: stock.currency || "USD",
        country: stock.exchange || stock.country_code || "?"
      };

      return res.json(stockData);
    } catch (error) {
      console.warn(`❌ Échec API ${host} :`, error?.response?.data?.message || error.message);
      continue; // essaie l’API suivante
    }
  }

  return res.status(500).json({ error: "Toutes les APIs ont échoué" });
});

module.exports = router;
