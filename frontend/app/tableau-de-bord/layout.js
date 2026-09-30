// Métadonnées (titre, indexation) de la page : la page elle-même est un composant client.
export const metadata = {
  title: "Tableau de bord",
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return children;
}
