// Métadonnées (titre, indexation) des pages d'analyse : les pages elles-mêmes sont des composants clients.
export const metadata = {
  title: "Analyses",
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return children;
}
