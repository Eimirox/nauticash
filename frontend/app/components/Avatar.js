import { cx } from "./ui/cx";

// Couleurs d'avatar proposées (doivent correspondre à AVATAR_COLORS côté backend)
export const AVATAR_COLORS = {
  emerald: "bg-emerald-600",
  blue: "bg-blue-600",
  teal: "bg-teal-600",
  indigo: "bg-indigo-600",
  amber: "bg-amber-600",
  rose: "bg-rose-600",
  slate: "bg-slate-600",
};

export function initialsOf(name, email) {
  const src = (name || "").trim() || (email || "").split("@")[0];
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : src.slice(0, 2);
  return letters.toUpperCase() || "?";
}

export function Avatar({ name, email, color = "emerald", size = "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        AVATAR_COLORS[color] || AVATAR_COLORS.emerald,
        size === "lg" ? "h-16 w-16 text-xl" : size === "sm" ? "h-7 w-7 text-[11px]" : "h-8 w-8 text-xs"
      )}
    >
      {initialsOf(name, email)}
    </span>
  );
}
