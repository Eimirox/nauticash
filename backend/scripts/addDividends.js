// backend/scripts/addDividends.js
// Script pour ajouter les champs dividend/dividendYield aux documents existants dans prices

require("dotenv").config();
const mongoose = require("mongoose");
const { getQuote } = require("../services/apiFinance");

async function addDividends() {
  try {
    // Connexion MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connecté à MongoDB");

    const Prices = mongoose.connection.collection("prices");

    // Récupérer tous les documents de prices
    const allPrices = await Prices.find({}).toArray();
    console.log(`📊 ${allPrices.length} documents trouvés dans prices`);

    let updated = 0;
    let failed = 0;

    for (const priceDoc of allPrices) {
      const ticker = priceDoc.symbol;
      
      // Si les dividendes sont déjà présents, skip
      if (priceDoc.dividend !== undefined && priceDoc.dividend !== null) {
        console.log(`⏭️  ${ticker} - Dividendes déjà présents`);
        continue;
      }

      try {
        console.log(`🔄 Mise à jour de ${ticker}...`);
        
        // Récupérer les données Yahoo Finance
        const data = await getQuote(ticker);
        
        if (!data) {
          console.log(`❌ ${ticker} - Pas de données Yahoo Finance`);
          failed++;
          continue;
        }

        // Mettre à jour le document
        await Prices.updateOne(
          { _id: priceDoc._id },
          {
            $set: {
              dividend: data.dividendRate ?? null,
              dividendYield: data.dividendYield ?? null,
              exDividendDate: data.exDividendDate ?? null,
              type: data.quoteType || priceDoc.type || "EQUITY",
              name: data.longName || priceDoc.name || ticker,
              // Mettre à jour aussi le prix si tu veux :
              // close: data.price || priceDoc.close,
            }
          }
        );

        console.log(`✅ ${ticker} - Mis à jour (dividend: ${data.dividendRate || 'null'})`);
        updated++;
        
        // Pause de 500ms pour éviter de surcharger l'API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error(`❌ ${ticker} - Erreur:`, err.message);
        failed++;
      }
    }

    console.log("\n📊 Résumé:");
    console.log(`✅ ${updated} documents mis à jour`);
    console.log(`❌ ${failed} échecs`);
    console.log(`⏭️  ${allPrices.length - updated - failed} déjà à jour`);

  } catch (err) {
    console.error("❌ Erreur globale:", err);
  } finally {
    await mongoose.connection.close();
    console.log("👋 Déconnexion MongoDB");
  }
}

// Lancer le script
addDividends();