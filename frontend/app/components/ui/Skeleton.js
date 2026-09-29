import { cx } from "./cx";

// Squelettes de chargement (voir docs/DESIGN.md, « États de chargement »).
// Pulsation seulement si l'utilisateur accepte les animations (motion-safe).

// Bloc gris arrondi, décoratif : masqué des lecteurs d'écran
export default function Skeleton({ className }) {
  return <span aria-hidden="true" className={cx("block rounded-md bg-surface-2 motion-safe:animate-pulse", className)} />;
}

// Conteneur annoncé une seule fois aux lecteurs d'écran (« Chargement de … »)
export function SkeletonRegion({ label, className, children, as: Tag = "div" }) {
  return (
    <Tag role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </Tag>
  );
}

// Carte KPI : libellé, valeur, variation
export function SkeletonStat({ className }) {
  return (
    <div aria-hidden="true" className={cx("rounded-xl border border-line bg-surface p-6 shadow-card", className)}>
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="mb-2 h-7 w-36" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

// Carte avec titre et zone de graphique
export function SkeletonChart({ className, height = "h-64" }) {
  return (
    <div aria-hidden="true" className={cx("rounded-xl border border-line bg-surface p-6 shadow-card", className)}>
      <Skeleton className="mb-6 h-5 w-48" />
      <Skeleton className={cx("w-full rounded-lg", height)} />
    </div>
  );
}

// Lignes de tableau (dans un <tbody>) : cellules grises de largeurs variées
const WIDTHS = ["w-16", "w-24", "w-12", "w-20", "w-14"];
export function SkeletonRows({ rows = 5, cols = 6 }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} aria-hidden="true" className="border-t border-line">
      {Array.from({ length: cols }, (_, c) => (
        <td key={c} className="px-6 py-4">
          <Skeleton className={cx("h-4", WIDTHS[(r + c) % WIDTHS.length])} />
        </td>
      ))}
    </tr>
  ));
}

// Liste de cartes (vue mobile des positions)
export function SkeletonList({ items = 3, className }) {
  return (
    <div aria-hidden="true" className={cx("space-y-3", className)}>
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-4 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
