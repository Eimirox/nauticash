// Métadonnées (titre, indexation) de la page : la page elle-même est un composant client.
export const metadata = {
  title: "Mon profil",
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return children;
}
