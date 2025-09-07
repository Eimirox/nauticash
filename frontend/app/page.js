"use client"; // Pour Next.js 13+ en app router

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [language, setLanguage] = useState("FR");

  return (
    <main className="flex flex-col min-h-screen bg-gray-100 text-gray-900">
      {/* HEADER */}
      <header className="w-full flex justify-between items-center p-4 bg-white shadow-md">
        {/* Bouton de Langue à gauche */}
        <button
          className="text-gray-700 text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-200"
          onClick={() => setLanguage(language === "FR" ? "EN" : "FR")}
        >
          🌍 {language}
        </button>

        {/* Boutons Connexion & Inscription à droite */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push("/login")}
            className="text-gray-700 text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-200"
          >
            Connexion
          </button>

          {/* [ALEX-HOME-REGISTER] CTA vers /register (au lieu de /signup) */}
          <button
            onClick={() => router.push("/register")}
            className="text-sm px-4 py-2 bg-[#1E3A8A] text-white rounded-lg hover:bg-[#3B82F6] transition"
          >
            Créer un compte
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <div className="flex flex-col items-center justify-center flex-grow p-10 text-center">
        <h1 className="text-5xl font-bold text-[#1E3A8A] mb-6">
          Gérez votre portefeuille boursier 📈
        </h1>
        <p className="text-lg text-gray-700">
          Suivez vos investissements en temps réel, optimisez votre rentabilité et accédez à des analyses avancées.
        </p>

        {/* Call-To-Action */}
        <div className="mt-6">
          <button
            onClick={() => router.push("/portfolio")}
            className="px-6 py-3 bg-[#1E3A8A] text-white text-lg font-semibold rounded-lg hover:bg-[#3B82F6] transition"
          >
            Accéder à mon portefeuille 🚀
          </button>
        </div>
      </div>
    </main>
  );
}
