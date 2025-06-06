
// Fonction qui permet de faire le trie croissant/décroissant
// Tri croissant/décroissant sur la valeur 'close'
export const sortByPrice = (stocks, order) => {
  if (order === "asc") {
    return [...stocks].sort((a, b) => (a.close ?? 0) - (b.close ?? 0));
  } else if (order === "desc") {
    return [...stocks].sort((a, b) => (b.close ?? 0) - (a.close ?? 0));
  }
  return stocks;
};