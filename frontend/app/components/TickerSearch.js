"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cx } from "./ui/cx";
import TickerLogo from "./TickerLogo";

// Suggestions affichées avant la saisie (titres les plus suivis)
const logoOf = (symbol) => `https://images.financialmodelingprep.com/symbol/${symbol.replace("-", "")}.png`;
const QUICK = [
  { symbol: "AAPL", name: "Apple Inc.", type: "Stock", exchange: "NASDAQ" },
  { symbol: "NVDA", name: "NVIDIA Corporation", type: "Stock", exchange: "NASDAQ" },
  { symbol: "MSFT", name: "Microsoft Corporation", type: "Stock", exchange: "NASDAQ" },
  { symbol: "MC.PA", name: "LVMH", type: "Stock", exchange: "Euronext Paris" },
  { symbol: "AIR.PA", name: "Airbus SE", type: "Stock", exchange: "Euronext Paris" },
  { symbol: "CW8.PA", name: "Amundi MSCI World UCITS ETF", type: "ETF", exchange: "Euronext Paris" },
  { symbol: "BTC-USD", name: "Bitcoin", type: "Crypto", exchange: "Crypto" },
].map((q) => ({ ...q, logo: logoOf(q.symbol) }));

const TYPE_LABELS = { Stock: "Action", ETF: "ETF", Crypto: "Crypto" };
const TYPE_STYLES = {
  Stock: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  ETF: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
  Crypto: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
};

/**
 * Champ de recherche de titre avec autocomplétion (nom ou ticker : « google », « airbus », « NVDA »…).
 * Entrée ou clic sur une suggestion → onSelect(symbole). Sans suggestion, Entrée envoie le texte saisi.
 * existing : tickers déjà en portefeuille (signalés dans la liste).
 */
export default function TickerSearch({ value, onChange, onSelect, disabled, existing = [] }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const boxRef = useRef(null);
  const owned = new Set(existing.map((t) => String(t).toUpperCase()));

  // Recherche (délai de 200 ms entre deux frappes, requête précédente annulée)
  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setResults(QUICK);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      apiFetch(`/api/market/search?q=${encodeURIComponent(q)}`)
        .then((d) => {
          if (!alive) return;
          setResults(Array.isArray(d?.results) ? d.results : []);
          setActive(0);
        })
        .catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [value]);

  // Fermer la liste en cliquant ailleurs
  useEffect(() => {
    const onDown = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const choose = (symbol) => {
    setOpen(false);
    onSelect(symbol);
  };

  const showList = open && (results.length > 0 || (value.trim() && !loading));

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!value.trim()) return;
      const pick = open && results[active];
      choose(pick ? pick.symbol : value.trim().toUpperCase());
    }
  };

  return (
    <div ref={boxRef} className="relative flex-1 min-w-[200px]">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 shrink-0 text-ink-muted/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          role="combobox"
          aria-expanded={Boolean(showList)}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          aria-label="Rechercher un titre par nom ou par ticker"
          autoComplete="off"
          spellCheck={false}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Rechercher un titre : Apple, Airbus, MSCI World, NVDA…"
          className="flex-1 border-0 bg-transparent px-1 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
        />
        {loading && value.trim() && (
          <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent" />
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-auto rounded-xl border border-line bg-surface py-1 shadow-card"
        >
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-muted">
              Aucun titre trouvé. Vérifiez l&apos;orthographe ou saisissez le ticker exact (ex. AIR.PA pour Paris).
            </li>
          ) : (
            <>
            {!value.trim() && (
              <li role="presentation" className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                Suggestions — tapez un nom ou un ticker
              </li>
            )}
            {results.map((r, i) => {
              const isOwned = owned.has(r.symbol);
              return (
                <li
                  key={r.symbol}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={isOwned}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!isOwned) choose(r.symbol);
                  }}
                  className={cx(
                    "flex cursor-pointer items-center gap-3 px-4 py-2.5",
                    i === active && "bg-surface-2",
                    isOwned && "cursor-default opacity-60"
                  )}
                >
                  <TickerLogo ticker={r.symbol} logo={r.logo} size={28} />
                  <span className="w-16 shrink-0 text-sm font-semibold text-ink sm:w-20 sm:text-base">{r.symbol}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{r.name}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {[r.exchange, r.sector, isOwned && "déjà dans votre portefeuille"].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {r.type && (
                    <span className={cx("hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold sm:inline-block", TYPE_STYLES[r.type])}>
                      {TYPE_LABELS[r.type] || r.type}
                    </span>
                  )}
                </li>
              );
            })}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
