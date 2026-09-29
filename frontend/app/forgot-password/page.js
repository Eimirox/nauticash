"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";


export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await apiFetch("/api/auth/forgot-password", { method: "POST", body: { email }, auth: false });
      setSent(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-ink mt-6 mb-2">Mot de passe oublié</h1>
          <p className="text-ink-muted">Entrez votre email, nous vous enverrons un lien pour le réinitialiser.</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-xl border border-line p-8">
          {sent ? (
            <div className="space-y-5">
              <div role="status" className="bg-accent/10 border border-accent/40 rounded-lg p-4 text-sm text-accent">
                {sent} Pensez à vérifier vos spams. Le lien est valable 1 heure.
              </div>
              <Link href="/login"
                className="block w-full text-center py-3 px-4 bg-gradient-to-r from-emerald-700 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-ink mb-2">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemple.com" required autoComplete="email"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "forgot-error" : undefined}
                  className="w-full px-4 py-3 border border-line rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all" />
              </div>

              {error && (
                <div id="forgot-error" role="alert" className="bg-loss/10 border border-loss/30 rounded-lg p-3 text-sm text-loss">{error}</div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-700 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                {loading ? "Envoi..." : "Envoyer le lien"}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-ink-muted hover:text-ink transition">← Retour à la connexion</Link>
        </div>
      </div>
    </main>
  );
}
