"use client";

import { useCallback, useId, useRef, useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { apiFetch } from "../../lib/api";
import { parsePositionsCsv, importOutcome, summarizeImport, CSV_TEMPLATE, CSV_MAX_ROWS } from "../../lib/csvImport";

const MAX_FILE_BYTES = 1024 * 1024;
const numberFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 6 });

// Statut d'une ligne envoyée : symbole + texte (la couleur n'est jamais le seul indicateur)
const STATUS = {
  added: { icon: "✓", label: "Ajouté", className: "text-gain" },
  notFound: { icon: "?", label: "Introuvable", className: "text-warn" },
  error: { icon: "✕", label: "Erreur", className: "text-loss" },
};

function downloadTemplate() {
  // BOM pour qu'Excel lise les accents en UTF-8
  const blob = new Blob(["﻿" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "nauticash-modele-import.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Fenêtre « Importer un CSV » : choix du fichier, modèle à télécharger, aperçu (lignes valides
 * et erreurs par ligne), puis ajout ligne par ligne via le POST /api/user/portfolio existant.
 * existing : tickers déjà détenus ; onClose(importedCount) doit être stable (useCallback).
 * Le parent recharge le portefeuille si importedCount > 0.
 */
export default function ImportCsvModal({ open, existing, accounts, onClose }) {
  const id = useId();
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null); // résultat de parsePositionsCsv
  const [phase, setPhase] = useState("pick"); // pick | running | done
  const [results, setResults] = useState([]); // [{ line, ticker, status, message }]
  const stopRef = useRef(false);
  const runningRef = useRef(false);
  const addedRef = useRef(0);

  // Stable (le Modal réinstalle son piège à focus quand onClose change)
  const close = useCallback(() => {
    if (runningRef.current) return; // pas de fermeture pendant l'envoi (utiliser « Arrêter »)
    const added = addedRef.current;
    addedRef.current = 0;
    setFileName("");
    setParsed(null);
    setPhase("pick");
    setResults([]);
    onClose(added);
  }, [onClose]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de rechoisir le même fichier après correction
    if (!file) return;
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setParsed({ ok: false, error: "Fichier trop volumineux (1 Mo maximum)." });
      return;
    }
    try {
      setParsed(parsePositionsCsv(await file.text(), { existing }));
    } catch {
      setParsed({ ok: false, error: "Impossible de lire ce fichier." });
    }
  };

  const runImport = async () => {
    if (!parsed?.ok || !parsed.rows.length || runningRef.current) return;
    runningRef.current = true;
    stopRef.current = false;
    setPhase("running");
    setResults([]);
    for (const row of parsed.rows) {
      if (stopRef.current) break;
      let error = null;
      try {
        await apiFetch("/api/user/portfolio", {
          method: "POST",
          body: { ticker: row.ticker, quantity: row.quantity, pru: row.pru, account: row.account },
        });
      } catch (err) {
        error = err;
      }
      const outcome = importOutcome(error);
      if (outcome.status === "added") addedRef.current += 1;
      setResults((prev) => [...prev, { line: row.line, ticker: row.ticker, ...outcome }]);
      if (error?.status === 401) break; // session expirée : apiFetch redirige déjà vers /login
    }
    runningRef.current = false;
    setPhase("done");
  };

  const counts = summarizeImport(results);
  const rows = parsed?.ok ? parsed.rows : [];
  const errors = parsed?.ok ? parsed.errors : [];
  const running = phase === "running";

  return (
    <Modal open={open} onClose={close} title="Importer des positions (CSV)" wide>
      {phase === "pick" ? (
        <div className="mt-2 space-y-4">
          <p>
            Une ligne par position : <strong className="text-ink">ticker</strong> et{" "}
            <strong className="text-ink">quantité</strong> obligatoires, PRU et enveloppe facultatifs
            ({Object.keys(accounts).join(", ")}). Séparateur « ; », « , » ou tabulation ; {CSV_MAX_ROWS} lignes au maximum.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor={`${id}-file`}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent transition hover:brightness-110 focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-bg sm:min-h-10"
            >
              Choisir un fichier…
              <input
                id={`${id}-file`}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="sr-only"
                onChange={onFile}
              />
            </label>
            <Button variant="ghost" onClick={downloadTemplate}>Télécharger le modèle</Button>
            {fileName && <span className="text-xs text-ink-muted break-all">{fileName}</span>}
          </div>

          <div aria-live="polite">
            {parsed && !parsed.ok && <p className="rounded-xl border border-loss/30 bg-loss/10 p-3 text-loss">{parsed.error}</p>}
            {parsed?.ok && (
              <div className="space-y-3">
                <p className="text-ink">
                  {rows.length} position{rows.length > 1 ? "s" : ""} prête{rows.length > 1 ? "s" : ""} à importer
                  {errors.length > 0 && `, ${errors.length} ligne${errors.length > 1 ? "s" : ""} ignorée${errors.length > 1 ? "s" : ""}`}.
                </p>
                {rows.length > 0 && (
                  <div className="max-h-56 overflow-auto rounded-xl border border-line">
                    <table className="w-full text-left text-xs">
                      <caption className="sr-only">Aperçu des positions valides</caption>
                      <thead className="sticky top-0 bg-surface-2 text-ink">
                        <tr>
                          <th scope="col" className="px-3 py-2">Ligne</th>
                          <th scope="col" className="px-3 py-2">Ticker</th>
                          <th scope="col" className="px-3 py-2 text-right">Quantité</th>
                          <th scope="col" className="px-3 py-2 text-right">PRU</th>
                          <th scope="col" className="px-3 py-2">Enveloppe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {rows.map((r) => (
                          <tr key={r.line}>
                            <td className="px-3 py-1.5">{r.line}</td>
                            <td className="px-3 py-1.5 font-semibold text-ink">{r.ticker}</td>
                            <td className="money px-3 py-1.5 text-right">{numberFmt.format(r.quantity)}</td>
                            <td className="px-3 py-1.5 text-right">{r.pru ? numberFmt.format(r.pru) : "—"}</td>
                            <td className="px-3 py-1.5">{r.account ? accounts[r.account] || r.account : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {errors.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold text-ink">Lignes ignorées</p>
                    <ul className="max-h-40 space-y-1 overflow-auto rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs">
                      {errors.map((err) => (
                        <li key={err.line}>
                          <span className="font-semibold text-ink">Ligne {err.line}{err.ticker ? ` (${err.ticker})` : ""} :</span>{" "}
                          {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={close}>Annuler</Button>
            <Button variant="accent" onClick={runImport} disabled={!rows.length}>
              {rows.length ? `Importer ${rows.length} position${rows.length > 1 ? "s" : ""}` : "Importer"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-4">
          <p className="text-ink" role="status">
            {running
              ? `Import en cours… ${results.length} / ${rows.length}`
              : `Import terminé : ${counts.added} ajoutée${counts.added > 1 ? "s" : ""}, ${counts.notFound} introuvable${counts.notFound > 1 ? "s" : ""}, ${counts.error} en erreur${
                  counts.total < rows.length ? ` (arrêté après ${counts.total} sur ${rows.length})` : ""
                }.`}
          </p>
          {running && (
            <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <div className="h-full bg-accent transition-all" style={{ width: `${(results.length / rows.length) * 100}%` }} />
            </div>
          )}
          <ul className="max-h-64 divide-y divide-line overflow-auto rounded-xl border border-line text-xs">
            {results.map((r) => {
              const s = STATUS[r.status];
              return (
                <li key={r.line} className="flex items-start gap-3 px-3 py-2">
                  <span className={`w-24 shrink-0 font-semibold ${s.className}`}>
                    <span aria-hidden="true">{s.icon}</span> {s.label}
                  </span>
                  <span className="w-20 shrink-0 font-semibold text-ink">{r.ticker}</span>
                  <span className="min-w-0">
                    Ligne {r.line}
                    {r.status !== "added" && ` : ${r.message}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            {running ? (
              <Button variant="secondary" onClick={() => (stopRef.current = true)}>Arrêter après cette ligne</Button>
            ) : (
              <Button variant="accent" onClick={close}>Fermer</Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
