"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/api";
import { cx } from "./ui/cx";
import { Avatar } from "./Avatar";
import { useProfile, useDiscreet } from "@/lib/profile";

// Adresse qui reçoit les retours de la bêta (variable Vercel NEXT_PUBLIC_CONTACT_EMAIL) ;
// sans elle, le lien « Donner mon avis » n'est pas affiché.
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";

function feedbackHref(pathname) {
  const subject = "Mon avis sur Nauticash (bêta)";
  const body = `Page : ${pathname}\n\nCe qui m'a plu :\n\nCe qui m'a gêné ou manqué :\n\n`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

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
  const { email, profile, loading: profileLoading } = useProfile();
  const [discreet, toggleDiscreet] = useDiscreet();
  const firstName = (profile.displayName || "").trim().split(/\s+/)[0];

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
            <span className="bg-gradient-to-r from-slate-900 via-emerald-600 to-blue-600 bg-clip-text text-xl font-bold text-transparent dark:from-white dark:via-emerald-300 dark:to-sky-300">
              Nauticash
            </span>
            <span
              className="hidden rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] min-[400px]:inline font-semibold uppercase tracking-wider text-accent"
              title="Nauticash est en version bêta : certaines fonctionnalités peuvent évoluer."
            >
              Bêta
            </span>
          </Link>

          <nav aria-label="Navigation principale" className="hidden flex-1 items-center gap-1 lg:flex">
            {links}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {actions}
            {CONTACT_EMAIL && (
              <a
                href={feedbackHref(pathname)}
                aria-label="Donner mon avis sur la bêta"
                className="hidden min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink-muted transition hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:inline-flex"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12a9 9 0 01-13.3 7.9L3 21l1.1-4.7A9 9 0 1121 12z" />
                </svg>
                <span className="hidden xl:inline">Donner mon avis</span>
              </a>
            )}
            <button
              type="button"
              onClick={toggleDiscreet}
              aria-pressed={discreet}
              aria-label={discreet ? "Afficher les montants" : "Masquer les montants (mode discret)"}
              title={discreet ? "Afficher les montants" : "Masquer les montants"}
              className={cx(
                "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                discreet ? "border-accent/40 bg-accent/10 text-accent" : "border-line bg-surface text-ink-muted hover:text-ink"
              )}
            >
              {discreet ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7a13 13 0 01-2.9 4.1M6.6 6.6C4.4 8 2.8 10.2 2 12c1 2.5 5 7 10 7 1.6 0 3.1-.5 4.4-1.2" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
            <Link
              href="/profil"
              aria-label={firstName ? `Mon profil (${firstName})` : "Mon profil"}
              aria-current={pathname === "/profil" ? "page" : undefined}
              className={cx(
                "inline-flex min-h-10 items-center gap-2 rounded-xl border pl-1.5 pr-1.5 sm:pr-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                pathname === "/profil" ? "border-accent/40 bg-accent/10 text-accent" : "border-line bg-surface text-ink-muted hover:text-ink"
              )}
            >
              {profileLoading ? (
                <span aria-hidden="true" className="h-7 w-7 animate-pulse rounded-full bg-surface-2" />
              ) : (
                <Avatar name={profile.displayName} email={email} color={profile.avatarColor} size="sm" />
              )}
              <span className="hidden max-w-[9rem] truncate sm:inline">{firstName || "Mon profil"}</span>
            </Link>
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
          {CONTACT_EMAIL && (
            <a
              href={feedbackHref(pathname)}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10 sm:hidden"
            >
              Donner mon avis
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
