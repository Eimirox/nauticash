const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  portfolio: { type: Array, default: [] } // Stocke les actions de l'utilisateur
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
