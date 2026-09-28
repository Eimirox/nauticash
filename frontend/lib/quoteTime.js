// frontend/lib/quoteTime.js
// Fraîcheur d'un cours : heure de cotation du jour, ou date si plus ancien,
// et alerte quand le cours date de plus de 3 jours ouvrés (valeur suspendue, ticker mort…).

const DAY = 24 * 60 * 60 * 1000;

/** Nombre de jours ouvrés (lundi → vendredi) écoulés entre deux dates, sans compter le jour de départ */
export function businessDaysBetween(from, to) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  let count = 0;
  for (let t = start.getTime() + DAY; t <= end.getTime(); t += DAY) {
    const d = new Date(t).getDay();
    if (d !== 0 && d !== 6) count++;
  }
  return count;
}

/**
 * { label, title, stale } ou null si l'heure est inconnue.
 * label : « 17:35 » pour aujourd'hui, « 26/09 » sinon ; stale : plus de 3 jours ouvrés.
 */
export function quoteFreshness(priceTime, now = new Date()) {
  if (!priceTime) return null;
  const t = new Date(priceTime);
  if (Number.isNaN(t.getTime())) return null;
  const sameDay = t.toDateString() === now.toDateString();
  const label = sameDay
    ? t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : t.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const title = `Cours du ${t.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}`;
  return { label, title, stale: businessDaysBetween(t, now) > 3 };
}
