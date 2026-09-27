import { cx } from "./cx";

// Carte de base : surface arrondie, bordure douce, ombre légère
export default function Card({ as: Tag = "div", className, padded = true, children, ...props }) {
  return (
    <Tag
      className={cx(
        "rounded-2xl border border-line bg-surface text-ink shadow-card",
        padded && "p-5 sm:p-6",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
