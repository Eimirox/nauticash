// backend/config/providers.js
// Configuration centralisée des providers d'API financières

module.exports = {
  // Provider principal (changeable en 1 ligne !)
  primary: process.env.PRIMARY_PRICE_PROVIDER || "fmp",

  // Liste des providers actifs (par ordre de priorité)
  // Tu peux en activer plusieurs pour avoir un fallback
  activeProviders: (process.env.ACTIVE_PROVIDERS || "fmp").split(","),

  // Configuration FMP (Financial Modeling Prep)
  fmp: {
    enabled: process.env.FMP_ENABLED !== "false",
    apiKey: process.env.FMP_API_KEY || "",
    baseUrl: "https://financialmodelingprep.com/stable",
    limits: {
      free: {
        requestsPerDay: 250,
        requestsPerMinute: null, // Pas de limite par minute
      },
      starter: {
        requestsPerDay: null, // Illimité
        requestsPerMinute: 300,
      },
    },
    // Tickers supportés
    supports: {
      usStocks: true,
      euStocks: true,
      crypto: true,
      etf: true,
      dividends: true,
    },
    // Mapping des tickers spéciaux
    tickerMapping: {
      "BTC-USD": "BTCUSD",
      "ETH-USD": "ETHUSD",
    },
  },

  // Configuration Twelve Data
  twelvedata: {
    enabled: process.env.TWELVE_DATA_ENABLED === "true",
    apiKey: process.env.TWELVE_DATA_API_KEY || "",
    baseUrl: "https://api.twelvedata.com",
    limits: {
      free: {
        requestsPerDay: 800,
        requestsPerMinute: 8,
      },
      grow: {
        requestsPerDay: null,
        requestsPerMinute: 55,
      },
    },
    supports: {
      usStocks: true,
      euStocks: false, // Payant uniquement
      crypto: true,
      etf: false, // Payant uniquement
      dividends: true,
    },
  },

  // Configuration Polygon.io
  polygon: {
    enabled: process.env.POLYGON_ENABLED === "true",
    apiKey: process.env.POLYGON_API_KEY || "",
    baseUrl: "https://api.polygon.io/v2",
    limits: {
      free: {
        requestsPerDay: 7200,
        requestsPerMinute: 5,
      },
      starter: {
        requestsPerDay: null,
        requestsPerMinute: null,
      },
    },
    supports: {
      usStocks: true,
      euStocks: false,
      crypto: true,
      etf: true,
      dividends: true,
    },
  },

  // Configuration Alpha Vantage (backup gratuit)
  alphavantage: {
    enabled: process.env.ALPHA_VANTAGE_ENABLED === "true",
    apiKey: process.env.ALPHA_VANTAGE_API_KEY || "",
    baseUrl: "https://www.alphavantage.co/query",
    limits: {
      free: {
        requestsPerDay: 25,
        requestsPerMinute: 5,
      },
      basic: {
        requestsPerDay: 75 * 60, // 75 req/min
        requestsPerMinute: 75,
      },
    },
    supports: {
      usStocks: true,
      euStocks: true,
      crypto: true,
      etf: true,
      dividends: true,
    },
  },

  // Configuration du cache
  cache: {
    // Durée de validité du cache (en millisecondes)
    ttl: {
      prices: parseInt(process.env.CACHE_TTL_PRICES) || 3600000, // 1h par défaut
      dividends: parseInt(process.env.CACHE_TTL_DIVIDENDS) || 86400000, // 24h
      fundamentals: parseInt(process.env.CACHE_TTL_FUNDAMENTALS) || 86400000, // 24h
    },
    // Force refresh si les données sont plus vieilles que (en millisecondes)
    maxAge: parseInt(process.env.CACHE_MAX_AGE) || 21600000, // 6h par défaut
  },

  // Configuration du cron job
  cron: {
    // Actualisation automatique des prix
    updatePrices: {
      enabled: process.env.CRON_UPDATE_PRICES !== "false",
      // Toutes les 6 heures par défaut : "0 */6 * * *"
      schedule: process.env.CRON_UPDATE_SCHEDULE || "0 */6 * * *",
      // Limite de tickers à actualiser par run
      batchSize: parseInt(process.env.CRON_BATCH_SIZE) || 100,
      // Délai entre chaque requête (ms) pour respecter les rate limits
      delayBetweenRequests: parseInt(process.env.CRON_DELAY) || 1000,
    },
  },

  // Rate limiting (pour éviter de dépasser les quotas)
  rateLimiting: {
    enabled: process.env.RATE_LIMITING_ENABLED !== "false",
    // Fenêtre glissante pour compter les requêtes (en millisecondes)
    window: 60000, // 1 minute
    // Alerte quand on atteint X% du quota
    alertThreshold: 0.8, // 80%
  },

  // Stratégie de fallback
  fallback: {
    // Activer le fallback automatique si une API échoue
    enabled: process.env.FALLBACK_ENABLED !== "false",
    // Nombre de tentatives avant de passer au provider suivant
    maxRetries: parseInt(process.env.FALLBACK_MAX_RETRIES) || 2,
    // Délai entre les tentatives (ms)
    retryDelay: parseInt(process.env.FALLBACK_RETRY_DELAY) || 1000,
  },

  // Logs et monitoring
  monitoring: {
    // Logger les appels API
    logApiCalls: process.env.LOG_API_CALLS === "true",
    // Logger les erreurs de cache
    logCacheErrors: process.env.LOG_CACHE_ERRORS !== "false",
    // Logger les stats d'utilisation
    logUsageStats: process.env.LOG_USAGE_STATS === "true",
  },
};
