import Link from "next/link";
import Compass from "./Compass";
import DepthLines from "./DepthLines";

// Mise en page commune aux pages 404 et erreur
export default function StatusPage({ code, title, message, children }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 text-ink">
      <DepthLines className="pointer-events-none absolute inset-0 h-full w-full text-accent-2" />
      <div className="relative w-full max-w-md text-center">
        <Compass className="mx-auto mb-6 h-24 w-24 text-ink-muted" spin />
        {code && <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent">{code}</p>}
        <h1 className="mb-3 text-3xl font-semibold">{title}</h1>
        <p className="mb-8 text-ink-muted">{message}</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">{children}</div>
        <Link href="/" className="mt-10 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
          <img src="/logo_nauticash.webp?v=3" alt="" width={20} height={20} className="rounded" />
          Nauticash
        </Link>
      </div>
    </main>
  );
}
