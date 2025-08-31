const express   = require("express");
const auth      = require("../middleware/auth");
const User      = require("../models/user");
const mongoose  = require("mongoose");
const { getQuote, getETFComposition } = require("../services/apiFinance");

const router = express.Router();
const Prices = mongoose.connection.collection("prices");

// --- GET /portfolio (inchangé) ---
router.get("/portfolio", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.portfolio.length) return res.json([]);

    const enriched = await Promise.all(
      user.portfolio.map(async (stock) => {
        const data = await getQuote(stock.ticker);
        if (!data) return null;

        const performance = ((data.price - stock.pru) / stock.pru) * 100;
        const total = data.price * stock.quantity;

        return {
          ticker: stock.ticker,
          quantity: stock.quantity,
          pru: stock.pru,
          close: data.price,
          open: data.open || null,
          high: data.high || null,
          low: data.low || null,
          volume: data.volume || null,
          date: new Date().toISOString().split("T")[0],
          currency: data.currency || "USD",
          country: data.exchange || "US",
          sector: data.quoteType === "CRYPTOCURRENCY" ? "Crypto" : data.sector || "Unknown",
          industry: data.quoteType === "CRYPTOCURRENCY" ? "Crypto" : data.industry || "Unknown",
          performance,
          total,
          dividend: data.dividendRate ?? null,
          dividendYield: data.dividendYield ?? null,
          myDividendYield: stock.pru > 0 && data.dividendRate
            ? (data.dividendRate / stock.pru) * 100
            : null,
          type: data.quoteType || "UNKNOWN",
        };
      })
    );

const response = {
  stocks: enriched.filter(Boolean),
  cash: {
    amount: user.cashAmount ?? 0,
    currency: user.cashCurrency ?? "EUR",
  },
};
res.json(response);

  } catch (err) {
    console.error("Erreur GET /portfolio (Yahoo) :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- POST /portfolio : version avec détection ETF ---
router.post("/portfolio", auth, async (req, res) => {
  try {
    const { ticker, quantity = 0, pru = 0 } = req.body;
    const user = await User.findById(req.user.userId);

    // 1) Ajouter au portefeuille si pas déjà présent
    const alreadyExists = user.portfolio.find(item => item.ticker === ticker);
    if (!alreadyExists) {
      user.portfolio.push({ ticker, quantity, pru });
      await user.save();
    }

    // 2) Vérifie si on a déjà ce ticker pour aujourd’hui
    const today = new Date().toISOString().slice(0, 10);
    const Prices = mongoose.connection.collection("prices");
    const exists = await Prices.findOne({ symbol: ticker, date: today });

    if (!exists) {
      // 3) Récupération des données
      const data = await getQuote(ticker);
      if (!data) return res.status(400).json({ error: "Ticker invalide ou non trouvé." });

      const isETF = data.quoteType === "ETF" || (data.longName && data.longName.toLowerCase().includes("etf"));

      let composition = null;
      if (isETF) {
        composition = await getETFComposition(ticker); // <--- nouvelle étape
      }

      const doc = {
        symbol: ticker,
        date: today,
        close: data.price,
        open: data.open,
        high: data.high,
        low: data.low,
        volume: data.volume,
        currency: data.currency,
        country: data.exchange,
        sector: data.sector ?? "Unknown",
        industry: data.industry ?? "Unknown",
        composition,
      };

      await Prices.insertOne(doc);
    }

    res.status(201).json({ message: "Ajout réussi" });
  } catch (err) {
    console.error("Erreur POST /portfolio :", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- DELETE /portfolio (inchangé) ---
router.delete("/portfolio", auth, async (req, res) => {
  try {
    const { ticker } = req.body;
    const user = await User.findById(req.user.userId);

    user.portfolio = user.portfolio.filter(item => item.ticker !== ticker);
    await user.save();

    res.json(user.portfolio);
  } catch (error) {
    console.error("Erreur DELETE /portfolio :", error);
    res.status(500).json({ error: error.message });
  }
});

// --- PATCH /portfolio (inchangé) ---
router.patch("/portfolio", auth, async (req, res) => {
  try {
    const { ticker, field, value } = req.body;
    const user = await User.findById(req.user.userId);

    const item = user.portfolio.find(stock => stock.ticker === ticker);
    if (!item) {
      return res.status(404).json({ message: "Action non trouvée." });
    }

    item[field] = value;
    await user.save();

    res.json({ message: "Mis à jour avec succès" });
  } catch (error) {
    console.error("Erreur PATCH /portfolio :", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /cash : mise à jour du montant ou de la devise du cash
router.patch("/cash", auth, async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || !["EUR", "USD"].includes(currency)) {
      return res.status(400).json({ error: "Paramètres invalides" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });

    user.cashAmount = numericAmount;
    user.cashCurrency = currency;
    await user.save();

    res.json({ success: true });
  } catch (err) {
    console.error("Erreur PATCH /cash :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
