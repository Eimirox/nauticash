"use client";

import { useEffect, useState } from "react";
import { Card, Button, useToast, applyTheme, cx } from "./ui";
import { apiFetch } from "@/lib/api";
import { setCachedProfile } from "@/lib/profile";
import { Avatar, AVATAR_COLORS, initialsOf } from "./Avatar";

export { Avatar, AVATAR_COLORS, initialsOf };

const COLOR_NAMES = {
  emerald: "Vert lagon", blue: "Bleu", teal: "Turquoise", indigo: "Indigo",
  amber: "Ambre", rose: "Rose", slate: "Ardoise",
};

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent";
const labelClass = "mb-2 block text-sm font-semibold text-ink";

function Choice({ name, value, current, onChange, children }) {
  const active = value === current;
  return (
    <label
      className={cx(
        "flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-medium transition",
        "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        active ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface text-ink-muted hover:text-ink"
      )}
    >
      <input type="radio" name={name} value={value} checked={active} onChange={() => onChange(value)} className="sr-only" />
      {children}
    </label>
  );
}

const HOME_PAGES = [
  ["/portfolio", "Portefeuille"],
  ["/analytics", "Vue d'ensemble"],
  ["/analytics/performance", "Performance"],
  ["/analytics/dividendes", "Dividendes"],
  ["/analytics/geographie", "Géographie"],
];

/**
 * Formulaire du profil : identité, affichage, objectifs.
 * Enregistre uniquement les champs modifiés (PATCH /api/user/profile).
 */
export default function ProfileForm({ onLoaded }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/api/user/profile")
      .then((data) => {
        setEmail(data.email);
        setSaved(data.profile);
        setForm(toForm(data.profile));
        onLoaded?.(data);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!form) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">{error ? `Profil indisponible : ${error}` : "Chargement du profil…"}</p>
      </Card>
    );
  }

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const changes = diff(saved, fromForm(form));
  const dirty = Object.keys(changes).length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!dirty) return;
    setError(null);
    setSaving(true);
    try {
      const data = await apiFetch("/api/user/profile", { method: "PATCH", body: changes });
      setSaved(data.profile);
      setForm(toForm(data.profile));
      if (changes.theme) applyTheme(data.profile.theme);
      setCachedProfile(data);
      onLoaded?.(data);
      toast.success("Profil enregistré.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6" aria-label="Profil" aria-describedby={error ? "profile-error" : undefined}>
      {/* Identité */}
      <Card as="section" aria-labelledby="identity-title">
        <h2 id="identity-title" className="mb-5 text-lg font-semibold">Identité</h2>
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={form.displayName} email={email} color={form.avatarColor} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{form.displayName || "Sans prénom"}</p>
            <p className="truncate text-sm text-ink-muted">{email}</p>
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <label htmlFor="displayName" className={labelClass}>Prénom ou pseudo</label>
            <input
              id="displayName"
              className={inputClass}
              maxLength={40}
              autoComplete="nickname"
              aria-describedby="displayName-hint"
              value={form.displayName}
              onChange={(e) => set("displayName")(e.target.value)}
              placeholder="Ex. Camille"
            />
            <p id="displayName-hint" className="mt-1 text-xs text-ink-muted">Affiché dans l&apos;en-tête, 40 caractères maximum.</p>
          </div>
          <fieldset>
            <legend className={labelClass}>Couleur de l'avatar</legend>
            <div className="flex flex-wrap gap-3">
              {Object.entries(AVATAR_COLORS).map(([key, cls]) => (
                <label key={key} className="cursor-pointer">
                  <input
                    type="radio"
                    name="avatarColor"
                    value={key}
                    checked={form.avatarColor === key}
                    onChange={() => set("avatarColor")(key)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cx(
                      "block h-9 w-9 rounded-full ring-offset-2 ring-offset-surface transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent",
                      cls,
                      form.avatarColor === key && "ring-2 ring-ink"
                    )}
                  />
                  <span className="sr-only">{COLOR_NAMES[key]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      {/* Affichage */}
      <Card as="section" aria-labelledby="display-title">
        <h2 id="display-title" className="mb-5 text-lg font-semibold">Affichage</h2>
        <div className="space-y-5">
          <fieldset>
            <legend className={labelClass}>Devise de référence</legend>
            <div className="grid grid-cols-4 gap-2">
              {["EUR", "USD", "GBP", "CHF"].map((c) => (
                <Choice key={c} name="baseCurrency" value={c} current={form.baseCurrency} onChange={set("baseCurrency")}>{c}</Choice>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className={labelClass}>Thème</legend>
            <div className="grid grid-cols-3 gap-2">
              <Choice name="theme" value="system" current={form.theme} onChange={set("theme")}>Automatique</Choice>
              <Choice name="theme" value="light" current={form.theme} onChange={set("theme")}>Clair</Choice>
              <Choice name="theme" value="dark" current={form.theme} onChange={set("theme")}>Sombre</Choice>
            </div>
          </fieldset>
          <label htmlFor="discreetMode" className="flex items-start justify-between gap-4 rounded-xl border border-line p-4">
            <span>
              <span className="block text-sm font-semibold">Mode discret</span>
              <span id="discreetMode-hint" className="block text-sm text-ink-muted">Masque les montants (les pourcentages restent visibles), pratique en public.</span>
            </span>
            <input
              id="discreetMode"
              type="checkbox"
              aria-describedby="discreetMode-hint"
              checked={form.discreetMode}
              onChange={(e) => set("discreetMode")(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-emerald-600"
            />
          </label>
          <div>
            <label htmlFor="homePage" className={labelClass}>Page d'accueil après connexion</label>
            <select id="homePage" className={inputClass} value={form.homePage} onChange={(e) => set("homePage")(e.target.value)}>
              {HOME_PAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Objectifs */}
      <Card as="section" aria-labelledby="goals-title">
        <h2 id="goals-title" className="mb-1 text-lg font-semibold">Objectifs</h2>
        <p className="mb-5 text-sm text-ink-muted">Facultatif. Sert à suivre votre progression, jamais à vous conseiller un placement.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="goalAmount" className={labelClass}>Objectif de patrimoine ({form.baseCurrency})</label>
            <input id="goalAmount" type="number" min="0" step="100" inputMode="decimal" className={inputClass} autoComplete="off"
              value={form.goalAmount} onChange={(e) => set("goalAmount")(e.target.value)} placeholder="Ex. 100000" />
          </div>
          <div>
            <label htmlFor="goalDate" className={labelClass}>Échéance</label>
            <input id="goalDate" type="date" className={inputClass} value={form.goalDate} onChange={(e) => set("goalDate")(e.target.value)} />
          </div>
          <div>
            <label htmlFor="horizon" className={labelClass}>Horizon de placement</label>
            <select id="horizon" className={inputClass} value={form.horizon} onChange={(e) => set("horizon")(e.target.value)}>
              <option value="">Non renseigné</option>
              <option value="court">Court terme (moins de 3 ans)</option>
              <option value="moyen">Moyen terme (3 à 8 ans)</option>
              <option value="long">Long terme (plus de 8 ans)</option>
            </select>
          </div>
          <div>
            <label htmlFor="riskProfile" className={labelClass}>Profil de risque</label>
            <select id="riskProfile" className={inputClass} value={form.riskProfile} onChange={(e) => set("riskProfile")(e.target.value)}>
              <option value="">Non renseigné</option>
              <option value="prudent">Prudent</option>
              <option value="equilibre">Équilibré</option>
              <option value="dynamique">Dynamique</option>
              <option value="offensif">Offensif</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="monthlyExpenses" className={labelClass}>Dépenses mensuelles ({form.baseCurrency})</label>
            <input id="monthlyExpenses" type="number" min="0" step="50" inputMode="decimal" className={inputClass}
              value={form.monthlyExpenses} onChange={(e) => set("monthlyExpenses")(e.target.value)}
              autoComplete="off" aria-describedby="monthlyExpenses-hint"
              placeholder="Ex. 2000" />
            <p id="monthlyExpenses-hint" className="mt-1 text-xs text-ink-muted">Sert à calculer votre fonds de précaution.</p>
          </div>
        </div>
      </Card>

      {error && <p id="profile-error" role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button type="submit" loading={saving} disabled={!dirty} className="shadow-lg">
          {dirty ? "Enregistrer le profil" : "Profil à jour"}
        </Button>
      </div>
    </form>
  );
}

// Le formulaire manipule des chaînes ; le backend attend nombres / null
function toForm(p) {
  return {
    ...p,
    goalAmount: p.goalAmount ?? "",
    goalDate: p.goalDate ?? "",
    horizon: p.horizon ?? "",
    riskProfile: p.riskProfile ?? "",
    monthlyExpenses: p.monthlyExpenses ?? "",
  };
}

function fromForm(f) {
  const num = (v) => (v === "" || v === null ? null : Number(v));
  return {
    ...f,
    displayName: f.displayName.trim(),
    goalAmount: num(f.goalAmount),
    goalDate: f.goalDate || null,
    horizon: f.horizon || null,
    riskProfile: f.riskProfile || null,
    monthlyExpenses: num(f.monthlyExpenses),
  };
}

function diff(saved, next) {
  const out = {};
  for (const [k, v] of Object.entries(next)) {
    if (saved?.[k] !== v) out[k] = v;
  }
  return out;
}
