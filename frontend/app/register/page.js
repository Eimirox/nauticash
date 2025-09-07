"use client";
// [ALEX-REGISTER-000] Page d'inscription avec validation "propre"

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const passwordRules = [
  { id: "len", test: (s) => s.length >= 10, label: "Au moins 10 caractères" },
  { id: "upper", test: (s) => /[A-Z]/.test(s), label: "Une majuscule (A-Z)" },
  { id: "lower", test: (s) => /[a-z]/.test(s), label: "Une minuscule (a-z)" },
  { id: "digit", test: (s) => /[0-9]/.test(s), label: "Un chiffre (0-9)" },
  { id: "special", test: (s) => /[^A-Za-z0-9]/.test(s), label: "Un caractère spécial" },
];

function computeStrength(pw) {
  const passed = passwordRules.reduce((acc, r) => acc + (r.test(pw) ? 1 : 0), 0);
  return Math.round((passed / passwordRules.length) * 100);
}

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [accepted, setAccepted] = useState(true); // mets à false si tu veux forcer l’acceptation CGU
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => computeStrength(password), [password]);
  const allRulesOk = useMemo(
    () => passwordRules.every((r) => r.test(password)),
    [password]
  );

  const canSubmit =
    email &&
    allRulesOk &&
    password === confirm &&
    accepted &&
    !loading;

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;

    try {
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000"}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Impossible de créer le compte");

      // Option : auto-login après inscription
      localStorage.setItem("token", data.token);
      router.push("/portfolio");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Créer un compte</h1>

      <form onSubmit={handleRegister} className="space-y-4" noValidate>
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            placeholder="email@exemple.com"
            className="w-full border rounded p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Mot de passe</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              placeholder="Mot de passe"
              className="w-full border rounded p-2 pr-16"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm underline"
              onClick={() => setShowPw((s) => !s)}
            >
              {showPw ? "Masquer" : "Afficher"}
            </button>
          </div>

          {/* Barre de force */}
          <div className="mt-2">
            <div className="h-2 w-full bg-gray-200 rounded">
              <div
                className="h-2 rounded"
                style={{
                  width: `${strength}%`,
                  background:
                    strength < 40 ? "#ef4444" : strength < 80 ? "#f59e0b" : "#10b981",
                }}
              />
            </div>
            <p className="text-xs mt-1 text-gray-600">
              Force du mot de passe : {strength}%
            </p>
          </div>

          {/* Règles */}
          <ul className="mt-2 text-sm space-y-1">
            {passwordRules.map((r) => {
              const ok = r.test(password);
              return (
                <li key={r.id} className={ok ? "text-green-600" : "text-gray-600"}>
                  {ok ? "✓" : "•"} {r.label}
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <label className="block text-sm mb-1">Confirmer le mot de passe</label>
          <input
            type="password"
            placeholder="Répéter le mot de passe"
            className="w-full border rounded p-2"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
          {confirm && confirm !== password && (
            <p className="text-xs text-red-600 mt-1">Les mots de passe ne correspondent pas.</p>
          )}
        </div>

        {/* CGU/Privacy si besoin */}
        <div className="flex items-center gap-2">
          <input
            id="accept"
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <label htmlFor="accept" className="text-sm">
            J’accepte les conditions d’utilisation
          </label>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full rounded py-2 text-white ${canSubmit ? "bg-black" : "bg-gray-400 cursor-not-allowed"}`}
        >
          {loading ? "Création..." : "Créer mon compte"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <span className="text-sm">Déjà un compte ? </span>
        <Link href="/login" className="text-blue-600 hover:underline">
          Se connecter
        </Link>
      </div>
    </main>
  );
}
