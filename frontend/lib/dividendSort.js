// Tri du tableau « Dividendes par action » (lib pure, testée dans tests/dividendSort.test.mjs).
// Colonnes triables : Total annuel (comparé dans la devise de référence), Rendement, Sur PRU.

export const DIVIDEND_SORT_KEYS = {
  totalAnnual: (row) => row.totalAnnualBase ?? row.totalAnnual,
  yieldPercent: (row) => row.yieldPercent,
  yieldOnCost: (row) => row.yieldOnCost,
};

// Cycle d'un clic sur un en-tête : décroissant → croissant → ordre par défaut.
// Changer de colonne repart du tri décroissant (le plus utile : plus gros revenus / rendements d'abord).
export function nextDividendSort(current, key) {
  if (!current || current.key !== key) return { key, dir: "desc" };
  if (current.dir === "desc") return { key, dir: "asc" };
  return { key: null, dir: null };
}

// Renvoie une copie triée ; les valeurs absentes (ex. « Sur PRU » sans PRU) restent toujours en fin de liste.
// Sans tri actif, l'ordre reçu est conservé (total annuel décroissant, fourni par estimateDividends).
export function sortDividendRows(rows, sort) {
  const list = [...(rows || [])];
  const getter = sort && DIVIDEND_SORT_KEYS[sort.key];
  if (!getter || (sort.dir !== "asc" && sort.dir !== "desc")) return list;
  const factor = sort.dir === "asc" ? 1 : -1;
  return list
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const va = getter(a.row);
      const vb = getter(b.row);
      const aMissing = va == null || Number.isNaN(Number(va));
      const bMissing = vb == null || Number.isNaN(Number(vb));
      if (aMissing || bMissing) return aMissing === bMissing ? a.index - b.index : aMissing ? 1 : -1;
      const diff = (Number(va) - Number(vb)) * factor;
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map((x) => x.row);
}

// Valeur de l'attribut aria-sort d'un en-tête.
export function ariaSortFor(sort, key) {
  if (!sort || sort.key !== key) return "none";
  return sort.dir === "asc" ? "ascending" : sort.dir === "desc" ? "descending" : "none";
}
