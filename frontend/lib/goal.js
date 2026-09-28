// frontend/lib/goal.js
// Progression vers l'objectif de patrimoine du profil.

/** Nombre de mois (fractionnaire) entre deux dates */
function monthsBetween(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + (to.getDate() - from.getDate()) / 30.4;
}

/**
 * { pct, remaining, reached, monthsLeft, perMonth, overdue } ou null si pas d'objectif.
 * perMonth : épargne mensuelle nécessaire pour atteindre l'objectif à l'échéance (hors rendement).
 */
export function goalProgress(current, goalAmount, goalDate, now = new Date()) {
  const goal = Number(goalAmount);
  if (!(goal > 0)) return null;
  const value = Math.max(0, Number(current) || 0);
  const remaining = Math.max(0, goal - value);
  const reached = remaining === 0;
  const pct = Math.min(100, (value / goal) * 100);

  let monthsLeft = null;
  let perMonth = null;
  let overdue = false;
  if (goalDate) {
    const end = new Date(`${goalDate}T12:00:00`);
    if (!Number.isNaN(end.getTime())) {
      monthsLeft = monthsBetween(now, end);
      overdue = monthsLeft <= 0 && !reached;
      if (monthsLeft > 0 && !reached) perMonth = remaining / Math.max(1, monthsLeft);
    }
  }
  return { pct, remaining, reached, monthsLeft, perMonth, overdue };
}
