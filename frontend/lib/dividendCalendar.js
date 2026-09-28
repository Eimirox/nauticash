// frontend/lib/dividendCalendar.js
// Dividendes : lignes qui versent, revenu annuel estimé et projection des versements
// sur les 12 prochains mois, à partir du dividende annuel, de la fréquence et du dernier
// détachement connus (données du backend). Partagé par la page Dividendes et la Vue d'ensemble.

export const FREQUENCY_LABELS = { 12: "Mensuel", 4: "Trimestriel", 2: "Semestriel", 1: "Annuel" };

export const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_LONG_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Ajoute des mois sans déborder sur le mois suivant (31 janv. + 1 mois → 28/29 févr.)
export function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Math.floor(months));
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

function parseDate(d) {
  if (d == null || d === "") return null;
  const date = typeof d === "number" ? new Date(d * 1000) : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Lignes qui versent un dividende, triées par revenu annuel décroissant.
 * inBase(montant, devise) convertit dans la devise de référence.
 */
export function dividendPositions(stocks, inBase) {
  return (stocks || [])
    .filter((s) => s.dividend != null && s.dividend > 0)
    .map((s) => {
      const quantity = s.quantity || 0;
      const divPerShare = s.dividend;
      const totalAnnual = divPerShare * quantity;
      const last = parseDate(s.exDividendDate);
      return {
        ticker: s.ticker,
        name: s.name,
        quantity,
        divPerShare,
        totalAnnual,
        totalAnnualBase: inBase(totalAnnual, s.currency),
        // Rendement au cours actuel, en %
        yieldPercent: s.close > 0 ? (divPerShare / s.close) * 100 : Number(s.dividendYield) || 0,
        yieldOnCost: s.pru > 0 ? (divPerShare / s.pru) * 100 : null,
        currency: s.currency || "USD",
        exDividendDate: s.exDividendDate,
        lastExDate: last ? last.toISOString() : null,
        nextExDividendDate: s.nextExDividendDate || null,
        sector: s.sector,
        logo: s.logo,
        exchange: s.exchange,
        // Fréquence connue (backend) ; à défaut : trimestriel aux États-Unis, annuel ailleurs (estimation)
        frequency: Number(s.dividendFrequency) || (String(s.ticker).includes(".") ? 1 : 4),
        frequencyEstimated: !s.dividendFrequency,
      };
    })
    .sort((a, b) => b.totalAnnualBase - a.totalAnnualBase);
}

/**
 * positions : [{ ticker, name, annualBase, frequency, lastExDate, nextExDate }]
 *   annualBase = dividende annuel de la ligne dans la devise de référence
 * → { months: [{ key, label, longLabel, total, items }], upcoming: [{ ticker, name, date, amount, frequency }] }
 */
export function projectDividends(positions, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = addMonths(start, 12);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = addMonths(start, i);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${MONTHS_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      longLabel: `${MONTHS_LONG_FR[d.getMonth()]} ${d.getFullYear()}`,
      total: 0,
      items: [],
    };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));
  const upcoming = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const p of positions || []) {
    const f = Number(p.frequency) || null;
    const perPayment = f ? p.annualBase / f : null;
    if (!(perPayment > 0)) continue;
    let date = p.nextExDate ? new Date(`${String(p.nextExDate).slice(0, 10)}T12:00:00`) : null;
    if ((!date || Number.isNaN(date.getTime())) && p.lastExDate) {
      date = new Date(`${String(p.lastExDate).slice(0, 10)}T12:00:00`);
    }
    if (!date || Number.isNaN(date.getTime())) continue;
    // Une date passée (estimation ancienne) est avancée au prochain versement
    for (let guard = 0; date < today && guard < 120; guard++) date = addMonths(date, 12 / f);
    for (let guard = 0; date < end && guard < 24; guard++) {
      const item = { ticker: p.ticker, name: p.name, date: new Date(date), amount: perPayment, frequency: f };
      const m = byKey.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (m) {
        m.total += perPayment;
        m.items.push(item);
      }
      upcoming.push(item);
      date = addMonths(date, 12 / f);
    }
  }
  upcoming.sort((a, b) => a.date - b.date);
  for (const m of months) m.items.sort((a, b) => a.date - b.date);
  return { months, upcoming };
}

/**
 * Synthèse : revenu annuel estimé (dividende annuel × quantité), revenu projeté sur
 * les 12 prochains mois, prochain versement et calendrier mois par mois.
 */
export function estimateDividends(stocks, inBase, now = new Date()) {
  const positions = dividendPositions(stocks, inBase);
  const annual = positions.reduce((sum, p) => sum + (p.totalAnnualBase || 0), 0);
  const { months, upcoming } = projectDividends(
    positions.map((p) => ({
      ticker: p.ticker,
      name: p.name,
      annualBase: p.totalAnnualBase,
      frequency: p.frequency,
      lastExDate: p.lastExDate,
      nextExDate: p.nextExDividendDate,
    })),
    now
  );
  const next12 = months.reduce((sum, m) => sum + m.total, 0);
  return { positions, annual, monthly: annual / 12, next12, months, upcoming, next: upcoming[0] || null };
}
