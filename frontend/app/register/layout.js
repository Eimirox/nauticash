// Métadonnées (titre, indexation) de la page : la page elle-même est un composant client.
export const metadata = {
  title: "Créer un compte",
  description:
    "Créez votre compte Nauticash (gratuit pendant la bêta) et suivez actions, ETF et cryptos au même endroit.",
  alternates: { canonical: "/register" },
};

export default function Layout({ children }) {
  return children;
}
