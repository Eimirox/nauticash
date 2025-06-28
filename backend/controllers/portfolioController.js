const Portfolio = require('../models/Portfolio'); // adapte le chemin
const { getQuote } = require('../services/apiFinance');

exports.getUserPortfolio = async (req, res) => {
  try {
    const userId = req.user.id; // suppose que tu utilises un middleware d'auth
    const portfolio = await Portfolio.findOne({ userId });

    if (!portfolio || !portfolio.stocks.length) return res.json([]);

    const enriched = await Promise.all(
      portfolio.stocks.map(async (stock) => {
        const data = await getQuote(stock.ticker);
        if (!data) return null;

        const performance = ((data.price - stock.pru) / stock.pru) * 100;
        const total = data.price * stock.quantity;

        return {
          ticker: stock.ticker,
          quantity: stock.quantity,
          pru: stock.pru,
          close: data.price,
          currency: data.currency,
          country: data.exchange,
          performance,
          total,
        };
      })
    );

    res.json(enriched.filter(Boolean));
  } catch (err) {
    console.error("Erreur portfolio :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
