const express = require("express");
const auth = require("../middleware/auth"); // Importer le middleware d'authentification
const User = require("../models/user");

const router = express.Router();

//  Récupérer le portefeuille de l'utilisateur (GET)
router.get("/portfolio", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json(user.portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ajouter une action au portefeuille (POST)
router.post("/portfolio", auth, async (req, res) => {
  try {
    //  récupère les 3 valeurs depuis le frontend
    const { ticker, quantity = 0, pru = 0 } = req.body;
    const user = await User.findById(req.user.userId);

    const exists = user.portfolio.find(item => item.ticker === ticker);
    if (!exists) {
      user.portfolio.push({ ticker, quantity, pru });
      await user.save(); // indispensable pour enregistrer
    }

    res.json(user.portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//  Supprimer une action du portefeuille (DELETE)
router.delete("/portfolio", auth, async (req, res) => {
  try {
    const { ticker } = req.body;
    const user = await User.findById(req.user.userId);

    user.portfolio = user.portfolio.filter(item => item.ticker !== ticker);
    await user.save();

    res.json(user.portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/portfolio", auth, async (req, res) => {
  try {
    const { ticker, field, value } = req.body;
    const user = await User.findById(req.user.userId);

    const item = user.portfolio.find(stock => stock.ticker === ticker);
    if (!item) return res.status(404).json({ message: "Action non trouvée." });

    item[field] = value; // ✅ Mise à jour dynamique du champ
    await user.save();

    res.json({ message: "Mis à jour avec succès" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
