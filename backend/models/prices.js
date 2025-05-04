const mongoose = require("mongoose");

const priceSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  date: { type: Date, required: true },
  open: Number,
  close: Number,
  high: Number,
  low: Number,
  volume: Number,
  createdAt: { type: Date, default: Date.now }
});

// Empêche les doublons symbol/date (optionnel)
priceSchema.index({ symbol: 1, date: -1 }, { unique: true });

module.exports = mongoose.model("Price", priceSchema);
