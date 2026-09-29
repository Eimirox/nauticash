// frontend/lib/chartSummary.js
// Résumés texte des graphiques pour les lecteurs d'écran (role="img" + aria-label).
// Un graphique canvas/SVG n'est pas lisible : on décrit la répartition ou la tendance en une phrase.

const pctFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** « +3,2 % » / « −1,5 % » (signe moins typographique, comme dans l'interface) */
export function signedPct(p) {
  if (p == null || !Number.isFinite(p)) return "inconnue";
  const sign = p > 0 ? "+" : p < 0 ? "−" : "";
  return `${sign}${pctFmt.format(Math.abs(p))} %`;
}

/**
 * Répartition : items [{ label, value }] → « Actions 62 %, ETF 30 % et 2 autres (8 %) ».
 * Les parts sont calculées sur la somme des valeurs positives, triées de la plus grande à la plus petite.
 */
export function shareSummary(items, max = 4) {
  const rows = (items || []).filter((r) => Number(r.value) > 0);
  const total = rows.reduce((s, r) => s + Number(r.value), 0);
  if (!rows.length || !(total > 0)) return "aucune donnée";
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, max).map((r) => `${r.label} ${pctFmt.format((r.value / total) * 100)} %`);
  const rest = sorted.slice(max);
  if (rest.length) {
    const restPct = (rest.reduce((s, r) => s + Number(r.value), 0) / total) * 100;
    const others = `${rest.length} autre${rest.length > 1 ? "s" : ""} (${pctFmt.format(restPct)} %)`;
    return `${head.join(", ")} et ${others}`;
  }
  if (head.length === 1) return head[0];
  return `${head.slice(0, -1).join(", ")} et ${head[head.length - 1]}`;
}

/**
 * Barres : rows [{ label, value }] → « point haut en mars (120 €), point bas en mai (10 €) ».
 * format : valeur → texte. Les barres nulles ou absentes sont ignorées.
 */
export function barsSummary(rows, format = (v) => pctFmt.format(v)) {
  const vals = (rows || []).filter((r) => Number(r.value) > 0);
  if (!vals.length) return "aucune donnée";
  const hi = vals.reduce((a, b) => (b.value > a.value ? b : a));
  const lo = vals.reduce((a, b) => (b.value < a.value ? b : a));
  if (hi === lo) return `${vals.length === 1 ? "une seule valeur" : "valeurs identiques"} : ${hi.label} (${format(hi.value)})`;
  return `point haut en ${hi.label} (${format(hi.value)}), point bas en ${lo.label} (${format(lo.value)})`;
}

/**
 * Tendance d'une série : points [{ label, value }] dans l'ordre → « de 10 000 € en janv. à 12 000 € en déc. (+20 %) ».
 * Les points sans valeur sont ignorés.
 */
export function trendSummary(points, format = (v) => pctFmt.format(v)) {
  const pts = (points || []).filter((p) => p.value != null && Number.isFinite(Number(p.value)));
  if (!pts.length) return "aucune donnée";
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length === 1) return `${format(first.value)} en ${first.label}`;
  const change = first.value ? signedPct(((last.value - first.value) / Math.abs(first.value)) * 100) : null;
  return `de ${format(first.value)} en ${first.label} à ${format(last.value)} en ${last.label}${change ? ` (${change})` : ""}`;
}
