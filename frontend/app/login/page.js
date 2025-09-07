"use client"; 
// Permet d'utiliser des hooks dans Next.js 13+

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; // [ALEX-LOGIN-002] import pour le lien vers /register

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Erreur de connexion");
      }

      // Stocker le token JWT dans le localStorage
      localStorage.setItem("token", data.token);

      // 🔀 Rediriger l'utilisateur vers la page du portefeuille
      router.push("/portfolio");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Connexion</h1>

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full border rounded p-2"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          className="w-full border rounded p-2"
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          className="w-full rounded bg-black text-white py-2"
        >
          Se connecter
        </button>
      </form>

      {/* [ALEX-LOGIN-002] Ajout du lien vers la page d'inscription */}
      <div className="mt-4 text-center">
        <span className="text-sm">Pas de compte ? </span>
        <Link href="/register" className="text-blue-600 hover:underline">
          Créer un compte
        </Link>
      </div>

      {/* [ALEX-LOGIN-BACK] Lien retour à l’accueil */}
      <div className="mt-2 text-center">
        <Link href="/" className="text-sm text-gray-600 hover:underline">
          ← Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
