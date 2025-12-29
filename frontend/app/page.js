"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/**
 * Page d'accueil Nauticash - Version Finance/Investissement
 * Thème professionnel avec carrousel de features
 */
export default function Home() {
  const router = useRouter();
  const [language, setLanguage] = useState("FR");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedLang = localStorage.getItem("lang");
    if (savedLang) setLanguage(savedLang);
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem("lang", language);
  }, [language, mounted]);

  const i18n = useMemo(
    () => ({
      brand: { FR: "Nauticash", EN: "Nauticash" },
      title: {
        FR: "Gérez votre portefeuille boursier",
        EN: "Manage your investment portfolio",
      },
      subtitle: {
        FR: "Suivez vos actifs, analysez vos performances et prenez des décisions éclairées.",
        EN: "Track your assets, analyze performance and make informed decisions.",
      },
      ctaPrimary: {
        FR: "Accéder à mon portefeuille",
        EN: "Open my portfolio",
      },
      ctaSecondary: { FR: "Créer un compte", EN: "Create account" },
      login: { FR: "Connexion", EN: "Log in" },
      featuresTitle: {
        FR: "Outils professionnels pour investisseurs",
        EN: "Professional tools for investors",
      },
      features: [
        {
          key: "efficiency",
          icon: "chart",
          badge: { FR: "Centralisation", EN: "Centralization" },
          title: { FR: "Gagnez un temps précieux", EN: "Save countless hours" },
          desc: {
            FR: "Consolidez tous vos actifs en un seul endroit. Fini les feuilles Excel et les connexions multiples.",
            EN: "Consolidate all your assets in one place. No more spreadsheets or multiple logins.",
          },
          features: {
            FR: [
              "Import et édition rapide de vos positions",
              "Vue consolidée en temps réel",
              "Cash intégré dans les calculs"
            ],
            EN: [
              "Quick import and edit of positions",
              "Real-time consolidated view",
              "Cash integrated in calculations"
            ]
          }
        },
        {
          key: "performance",
          icon: "analytics",
          badge: { FR: "Analytique", EN: "Analytics" },
          title: { FR: "Mesurez vos performances", EN: "Measure your performance" },
          desc: {
            FR: "Visualisez clairement vos rendements avec des graphiques interactifs et des métriques détaillées.",
            EN: "Visualize your returns clearly with interactive charts and detailed metrics.",
          },
          features: {
            FR: [
              "Graphiques de performance interactifs",
              "Suivi des dividendes et rendements",
              "Analyses comparatives avancées"
            ],
            EN: [
              "Interactive performance charts",
              "Dividend and yield tracking",
              "Advanced comparative analysis"
            ]
          }
        },
      ],
      finalCtaTitle: { FR: "Prêt à démarrer ?", EN: "Ready to get started?" },
      finalCtaDesc: {
        FR: "Créez votre compte gratuitement et prenez le contrôle de vos investissements dès aujourd'hui.",
        EN: "Create your free account and take control of your investments today.",
      },
    }),
    []
  );

  const lang = language;

  return (
    <main className="flex flex-col min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* ===== Header ===== */}
      <header className="w-full sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-3 group transition-transform hover:scale-105"
            >
              <div className="relative">
                <img
                  src="/logo_nauticash.webp?v=2"
                  alt="Logo Nauticash"
                  width={32}
                  height={32}
                  className="rounded-lg shadow-sm"
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-emerald-600 to-blue-600 bg-clip-text text-transparent">
                {i18n.brand[lang]}
              </span>
            </button>

            {/* Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLanguage(lang === "FR" ? "EN" : "FR")}
                className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                {lang}
              </button>
              <button
                onClick={() => router.push("/login")}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
              >
                {i18n.login[lang]}
              </button>
              <button
                onClick={() => router.push("/register")}
                className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-blue-600 rounded-lg hover:shadow-lg hover:scale-105 transition-all"
              >
                {i18n.ctaSecondary[lang]}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ===== Hero Section ===== */}
      <section className="relative overflow-hidden">
        {/* Background professionnel */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
          {/* Pattern grille subtile */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '50px 50px'
            }} />
          </div>
          {/* Accent lumineux */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/20 rounded-full filter blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/20 rounded-full filter blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32 md:pt-28 md:pb-40">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white text-sm font-medium mb-8 animate-fade-in-down">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Plateforme sécurisée</span>
              <span className="opacity-50">•</span>
              <span className="opacity-90">100% Gratuit</span>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight mb-6 animate-fade-in-up">
              {i18n.title[lang]}
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                en toute simplicité
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto mb-10 animate-fade-in-up animation-delay-200">
              {i18n.subtitle[lang]}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-400">
              <button
                onClick={() => router.push("/portfolio")}
                className="group relative px-8 py-4 bg-white text-slate-900 font-bold rounded-xl shadow-2xl hover:shadow-3xl transition-all hover:scale-105"
              >
                <span className="flex items-center gap-2">
                  {i18n.ctaPrimary[lang]}
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
              <button
                onClick={() => router.push("/register")}
                className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl border-2 border-white/30 hover:bg-white/20 hover:border-white/50 transition-all"
              >
                {i18n.ctaSecondary[lang]}
              </button>
            </div>

            {/* Stats - Thème Finance */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mt-16 pt-16 border-t border-white/20">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">∞</div>
                <div className="text-sm text-slate-300">Positions</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-emerald-400 mb-2">0€</div>
                <div className="text-sm text-slate-300">Frais</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                  <svg className="w-8 h-8 md:w-10 md:h-10 inline" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-sm text-slate-300">Sécurisé</div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave Divider moderne */}
        <div className="absolute bottom-0 left-0 w-full">
          <svg className="w-full h-16 md:h-24 text-white" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path
              fill="currentColor"
              d="M0,64L48,69.3C96,75,192,85,288,82.7C384,80,480,64,576,58.7C672,53,768,59,864,58.7C960,59,1056,53,1152,48C1248,43,1344,37,1392,34.7L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
            />
          </svg>
        </div>
      </section>

      {/* ===== Features Section avec Carrousel ===== */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-sm font-semibold text-emerald-700 mb-6">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
              {lang === "FR" ? "Fonctionnalités" : "Features"}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              {i18n.featuresTitle[lang]}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {lang === "FR" 
                ? "Des outils puissants pour gérer votre patrimoine financier efficacement"
                : "Powerful tools to manage your financial assets effectively"
              }
            </p>
          </div>

          <FeatureCarousel items={i18n.features} lang={lang} />
        </div>
      </section>

      {/* ===== CTA Section ===== */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-emerald-900" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {i18n.finalCtaTitle[lang]}
          </h3>
          <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
            {i18n.finalCtaDesc[lang]}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push("/register")}
              className="group relative px-8 py-4 bg-white text-slate-900 font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all hover:scale-105"
            >
              <span className="flex items-center gap-2">
                {i18n.ctaSecondary[lang]}
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
            <button
              onClick={() => router.push("/login")}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/20 hover:border-white/50 transition-all"
            >
              {i18n.login[lang]}
            </button>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img
                  src="/logo_nauticash.webp?v=2"
                  alt="Logo"
                  width={28}
                  height={28}
                  className="rounded"
                />
                <span className="text-xl font-bold text-slate-900">{i18n.brand[lang]}</span>
              </div>
              <p className="text-sm text-slate-600">
                {lang === "FR"
                  ? "Plateforme de gestion de portefeuille boursier pour investisseurs avertis."
                  : "Investment portfolio management platform for savvy investors."
                }
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">
                {lang === "FR" ? "Navigation" : "Navigation"}
              </h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><button onClick={() => router.push("/")} className="hover:text-emerald-600 transition">Accueil</button></li>
                <li><button onClick={() => router.push("/portfolio")} className="hover:text-emerald-600 transition">Portfolio</button></li>
                <li><button onClick={() => router.push("/login")} className="hover:text-emerald-600 transition">Connexion</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">
                {lang === "FR" ? "Légal" : "Legal"}
              </h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><a href="#" className="hover:text-emerald-600 transition">Conditions d'utilisation</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition">Politique de confidentialité</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t text-center text-sm text-slate-500">
            <p>© {new Date().getFullYear()} {i18n.brand[lang]}. {lang === "FR" ? "Tous droits réservés." : "All rights reserved."}</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

/**
 * Carrousel de Features - Navigation par flèches et dots
 */
function FeatureCarousel({ items, lang }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-play
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, items.length]);

  const goToPrevious = () => {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev + 1) % items.length);
  };

  const goToSlide = (index) => {
    setIsAutoPlaying(false);
    setActiveIndex(index);
  };

  const currentItem = items[activeIndex];

  return (
    <div className="relative">
      {/* Carrousel Content */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xl overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-0">
          {/* Image */}
          <div className="relative bg-gradient-to-br from-slate-50 to-emerald-50 p-8 flex items-center justify-center">
            <div className="relative w-full max-w-lg">
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-2xl opacity-20 blur-2xl"></div>
              <img
                src="/overview.png?v=2"
                alt="Aperçu Nauticash"
                className="relative w-full h-auto rounded-xl shadow-2xl border border-slate-200 transition-all duration-500"
                key={activeIndex}
              />
            </div>
          </div>

          {/* Details */}
          <div className="p-8 lg:p-12 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-700 mb-6 w-fit">
              {currentItem.icon === "chart" ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                  <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                </svg>
              )}
              {currentItem.badge[lang]}
            </div>

            <h4 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
              {currentItem.title[lang]}
            </h4>
            
            <p className="text-slate-600 mb-6 leading-relaxed">
              {currentItem.desc[lang]}
            </p>

            <ul className="space-y-3">
              {currentItem.features[lang].map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3 animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
                  <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-slate-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between px-4 pointer-events-none">
        <button
          onClick={goToPrevious}
          className="pointer-events-auto w-12 h-12 flex items-center justify-center bg-white border-2 border-slate-200 rounded-full shadow-lg hover:bg-slate-50 hover:scale-110 transition-all"
          aria-label="Previous"
        >
          <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={goToNext}
          className="pointer-events-auto w-12 h-12 flex items-center justify-center bg-white border-2 border-slate-200 rounded-full shadow-lg hover:bg-slate-50 hover:scale-110 transition-all"
          aria-label="Next"
        >
          <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Dots Navigation */}
      <div className="flex items-center justify-center gap-2 mt-8">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`transition-all ${
              index === activeIndex
                ? "w-8 h-3 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-full"
                : "w-3 h-3 bg-slate-300 rounded-full hover:bg-slate-400"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Auto-play indicator */}
      <div className="text-center mt-4">
        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className="text-sm text-slate-500 hover:text-slate-700 transition flex items-center justify-center gap-2 mx-auto"
        >
          {isAutoPlaying ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Play
            </>
          )}
        </button>
      </div>
    </div>
  );
}