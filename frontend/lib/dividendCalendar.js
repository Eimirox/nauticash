// frontend/lib/dividendCalendar.js
// Projection des dividendes sur les 12 prochains mois à partir du dividende annuel,
// de la fréquence de versement et du dernier détachement connu (données du backend).

export const FREQUENCY_LABELS = { 12: "Mensuel", 4: "Trimestriel", 2: "Semestriel", 1: "Annuel" };

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function addMonths(date, months) {
  const d = new Date(date);
  const whole = Math.floor(months);
  d.setMonth(d.getMonth() + whole);
  return d;
}

/**
 * positions : [{ ticker, name, annualBase, frequency, lastExDate, nextExDate }]
 *   annualBase = dividende annuel de la ligne dans la devise de référence
 * → { months: [{ key, label, total, items: [{ticker, amount}] }], upcoming: [{ ticker, date, amount }] }
 */
export function projectDividends(positions, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = addMonths(start, 12);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = addMonths(start, i);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: `${MONTHS_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, total: 0, items: [] };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));
  const upcoming = [];

  for (const p of positions || []) {
    const f = Number(p.frequency) || null;
    const perPayment = f ? p.annualBase / f : null;
    if (!(perPayment > 0)) continue;
    let date = p.nextExDate ? new Date(`${p.nextExDate}T12:00:00`) : null;
    if (!date && p.lastExDate) {
      date = new Date(`${String(p.lastExDate).slice(0, 10)}T12:00:00`);
      while (date <= now) date = addMonths(date, 12 / f);
    }
    if (!date || Number.isNaN(date.getTime())) continue;
    for (let guard = 0; date < end && guard < 24; guard++) {
      const m = byKey.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (m) {
        m.total += perPayment;
        m.items.push({ ticker: p.ticker, amount: perPayment });
      }
      upcoming.push({ ticker: p.ticker, name: p.name, date: new Date(date), amount: perPayment, frequency: f });
      date = addMonths(date, 12 / f);
    }
  }
  upcoming.sort((a, b) => a.date - b.date);
  return { months, upcoming };
}
