// utils/styles.js
export function getPerformanceClass(performance) {
    if (performance > 0) return "text-green-600 font-semibold";
    if (performance < 0) return "text-red-600 font-semibold";
    return ""; // Pas de style si 0 ou null
  }
  