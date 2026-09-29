"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";


// Mêmes règles que le backend (routes/auth.js)
const RULES = [
  { test: (p) => p.length >= 10, label: "10 caractères minimum" },
  { test: (p) => /[A-Z]/.test(p), label: "1 majuscule" },
  { test: (p) => /[a-z]/.test(p), label: "1 minuscule" },
  { test: (p) => /[0-9]/.test(p), label: "1 chiffre" },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: "1 caractère spécial" },
];

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [loading, setLoading] = useState(false);

  const allValid = RULES.every((r) => r.test(password));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!allValid) return setError("Le mot de passe ne respecte pas les règles.");
    if (password !== confirm) return setError("Les deux mots de passe ne correspondent pas.");

    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/reset-password", { method: "POST", body: { token, password }, auth: false });
      setDone(data.message);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-5">
        <div role="alert" className="bg-loss/10 border border-loss/30 rounded-lg p-3 text-sm text-loss">
          Lien invalide. Refaites une demande de réinitialisation.
        </div>
        <Link href="/forgot-password" className="block text-center text-sm font-semibold text-accent hover:text-accent">
          Mot de passe oublié
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div role="status" className="bg-accent/10 border border-accent/40 rounded-lg p-4 text-sm text-accent">
        {done} Redirection vers la connexion...
      </div>
    );
  }

  const inputClass =
    "w-full px-4 py-3 border border-line rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-ink mb-2">Nouveau mot de passe</label>
        <div className="relative">
          <input id="password" type={showPassword ? "text" : "password"} value={password}
            onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password"
            aria-invalid={error && !allValid ? true : undefined}
            aria-describedby={error && !allValid ? "reset-error password-rules" : "password-rules"}
            className={`${inputClass} pr-24`} />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            aria-pressed={showPassword} aria-controls="password confirm"
            aria-label={showPassword ? "Masquer les mots de passe" : "Afficher les mots de passe"}
            className="absolute inset-y-0 right-0 pr-3 text-sm text-ink-muted hover:text-ink">
            {showPassword ? "Masquer" : "Afficher"}
          </button>
        </div>
        <ul id="password-rules" aria-label="Règles du mot de passe" className="mt-2 grid grid-cols-2 gap-1 text-xs">
          {RULES.map((r) => (
            <li key={r.label} className={r.test(password) ? "text-accent" : "text-ink-muted/70"}>
              <span aria-hidden="true">{r.test(password) ? "✓" : "•"}</span>{" "}
              <span className="sr-only">{r.test(password) ? "Respectée : " : "Manquante : "}</span>
              {r.label}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label htmlFor="confirm" className="block text-sm font-semibold text-ink mb-2">Confirmer le mot de passe</label>
        <input id="confirm" type={showPassword ? "text" : "password"} value={confirm}
          onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password"
          aria-invalid={error && allValid && password !== confirm ? true : undefined}
          aria-describedby={error && allValid && password !== confirm ? "reset-error" : undefined}
          className={inputClass} />
      </div>

      {error && <div id="reset-error" role="alert" className="bg-loss/10 border border-loss/30 rounded-lg p-3 text-sm text-loss">{error}</div>}

      <button type="submit" disabled={loading}
        className="w-full py-3 px-4 bg-gradient-to-r from-emerald-700 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
        {loading ? "Enregistrement..." : "Changer le mot de passe"}
      </button>
    </form>
  );
}

export default function ResetPassword() {
  return (
    <main id="contenu" tabIndex={-1} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 dark:from-bg dark:via-bg dark:to-surface flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group mb-2">
            <img src="/logo_nauticash.webp?v=2" alt="Logo Nauticash" width={40} height={40}
              className="rounded-lg shadow-md group-hover:scale-110 transition-transform" />
            <span className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-emerald-600 to-blue-600 dark:from-white dark:via-emerald-300 dark:to-sky-300 bg-clip-text text-transparent">
              Nauticash
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-ink mt-6 mb-2">Nouveau mot de passe</h1>
          <p className="text-ink-muted">Choisissez un nouveau mot de passe pour votre compte.</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-xl border border-line p-8">
          <Suspense fallback={<p className="text-sm text-ink-muted">Chargement...</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-ink-muted hover:text-ink transition">← Retour à la connexion</Link>
        </div>
      </div>
    </main>
  );
}
