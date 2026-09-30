"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useProfile, setCachedProfile } from "@/lib/profile";
import {
  STRATEGIES,
  ALLOCATION_BUCKETS,
  strategyDefaults,
  allocationTotal,
  isValidMaxWeight,
  initialStrategy,
  isDefaultForStrategy,
  strategyPatch,
} from "@/lib/strategy";
import AppHeader from "../components/AppHeader";
import { Card, Button, useToast } from "../components/ui";
import Skeleton, { SkeletonRegion } from "../components/ui/Skeleton";

const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

const inputClass =
  "w-20 rounded-lg border border-line bg-surface px-3 py-2 text-right text-ink tabular-nums focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent";

function StyleChoice({ value, onChange }) {
  return (
    <fieldset>
      <legend className="sr-only">Style d&apos;investissement</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {STRATEGIES.map((s) => {
          const checked = value === s.key;
          return (
            <label
              key={s.key}
              className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-accent ${
                checked ? "border-accent bg-accent/5" : "border-line hover:bg-surface-2"
              }`}
            >
              <input
                type="radio"
                name="strategy"
                value={s.key}
                checked={checked}
                onChange={() => onChange(s.key)}
                className="mt-1 h-4 w-4 shrink-0 accent-accent"
              />
              <span>
                <span className="block font-semibold text-ink">{s.label}</span>
                <span className="mt-1 block text-sm text-ink-muted">{s.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function AllocationRow({ bucket, value, onChange }) {
  const id = `alloc-${bucket.key}`;
  const n = Number(value) || 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm font-semibold text-ink">{bucket.label}</label>
        {bucket.hint && <span className="block text-xs text-ink-muted">{bucket.hint}</span>}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div className="h-full rounded-full bg-accent-2" style={{ width: `${Math.max(0, Math.min(100, n))}%` }} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <input
          id={id}
          type="number"
          min="0"
          max="100"
          step="1"
          inputMode="decimal"
          autoComplete="off"
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <span className="text-sm text-ink-muted" aria-hidden="true">%</span>
      </div>
    </div>
  );
}

export default function Strategie() {
  const toast = useToast();
  const { email, profile, loading } = useProfile();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const baseline = useMemo(() => initialStrategy(profile), [profile]);
  useEffect(() => {
    if (!form && !loading) setForm(baseline);
  }, [form, loading, baseline]);

  const values = form || baseline;
  const total = allocationTotal(values.allocation);
  const remaining = Math.round((100 - total) * 10) / 10;
  const totalOk = Math.abs(remaining) <= 0.5;
  const weightOk = isValidMaxWeight(values.maxPositionWeight);
  const changes = form ? strategyPatch(profile, form) : null;
  const dirty = Boolean(changes && Object.keys(changes).length);
  const isDefault = isDefaultForStrategy(values);

  // Choisir un style applique ses valeurs proposées (modifiables ensuite)
  const chooseStrategy = (key) => setForm({ ...values, strategy: key, ...strategyDefaults(key) });
  const resetDefaults = () => setForm({ ...values, ...strategyDefaults(values.strategy) });
  const setBucket = (key) => (v) => setForm({ ...values, allocation: { ...values.allocation, [key]: v } });

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const data = await apiFetch("/api/user/profile", { method: "PATCH", body: changes });
      setCachedProfile(data);
      toast.success("Stratégie enregistrée.");
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
          <h1 className="mb-2 text-3xl font-bold text-ink md:text-4xl">Stratégie</h1>
          <p className="text-ink-muted">
            Choisissez votre style d&apos;investissement et la répartition que vous visez. Nauticash la comparera bientôt à votre portefeuille réel.
          </p>
        </div>

        {!form ? (
          <SkeletonRegion label="Chargement de votre stratégie…" className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
            <Skeleton className="h-64 rounded-2xl" />
          </SkeletonRegion>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <div className="grid grid-cols-1 gap-6 lg:col-span-2">
              <Card as="section" aria-labelledby="style-title">
                <h2 id="style-title" className="mb-1 text-lg font-semibold text-ink">Votre style</h2>
                <p className="mb-4 text-sm text-ink-muted">
                  Choisir un style propose une allocation cible et une limite par ligne, que vous pouvez ensuite ajuster.
                </p>
                <StyleChoice value={values.strategy} onChange={chooseStrategy} />
              </Card>

              <Card as="section" aria-labelledby="alloc-title">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="alloc-title" className="text-lg font-semibold text-ink">Allocation cible</h2>
                  {!isDefault && (
                    <Button variant="ghost" onClick={resetDefaults}>Revenir aux valeurs proposées</Button>
                  )}
                </div>
                <p className="mb-2 text-sm text-ink-muted">Part visée de chaque poche dans votre portefeuille investi.</p>
                <div className="divide-y divide-line">
                  {ALLOCATION_BUCKETS.map((b) => (
                    <AllocationRow key={b.key} bucket={b} value={values.allocation[b.key]} onChange={setBucket(b.key)} />
                  ))}
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                  <span className="text-sm font-semibold text-ink">Total</span>
                  <span className={`text-sm font-semibold tabular-nums ${totalOk ? "text-gain" : "text-warn"}`} aria-live="polite">
                    {totalOk ? "✓ " : ""}
                    {nf1.format(total)} %
                    {!totalOk && (remaining > 0 ? ` — reste ${nf1.format(remaining)} % à répartir` : ` — ${nf1.format(-remaining)} % de trop`)}
                  </span>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <Card as="section" aria-labelledby="limit-title">
                <h2 id="limit-title" className="mb-1 text-lg font-semibold text-ink">Limite par ligne</h2>
                <p className="mb-4 text-sm text-ink-muted">Poids maximal d&apos;un titre ou d&apos;un fonds dans votre portefeuille.</p>
                <div className="flex items-center gap-2">
                  <label htmlFor="maxPositionWeight" className="flex-1 text-sm font-semibold text-ink">Poids maximal</label>
                  <input
                    id="maxPositionWeight"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    inputMode="decimal"
                    autoComplete="off"
                    className={inputClass}
                    value={values.maxPositionWeight}
                    aria-invalid={!weightOk || undefined}
                    onChange={(e) => setForm({ ...values, maxPositionWeight: e.target.value === "" ? "" : Number(e.target.value) })}
                  />
                  <span className="text-sm text-ink-muted" aria-hidden="true">%</span>
                </div>
                {!weightOk && <p className="mt-2 text-sm text-warn">Entre 1 et 100 %.</p>}

                {email && (
                  <>
                    <Button className="mt-6 w-full" variant="accent" loading={saving} disabled={!dirty} onClick={save}>
                      Enregistrer ma stratégie
                    </Button>
                    {!totalOk && <p className="mt-2 text-xs text-ink-muted">Le total de l&apos;allocation doit faire 100 % pour enregistrer.</p>}
                    {!baseline.saved && totalOk && weightOk && (
                      <p className="mt-2 text-xs text-ink-muted">Valeurs proposées, pas encore enregistrées.</p>
                    )}
                  </>
                )}
              </Card>

              <Card as="section" aria-labelledby="next-title">
                <h2 id="next-title" className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Bientôt</h2>
                <ul className="space-y-2 text-sm text-ink">
                  <li>Écarts entre votre portefeuille et votre cible (zones, lignes, cash)</li>
                  <li>Où orienter vos prochains versements, montants à l&apos;appui</li>
                </ul>
                <p className="mt-4 text-xs text-ink-muted">
                  Outil d&apos;aide à la réflexion, pas un conseil en investissement : Nauticash ne recommande jamais l&apos;achat d&apos;un titre précis.
                </p>
              </Card>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
