// utils/styles.js
export function getPerformanceClass(performance) {
    if (performance > 0) return "text-gain font-semibold";
    if (performance < 0) return "text-loss font-semibold";
    return ""; // Pas de style si 0 ou null
  }
  