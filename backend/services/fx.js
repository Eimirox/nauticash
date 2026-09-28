// backend/services/fx.js
// Taux de change de référence de la BCE via Frankfurter (gratuit, sans clé),
// base EUR : rates.USD = nombre de dollars pour 1 €.
// Mis en cache 6 h ; en cas d'échec on garde les derniers taux connus.

const FX_URL = process.env.FX_API_URL || "https://api.frankfurter.dev/v1/latest?base=EUR";
const TTL = 6 * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE = 10 * 60 * 1000;

// Secours si l'API n'a jamais répondu (ordre de grandeur uniquement, signalé par `stale`)
const FALLBACK = {
  date: null,
  rates: { USD: 1.14, GBP: 0.86, CHF: 0.94, CAD: 1.61, JPY: 180, SEK: 11, NOK: 11.7, DKK: 7.46, AUD: 1.73, HKD: 8.87 },
};

let cache = null; // { base, date, rates, fetchedAt }
let lastFailure = 0;
let inflight = null;

async function fetchRates() {
  const res = await fetch(FX_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Frankfurter a répondu ${res.status}`);
  const data = await res.json();
  if (!data || typeof data.rates !== "object" || !Number(data.rates.USD)) throw new Error("Réponse de taux invalide");
  return { base: "EUR", date: data.date || null, rates: { ...data.rates, EUR: 1 }, fetchedAt: new Date() };
}

async function getRates() {
  const fresh = cache && Date.now() - cache.fetchedAt.getTime() < TTL;
  if (fresh || (Date.now() - lastFailure < RETRY_AFTER_FAILURE && cache)) return { ...cache, stale: !fresh };

  if (!inflight) {
    inflight = fetchRates()
      .then((r) => { cache = r; })
      .catch((err) => {
        lastFailure = Date.now();
        console.error("❌ Taux de change indisponibles :", err.message);
      })
      .finally(() => { inflight = null; });
  }
  await inflight;

  if (cache) return { ...cache, stale: Date.now() - cache.fetchedAt.getTime() >= TTL };
  return { base: "EUR", date: FALLBACK.date, rates: { ...FALLBACK.rates, EUR: 1 }, fetchedAt: null, stale: true };
}

/** Convertit un montant en euros (null si la devise est inconnue) */
function toEUR(amount, currency, rates) {
  if (!Number.isFinite(amount)) return null;
  if (!currency || currency === "EUR") return amount;
  const rate = Number(rates?.[currency]);
  return rate > 0 ? amount / rate : null;
}

function _reset() { cache = null; lastFailure = 0; inflight = null; }

module.exports = { getRates, toEUR, _reset };
