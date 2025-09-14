"use client"; // [ALEX-HOME] Landing "océan" – Next.js App Router

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [language, setLanguage] = useState("FR");

  // [ALEX-HOME-i18n] Mini dictionnaire FR/EN (évolutif)
  const t = {
    title: {
      FR: "Gérez votre portefeuille boursier",
      EN: "Manage your investment portfolio",
    },
    subtitle: {
      FR: "Suivez, analysez et optimisez en toute simplicité.",
      EN: "Track, analyze and optimize effortlessly.",
    },
    ctaPrimary: { FR: "Accéder à mon portefeuille 🚀", EN: "Open my portfolio 🚀" },
    ctaSecondary: { FR: "Créer un compte", EN: "Create account" },
    featuresTitle: { FR: "Tout pour piloter vos investissements", EN: "Everything to pilot your investments" },
    feature1: { FR: "Vue globale multi-devises", EN: "Global view, multi-currency" },
    feature1Desc: { FR: "Cash + actions + ETF + crypto en un seul endroit.", EN: "Cash + stocks + ETFs + crypto in one place." },
    feature2: { FR: "Tri et filtres pro", EN: "Pro sorting & filters" },
    feature2Desc: { FR: "Prix, performance, dividendes, rendement, total.", EN: "Price, performance, dividends, yield, total." },
    feature3: { FR: "Analytique claire", EN: "Clear analytics" },
    feature3Desc: { FR: "KPIs, cartes, et bientôt DCF & alertes.", EN: "KPIs, cards, and soon DCF & alerts." },
    previewTitle: { FR: "Aperçu produit", EN: "Product preview" },
    previewDesc: {
      FR: "Un tableau épuré, rapide, et pensé pour vos décisions.",
      EN: "A clean, fast table—built for decision making.",
    },
    finalCtaTitle: { FR: "Prêt à embarquer ?", EN: "Ready to set sail?" },
    finalCtaDesc: { FR: "Créez votre compte et suivez la houle des marchés.", EN: "Create your account and surf the market waves." },
    login: { FR: "Connexion", EN: "Log in" },
    brand: { FR: "Nauticash", EN: "Nauticash" },
  };

  return (
    <main className="flex flex-col min-h-screen bg-gray-50 text-gray-900">
      {/* [ALEX-HOME-HEADER] Header style Finary */}
      <header className="w-full sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-white/60">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Brand à gauche */}
          <div
            className="text-[#0b5bd3] font-extrabold tracking-tight text-xl cursor-pointer"
            onClick={() => router.push("/")}
          >
            {t.brand[language]}
          </div>

          {/* Actions à droite : Langue → Connexion → Créer un compte */}
          <div className="flex items-center gap-3">
            <button
              className="text-gray-700 text-sm px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-100"
              onClick={() => setLanguage(language === "FR" ? "EN" : "FR")}
              aria-label="Changer de langue"
              title="Changer de langue"
            >
              🌊 {language}
            </button>
            <button
              onClick={() => router.push("/login")}
              className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100"
            >
              {t.login[language]}
            </button>
            <button
              onClick={() => router.push("/register")}
              className="text-sm px-4 py-2 rounded-lg bg-[#0b5bd3] text-white hover:bg-[#3B82F6] transition"
            >
              {t.ctaSecondary[language]}
            </button>
          </div>
        </div>
      </header>

      {/* [ALEX-HOME-HERO] Océan / dégradé + vagues */}
      <section className="relative isolate overflow-hidden">
        {/* Dégradé océan */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b5bd3] via-[#0e86ff] to-[#7cc6ff]" />
        {/* Gloss doux */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[28rem] w-[64rem] opacity-20"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(255,255,255,0.60) 0%, rgba(255,255,255,0.05) 60%, transparent 100%)",
            filter: "blur(30px)",
          }}
        />
        {/* Contenu hero */}
        <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-32 text-center text-white">
          <span className="inline-flex items-center gap-2 text-xs md:text-sm px-3 py-1 rounded-full bg-white/15 ring-1 ring-white/30">
            <span>🌐 MVP en cours</span>
            <span className="opacity-70">•</span>
            <span>UI “Ocean”</span>
          </span>

          <h1 className="mt-5 text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
            {t.title[language]} <span className="opacity-90">📈</span>
          </h1>
          <p className="mt-4 md:mt-5 text-base md:text-lg text-white/90">
            {t.subtitle[language]}
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => router.push("/portfolio")}
              className="px-6 py-3 bg-white text-[#0b5bd3] font-semibold rounded-xl shadow hover:shadow-md transition"
            >
              {t.ctaPrimary[language]}
            </button>
            <button
              onClick={() => router.push("/register")}
              className="px-6 py-3 bg-[#0b5bd3]/20 text-white font-semibold rounded-xl ring-1 ring-white/40 hover:bg-[#0b5bd3]/30 transition"
            >
              {t.ctaSecondary[language]}
            </button>
          </div>
        </div>

        {/* Vague décorative bas */}
        <Waves />
      </section>

      {/* [ALEX-HOME-FEATURES] */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <h2 className="text-2xl md:text-3xl font-bold text-[#0b5bd3] mb-6">
          {t.featuresTitle[language]}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon="🌍"
            title={t.feature1[language]}
            desc={t.feature1Desc[language]}
          />
          <FeatureCard
            icon="🧭"
            title={t.feature2[language]}
            desc={t.feature2Desc[language]}
          />
          <FeatureCard
            icon="📊"
            title={t.feature3[language]}
            desc={t.feature3Desc[language]}
          />
        </div>
      </section>

      {/* [ALEX-HOME-PREVIEW] */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="rounded-2xl border bg-white shadow-sm p-6 md:p-8">
          <div className="flex flex-col lg:flex-row items-start gap-8">
            <div className="flex-1">
              <h3 className="text-xl md:text-2xl font-semibold text-gray-900">
                {t.previewTitle[language]}
              </h3>
              <p className="mt-2 text-gray-600">
                {t.previewDesc[language]}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Badge>🔒 Auth sécurisée (JWT)</Badge>
                <Badge>⚡ Tri multi-colonnes</Badge>
                <Badge>💼 Cash intégré</Badge>
                <Badge>🧩 MVP modulaire</Badge>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => router.push("/portfolio")}
                  className="px-5 py-2.5 bg-[#0b5bd3] text-white rounded-lg hover:bg-[#3B82F6] transition"
                >
                  Demo Portfolio
                </button>
                <button
                  onClick={() => router.push("/login")}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                >
                  {t.login[language]}
                </button>
              </div>
            </div>

            {/* Mock écran produit */}
            <div className="flex-1 w-full">
              <div className="relative rounded-xl border bg-white shadow overflow-hidden">
                {/* barre fenêtre */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                  <span className="ml-2 text-xs text-gray-500">/portfolio</span>
                </div>
                {/* contenu simplifié */}
                <div className="p-4">
                  <div className="h-7 w-44 bg-blue-100 rounded mb-3" />
                  <div className="grid grid-cols-5 gap-2 text-xs text-gray-500 mb-2">
                    {["Ticker","Prix","Quantité","Perf","Total"].map((h) => (
                      <div key={h} className="px-2 py-1 bg-gray-50 rounded border">{h}</div>
                    ))}
                  </div>
                  {[...Array(5)].map((_,i) => (
                    <div key={i} className="grid grid-cols-5 gap-2 mb-2">
                      <div className="h-6 bg-gray-100 rounded" />
                      <div className="h-6 bg-gray-100 rounded" />
                      <div className="h-6 bg-gray-100 rounded" />
                      <div className="h-6 bg-gray-100 rounded" />
                      <div className="h-6 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Illustration – l’interface réelle est dynamique et triable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* [ALEX-HOME-CTA] */}
      <section className="relative">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#7cc6ff] via-[#b0e1ff] to-white" />
        <div className="max-w-6xl mx-auto px-4 py-14 text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-[#0b5bd3]">{t.finalCtaTitle[language]}</h3>
          <p className="mt-2 text-gray-600">{t.finalCtaDesc[language]}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => router.push("/register")}
              className="px-6 py-3 bg-[#0b5bd3] text-white font-semibold rounded-xl shadow hover:bg-[#3B82F6] transition"
            >
              {t.ctaSecondary[language]}
            </button>
            <button
              onClick={() => router.push("/login")}
              className="px-6 py-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition"
            >
              {t.login[language]}
            </button>
          </div>
        </div>
      </section>

      {/* [ALEX-HOME-FOOTER] */}
      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6 text-sm flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-gray-500">© {new Date().getFullYear()} {t.brand[language]}. All rights reserved.</p>
          <div className="flex items-center gap-4 text-gray-500">
            <a className="hover:text-gray-700" href="#" onClick={(e)=>e.preventDefault()}>Confidentialité</a>
            <a className="hover:text-gray-700" href="#" onClick={(e)=>e.preventDefault()}>CGU</a>
            <a className="hover:text-gray-700" href="#" onClick={(e)=>e.preventDefault()}>Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

/** [ALEX-HOME-COMPONENTS] **/
function FeatureCard({ icon, title, desc }) {
  return (
    <div className="p-5 rounded-2xl bg-white border shadow-sm hover:shadow-md transition">
      <div className="text-2xl">{icon}</div>
      <h4 className="mt-2 font-semibold">{title}</h4>
      <p className="text-gray-600 text-sm mt-1">{desc}</p>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
      {children}
    </span>
  );
}

function Waves() {
  return (
    <svg
      className="absolute bottom-0 left-0 w-full h-16 md:h-24 text-white"
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M0,64L48,69.3C96,75,192,85,288,82.7C384,80,480,64,576,58.7C672,53,768,59,864,58.7C960,59,1056,53,1152,48C1248,43,1344,37,1392,34.7L1440,32L1440,90L1392,90C1344,90,1248,90,1152,90C1056,90,960,90,864,90C768,90,672,90,576,90C480,90,384,90,288,90C192,90,96,90,48,90L0,90Z"
      />
    </svg>
  );
}
