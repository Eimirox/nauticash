const express = require("express");
const router = express.Router();
const Price = require("../models/prices");

router.get("/:symbol/latest", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();

  try {
    const latest = await Price.find({ symbol })
      .sort({ date: -1 })
      .limit(1);

    if (latest.length === 0) {
      return res.status(404).json({ message: "Aucune donnée pour ce symbole." });
    }

    res.json(latest[0]);
  } catch (err) {
    console.error("❌ Erreur dans /stocks/:symbol/latest :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Route POST
router.post("/update", async (req, res) => {
  const data = req.body;

  try {
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ message: "Format attendu : tableau de données." });
    }

    const inserted = await Price.insertMany(data, { ordered: false });
    res.status(200).json({ insertedCount: inserted.length });
  } catch (err) {
    console.error("❌ Erreur insertion :", err.message);
    res.status(500).json({ message: "Erreur d'insertion dans la base." });
  }
});

module.exports = router; // Doit être en dernier
