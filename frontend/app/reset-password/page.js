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
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Lien invalide. Refaites une demande de réinitialisation.
        </div>
        <Link href="/forgot-password" className="block text-center text-sm font-semibold text-emerald-600 hover:text-emerald-700">
          Mot de passe oublié
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
        {done} Redirection vers la connexion...
      </div>
    );
  }

  const inputClass =
    "w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">Nouveau mot de passe</label>
        <div className="relative">
          <input id="password" type={showPassword ? "text" : "password"} value={password}
            onChange={(e) => setPassword(e.target.value)} required className={`${inputClass} pr-24`} />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 text-sm text-slate-500 hover:text-slate-700">
            {showPassword ? "Masquer" : "Afficher"}
          </button>
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
          {RULES.map((r) => (
            <li key={r.label} className={r.test(password) ? "text-emerald-600" : "text-slate-400"}>
              {r.test(password) ? "✓" : "•"} {r.label}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label htmlFor="confirm" className="block text-sm font-semibold text-slate-700 mb-2">Confirmer le mot de passe</label>
        <input id="confirm" type={showPassword ? "text" : "password"} value={confirm}
          onChange={(e) => setConfirm(e.target.value)} required className={inputClass} />
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

      <button type="submit" disabled={loading}
        className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
        {loading ? "Enregistrement..." : "Changer le mot de passe"}
      </button>
    </form>
  );
}

export default function ResetPassword() {
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
          <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-2">Nouveau mot de passe</h1>
          <p className="text-slate-600">Choisissez un nouveau mot de passe pour votre compte.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <Suspense fallback={<p className="text-sm text-slate-500">Chargement...</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition">← Retour à la connexion</Link>
        </div>
      </div>
    </main>
  );
}
