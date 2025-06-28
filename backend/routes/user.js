// backend/routes/user.js

const express   = require("express");
const auth      = require("../middleware/auth");
const User      = require("../models/user");
const mongoose  = require("mongoose");
const { spawn } = require("child_process");
const path      = require("path");

const router = express.Router();

// --- GET /portfolio (inchangé) ---
router.get("/portfolio", auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const portfolio = await User.aggregate([
      { $match: { _id: userId } },
      { $unwind: "$portfolio" },
      {
        $lookup: {
          from: "prices",
          let: { tick: "$portfolio.ticker" },
          pipeline: [
            { $match: { $expr: { $eq: ["$symbol", "$$tick"] } } },
            { $sort: { date: -1 } },
            { $limit: 1 }
          ],
          as: "lastPrice"
        }
      },
      { $addFields: { lastPrice: { $arrayElemAt: ["$lastPrice", 0] } } },
      {
        $project: {
            _id:      0,
            ticker:   "$portfolio.ticker",
            quantity: "$portfolio.quantity",
            pru:      "$portfolio.pru",
            open:     "$lastPrice.open",
            close:    "$lastPrice.close",
            high:     "$lastPrice.high",
            low:      "$lastPrice.low",
            volume:   "$lastPrice.volume",
            date:     "$lastPrice.date",
            currency: { $ifNull: ["$lastPrice.currency", "USD"] },
            country:  { $ifNull: ["$lastPrice.country",  "US"] },
            // Ajout des deux champs :
            sector:   { $ifNull: ["$lastPrice.sector",   "Unknown"] },
            industry: { $ifNull: ["$lastPrice.industry",  "Unknown"] }
          }
        }
    ]);
    res.json(portfolio);
  } catch (err) {
    console.error("Erreur GET /portfolio :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- POST /portfolio : ajoute ET conditionnellement update_prices.py ---
router.post("/portfolio", auth, async (req, res) => {
  try {
    const { ticker, quantity = 0, pru = 0 } = req.body;
    const user = await User.findById(req.user.userId);

    // 1) on ajoute si absent
    if (!user.portfolio.find(item => item.ticker === ticker)) {
      user.portfolio.push({ ticker, quantity, pru });
      await user.save();
    }

    // 2) on vérifie dans prices si on a déjà aujourd'hui
    const Prices = mongoose.connection.collection("prices");
    const today   = new Date().toISOString().slice(0,10);
    const exists  = await Prices.findOne({ symbol: ticker, date: today });

    if (!exists) {
      // 3) on lance le Python pour ce ticker
      const script = path.join(__dirname, "../scripts/update_prices.py");
      await new Promise((resolve, reject) => {
        const py = spawn("python", [ script, ticker ], { stdio: "inherit" });
        py.on("close", code => code === 0
          ? resolve()
          : reject(new Error(`update_prices.py exited with code ${code}`))
        );
      });
    }

    // 4) on renvoie le portfolio à jour (agrégé) en réutilisant la même pipeline que GET
    const userId   = new mongoose.Types.ObjectId(req.user.userId);
    const portfolio = await User.aggregate([
      { $match: { _id: userId } },
      { $unwind: "$portfolio" },
      {
        $lookup: {
          from: "prices",
          let: { tick: "$portfolio.ticker" },
          pipeline: [
            { $match: { $expr: { $eq: ["$symbol", "$$tick"] } } },
            { $sort: { date: -1 } },
            { $limit: 1 }
          ],
          as: "lastPrice"
        }
      },
      { $addFields: { lastPrice: { $arrayElemAt: ["$lastPrice", 0] } } },
      {
        $project: {
          _id:      0,
          ticker:   "$portfolio.ticker",
          quantity: "$portfolio.quantity",
          pru:      "$portfolio.pru",
          open:     "$lastPrice.open",
          close:    "$lastPrice.close",
          high:     "$lastPrice.high",
          low:      "$lastPrice.low",
          volume:   "$lastPrice.volume",
          date:     "$lastPrice.date",
          currency: { $ifNull: ["$lastPrice.currency", "USD"] },
          country:  { $ifNull: ["$lastPrice.country",  "US"] }
        }
      }
    ]);

    res.json(portfolio);

  } catch (error) {
    console.error("Erreur POST /portfolio :", error);
    res.status(500).json({ error: error.message });
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

module.exports = router;
