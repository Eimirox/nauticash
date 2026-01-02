const express   = require("express");
const auth      = require("../middleware/auth");
const User      = require("../models/user");
const mongoose  = require("mongoose");
const { getQuote, getETFComposition } = require("../services/apiFinance");

const router = express.Router();
const Prices = mongoose.connection.collection("prices");

function exchangeToCountry(exchange) {
  if (!exchange) return "Unknown";
  
  const mapping = {
    // États-Unis
    "NMS": "États-Unis",
    "NYQ": "États-Unis", 
    "NGM": "États-Unis",
    "NASDAQ": "États-Unis",
    "NYSE": "États-Unis",
    "NasdaqGS": "États-Unis",
    "NasdaqCM": "États-Unis",
    "AMEX": "États-Unis",
    "BATS": "États-Unis",
    "NYSEARCA": "États-Unis",
    "PCX": "États-Unis",
    
    // France
    "PAR": "France",
    "Paris": "France",
    "PARIS": "France",
    "EPA": "France",
    
    // Pays-Bas / Amsterdam
    "AMS": "Amsterdam",
    "Amsterdam": "Amsterdam",
    "AMSTERDAM": "Amsterdam",
    
    // Allemagne
    "FRA": "Allemagne",
    "XETRA": "Allemagne",
    "GER": "Allemagne",
    
    // Royaume-Uni
    "LSE": "Royaume-Uni",
    "LON": "Royaume-Uni",
    
    // Suisse
    "VTX": "Suisse",
    "SWX": "Suisse",
    
    // Japon
    "JPX": "Japon",
    "TYO": "Japon",
    
    // Canada
    "TOR": "Canada",
    "TSE": "Canada",
    
    // Crypto
    "CCC": "CCC",
    "CCY": "CCC",
  };
  
  return mapping[exchange] || exchange;
}
// --- GET /portfolio (utilise la BDD prices) ---
router.get("/portfolio", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // Si portfolio vide, renvoyer structure complète
    if (!user.portfolio || user.portfolio.length === 0) {
      return res.json({
        stocks: [],
        cash: {
          amount: user.cashAmount ?? 0,
          currency: user.cashCurrency ?? "EUR",
        },
      });
    }

    // Récupérer les tickers du portfolio
    const tickers = user.portfolio.map(p => p.ticker);
    
    // Récupérer les prix depuis la collection prices
    const pricesData = await Prices.find({ symbol: { $in: tickers } }).toArray();
    
    // Enrichir chaque action du portfolio
    const enriched = user.portfolio.map((stock) => {
      // Trouver les données de prix correspondantes
      const priceInfo = pricesData.find(p => p.symbol === stock.ticker);
      
      if (!priceInfo) {
        // Si pas de données, renvoyer avec des valeurs par défaut
        return {
          ticker: stock.ticker,
          quantity: stock.quantity,
          pru: stock.pru,
          close: 0,
          currency: "USD",
          country: "Unknown",
          sector: "Unknown",
          industry: "Unknown",
          type: "UNKNOWN",
          dividend: null,
          dividendYield: null,
          myDividendYield: null,
        };
      }

      const performance = stock.pru > 0 
        ? ((priceInfo.close - stock.pru) / stock.pru) * 100 
        : 0;
      const total = priceInfo.close * stock.quantity;

      return {
        ticker: stock.ticker,
        quantity: stock.quantity,
        pru: stock.pru,
        close: priceInfo.close || 0,
        open: priceInfo.open || null,
        high: priceInfo.high || null,
        low: priceInfo.low || null,
        volume: priceInfo.volume || null,
        date: priceInfo.date || new Date().toISOString().split("T")[0],
        currency: priceInfo.currency || "USD",
        country: exchangeToCountry(priceInfo.country),
        sector: priceInfo.sector || "Unknown",
        industry: priceInfo.industry || "Unknown",
        composition: priceInfo.composition || null,
        performance,
        total,
        dividend: priceInfo.dividend ?? null,
        dividendYield: priceInfo.dividendYield ?? null,
        exDividendDate: priceInfo.exDividendDate ?? null,
        myDividendYield: stock.pru > 0 && priceInfo.dividend
          ? (priceInfo.dividend / stock.pru) * 100
          : null,
        type: priceInfo.type || "EQUITY",
        name: priceInfo.name || stock.ticker,
      };
    });

    const response = {
      stocks: enriched,
      cash: {
        amount: user.cashAmount ?? 0,
        currency: user.cashCurrency ?? "EUR",
      },
    };
    
    res.json(response);

  } catch (err) {
    console.error("Erreur GET /portfolio :", err);
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
