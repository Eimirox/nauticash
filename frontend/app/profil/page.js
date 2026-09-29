"use client";

import { useState } from "react";
import AppHeader from "../components/AppHeader";
import ProfileForm from "../components/ProfileForm";
import { Card, Button, ConfirmModal, useToast } from "../components/ui";
import { apiFetch, apiDownload, logout } from "@/lib/api";

// Mêmes règles que le backend (routes/auth.js)
const RULES = [
  { test: (p) => p.length >= 10, label: "10 caractères minimum" },
  { test: (p) => /[A-Z]/.test(p), label: "1 majuscule" },
  { test: (p) => /[a-z]/.test(p), label: "1 minuscule" },
  { test: (p) => /[0-9]/.test(p), label: "1 chiffre" },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: "1 caractère spécial" },
];

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent";

function Field({ id, label, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink">{label}</label>
      <input id={id} className={inputClass} {...props} />
    </div>
  );
}

export default function MonProfil() {
  const toast = useToast();
  const [email, setEmail] = useState("");

  // Changement de mot de passe
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwError, setPwError] = useState(null);

  // Export des données (RGPD)
  const [exporting, setExporting] = useState(null);

  const exportData = async (kind) => {
    const day = new Date().toISOString().slice(0, 10);
    const files = {
      json: ["/api/user/export?format=json", `nauticash-export-${day}.json`],
      positions: ["/api/user/export?format=csv&dataset=positions", `nauticash-positions-${day}.csv`],
      history: ["/api/user/export?format=csv&dataset=history", `nauticash-historique-${day}.csv`],
    };
    setExporting(kind);
    try {
      await apiDownload(...files[kind]);
      toast.success("Export téléchargé.");
    } catch (err) {
      if (err.status !== 401) toast.error(err.message);
    } finally {
      setExporting(null);
    }
  };

  // Suppression du compte
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);


  const allValid = RULES.every((r) => r.test(next));

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError(null);
    if (!allValid) return setPwError("Le nouveau mot de passe ne respecte pas les règles.");
    if (next !== confirm) return setPwError("Les deux nouveaux mots de passe ne correspondent pas.");
    setSaving(true);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword: current, password: next },
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Mot de passe modifié.");
    } catch (err) {
      setPwError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await apiFetch("/api/auth/account", { method: "DELETE", body: { currentPassword: deletePassword } });
      toast.success("Compte supprimé. À bientôt !");
      setTimeout(logout, 1200);
    } catch (err) {
      toast.error(err.message);
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg text-ink">
      <AppHeader />

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">Mon profil</h1>
          <p className="text-ink-muted">
            Connecté avec <span className="font-semibold text-ink">{email || "…"}</span>
          </p>
        </div>

        <ProfileForm onLoaded={(data) => setEmail(data.email)} />

        <h2 className="pt-6 text-xl font-semibold">Sécurité et compte</h2>

        <Card as="section" aria-labelledby="pw-title">
          <h2 id="pw-title" className="mb-1 text-lg font-semibold">Changer de mot de passe</h2>
          <p className="mb-5 text-sm text-ink-muted">Vous devrez utiliser le nouveau mot de passe à votre prochaine connexion.</p>

          <form onSubmit={changePassword} className="space-y-4">
            <Field
              id="current"
              label="Mot de passe actuel"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              aria-invalid={pwError ? true : undefined}
              aria-describedby={pwError ? "pw-error" : undefined}
              required
            />
            <div>
              <Field
                id="new"
                label="Nouveau mot de passe"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                aria-invalid={pwError ? true : undefined}
                aria-describedby={pwError ? "new-rules pw-error" : "new-rules"}
                required
              />
              <p id="new-rules" className="sr-only">
                Le mot de passe doit contenir au moins 10 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-1 text-xs" aria-label="Règles du nouveau mot de passe">
                {RULES.map((r) => {
                  const ok = r.test(next);
                  return (
                    <li key={r.label} className={ok ? "text-gain" : "text-ink-muted"}>
                      <span aria-hidden="true">{ok ? "✓" : "•"}</span>{" "}
                      <span className="sr-only">{ok ? "Respectée : " : "Manquante : "}</span>
                      {r.label}
                    </li>
                  );
                })}
              </ul>
            </div>
            <Field
              id="confirm"
              label="Confirmer le nouveau mot de passe"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={pwError || (confirm && confirm !== next) ? true : undefined}
              aria-describedby={pwError ? "pw-error" : undefined}
              required
            />
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} aria-controls="current new confirm" className="h-4 w-4 accent-emerald-600" />
              Afficher les mots de passe
            </label>

            {pwError && (
              <p id="pw-error" role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{pwError}</p>
            )}

            <Button type="submit" loading={saving} className="w-full sm:w-auto">Enregistrer le mot de passe</Button>
          </form>
        </Card>

        <Card as="section" aria-labelledby="export-title">
          <h2 id="export-title" className="mb-1 text-lg font-semibold">Exporter mes données</h2>
          <p className="mb-5 text-sm text-ink-muted">
            Téléchargez une copie de vos données : profil, positions, cash, historique de valeur et transactions.
            Le fichier JSON contient tout ; les CSV s&apos;ouvrent directement dans un tableur.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap" aria-busy={Boolean(exporting)}>
            <Button variant="secondary" loading={exporting === "json"} disabled={Boolean(exporting)} onClick={() => exportData("json")}>
              Tout exporter (JSON)
            </Button>
            <Button variant="secondary" loading={exporting === "positions"} disabled={Boolean(exporting)} onClick={() => exportData("positions")}>
              Positions et cash (CSV)
            </Button>
            <Button variant="secondary" loading={exporting === "history"} disabled={Boolean(exporting)} onClick={() => exportData("history")}>
              Historique quotidien (CSV)
            </Button>
          </div>
        </Card>

        <Card as="section" aria-labelledby="delete-title" className="border-loss/30">
          <h2 id="delete-title" className="mb-1 text-lg font-semibold text-loss">Supprimer mon compte</h2>
          <p id="delete-warning" className="mb-5 text-sm text-ink-muted">
            Votre compte, votre portefeuille, votre cash et votre historique seront effacés définitivement. Cette action est irréversible.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (deletePassword) setConfirmOpen(true);
            }}
            className="space-y-4"
            aria-describedby="delete-warning"
          >
            <Field
              id="delete-password"
              label="Mot de passe (pour confirmer)"
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
            />
            <Button type="submit" variant="danger" disabled={!deletePassword}>Supprimer mon compte</Button>
          </form>
        </Card>
      </div>

      <ConfirmModal
        open={confirmOpen}
        danger
        title="Supprimer définitivement votre compte ?"
        message="Toutes vos données Nauticash seront effacées. Vous ne pourrez pas les récupérer."
        confirmLabel="Oui, supprimer"
        loading={deleting}
        onConfirm={deleteAccount}
        onCancel={() => !deleting && setConfirmOpen(false)}
      />
    </main>
  );
}
