import { cx } from "./cx";

const VARIANTS = {
  primary:
    "bg-gradient-to-r from-emerald-600 to-blue-600 text-white shadow-sm hover:shadow-md hover:brightness-110 dark:from-emerald-500 dark:to-blue-500",
  accent: "bg-accent text-on-accent hover:brightness-110",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-ink-muted hover:text-ink hover:bg-surface-2",
  danger: "bg-loss/10 text-loss border border-loss/30 hover:bg-loss hover:text-white",
};

const SIZES = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 sm:min-h-10 px-4 text-sm",
  lg: "min-h-12 px-6 text-base",
};

// Bouton du design system. `loading` désactive le bouton et affiche un indicateur.
export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
