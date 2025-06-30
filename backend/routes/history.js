const express  = require("express");
const auth     = require("../middleware/auth");
const mongoose = require("mongoose");

const router = express.Router();

// --- POST /api/user/history ---
router.post("/history", auth, async (req, res) => {
  try {
    const { date, value } = req.body;
    const parsedDate = new Date(date);

    const year = parsedDate.getFullYear();
    const month = parsedDate.toLocaleString("en-US", { month: "long" });

    await mongoose.connection.collection("history").updateOne(
      { userId: req.user.userId, year, month },
      { $set: { value } },
      { upsert: true }
    );

    res.status(201).json({ message: "Historique mis à jour" });
  } catch (err) {
    console.error("Erreur POST /history:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- GET /api/user/history ---
router.get("/history", auth, async (req, res) => {
  try {
    const history = await mongoose.connection
      .collection("history")
      .find({ userId: req.user.userId })
      .sort({ year: 1, month: 1 })
      .toArray();

    res.json(history);
  } catch (err) {
    console.error("Erreur GET /history:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
