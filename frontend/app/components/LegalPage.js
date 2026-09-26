import Link from "next/link";

// Mise en page commune aux pages légales
export default function LegalPage({ title, updated, children }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white/90">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo_nauticash.webp?v=2" alt="Logo Nauticash" width={32} height={32} className="rounded-lg" />
            <span className="text-xl font-bold bg-gradient-to-r from-slate-900 via-emerald-600 to-blue-600 bg-clip-text text-transparent">
              Nauticash
            </span>
          </Link>
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">← Accueil</Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-10 text-slate-700 leading-relaxed
        [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-10 [&_h2]:mb-3
        [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_li]:mb-1 [&_a]:text-emerald-600 [&_a]:underline">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
        <p className="text-sm text-slate-500 mb-8">Dernière mise à jour : {updated}</p>
        {children}
      </article>
    </main>
  );
}
