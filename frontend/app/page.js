"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Compass from "./components/Compass";
import DepthLines from "./components/DepthLines";

/**
 * Page d'accueil Nauticash — voir docs/DESIGN.md (identité « abysse / lagon »)
 */

const FEATURES = [
  {
    title: "Tout votre portefeuille, au même endroit",
    desc: "Actions, ETF, cryptos et cash réunis dans une vue unique, en euros comme en dollars. Fini les tableurs à tenir à jour.",
    icon: "M4 6h16M4 12h16M4 18h10",
  },
  {
    title: "Votre performance, sans calcul",
    desc: "Plus-value par position, rendement de vos dividendes et évolution mois après mois de la valeur de votre patrimoine.",
    icon: "M3 17l6-6 4 4 8-8M15 7h6v6",
  },
  {
    title: "Votre exposition, en un coup d'œil",
    desc: "Répartition par pays, par continent, par type d'actif et par devise, pour repérer une concentration avant qu'elle ne pèse.",
    icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18",
  },
];

const STEPS = [
  { n: "1", title: "Créez votre compte", desc: "Une adresse email et un mot de passe suffisent. Aucune donnée bancaire demandée." },
  { n: "2", title: "Ajoutez vos positions", desc: "Saisissez le ticker, la quantité et votre prix de revient. Les cours se mettent à jour automatiquement." },
  { n: "3", title: "Suivez votre cap", desc: "Performance, dividendes et répartition sont calculés pour vous, sur ordinateur comme sur mobile." },
];

const TRUST = [
  "Aucune connexion à votre banque ou à votre courtier",
  "Mots de passe chiffrés, échanges en HTTPS",
  "Gratuit pendant la bêta",
];

// Aperçu illustratif du tableau de bord (valeurs fictives)
function DashboardPreview() {
  const rows = [
    ["ETF Monde", "ETF", "+18,4 %", true],
    ["Action européenne", "Action", "+6,1 %", true],
    ["Action américaine", "Action", "−2,3 %", false],
  ];
  return (
    <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur" aria-hidden="true">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Patrimoine</p>
      <p className="mt-1 text-4xl font-semibold tabular-nums text-white">48 231,57 €</p>
      <p className="mt-1 text-sm font-semibold text-emerald-400">▲ +3,42 % <span className="font-normal text-slate-400">depuis l'achat</span></p>

      <svg viewBox="0 0 300 70" className="mt-4 h-16 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#34D399" stopOpacity=".35" />
            <stop offset="1" stopColor="#34D399" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 55 C30 50 45 58 70 45 S110 40 130 36 170 42 190 30 230 22 250 24 280 12 300 8 V70 H0 Z" fill="url(#fill)" />
        <path d="M0 55 C30 50 45 58 70 45 S110 40 130 36 170 42 190 30 230 22 250 24 280 12 300 8" fill="none" stroke="#34D399" strokeWidth="2" />
      </svg>

      <ul className="mt-4 divide-y divide-white/10 text-sm">
        {rows.map(([name, type, perf, up]) => (
          <li key={name} className="flex items-center justify-between py-2.5">
            <span className="text-slate-200">{name} <span className="ml-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">{type}</span></span>
            <span className={`font-semibold tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}>{perf}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-slate-500">Aperçu illustratif, valeurs fictives.</p>
    </div>
  );
}

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    try {
      setLoggedIn(Boolean(localStorage.getItem("token")));
    } catch {}
  }, []);

  const primaryCta = loggedIn
    ? { href: "/portfolio", label: "Accéder à mon portefeuille" }
    : { href: "/register", label: "Créer mon compte gratuit" };

  const btnPrimary =
    "inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-blue-600 px-6 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1B2B]";

  return (
    <main className="flex min-h-screen flex-col bg-bg text-ink">
      {/* ===== Hero (fond abysse) ===== */}
      <section className="relative overflow-hidden bg-[#0B1B2B] text-white">
        <DepthLines className="pointer-events-none absolute inset-0 h-full w-full text-sky-300" />

        <header className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo_nauticash.webp?v=3" alt="" width={32} height={32} className="rounded-lg" />
            <span className="text-xl font-bold">Nauticash</span>
          </Link>
          <nav className="flex items-center gap-2">
            {loggedIn ? (
              <Link href="/portfolio" className="rounded-xl px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10">
                Mon portefeuille
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10">
                  Connexion
                </Link>
                <Link href="/register" className="hidden rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0B1B2B] hover:bg-slate-100 sm:inline-flex">
                  Créer un compte
                </Link>
              </>
            )}
          </nav>
        </header>
        <div id="contenu" tabIndex={-1} className="outline-none" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pb-28 lg:pt-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <Compass className="h-4 w-4 text-emerald-300" /> Bêta gratuite
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Gardez le cap sur <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">votre patrimoine boursier</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              Nauticash réunit vos actions, ETF, cryptos et liquidités dans un seul tableau de bord clair : valeur totale, performance, dividendes et exposition géographique, mis à jour automatiquement.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={primaryCta.href} className={btnPrimary}>{primaryCta.label}</Link>
              {!loggedIn && (
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 text-base font-semibold text-white transition hover:bg-white/10"
                >
                  J'ai déjà un compte
                </Link>
              )}
            </div>
            <ul className="mt-8 space-y-2 text-sm text-slate-400">
              {TRUST.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center lg:justify-end">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* ===== Fonctionnalités ===== */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="features-title">
        <h2 id="features-title" className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Ce que Nauticash fait pour vous
        </h2>
        <p className="mt-3 max-w-2xl text-ink-muted">L'essentiel pour piloter vos investissements, sans jargon ni tableur.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-2xl border border-line bg-surface p-6 shadow-card">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-ink-muted">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ===== Comment ça marche ===== */}
      <section className="border-y border-line bg-surface" aria-labelledby="steps-title">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 id="steps-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">Prêt en trois minutes</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="relative pl-14">
                <span className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border-2 border-accent font-semibold text-accent">
                  {s.n}
                </span>
                <h3 className="mb-1 text-lg font-semibold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-ink-muted">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== Appel à l'action final ===== */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[#0B1B2B] px-6 py-14 text-center text-white sm:px-12">
          <DepthLines className="pointer-events-none absolute inset-0 h-full w-full text-sky-300" />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Prenez la barre de vos investissements</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              Créez votre compte gratuitement et ajoutez vos premières positions dès aujourd'hui.
            </p>
            <Link href={primaryCta.href} className={`${btnPrimary} mt-8`}>{primaryCta.label}</Link>
          </div>
        </div>
      </section>

      {/* ===== Pied de page ===== */}
      <footer className="mt-auto border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <img src="/logo_nauticash.webp?v=3" alt="" width={24} height={24} className="rounded" />
            <span className="font-semibold text-ink">Nauticash</span>
            <span>· Outil de suivi, pas un conseil en investissement.</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Liens légaux">
            <Link href="/cgu" className="hover:text-ink">Conditions d'utilisation</Link>
            <Link href="/confidentialite" className="hover:text-ink">Confidentialité</Link>
            <span>© {new Date().getFullYear()} Nauticash</span>
          </nav>
        </div>
      </footer>
    </main>
  );
}
