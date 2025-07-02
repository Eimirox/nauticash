const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/user");
const yahooFinance = require("yahoo-finance2").default;

router.post("/update-prices", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.portfolio || user.portfolio.length === 0) {
      return res.status(404).json({ message: "Aucun portefeuille trouvé." });
    }

    for (const stock of user.portfolio) {
      if (!stock.ticker) continue;

      try {
        const quote = await yahooFinance.quote(stock.ticker);
        if (quote && quote.regularMarketPrice) {
          stock.latestPrice = quote.regularMarketPrice;
        }
      } catch (err) {
        console.warn(`Erreur Yahoo pour ${stock.ticker} :`, err.message);
      }
    }

    await user.save();
    res.json({ success: true, message: "Prix mis à jour avec succès" });
  } catch (err) {
    console.error("Erreur update-prices :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
