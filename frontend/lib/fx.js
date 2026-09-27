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

/** Montant converti en euros ; null si la devise est inconnue ou les taux absents */
export function toEUR(amount, currency, rates) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  if (!currency || currency === "EUR") return n;
  const rate = Number(rates?.[currency]);
  return rate > 0 ? n / rate : null;
}

/** Taux « 1 <devise> = x € » pour l'affichage */
export function eurPer(currency, rates) {
  const rate = Number(rates?.[currency]);
  return rate > 0 ? 1 / rate : null;
}
