// backend/server.js
// Serveur principal avec intégration du système de prix intelligent

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const historyRoutes = require("./routes/history");
const transactionRoutes = require("./routes/transactions");

// Services
const priceService = require("./services/priceService");
const priceUpdater = require("./jobs/updatePrices");

const app = express();

// =============================================================================
// MIDDLEWARE
// =============================================================================

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

app.use(express.json());

// =============================================================================
// ROUTES
// =============================================================================

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/user", historyRoutes);
app.use("/api/transactions", transactionRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// =============================================================================
// ROUTES ADMIN (pour monitoring)
// =============================================================================

// Stats d'utilisation des APIs
app.get("/api/admin/stats", async (req, res) => {
  try {
    // TODO: Ajouter auth admin
    const stats = priceService.getUsageStats();
    const cronStats = priceUpdater.getStats();

    res.json({
      apiUsage: stats,
      cronJob: cronStats,
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check de tous les providers
app.get("/api/admin/health", async (req, res) => {
  try {
    const health = await priceService.healthCheckAll();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Forcer une actualisation manuelle (admin uniquement)
app.post("/api/admin/update-prices", async (req, res) => {
  try {
    // TODO: Ajouter auth admin

    // Lancer l'update en arrière-plan
    priceUpdater.runManual().catch((err) => {
      console.error("❌ Manual update failed:", err);
    });

    res.json({
      message: "Price update started",
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// MONGODB CONNECTION
// =============================================================================

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
    
    // Afficher les infos de la BDD
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📊 Collections disponibles: ${collections.map(c => c.name).join(", ")}`);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};

// =============================================================================
// DÉMARRAGE DU SERVEUR
// =============================================================================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Connexion à MongoDB
    await connectDB();

    // 2. Vérifier la configuration des providers
    console.log("\n" + "=".repeat(60));
    console.log("🔧 PRICE PROVIDERS CONFIGURATION");
    console.log("=".repeat(60));
    
    const config = require("./config/providers");
    console.log(`Primary provider: ${config.primary}`);
    console.log(`Active providers: ${config.activeProviders.join(", ")}`);
    
    if (config.fmp.enabled && config.fmp.apiKey) {
      console.log("✅ FMP configured");
    } else {
      console.warn("⚠️ FMP not configured - add FMP_API_KEY to .env");
    }

    if (config.twelvedata.enabled && config.twelvedata.apiKey) {
      console.log("✅ Twelve Data configured");
    }

    if (config.polygon.enabled && config.polygon.apiKey) {
      console.log("✅ Polygon configured");
    }

    if (config.alphavantage.enabled && config.alphavantage.apiKey) {
      console.log("✅ Alpha Vantage configured");
    }

    console.log("=".repeat(60) + "\n");

    // 3. Health check des providers
    console.log("🏥 Running health checks...");
    const health = await priceService.healthCheckAll();
    
    for (const [name, status] of Object.entries(health)) {
      if (status.healthy) {
        console.log(`✅ ${name} - OK`);
      } else {
        console.warn(`❌ ${name} - ${status.error || 'Failed'}`);
      }
    }
    console.log("");

    // 4. Démarrer le cron job
    if (config.cron.updatePrices.enabled) {
      priceUpdater.start();
    } else {
      console.log("⏸️ Cron job disabled");
    }

    // 5. Démarrer le serveur Express
    app.listen(PORT, () => {
      console.log("\n" + "=".repeat(60));
      console.log(`🚀 SERVER STARTED`);
      console.log("=".repeat(60));
      console.log(`Port: ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
      console.log("=".repeat(60) + "\n");

      // Afficher les routes disponibles
      console.log("📡 Available routes:");
      console.log("   POST   /api/auth/register");
      console.log("   POST   /api/auth/login");
      console.log("   GET    /api/user/portfolio");
      console.log("   POST   /api/user/portfolio");
      console.log("   DELETE /api/user/portfolio/:ticker");
      console.log("   POST   /api/user/portfolio/force-refresh");
      console.log("   GET    /api/user/portfolio/stats");
      console.log("   GET    /api/user/history");
      console.log("   POST   /api/user/history");
      console.log("   GET    /api/admin/stats");
      console.log("   GET    /api/admin/health");
      console.log("   POST   /api/admin/update-prices");
      console.log("");

      // Afficher la prochaine exécution du cron
      if (config.cron.updatePrices.enabled) {
        console.log(`⏰ Next price update: ${config.cron.updatePrices.schedule}`);
        console.log(`   (Example: "0 */6 * * *" = every 6 hours)`);
      }

      console.log("\n✨ Ready to accept requests!\n");
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Gestion des erreurs non catchées
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  
  try {
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
});

// Démarrer le serveur
startServer();

module.exports = app;
