require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Connexion à MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ Connecté à MongoDB Atlas"))
.catch(err => console.error("❌ Erreur de connexion à MongoDB :", err));

app.use(cors());
app.use(express.json()); // 🔥 Permet à Express de lire le JSON envoyé par le client
app.use(express.urlencoded({ extended: true }));

// ✅ Route pour récupérer les prix en temps réel de plusieurs actions
app.get("/api/quotes", async (req, res) => {
  const symbols = req.query.symbols || "AAPL,TSLA,GOOGL"; // Symboles par défaut

  try {
    console.log(`📡 Requête pour les tickers : ${symbols}`);

    const response = await axios.get(
      "https://yh-finance.p.rapidapi.com/market/v2/get-quotes",
      {
        params: { region: "US", symbols },
        headers: {
          "X-RapidAPI-Host": "yh-finance.p.rapidapi.com",
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY, // 🔐 Clé API sécurisée
        },
      }
    );

    console.log("📊 Réponse brute de l'API :", response.data);

    if (!response.data?.quoteResponse?.result || response.data.quoteResponse.result.length === 0) {
      return res.status(404).json({ error: `Tickers '${symbols}' non trouvés.` });
    }

    // On extrait les prix pour chaque action
    const quotes = response.data.quoteResponse.result.map(stock => ({
      ticker: stock.symbol,
      price: stock.regularMarketPrice || "N/A",
      currency: stock.currency || "USD",
    }));

    res.json(quotes);
  } catch (error) {
    console.error("❌ Erreur API Yahoo Finance :", error.message);

    if (error.response) {
      console.error("📡 Détails de l'erreur :", error.response.data);
      return res.status(error.response.status).json({ error: error.response.data });
    }

    res.status(500).json({ error: "Erreur serveur interne" });
  }
});


// ✅ Importer les routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

const userRoutes = require("./routes/user"); // 🔥 Ajout de la route pour le portefeuille
app.use("/api/user", userRoutes);


// ✅ Route de test pour voir si le serveur tourne
app.get("/", (req, res) => {
  res.send("✅ Serveur Express fonctionne !");
});

// ✅ Lancer le serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur Express en ligne sur http://localhost:${PORT}`);
});
