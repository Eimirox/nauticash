import { cx } from "./cx";

const TONES = {
  neutral: "bg-surface-2 text-ink-muted border-line",
  accent: "bg-accent/10 text-accent border-accent/30",
  info: "bg-accent-2/10 text-accent-2 border-accent-2/30",
  gain: "bg-gain/10 text-gain border-gain/30",
  loss: "bg-loss/10 text-loss border-loss/30",
  warn: "bg-warn/10 text-warn border-warn/30",
};

// Correspondance type d'actif → libellé et ton
const ASSET_TYPES = {
  STOCK: ["Action", "info"],
  EQUITY: ["Action", "info"],
  ETF: ["ETF", "accent"],
  CRYPTO: ["Crypto", "warn"],
  CRYPTOCURRENCY: ["Crypto", "warn"],
};

export default function Badge({ tone = "neutral", className, children }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-semibold",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function AssetTypeBadge({ type }) {
  const [label, tone] = ASSET_TYPES[(type || "").toUpperCase()] || [type || "Autre", "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}
