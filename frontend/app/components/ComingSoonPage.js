"use client";

import Link from "next/link";
import AppHeader from "./AppHeader";
import { Card } from "./ui";

/**
 * Onglet réservé, pas encore construit : titre, description et liste de ce qui arrive.
 * <ComingSoonPage title="Objectifs" intro="…" upcoming={["…", "…"]} />
 */
export default function ComingSoonPage({ title, intro, upcoming = [] }) {
  return (
    <main className="min-h-screen bg-bg">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-ink md:text-4xl">{title}</h1>
          <p className="text-ink-muted">{intro}</p>
        </div>
        <Card className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">Bientôt</p>
          <h2 className="mb-3 text-lg font-bold text-ink">Cet onglet est en préparation</h2>
          {upcoming.length > 0 && (
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink-muted">
              {upcoming.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
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
