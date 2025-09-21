"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/**
 * Page d'accueil "Nauticash"
 * - Header type produit (marque à gauche, actions à droite)
 * - Hero dégradé "océan" + CTA
 * - Onglets de fonctionnalités (2 onglets) avec persistance
 * - CTA final + footer centré
 */
export default function Home() {
  const router = useRouter();
  const [language, setLanguage] = useState("FR");

  // === Persistance langue via localStorage ===
  useEffect(() => {
    const savedLang = localStorage.getItem("lang");
    if (savedLang) setLanguage(savedLang);
  }, []);
  useEffect(() => {
    localStorage.setItem("lang", language);
  }, [language]);

  // Dictionnaire FR/EN
  const i18n = useMemo(
    () => ({
      brand: { FR: "Nauticash", EN: "Nauticash" },
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
      login: { FR: "Connexion", EN: "Log in" },

      featuresTitle: {
        FR: "Tout pour piloter vos investissements",
        EN: "Everything to pilot your investments",
      },

      tabs: [
        {
          key: "efficiency",
          badge: { FR: "Centralisation", EN: "Single view" },
          title: { FR: "Gagnez un temps précieux", EN: "Save countless hours" },
          desc: {
            FR: "Fini les feuilles Excel et les connexions multiples : tout est réuni au même endroit.",
            EN: "No more spreadsheets or checking every account: everything in one place.",
          },
        },
        {
          key: "performance",
          badge: { FR: "Analytique", EN: "Analytics" },
          title: { FR: "Mesurez vos performances", EN: "Measure your performance" },
          desc: {
            FR: "Courbes claires, rendements, dividendes et vues personnalisables.",
            EN: "Clear charts, returns, dividends and customizable views.",
          },
        },
      ],

      finalCtaTitle: { FR: "Prêt à embarquer ?", EN: "Ready to set sail?" },
      finalCtaDesc: {
        FR: "Créez votre compte et suivez la houle des marchés.",
        EN: "Create your account and surf the market waves.",
      },
    }),
    []
  );

  const lang = language;

  return (
    <main className="flex flex-col min-h-screen bg-gray-50 text-gray-900">
      {/* ===== Header produit ===== */}
      <header className="w-full sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-white/60">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div
            className="text-[#0b5bd3] font-extrabold tracking-tight text-xl cursor-pointer"
            onClick={() => router.push("/")}
          >
            {i18n.brand[lang]}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="text-gray-700 text-sm px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-100"
              onClick={() => setLanguage(lang === "FR" ? "EN" : "FR")}
              aria-label="Changer de langue"
              title="Changer de langue"
            >
              {lang}
            </button>
            <button
              onClick={() => router.push("/login")}
              className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100"
            >
              {i18n.login[lang]}
            </button>
            <button
              onClick={() => router.push("/register")}
              className="text-sm px-4 py-2 rounded-lg bg-[#0b5bd3] text-white hover:bg-[#3B82F6] transition"
            >
              {i18n.ctaSecondary[lang]}
            </button>
          </div>
        </div>
      </header>

      {/* ===== Hero "Océan" ===== */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b5bd3] via-[#0e86ff] to-[#7cc6ff]" />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[28rem] w-[64rem] opacity-20"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(255,255,255,0.60) 0%, rgba(255,255,255,0.05) 60%, transparent 100%)",
            filter: "blur(30px)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-32 text-center text-white">
          <span className="inline-flex items-center gap-2 text-xs md:text-sm px-3 py-1 rounded-full bg-white/15 ring-1 ring-white/30">
            <span>MVP</span>
            <span className="opacity-70">•</span>
            <span>UI Ocean</span>
          </span>

          <h1 className="mt-5 text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
            {i18n.title[lang]} <span className="opacity-90">📈</span>
          </h1>
          <p className="mt-4 md:mt-5 text-base md:text-lg text-white/90">
            {i18n.subtitle[lang]}
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => router.push("/portfolio")}
              className="px-6 py-3 bg-white text-[#0b5bd3] font-semibold rounded-xl shadow hover:shadow-md transition"
            >
              {i18n.ctaPrimary[lang]}
            </button>
            <button
              onClick={() => router.push("/register")}
              className="px-6 py-3 bg-[#0b5bd3]/20 text-white font-semibold rounded-xl ring-1 ring-white/40 hover:bg-[#0b5bd3]/30 transition"
            >
              {i18n.ctaSecondary[lang]}
            </button>
          </div>
        </div>
        <OceanWaves />
      </section>

      {/* ===== Fonctionnalités (onglets) ===== */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <h2 className="text-2xl md:text-3xl font-bold text-[#0b5bd3] mb-6">
          {i18n.featuresTitle[lang]}
        </h2>
        <FeatureTabs items={i18n.tabs} lang={lang} />
      </section>

      {/* ===== CTA final ===== */}
      <section className="relative">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#7cc6ff] via-[#b0e1ff] to-white" />
        <div className="max-w-6xl mx-auto px-4 py-14 text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-[#0b5bd3]">
            {i18n.finalCtaTitle[lang]}
          </h3>
          <p className="mt-2 text-gray-600">{i18n.finalCtaDesc[lang]}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => router.push("/register")}
              className="px-6 py-3 bg-[#0b5bd3] text-white font-semibold rounded-xl shadow hover:bg-[#3B82F6] transition"
            >
              {i18n.ctaSecondary[lang]}
            </button>
            <button
              onClick={() => router.push("/login")}
              className="px-6 py-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition"
            >
              {i18n.login[lang]}
            </button>
          </div>
        </div>
      </section>

      {/* ===== Footer centré ===== */}
      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6 text-sm text-center">
          <p className="text-gray-500">
            © {new Date().getFullYear()} {i18n.brand[lang]}. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

/**
 * Bloc d’onglets de fonctionnalités (persistance onglet via localStorage)
 */
function FeatureTabs({ items, lang }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("activeTab");
    if (saved) setActiveIndex(Number(saved));
  }, []);
  useEffect(() => {
    localStorage.setItem("activeTab", activeIndex.toString());
  }, [activeIndex]);

  return (
    <div className="w-full">
      <div role="tablist" className="grid md:grid-cols-2 gap-4 mb-6">
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const progress = isActive ? 100 : 0;
          return (
            <button
              key={item.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveIndex(index)}
              className={`group text-left rounded-2xl border bg-white p-4 md:p-5 shadow-sm hover:shadow-md transition
                         ${isActive ? "ring-2 ring-[#0b5bd3]/30 border-[#0b5bd3]/40" : "border-gray-200"}`}
            >
              <div className="h-1 w-full bg-gray-100 rounded overflow-hidden mb-3">
                <div
                  className="h-full bg-[#0b5bd3] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-[#0b5bd3] font-medium">
                <span className="inline-flex px-2 py-0.5 bg-blue-50 border border-blue-100 rounded">
                  {item.badge[lang]}
                </span>
              </div>

              <h3 className="mt-2 text-base md:text-lg font-semibold text-gray-900">
                {item.title[lang]}
              </h3>
              <p className="mt-1 text-sm text-gray-600">{item.desc[lang]}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-white shadow-sm p-4 md:p-6">
        <div className="grid lg:grid-cols-2 gap-6 items-center">
          <MockWindow url={activeIndex === 0 ? "/overview" : "/performance"} />
          <div>
            <h4 className="text-lg md:text-xl font-semibold text-gray-900">
              {items[activeIndex].title[lang]}
            </h4>
            <p className="mt-2 text-gray-600">{items[activeIndex].desc[lang]}</p>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              {activeIndex === 0 && (
                <>
                  <li>• Import/édition rapide, vue consolidée</li>
                  <li>• Tri par prix, performance, dividendes, rendement, total</li>
                  <li>• Cash intégré dans les totaux</li>
                </>
              )}
              {activeIndex === 1 && (
                <>
                  <li>• Courbes claires & indicateurs</li>
                  <li>• Perf vs PRU, dividendes, rendements</li>
                  <li>• Exports & vues personnalisables (à venir)</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Fenêtre de prévisualisation "maquette"
 */
function MockWindow({ url }) {
  return (
    <div className="relative rounded-xl border bg-white shadow overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-2 text-xs text-gray-500">{url}</span>
      </div>
      <div className="p-4">
        <div className="h-7 w-40 bg-blue-100 rounded mb-3" />
        <div className="grid grid-cols-5 gap-2 text-xs text-gray-500 mb-2">
          {["Ticker", "Prix", "Quantité", "Perf", "Total"].map((h) => (
            <div key={h} className="px-2 py-1 bg-gray-50 rounded border">
              {h}
            </div>
          ))}
        </div>
        {[...Array(6)].map((_, i) => (
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
  );
}

/**
 * Vague SVG décorative bas du hero
 */
function OceanWaves() {
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
