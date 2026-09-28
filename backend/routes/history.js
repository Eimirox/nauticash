const express = require("express");
const auth = require("../middleware/auth");
const mongoose = require("mongoose");
const dailyHistory = require("../services/dailyHistory");

const router = express.Router();

// Les mois sont stockés en toutes lettres ("June") : on les trie dans l'ordre du calendrier
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const history = () => mongoose.connection.collection("history");

// --- POST /api/user/history  { date, value } ---
router.post("/history", auth, async (req, res) => {
  try {
    const { date } = req.body;
    const value = Number(req.body.value);
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: "Date invalide" });
    }
    if (!Number.isFinite(value)) {
      return res.status(400).json({ error: "Valeur invalide" });
    }

    const year = parsedDate.getFullYear();
    const month = MONTHS[parsedDate.getMonth()];

    await history().updateOne(
      { userId: req.user.userId, year, month },
      { $set: { value, auto: false } },
      { upsert: true }
    );

    res.status(201).json({ message: "Historique mis à jour" });
  } catch (err) {
    console.error("Erreur POST /history:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- GET /api/user/history/daily?days=365 ---
// Valeur quotidienne (en euros) enregistrée automatiquement chaque soir
router.get("/history/daily", auth, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 365, 1), 3660);
    res.json(await dailyHistory.getDaily(req.user.userId, { days }));
  } catch (err) {
    console.error("Erreur GET /history/daily:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- GET /api/user/history ---
router.get("/history", auth, async (req, res) => {
  try {
    const rows = await history().find({ userId: req.user.userId }).toArray();

    rows.sort((a, b) => a.year - b.year || MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));

    res.json(rows);
  } catch (err) {
    console.error("Erreur GET /history:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
