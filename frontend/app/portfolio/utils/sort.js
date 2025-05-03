
// Fonction qui permet de faire le trie croissant/décroissant
export const sortByPrice = (stocks, order) => {
  if (order === "asc") {
    return [...stocks].sort((a, b) => a.price - b.price);
  } else if (order === "desc") {
    return [...stocks].sort((a, b) => b.price - a.price);
  }
  return stocks; // no tri
};