"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useFxRates, toCurrency, currencySymbol } from "@/lib/fx";
import { useBaseCurrency } from "@/lib/profile";
import { feeAnalysis } from "@/lib/fees";
import AppHeader from "../../components/AppHeader";
import FeesCard from "../../components/FeesCard";
import { SkeletonRegion, SkeletonStat, SkeletonChart } from "../../components/ui/Skeleton";

// Analyses › Frais : frais annuels (TER) des ETF et fonds, coût annuel et manque à gagner projeté
// (carte déplacée depuis le tableau de bord).
export default function FraisPage() {
  const [loadError, setLoadError] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { rates } = useFxRates();
  const base = useBaseCurrency();
  const inBase = (value, currency) => toCurrency(value, currency, base, rates) ?? ((currency || "EUR") === base ? value : 0);

  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(true);
      try {
        const data = await apiFetch("/api/user/portfolio");
        setStocks(data.stocks || []);
      } catch (err) {
        console.error(err);
        setLoadError(`Impossible de charger vos données : ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, []);

  const positions = stocks.map((s) => ({
    ticker: s.ticker,
    name: s.name,
    type: s.type,
    fees: s.fees ?? null,
    value: inBase((s.close || 0) * (s.quantity || 0), s.currency),
  }));
  const hasFunds = feeAnalysis(positions).rows.length > 0;

  return (
    <main className="min-h-screen bg-bg">
      {loadError && (
        <div role="alert" className="mx-auto mt-4 max-w-7xl rounded-lg border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss">
          {loadError}
        </div>
      )}
      <AppHeader />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-ink md:text-4xl">Frais</h1>
          <p className="text-ink-muted">
            Ce que vous coûtent chaque année vos ETF et fonds, et leur effet sur votre patrimoine à 10 et 20 ans.
          </p>
        </div>

        {loading ? (
          <SkeletonRegion label="Chargement des frais…" className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SkeletonStat />
              <SkeletonStat className="hidden sm:block" />
              <SkeletonStat className="hidden sm:block" />
            </div>
            <SkeletonChart height="h-48" />
          </SkeletonRegion>
        ) : hasFunds ? (
          <FeesCard
            symbol={currencySymbol(base)}
            positions={positions}
            onFeesChange={(ticker, fees) => setStocks((prev) => prev.map((s) => (s.ticker === ticker ? { ...s, fees } : s)))}
          />
        ) : (
          !loadError && (
            <div className="rounded-xl border border-line bg-surface p-8 text-center shadow-lg">
              <h2 className="mb-2 text-lg font-bold text-ink">Aucun ETF ni fonds dans votre portefeuille</h2>
              <p className="text-sm text-ink-muted">
                Les frais annuels ne concernent que les ETF et les fonds. Les actions en direct n&apos;en ont pas (hors frais de courtage).
              </p>
              <Link href="/portfolio" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
                Voir mon portefeuille
              </Link>
            </div>
          )
        )}
      </div>
    </main>
  );
}
