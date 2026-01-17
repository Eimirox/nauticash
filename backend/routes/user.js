// backend/routes/user.js
// Routes utilisateur - Version optimisée avec cache

const express = require("express");
const auth = require("../middleware/auth");
const mongoose = require("mongoose");
const priceService = require("../services/priceService");

const router = express.Router();

// =============================================================================
// GET /api/user/portfolio - Récupère le portfolio de l'utilisateur
// =============================================================================
router.get("/portfolio", auth, async (req, res) => {
  try {
    const User = mongoose.connection.collection("users");
    const Prices = mongoose.connection.collection("prices");

    const user = await User.findOne({ _id: new mongoose.Types.ObjectId(req.user.userId) });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Récupérer les tickers du portfolio
    const tickers = user.portfolio.map((p) => p.ticker);

    if (tickers.length === 0) {
      return res.json({
        stocks: [],
        cash: user.cash || { amount: 0, currency: "EUR" },
      });
    }

    // Lire depuis le cache MongoDB (actualisé par le cron job)
    const pricesData = await Prices.find({ symbol: { $in: tickers } }).toArray();

    // Enrichir les données du portfolio avec les prix
    const stocks = user.portfolio.map((stock) => {
      const priceInfo = pricesData.find((p) => p.symbol === stock.ticker);

      if (!priceInfo) {
        // Prix non trouvé dans le cache
        return {
          ticker: stock.ticker,
          quantity: stock.quantity,
          pru: stock.pru,
          close: 0,
          currency: "USD",
          performance: 0,
          total: 0,
          error: "Price not available",
        };
      }

      const close = priceInfo.close || 0;
      const performance = stock.pru > 0 ? ((close - stock.pru) / stock.pru) * 100 : 0;
      const total = close * stock.quantity;
      const myDividendYield = priceInfo.dividend && close > 0
        ? (priceInfo.dividend / close) * 100
        : null;

      return {
        ticker: stock.ticker,
        name: priceInfo.name || stock.ticker,
        quantity: stock.quantity,
        pru: stock.pru,
        close,
        currency: priceInfo.currency || "USD",
        performance,
        total,
        dividend: priceInfo.dividend || null,
        dividendYield: priceInfo.dividendYield || null,
        myDividendYield,
        exDividendDate: priceInfo.exDividendDate || null,
        country: priceInfo.country || "Unknown",
        sector: priceInfo.sector || null,
        type: priceInfo.type || "Stock",
        lastUpdate: priceInfo.lastUpdate,
        source: priceInfo.source,
      };
    });

    res.json({
      stocks,
      cash: user.cash || { amount: 0, currency: "EUR" },
    });
  } catch (err) {
    console.error("❌ Error GET /portfolio:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =============================================================================
// POST /api/user/portfolio - Ajoute une action au portfolio
// =============================================================================
router.post("/portfolio", auth, async (req, res) => {
  try {
    const { ticker, quantity, pru } = req.body;

    if (!ticker || !quantity || quantity <= 0) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const User = mongoose.connection.collection("users");
    const Prices = mongoose.connection.collection("prices");

    // 1. Récupérer les données de l'action via priceService
    console.log(`🔄 Fetching data for ${ticker}...`);
    
    let quote;
    try {
      quote = await priceService.getQuote(ticker, { forceRefresh: true });
    } catch (error) {
      return res.status(404).json({
        error: `Could not fetch data for ${ticker}`,
        details: error.message,
      });
    }

    // 2. Sauvegarder dans la collection prices (cache)
    await Prices.updateOne(
      { symbol: ticker },
      {
        $set: {
          symbol: ticker,
          close: quote.price || quote.close,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          volume: quote.volume,
          previousClose: quote.previousClose,
          change: quote.change,
          changePercent: quote.changePercent,
          marketCap: quote.marketCap,
          currency: quote.currency,
          exchange: quote.exchange,
          country: quote.country,
          sector: quote.sector,
          type: quote.type,
          dividend: quote.dividend,
          dividendYield: quote.dividendYield,
          dividendRate: quote.dividendRate,
          exDividendDate: quote.exDividendDate,
          name: quote.name,
          lastUpdate: new Date(),
          source: quote.source,
        },
      },
      { upsert: true }
    );

    // 3. Ajouter au portfolio de l'utilisateur
    const result = await User.updateOne(
      { _id: new mongoose.Types.ObjectId(req.user.userId) },
      {
        $push: {
          portfolio: {
            ticker,
            quantity: parseFloat(quantity),
            pru: parseFloat(pru) || 0,
            _id: new mongoose.Types.ObjectId(),
          },
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`✅ Added ${ticker} to portfolio`);

    res.status(201).json({
      message: "Stock added successfully",
      stock: {
        ticker,
        quantity,
        pru,
        price: quote.price || quote.close,
        currency: quote.currency,
      },
    });
  } catch (err) {
    console.error("❌ Error POST /portfolio:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =============================================================================
// DELETE /api/user/portfolio/:ticker - Supprime une action
// =============================================================================
router.delete("/portfolio/:ticker", auth, async (req, res) => {
  try {
    const { ticker } = req.params;

    const User = mongoose.connection.collection("users");

    const result = await User.updateOne(
      { _id: new mongoose.Types.ObjectId(req.user.userId) },
      { $pull: { portfolio: { ticker } } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: "Stock not found in portfolio" });
    }

    console.log(`🗑️ Removed ${ticker} from portfolio`);

    res.json({ message: "Stock removed successfully" });
  } catch (err) {
    console.error("❌ Error DELETE /portfolio:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =============================================================================
// POST /api/user/portfolio/force-refresh - Force l'actualisation (premium)
// =============================================================================
router.post("/portfolio/force-refresh", auth, async (req, res) => {
  try {
    const User = mongoose.connection.collection("users");
    const Prices = mongoose.connection.collection("prices");

    const user = await User.findOne({ _id: new mongoose.Types.ObjectId(req.user.userId) });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const tickers = user.portfolio.map((p) => p.ticker);

    if (tickers.length === 0) {
      return res.json({ message: "No stocks to refresh" });
    }

    // Vérifier quota (max 3 refresh forcés par jour)
    const today = new Date().toDateString();
    const refreshKey = `refresh_${req.user.userId}_${today}`;
    
    // TODO: Implémenter un vrai système de quota avec Redis
    // Pour l'instant, on autorise
    
    console.log(`🔄 Force refreshing ${tickers.length} stocks for user ${req.user.userId}...`);

    let successCount = 0;
    let failCount = 0;

    // Actualiser chaque ticker
    for (const ticker of tickers) {
      try {
        const quote = await priceService.getQuote(ticker, { forceRefresh: true });

        await Prices.updateOne(
          { symbol: ticker },
          {
            $set: {
              symbol: ticker,
              close: quote.price || quote.close,
              currency: quote.currency,
              dividend: quote.dividend,
              dividendYield: quote.dividendYield,
              lastUpdate: new Date(),
              source: quote.source,
            },
          },
          { upsert: true }
        );

        successCount++;
        
        // Petit délai pour respecter les rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Failed to refresh ${ticker}:`, error.message);
        failCount++;
      }
    }

    res.json({
      message: "Portfolio refreshed",
      success: successCount,
      failed: failCount,
      total: tickers.length,
    });
  } catch (err) {
    console.error("❌ Error force-refresh:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =============================================================================
// GET /api/user/portfolio/stats - Stats du portfolio
// =============================================================================
router.get("/portfolio/stats", auth, async (req, res) => {
  try {
    const User = mongoose.connection.collection("users");
    const Prices = mongoose.connection.collection("prices");

    const user = await User.findOne({ _id: new mongoose.Types.ObjectId(req.user.userId) });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const tickers = user.portfolio.map((p) => p.ticker);
    const pricesData = await Prices.find({ symbol: { $in: tickers } }).toArray();

    // Calculer les stats
    const totalStocks = user.portfolio.length;
    const oldestPrice = pricesData.reduce((oldest, p) => {
      return !oldest || p.lastUpdate < oldest ? p.lastUpdate : oldest;
    }, null);

    const newestPrice = pricesData.reduce((newest, p) => {
      return !newest || p.lastUpdate > newest ? p.lastUpdate : newest;
    }, null);

    res.json({
      totalStocks,
      cachedPrices: pricesData.length,
      oldestPriceUpdate: oldestPrice,
      newestPriceUpdate: newestPrice,
      cacheAge: oldestPrice ? Date.now() - new Date(oldestPrice).getTime() : null,
    });
  } catch (err) {
    console.error("❌ Error GET /portfolio/stats:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
