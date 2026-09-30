"use client";

import { useEffect, useId, useRef, useState } from "react";
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

// Navigation principale de l'espace connecté (voir docs/DESIGN.md) :
// Tableau de bord, Portefeuille, Analyses ▾ (menu), Objectifs, Stratégie ; « Mon profil » = avatar à droite.
const ANALYSES = [
  { href: "/analyses/performance", label: "Performance" },
  { href: "/analyses/dividendes", label: "Dividendes" },
  { href: "/analyses/repartition", label: "Répartition" },
];

const NAV = [
  { href: "/tableau-de-bord", label: "Tableau de bord" },
  { href: "/portfolio", label: "Portefeuille" },
  { menu: "Analyses", base: "/analyses", items: ANALYSES },
  { href: "/objectifs", label: "Objectifs" },
  { href: "/strategie", label: "Stratégie" },
];

function isActive(pathname, { href, exact }) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

const tabClass = (active) =>
  cx(
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
    active ? "bg-accent/10 text-accent" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
  );

function NavLink({ item, pathname, className }) {
  const active = isActive(pathname, item);
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={className ?? tabClass(active)}>
      {item.label}
    </Link>
  );
}

/**
 * Menu déroulant « Analyses ▾ » (motif « disclosure ») : bouton aria-expanded + liste de liens.
 * Clavier : Entrée/Espace ouvre, ↓ ouvre et va au premier lien, ↑/↓ entre les liens,
 * Échap referme et rend le focus au bouton ; se referme en quittant le menu ou en changeant de page.
 */
function NavMenu({ item, pathname }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listId = useId();
  const active = pathname === item.base || pathname.startsWith(`${item.base}/`);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const links = () => Array.from(rootRef.current?.querySelectorAll("a") || []);
  const focusLink = (index) => {
    const list = links();
    if (list.length) list[(index + list.length) % list.length].focus();
  };

  const onButtonKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusLink(0));
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    const current = links().indexOf(document.activeElement);
    if (current === -1) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      focusLink(current + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      focusLink(e.key === "Home" ? 0 : -1);
    }
  };

  const onBlur = (e) => {
    if (!rootRef.current?.contains(e.relatedTarget)) setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
        className={cx(tabClass(active), "inline-flex items-center gap-1")}
      >
        {item.menu}
        <svg
          className={cx("h-4 w-4 transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <ul
        id={listId}
        hidden={!open}
        className="absolute left-0 top-full z-50 mt-1 min-w-[12rem] rounded-xl border border-line bg-surface p-1 shadow-card"
      >
        {item.items.map((sub) => {
          const subActive = isActive(pathname, sub);
          return (
            <li key={sub.href}>
              <NavLink
                item={sub}
                pathname={pathname}
                className={cx(
                  "block rounded-lg px-3 py-2 text-sm font-medium transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  subActive ? "bg-accent/10 text-accent" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                )}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
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

  // Bureau : onglets + menu déroulant « Analyses »
  const desktopLinks = NAV.map((item) =>
    item.menu ? (
      <NavMenu key={item.menu} item={item} pathname={pathname} />
    ) : (
      <NavLink key={item.href} item={item} pathname={pathname} />
    )
  );
  // Mobile / tablette : liste à plat (un menu déroulant serait coupé par la zone défilante)
  const mobileLinks = NAV.flatMap((item) => (item.menu ? item.items : [item])).map((item) => (
    <NavLink key={item.href} item={item} pathname={pathname} />
  ));

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/tableau-de-bord"
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
            {desktopLinks}
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
          {mobileLinks}
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
    {/* Cible du lien d'évitement « Aller au contenu » (app/layout.js) */}
    <div id="contenu" tabIndex={-1} className="scroll-mt-28 outline-none" />
    </>
  );
}
