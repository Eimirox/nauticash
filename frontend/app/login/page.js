"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await apiFetch("/api/auth/login", { method: "POST", body: { email, password }, auth: false });

      localStorage.setItem("token", data.token);
      router.push("/portfolio");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="contenu" tabIndex={-1} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 dark:from-bg dark:via-bg dark:to-surface flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group mb-2">
            <img
              src="/logo_nauticash.webp?v=2"
              alt="Logo Nauticash"
              width={40}
              height={40}
              className="rounded-lg shadow-md group-hover:scale-110 transition-transform"
            />
            <span className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-emerald-600 to-blue-600 dark:from-white dark:via-emerald-300 dark:to-sky-300 bg-clip-text text-transparent">
              Nauticash
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-ink mt-6 mb-2">
            Bon retour !
          </h1>
          <p className="text-ink-muted">
            Connectez-vous pour accéder à votre portefeuille
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-xl border border-line p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-ink mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg aria-hidden="true" className="h-5 w-5 text-ink-muted/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemple.com"
                  autoComplete="email"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className="w-full pl-10 pr-4 py-3 border border-line rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-ink mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg aria-hidden="true" className="h-5 w-5 text-ink-muted/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className="w-full pl-10 pr-12 py-3 border border-line rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-muted/70 hover:text-ink-muted transition"
                >
                  {showPassword ? (
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="flex items-center justify-end">
              <Link href="/forgot-password" className="text-sm font-medium text-accent hover:text-accent transition">
                Mot de passe oublié ?
              </Link>
            </div>

            {/* Error Message */}
            {error && (
              <div id="login-error" role="alert" className="bg-loss/10 border border-loss/30 rounded-lg p-3 flex items-start gap-2">
                <svg aria-hidden="true" className="w-5 h-5 text-loss mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-loss">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-700 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg aria-hidden="true" className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Connexion...
                </span>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface text-ink-muted">ou</span>
            </div>
          </div>

          {/* Sign up link */}
          <div className="text-center">
            <span className="text-sm text-ink-muted">Pas encore de compte ? </span>
            <Link
              href="/register"
              className="text-sm font-semibold text-accent hover:text-accent transition"
            >
              Créer un compte
            </Link>
          </div>
        </div>

        {/* Back to home */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition"
          >
            <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </main>
  );
}