import Link from "next/link";

// Mise en page commune aux pages légales
export default function LegalPage({ title, updated, children }) {
  return (
    <main className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface/90">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo_nauticash.webp?v=2" alt="Logo Nauticash" width={32} height={32} className="rounded-lg" />
            <span className="text-xl font-bold bg-gradient-to-r from-slate-900 via-emerald-600 to-blue-600 dark:from-white dark:via-emerald-300 dark:to-sky-300 bg-clip-text text-transparent">
              Nauticash
            </span>
          </Link>
          <Link href="/" className="text-sm text-ink-muted hover:text-ink">← Accueil</Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-10 text-ink leading-relaxed
        [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h2]:mt-10 [&_h2]:mb-3
        [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_li]:mb-1 [&_a]:text-accent [&_a]:underline">
        <h1 className="text-3xl font-bold text-ink mb-2">{title}</h1>
        <p className="text-sm text-ink-muted mb-8">Dernière mise à jour : {updated}</p>
        {children}
      </article>
    </main>
  );
}
