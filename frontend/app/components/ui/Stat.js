import { cx } from "./cx";
import { formatPercent } from "./format";

// Variation avec signe et flèche : la couleur n'est jamais le seul indicateur
export function Delta({ value, suffix, className }) {
  if (value == null || !Number.isFinite(Number(value))) {
    return <span className={cx("text-ink-muted", className)}>—</span>;
  }
  const v = Number(value);
  const tone = v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-ink-muted";
  const arrow = v > 0 ? "▲" : v < 0 ? "▼" : "•";
  return (
    <span className={cx("inline-flex items-center gap-1 font-semibold tabular-nums", tone, className)}>
      <span aria-hidden="true" className="text-[0.7em]">{arrow}</span>
      {formatPercent(v)}
      {suffix && <span className="font-normal text-ink-muted">{suffix}</span>}
    </span>
  );
}

// Indicateur : libellé en petites capitales, valeur en grand, variation dessous
export default function Stat({ label, value, delta, deltaSuffix, size = "md", className, children }) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      <span
        className={cx(
          "font-semibold tabular-nums text-ink",
          size === "xl" ? "text-4xl sm:text-5xl" : size === "lg" ? "text-3xl" : "text-2xl"
        )}
      >
        {value}
      </span>
      {delta !== undefined && <Delta value={delta} suffix={deltaSuffix} className="text-sm" />}
      {children}
    </div>
  );
}
