// frontend/lib/fx.js
// Taux de change servis par le backend (/api/fx : taux de référence BCE, base EUR).
// rates.USD = nombre de dollars pour 1 €. Toutes les devises sont converties, pas seulement l'USD.

"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api";

let shared = null; // une seule requête par chargement de page

export function fetchFxRates() {
  if (!shared) {
    shared = apiFetch("/api/fx", { auth: false }).catch((err) => {
      shared = null;
      throw err;
    });
  }
  return shared;
}

/** { rates, date, stale, loading } — rates vaut null tant que les taux ne sont pas chargés */
export function useFxRates() {
  const [state, setState] = useState({ rates: null, date: null, stale: false, loading: true });

  useEffect(() => {
    let alive = true;
    fetchFxRates()
      .then((d) => alive && setState({ rates: d.rates, date: d.date, stale: Boolean(d.stale), loading: false }))
      .catch(() => alive && setState({ rates: null, date: null, stale: true, loading: false }));
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

/**
 * Montant converti d'une devise à une autre via l'euro (taux BCE, base EUR) ;
 * null si l'une des devises est inconnue ou si les taux ne sont pas chargés.
 */
export function toCurrency(amount, from, to = "EUR", rates) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  const src = from || "EUR";
  const dst = to || "EUR";
  if (src === dst) return n;
  const rateFrom = src === "EUR" ? 1 : Number(rates?.[src]);
  const rateTo = dst === "EUR" ? 1 : Number(rates?.[dst]);
  return rateFrom > 0 && rateTo > 0 ? (n / rateFrom) * rateTo : null;
}

/** Montant converti en euros ; null si la devise est inconnue ou les taux absents */
export function toEUR(amount, currency, rates) {
  return toCurrency(amount, currency, "EUR", rates);
}

/** Taux « 1 <devise> = x <devise de référence> » pour l'affichage */
export function ratePer(currency, base = "EUR", rates) {
  return toCurrency(1, currency, base, rates);
}

/** Taux « 1 <devise> = x € » pour l'affichage */
export function eurPer(currency, rates) {
  return ratePer(currency, "EUR", rates);
}

const SYMBOLS = { EUR: "€", USD: "$", GBP: "£", CHF: "CHF", JPY: "¥" };

/** Symbole court d'une devise (code ISO sinon) */
export function currencySymbol(currency) {
  return SYMBOLS[currency] || currency || "€";
}
