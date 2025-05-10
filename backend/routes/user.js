const express  = require("express");
const auth     = require("../middleware/auth");
const User     = require("../models/user");
const Price    = require("../models/prices");
const mongoose = require("mongoose");

const router = express.Router();

//  Récupérer le portefeuille enrichi de l'utilisateur (GET)
router.get("/portfolio", auth, async (req, res) => {
  try {
    // On caste l’ID passé par le middleware en ObjectId
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    // Aggregation : unwind le tableau portfolio, lookup dans prices, puis projection
    const portfolio = await User.aggregate([
      { $match: { _id: userId } },
      { $unwind: "$portfolio" },
      {
        $lookup: {
          from: "prices",            // nom de la collection MongoDB
          let: { tick: "$portfolio.ticker" },
          pipeline: [
            { $match: {
                $expr: { $eq: ["$symbol", "$$tick"] }
              }
            },
            { $sort: { date: -1 } }, // on prend la plus récente
            { $limit: 1 }
          ],
          as: "lastPrice"
        }
      },
      {
        $addFields: {
          lastPrice: { $arrayElemAt: ["$lastPrice", 0] }
        }
      },
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
  } catch (err) {
    console.error("Erreur GET /portfolio :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Ajouter une action au portefeuille (POST)
router.post("/portfolio", auth, async (req, res) => {
  try {
    const { ticker, quantity = 0, pru = 0 } = req.body;
    const user = await User.findById(req.user.userId);

    // On n’ajoute que si n’existe pas déjà
    const exists = user.portfolio.find(item => item.ticker === ticker);
    if (!exists) {
      user.portfolio.push({ ticker, quantity, pru });
      await user.save();
    }

    res.json(user.portfolio);
  } catch (error) {
    console.error("Erreur POST /portfolio :", error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer une action du portefeuille (DELETE)
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

// Mettre à jour quantité ou PRU (PATCH)
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
