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

// Middlewares utiles
app.use(cors());
app.use(express.json());

// Routes API
app.use("/api/auth", require("./routes/auth"));
app.use("/api/user", require("./routes/user"));
app.use("/api/user", historyRoutes);
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/quotes", require("./api/quote")); // Route des API annexes
app.use("/api/stocks", require("./routes/stocks")); // Route de mon API
app.use("/api", require("./routes/updatePrices")); // Route Update Price avec API

// Route de test
app.get("/", (req, res) => {
  res.send("✅ Serveur Express opérationnel !");
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur Express en ligne sur http://localhost:${PORT}`);
});
