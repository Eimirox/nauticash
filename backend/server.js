require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const historyRoutes = require("./routes/history");

const app = express();
const PORT = process.env.PORT || 5000;

// Connexion MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connecté à MongoDB Atlas"))
  .catch((err) => console.error("❌ Erreur MongoDB :", err));

// Middlewares
app.use(express.json());
// CORS ciblé (recommandé)
app.use(cors({ origin: "http://localhost:3000", credentials: true }));

// Routes API
app.use("/api/auth", require("./routes/auth"));           // <= IMPORTANT : routes/auth.js
app.use("/api/user", require("./routes/user"));
app.use("/api/user", historyRoutes);
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/quotes", require("./api/quote"));
app.use("/api/stocks", require("./routes/stocks"));
app.use("/api", require("./routes/updatePrices"));

// Route de test
app.get("/", (req, res) => {
  res.send("✅ Serveur Express opérationnel !");
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur Express en ligne sur http://localhost:${PORT}`);
});
