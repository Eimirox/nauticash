const mongoose = require('mongoose');
require('dotenv').config();

const dividendsData = {
  'NVDA': { dividend: 0.04, dividendYield: 0.02 },
  'PFE': { dividend: 1.72, dividendYield: 6.32 },
  'V': { dividend: 1.85, dividendYield: 0.56 },
  'GOOGL': { dividend: 0.83, dividendYield: 0.26 },
  'GTT.PA': { dividend: 2.56, dividendYield: 1.44 },
  'TTE.PA': { dividend: 2.98, dividendYield: 4.76 },
};

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Prices = mongoose.connection.collection('prices');
  
  for (const [ticker, data] of Object.entries(dividendsData)) {
    await Prices.updateOne(
      { symbol: ticker },
      { $set: { dividend: data.dividend, dividendYield: data.dividendYield } }
    );
    console.log(`✅ Restored ${ticker}: ${data.dividend}`);
  }
  
  console.log('\n✅ All dividends restored!');
  process.exit(0);
});