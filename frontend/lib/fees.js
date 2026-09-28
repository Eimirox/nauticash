// frontend/lib/fees.js
// Analyse des frais annuels (TER) des ETF et fonds, saisis par l'utilisateur.
// Impact projeté : écart entre la valeur future avec un rendement brut hypothétique
// et la même valeur diminuée des frais chaque année (valeur actuelle, sans versements).

export const ASSUMED_RETURN = 0.05; // 5 % par an avant frais (hypothèse affichée à l'utilisateur)

const isFund = (p) => /ETF|FUND|FONDS|OPCVM|SICAV/i.test(String(p.type || ""));

/**
 * positions : [{ ticker, name, type, value, fees }] (value dans la devise de référence, fees en %)
 * rows : ETF / fonds et toute position dont les frais sont renseignés.
 */
export function feeAnalysis(positions, { rate = ASSUMED_RETURN } = {}) {
  const rows = (positions || [])
    .filter((p) => Number(p.value) > 0 && (isFund(p) || p.fees != null))
    .map((p) => {
      const fees = p.fees == null ? null : Number(p.fees);
      return { ...p, fees, annualCost: fees == null ? null : (p.value * fees) / 100 };
    })
    .sort((a, b) => (b.annualCost ?? -1) - (a.annualCost ?? -1));

  const known = rows.filter((r) => r.fees != null);
  const value = known.reduce((a, r) => a + r.value, 0);
  const annualCost = known.reduce((a, r) => a + r.annualCost, 0);
  const weightedTer = value > 0 ? (annualCost / value) * 100 : null;

  const impact = (years) =>
    known.reduce((a, r) => a + r.value * ((1 + rate) ** years - (1 + rate - r.fees / 100) ** years), 0);

  return {
    rows,
    missing: rows.filter((r) => r.fees == null).length,
    value,
    annualCost,
    weightedTer,
    impact10: known.length ? impact(10) : null,
    impact20: known.length ? impact(20) : null,
  };
}
