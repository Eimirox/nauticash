// Métadonnées (titre, indexation) de la page : la page elle-même est un composant client.
export const metadata = {
  title: "Objectifs",
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return children;
}
