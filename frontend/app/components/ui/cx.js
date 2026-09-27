// Concatène des classes CSS en ignorant les valeurs vides
export const cx = (...classes) => classes.filter(Boolean).join(" ");
