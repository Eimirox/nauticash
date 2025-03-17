const express = require("express");
const auth = require("../middleware/auth");
const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  action: String, // "Ajout" ou "Suppression"
  ticker: String,
  timestamp: { type: Date, default: Date.now }
});

const Transaction = mongoose.model("Transaction", TransactionSchema);
const router = express.Router();

// 📌 Voir l'historique des transactions d'un utilisateur
router.get("/", auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.userId });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
