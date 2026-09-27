"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/api";
import { cx } from "./ui/cx";

// Navigation principale de l'espace connecté (voir docs/DESIGN.md)
const NAV = [
  { href: "/portfolio", label: "Portefeuille" },
  { href: "/analytics", label: "Vue d'ensemble", exact: true },
  { href: "/analytics/performance", label: "Performance" },
  { href: "/analytics/dividendes", label: "Dividendes" },
  { href: "/analytics/geographie", label: "Géographie" },
];

function isActive(pathname, { href, exact }) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * En-tête commun : logo, navigation (défilante sur mobile), actions propres à la page, déconnexion.
 * <AppHeader actions={<Button ...>Actualiser</Button>} />
 */
export default function AppHeader({ actions }) {
  const pathname = usePathname() || "";

  const links = NAV.map((item) => {
    const active = isActive(pathname, item);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          active ? "bg-accent/10 text-accent" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
        )}
      >
        {item.label}
      </Link>
    );
  });

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/portfolio"
            className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <img src="/logo_nauticash.webp?v=3" alt="" width={32} height={32} className="rounded-lg shadow-sm" />
            <span className="bg-gradient-to-r from-slate-900 via-emerald-600 to-blue-600 bg-clip-text text-xl font-bold text-transparent dark:from-white">
              Nauticash
            </span>
          </Link>

          <nav aria-label="Navigation principale" className="hidden flex-1 items-center gap-1 lg:flex">
            {links}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={logout}
              aria-label="Déconnexion"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink-muted transition hover:border-loss/40 hover:text-loss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Mobile / tablette : navigation défilante sous le logo */}
        <nav aria-label="Navigation principale" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
          {links}
        </nav>
      </div>
    </header>
  );
}
