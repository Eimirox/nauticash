// frontend/lib/alerts.js
// Alertes du tableau de bord : cours en échec, non datés ou anciens, fonds de précaution insuffisant.
// Fonction pure (sans React) pour rester simple à vérifier.

import { quoteFreshness } from "./quoteTime";

const MIN_MONTHS = 3; // même repère que la carte « Fonds de précaution » (EmergencyFund)

/** Mois de dépenses couverts par le cash (null si dépenses non renseignées) */
function monthsCovered(cash, monthlyExpenses) {
  const m = Number(monthlyExpenses);
  if (!(m > 0)) return null;
  return Math.max(0, Number(cash) || 0) / m;
}

const tickers = (list) => list.map((s) => s.ticker).filter(Boolean);

/**
 * Liste d'alertes { id, level: "loss" | "warn", title, detail, tickers?, href, cta }, les plus graves d'abord.
 * - stocks : positions renvoyées par /api/user/portfolio (priceError, priceTime)
 * - cashInBase : cash converti dans la devise de référence (null si inconnu)
 * - monthlyExpenses : dépenses mensuelles du profil (facultatif)
 */
export function dashboardAlerts({ stocks = [], cashInBase = null, monthlyExpenses = null, now = new Date() } = {}) {
  const alerts = [];
  const failed = [];
  const undated = [];
  const stale = [];

  for (const s of stocks) {
    if (s.priceError) {
      failed.push(s);
      continue;
    }
    const f = quoteFreshness(s.priceTime, now);
    if (!f) undated.push(s);
    else if (f.stale) stale.push(s);
  }

  const plural = (n, one, many) => (n > 1 ? many : one);

  if (failed.length) {
    alerts.push({
      id: "quotes-failed",
      level: "loss",
      title: `${failed.length} ${plural(failed.length, "cours non actualisé", "cours non actualisés")}`,
      detail: "La dernière actualisation a échoué : le dernier cours connu est conservé et une nouvelle tentative aura lieu automatiquement.",
      tickers: tickers(failed),
      href: "/portfolio",
      cta: "Voir le portefeuille",
    });
  }
  if (undated.length) {
    alerts.push({
      id: "quotes-undated",
      level: "warn",
      title: `${undated.length} ${plural(undated.length, "cours non daté", "cours non datés")}`,
      detail: plural(undated.length, "Ce cours n'a pas de date de cotation : il est actualisé en priorité.", "Ces cours n'ont pas de date de cotation : ils sont actualisés en priorité."),
      tickers: tickers(undated),
      href: "/portfolio",
      cta: "Voir le portefeuille",
    });
  }
  if (stale.length) {
    alerts.push({
      id: "quotes-stale",
      level: "warn",
      title: `${stale.length} ${plural(stale.length, "cours ancien", "cours anciens")}`,
      detail: "Plus de 3 jours ouvrés sans nouvelle cotation : valeur suspendue, ticker changé ou place fermée ?",
      tickers: tickers(stale),
      href: "/portfolio",
      cta: "Voir le portefeuille",
    });
  }

  if (cashInBase != null) {
    const months = monthsCovered(cashInBase, monthlyExpenses);
    if (months !== null && months < MIN_MONTHS) {
      alerts.push({
        id: "emergency-low",
        level: "warn",
        title: "Fonds de précaution à renforcer",
        detail: `Votre cash couvre ${months.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} mois de dépenses (repère : ${MIN_MONTHS} à 6 mois).`,
        href: "#objectifs-en-bref",
        cta: "Voir le détail",
      });
    }
  }

  return alerts;
}
