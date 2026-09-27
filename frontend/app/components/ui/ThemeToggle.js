"use client";

import { useEffect, useState } from "react";

// Script à injecter dans <head> : applique le thème mémorisé avant l'affichage (évite le flash)
// Valeurs : "dark", "light" ou "system" (suit l'appareil).
export const themeInitScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

// Applique et mémorise un thème choisi dans le profil
export function applyTheme(theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch {}
  const dark =
    theme === "dark" ||
    (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

// Bouton clair / sombre. Le mode clair reste le défaut tant que toutes les pages
// ne sont pas migrées vers les jetons du design system (voir docs/AMELIORATIONS.md).
export default function ThemeToggle({ className = "" }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      aria-pressed={dark}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
    >
      {dark ? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
