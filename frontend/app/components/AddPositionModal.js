"use client";

import { useId, useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { readNewPosition } from "../../lib/newPosition";

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent aria-[invalid=true]:border-loss";
const labelClass = "mb-1 block text-sm font-semibold text-ink";
const EMPTY = { quantity: "", pru: "", account: "" };

/**
 * Fenêtre « Ajouter une position » : ouverte après le choix d'un titre dans la recherche,
 * elle demande quantité, PRU et enveloppe pour ajouter la position en une seule fois.
 * onConfirm(ticker, { quantity, pru, account }) ; onCancel doit être stable (useCallback).
 * Le parent passe key={ticker} pour repartir d'un formulaire vierge à chaque titre.
 */
export default function AddPositionModal({ ticker, accounts, loading, onConfirm, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const id = useId();

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
  };

  const submit = (e) => {
    e.preventDefault();
    if (loading) return;
    const result = readNewPosition(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onConfirm(ticker, result.body);
  };

  const field = (name, label, hint, props) => (
    <div>
      <label htmlFor={`${id}-${name}`} className={labelClass}>{label}</label>
      <input
        id={`${id}-${name}`}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={inputClass}
        value={form[name]}
        onChange={set(name)}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={`${id}-${name}-hint`}
        {...props}
      />
      <p id={`${id}-${name}-hint`} className={errors[name] ? "mt-1 text-xs text-loss" : "mt-1 text-xs text-ink-muted"}>
        {errors[name] || hint}
      </p>
    </div>
  );

  return (
    <Modal open={Boolean(ticker)} onClose={onCancel} title={`Ajouter ${ticker || ""}`}>
      <form onSubmit={submit} noValidate className="mt-2 space-y-4">
        <p>Indiquez votre position ; chaque champ reste modifiable ensuite dans le tableau.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("quantity", "Quantité", "Nombre de titres détenus (ex. 10 ou 0,5).", { placeholder: "0" })}
          {field("pru", "PRU", "Prix de revient unitaire, dans la devise du titre.", { placeholder: "0,00" })}
        </div>
        <div>
          <label htmlFor={`${id}-account`} className={labelClass}>Enveloppe</label>
          <select
            id={`${id}-account`}
            className={inputClass}
            value={form.account}
            onChange={set("account")}
            aria-invalid={Boolean(errors.account)}
          >
            <option value="">Sans enveloppe</option>
            {Object.entries(accounts).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          {errors.account && <p className="mt-1 text-xs text-loss">{errors.account}</p>}
        </div>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Annuler</Button>
          <Button type="submit" loading={loading}>Ajouter au portefeuille</Button>
        </div>
      </form>
    </Modal>
  );
}
