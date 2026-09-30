"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useFxRates, toCurrency, currencySymbol } from "@/lib/fx";
import { useBaseCurrency, useProfile, setCachedProfile } from "@/lib/profile";
import { wealthSummary } from "@/lib/wealth";
import { estimateDividends } from "@/lib/dividendCalendar";
import {
  currentYieldPct,
  initialAssumptions,
  wealthGoalEta,
  incomeGoalEta,
  etaLabel,
  assumptionsPatch,
} from "@/lib/objectives";
import AppHeader from "../components/AppHeader";
import { Card, Button, useToast } from "../components/ui";
import Skeleton, { SkeletonRegion } from "../components/ui/Skeleton";
import ProjectionChart from "./ProjectionChart";

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const money = (v, symbol) => `${nf0.format(Math.round(Number(v) || 0))} ${symbol}`;

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink tabular-nums focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent";

// Curseurs d'hypothèses : bornes compatibles avec la validation du backend
const SLIDERS = [
  { key: "monthlySavings", label: "Épargne investie par mois", min: 0, max: 5000, step: 50, unit: "money" },
  { key: "expectedReturn", label: "Rendement espéré", min: 0, max: 12, step: 0.5, unit: "%/an" },
  { key: "dividendYield", label: "Rendement du dividende à l'arrivée", min: 0.5, max: 10, step: 0.1, unit: "%" },
  { key: "inflationRate", label: "Inflation", min: 0, max: 6, step: 0.1, unit: "%/an" },
];

function Slider({ def, value, onChange, symbol }) {
  const id = `h-${def.key}`;
  const shown = def.unit === "money" ? money(value, symbol) : `${nf1.format(value)} ${def.unit}`;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-ink">{def.label}</label>
        <span className={`shrink-0 text-sm font-semibold tabular-nums text-accent ${def.unit === "money" ? "money" : ""}`}>{shown}</span>
      </div>
      <input
        id={id}
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={Math.min(def.max, Math.max(def.min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={shown}
        className="w-full accent-accent"
      />
    </div>
  );
}

function Progress({ pct, label }) {
  const v = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(v, 1)}%` }} />
    </div>
  );
}

function EtaResult({ result }) {
  const text = etaLabel(result);
  if (!text) return null;
  const tone = result.reached ? "text-gain" : result.unreachable ? "text-warn" : "text-ink";
  return (
    <p className={`text-xl font-semibold sm:text-2xl ${tone}`} aria-live="polite">
      {result.reached && <span aria-hidden="true">✓ </span>}
      {text}
    </p>
  );
}

export default function Objectifs() {
  const toast = useToast();
  const { rates } = useFxRates();
  const base = useBaseCurrency();
  const symbol = currencySymbol(base);
  const { email, profile, loading: profileLoading } = useProfile();

  const [stocks, setStocks] = useState([]);
  const [cash, setCash] = useState({ amount: 0, currency: "EUR" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/user/portfolio")
      .then((data) => {
        setStocks(data.stocks || []);
        setCash(data.cash || { amount: 0, currency: "EUR" });
      })
      .catch((err) => setLoadError(`Impossible de charger vos données : ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  // Point de départ : portefeuille réel converti dans la devise de référence
  const toBase = (value, currency) => toCurrency(value, currency, base, rates);
  const inBase = (value, currency) => toBase(value, currency) ?? ((currency || "EUR") === base ? value : 0);
  const summary = wealthSummary(stocks, cash, toBase);
  const ready = !loading && (Boolean(rates) || stocks.every((s) => (s.currency || "EUR") === base));
  const annualDividends = ready ? estimateDividends(stocks, inBase).annual : 0;
  const currentYield = currentYieldPct(annualDividends, summary.invested);
  const current = Math.max(0, summary.total);

  // Hypothèses : profil enregistré, sinon valeurs proposées (initialisées une fois les données prêtes)
  const baseline = useMemo(() => initialAssumptions(profile, { currentYield }), [profile, currentYield]);
  useEffect(() => {
    if (!form && ready && !profileLoading) setForm(baseline);
  }, [form, ready, profileLoading, baseline]);

  const values = form || baseline;
  const set = (key) => (v) => setForm((f) => ({ ...(f || baseline), [key]: v }));
  const setAmount = (key) => (e) => {
    const raw = e.target.value;
    set(key)(raw === "" ? "" : Math.max(0, Number(raw)));
  };

  const common = {
    current,
    monthlySavings: values.monthlySavings,
    expectedReturn: values.expectedReturn,
    inflationRate: values.inflationRate,
  };
  const wealth = wealthGoalEta({ ...common, target: values.goalAmount });
  const income = incomeGoalEta({
    ...common,
    currentAnnualIncome: annualDividends,
    targetMonthly: values.incomeGoalMonthly,
    dividendYield: values.dividendYield,
  });

  const changes = form ? assumptionsPatch(profile, form) : {};
  // Valeurs proposées jamais enregistrées : le bouton reste actif pour les enregistrer telles quelles
  const dirty = Object.keys(changes).length > 0;

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const data = await apiFetch("/api/user/profile", { method: "PATCH", body: changes });
      setCachedProfile(data);
      toast.success("Objectifs enregistrés.");
    } catch (err) {
      toast.error(`Enregistrement impossible : ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-ink md:text-4xl">Objectifs</h1>
          <p className="text-ink-muted">
            Fixez un cap — un patrimoine à atteindre ou une rente de dividendes — et voyez quand vous y serez, à partir de votre portefeuille réel.
          </p>
        </div>

        {loadError && (
          <div role="alert" className="mb-6 rounded-lg border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss">{loadError}</div>
        )}

        {/* Point de départ */}
        {!ready ? (
          <SkeletonRegion label="Chargement de votre point de départ…" className="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-card">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          </SkeletonRegion>
        ) : (
          <Card as="section" aria-labelledby="depart-title" className="mb-6">
            <h2 id="depart-title" className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Point de départ</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-ink-muted">Patrimoine actuel</dt>
                <dd className="text-2xl font-semibold tabular-nums text-ink"><span className="money">{money(current, symbol)}</span></dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Dividendes estimés par an</dt>
                <dd className="text-2xl font-semibold tabular-nums text-ink">
                  <span className="money">{money(annualDividends, symbol)}</span>
                  <span className="ml-2 text-sm font-normal text-ink-muted money">soit {money(annualDividends / 12, symbol)}/mois</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Rendement actuel du dividende</dt>
                <dd className="text-2xl font-semibold tabular-nums text-ink">{currentYield != null ? `${nf1.format(currentYield)} %` : "—"}</dd>
              </div>
            </dl>
          </Card>
        )}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {/* Objectifs */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-2">
            <Card as="section" aria-labelledby="goal-wealth-title">
              <h2 id="goal-wealth-title" className="mb-1 text-lg font-semibold text-ink">Objectif de patrimoine</h2>
              <p className="mb-4 text-sm text-ink-muted">Le capital total que vous visez.</p>
              <label htmlFor="goalAmount" className="mb-2 block text-sm font-semibold text-ink">Montant visé ({symbol})</label>
              <input id="goalAmount" type="number" min="0" step="10000" inputMode="decimal" autoComplete="off" className={`${inputClass} mb-4`}
                value={values.goalAmount} onChange={setAmount("goalAmount")} />
              {wealth && (
                <>
                  <div className="mb-1 flex justify-between text-xs text-ink-muted tabular-nums">
                    <span className="money">{money(current, symbol)}</span>
                    <span>{nf0.format(Math.min(100, (current / wealth.target) * 100))} %</span>
                  </div>
                  <div className="mb-4"><Progress pct={(current / wealth.target) * 100} label="Progression vers l'objectif de patrimoine" /></div>
                  <EtaResult result={wealth} />
                </>
              )}
            </Card>

            <Card as="section" aria-labelledby="goal-income-title">
              <h2 id="goal-income-title" className="mb-1 text-lg font-semibold text-ink">Objectif de rente de dividendes</h2>
              <p className="mb-4 text-sm text-ink-muted">Les dividendes que vous voulez toucher chaque mois.</p>
              <label htmlFor="incomeGoalMonthly" className="mb-2 block text-sm font-semibold text-ink">Rente visée ({symbol} par mois)</label>
              <input id="incomeGoalMonthly" type="number" min="0" step="100" inputMode="decimal" autoComplete="off" className={`${inputClass} mb-4`}
                value={values.incomeGoalMonthly} onChange={setAmount("incomeGoalMonthly")} />
              {income && (
                <>
                  <p className="mb-1 text-sm text-ink-muted">
                    Capital nécessaire à {nf1.format(values.dividendYield)} % : <strong className="money tabular-nums text-ink">{money(income.capitalNeeded, symbol)}</strong>
                  </p>
                  <div className="mb-1 flex justify-between text-xs text-ink-muted tabular-nums">
                    <span className="money">Aujourd&apos;hui {money(income.currentMonthly, symbol)}/mois</span>
                    <span>{nf0.format(Math.min(100, (income.currentMonthly / values.incomeGoalMonthly) * 100))} %</span>
                  </div>
                  <div className="mb-4"><Progress pct={(income.currentMonthly / values.incomeGoalMonthly) * 100} label="Progression vers la rente visée" /></div>
                  <EtaResult result={income} />
                </>
              )}
            </Card>
          </div>

          {/* Hypothèses */}
          <Card as="section" aria-labelledby="hyp-title">
            <h2 id="hyp-title" className="mb-4 text-lg font-semibold text-ink">Hypothèses</h2>
            <div className="space-y-5">
              {SLIDERS.map((def) => (
                <Slider key={def.key} def={def} value={Number(values[def.key]) || 0} onChange={set(def.key)} symbol={symbol} />
              ))}
            </div>
            <p className="mt-5 text-xs text-ink-muted">
              Montants en euros d&apos;aujourd&apos;hui : la projection retire l&apos;inflation du rendement et suppose une épargne revalorisée chaque année. Simulation, pas une garantie.
            </p>
            {email && (
              <Button className="mt-5 w-full" variant="accent" loading={saving} disabled={!form || !dirty} onClick={save}>
                Enregistrer mes objectifs
              </Button>
            )}
          </Card>
        </div>

        {ready && (
          <ProjectionChart
            current={current}
            goalAmount={values.goalAmount}
            monthlySavings={Number(values.monthlySavings) || 0}
            expectedReturn={Number(values.expectedReturn) || 0}
            inflationRate={Number(values.inflationRate) || 0}
            goalDate={profile?.goalDate}
            symbol={symbol}
          />
        )}
      </div>
    </main>
  );
}
