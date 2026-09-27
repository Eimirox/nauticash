"use client";

import { useEffect } from "react";
import Link from "next/link";
import StatusPage from "./components/StatusPage";

// Affichée quand une page plante de façon inattendue (le reste du site reste utilisable)
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      code="Erreur inattendue"
      title="Avis de gros temps"
      message="Un problème est survenu en affichant cette page. Réessayez ; si cela persiste, revenez dans quelques minutes."
    >
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Réessayer
      </button>
      <Link
        href="/portfolio"
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Mon portefeuille
      </Link>
      {error?.digest && <p className="sr-only">Référence : {error.digest}</p>}
    </StatusPage>
  );
}
