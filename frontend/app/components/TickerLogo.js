"use client";

import { useState } from "react";
import { cx } from "./ui/cx";

// Couleur stable par ticker pour les initiales de secours
const COLORS = ["bg-emerald-600", "bg-blue-600", "bg-indigo-600", "bg-teal-600", "bg-amber-600", "bg-rose-600", "bg-slate-600"];
const colorOf = (t) => COLORS[[...String(t)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

/**
 * Logo de l'entreprise (images publiques FMP) ; initiales colorées si l'image n'existe pas.
 */
export default function TickerLogo({ ticker, logo, size = 32, className }) {
  const [failed, setFailed] = useState(false);
  const initials = String(ticker || "?").replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase();
  const style = { width: size, height: size };

  if (!logo || failed) {
    return (
      <span
        aria-hidden="true"
        style={style}
        className={cx("inline-flex shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white", colorOf(ticker), className)}
      >
        {initials}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={style}
      className={cx("shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-line", className)}
    />
  );
}
