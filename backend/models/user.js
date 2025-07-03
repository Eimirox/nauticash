const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  portfolio: [
    {
      ticker: { type: String, required: true },
      quantity: { type: Number, default: 0 },
      pru: { type: Number, default: 0 }
    }
  ],
  cash: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: "EUR" }
  }

}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
