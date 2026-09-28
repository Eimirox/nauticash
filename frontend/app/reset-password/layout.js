// Métadonnées (titre, indexation) de la page : la page elle-même est un composant client.
export const metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return children;
}
