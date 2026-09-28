// backend/services/dividends.js
// Dividende annuel à partir de la liste des versements (FMP /stable/dividends).
//
// Additionner « tout ce qui tombe dans les 365 derniers jours » est faux dès que les dates
// glissent : 5 versements trimestriels peuvent tomber dans la fenêtre (+25 %), ou 3 (−25 %).
// On prend donc les N derniers versements, N = fréquence annuelle (déclarée par l'API
// ou déduite de l'écart entre versements), ce qui donne le dividende annuel « courant ».

const DAY = 24 * 60 * 60 * 1000;

const FREQUENCIES = {
  monthly: 12, quarterly: 4, "semi-annual": 2, semiannual: 2, "semi annual": 2,
  biannual: 2, annual: 1, annually: 1, yearly: 1,
};

const amountOf = (d) => Number(d.adjDividend ?? d.dividend) || 0;
const timeOf = (d) => new Date(d.date).getTime();

function frequencyOf(rows) {
  const declared = FREQUENCIES[String(rows[0]?.frequency || "").toLowerCase().trim()];
  if (declared) return declared;
  if (rows.length < 2) return 1;

  // Écart médian entre les derniers versements
  const gaps = [];
  for (let i = 0; i < Math.min(rows.length - 1, 4); i++) gaps.push((timeOf(rows[i]) - timeOf(rows[i + 1])) / DAY);
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median < 45) return 12;
  if (median < 135) return 4;
  if (median < 250) return 2;
  return 1;
}

/**
 * @param {Array} data versements (ordre quelconque), champs date, adjDividend|dividend, frequency?
 * @param {number} now horodatage de référence (tests)
 * @returns {{ annual: number|null, frequency: number|null, latest: object|null }}
 */
function annualizeDividends(data, now = Date.now()) {
  const rows = (Array.isArray(data) ? data : [])
    .filter((d) => d && Number.isFinite(timeOf(d)) && amountOf(d) > 0)
    .sort((a, b) => timeOf(b) - timeOf(a));

  if (!rows.length) return { annual: null, frequency: null, latest: null };

  // Versements déjà détachés (ou annoncés dans les 3 prochains mois)
  const relevant = rows.filter((d) => timeOf(d) <= now + 92 * DAY);
  const latest = relevant[0] || rows[rows.length - 1];

  // Plus aucun versement depuis 18 mois : dividende suspendu
  if (!relevant.length || now - timeOf(latest) > 548 * DAY) {
    return { annual: null, frequency: null, latest };
  }

  const frequency = frequencyOf(relevant);
  const annual = relevant.slice(0, frequency).reduce((sum, d) => sum + amountOf(d), 0);
  return { annual: annual > 0 ? Math.round(annual * 1e6) / 1e6 : null, frequency, latest };
}

module.exports = { annualizeDividends, frequencyOf };
