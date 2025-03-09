const express = require("express");
const auth = require("../middleware/auth"); // Importer le middleware d'authentification
const User = require("../models/User");

const router = express.Router();

// 📌 Récupérer le portefeuille de l'utilisateur (GET)
router.get("/portfolio", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json(user.portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 Ajouter une action au portefeuille (POST)
router.post("/portfolio", auth, async (req, res) => {
  try {
    const { ticker } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user.portfolio.includes(ticker)) {
      user.portfolio.push(ticker);
      await user.save();
    }

    res.json(user.portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 Supprimer une action du portefeuille (DELETE)
router.delete("/portfolio", auth, async (req, res) => {
  try {
    const { ticker } = req.body;
    const user = await User.findById(req.user.userId);

    user.portfolio = user.portfolio.filter(t => t !== ticker);
    await user.save();

    res.json(user.portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
