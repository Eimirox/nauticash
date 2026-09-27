const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },

  portfolio: [
    {
      ticker:   { type: String, required: true },
      quantity: { type: Number, default: 0 },
      pru:      { type: Number, default: 0 },
    }
  ],

  cashAmount:   { type: Number, default: 0 },       
  cashCurrency: { type: String, default: "EUR" },

  // Préférences personnelles (voir services/profile.js pour les champs et valeurs par défaut)
  profile: { type: mongoose.Schema.Types.Mixed, default: undefined },

  // Réinitialisation du mot de passe (le token est stocké hashé en SHA-256)
  resetPasswordToken:   { type: String, default: null, index: true },
  resetPasswordExpires: { type: Date,   default: null },

}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
