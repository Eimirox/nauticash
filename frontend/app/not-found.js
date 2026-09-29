import Link from "next/link";
import StatusPage from "./components/StatusPage";

export const metadata = { title: "Page introuvable" };

const primary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export default function NotFound() {
  return (
    <StatusPage
      code="Erreur 404"
      title="Cap perdu"
      message="Cette page n'existe pas ou a été déplacée. Reprenons la route vers votre portefeuille."
    >
      <Link href="/portfolio" className={primary}>Mon portefeuille</Link>
      <Link href="/" className={secondary}>Accueil</Link>
    </StatusPage>
  );
}
