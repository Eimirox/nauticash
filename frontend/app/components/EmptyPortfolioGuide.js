"use client";

import { useId } from "react";
import Button from "./ui/Button";
import { cx } from "./ui/cx";

// Accueil guidé du portefeuille vide : les 3 étapes pour ajouter une première position.
const STEPS = [
  {
    title: "Cherchez un titre",
    text: "Tapez un nom ou un ticker (Apple, Airbus, MSCI World…) dans la barre de recherche, puis choisissez-le dans la liste.",
  },
  {
    title: "Saisissez quantité et PRU",
    text: "Dans la ligne ajoutée, indiquez le nombre de titres détenus et votre prix de revient unitaire (PRU).",
  },
  {
    title: "Choisissez l'enveloppe",
    text: "Rangez la position dans son compte (PEA, CTO, assurance-vie, crypto) pour suivre les sous-totaux.",
  },
];

// Place le curseur dans la barre de recherche du bloc « Ajouter une position ».
export function focusTickerSearch() {
  if (typeof document === "undefined") return;
  const input = document.querySelector("#add-position input[role='combobox']");
  if (!input) return;
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  input.focus({ preventScroll: true });
}

export default function EmptyPortfolioGuide({ className }) {
  // Le guide est rendu deux fois (vue mobile et tableau) : identifiant unique par instance
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={cx("mx-auto max-w-2xl text-left", className)}>
      <h2 id={titleId} className="text-center text-lg font-semibold text-ink">
        Votre portefeuille est vide
      </h2>
      <p className="mt-1 text-center text-sm text-ink-muted">Ajoutez votre première position en trois étapes.</p>

      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="rounded-xl border border-line bg-surface-2/50 p-4">
            <span
              aria-hidden="true"
              className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent"
            >
              {i + 1}
            </span>
            <p className="text-sm font-semibold text-ink">
              <span className="sr-only">Étape {i + 1} : </span>
              {step.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{step.text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 text-center">
        <Button onClick={focusTickerSearch}>Chercher un titre</Button>
      </div>
    </section>
  );
}
