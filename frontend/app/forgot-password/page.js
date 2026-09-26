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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group mb-2">
            <img src="/logo_nauticash.webp?v=2" alt="Logo Nauticash" width={40} height={40}
              className="rounded-lg shadow-md group-hover:scale-110 transition-transform" />
            <span className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-emerald-600 to-blue-600 bg-clip-text text-transparent">
              Nauticash
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-2">Mot de passe oublié</h1>
          <p className="text-slate-600">Entrez votre email, nous vous enverrons un lien pour le réinitialiser.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          {sent ? (
            <div className="space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
                {sent} Pensez à vérifier vos spams. Le lien est valable 1 heure.
              </div>
              <Link href="/login"
                className="block w-full text-center py-3 px-4 bg-gradient-to-r from-emerald-600 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemple.com" required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                {loading ? "Envoi..." : "Envoyer le lien"}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition">← Retour à la connexion</Link>
        </div>
      </div>
    </main>
  );
}
