"use client";

import Link from "next/link";
import AppHeader from "./AppHeader";
import { Card } from "./ui";

/**
 * Écran réservé à la formule VIP (affiché quand le verrouillage est actif et que le compte est gratuit).
 * <VipLockedPage title="Objectifs" intro="…" benefits={["…", "…"]} />
 */
export default function VipLockedPage({ title, intro, benefits = [] }) {
  return (
    <main className="min-h-screen bg-bg">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-ink md:text-4xl">{title}</h1>
          <p className="text-ink-muted">{intro}</p>
        </div>
        <Card className="max-w-2xl">
          <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warn">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path strokeLinecap="round" d="M8 11V8a4 4 0 018 0v3" />
            </svg>
            Formule VIP
          </p>
          <h2 className="mb-3 text-lg font-bold text-ink">Cet écran fait partie de la formule VIP</h2>
          {benefits.length > 0 && (
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink-muted">
              {benefits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <p className="mb-4 text-sm text-ink-muted">L&apos;abonnement n&apos;est pas encore ouvert : revenez bientôt.</p>
          <Link
            href="/tableau-de-bord"
            className="inline-flex rounded-lg text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Retour au tableau de bord
          </Link>
        </Card>
      </div>
    </main>
  );
}
