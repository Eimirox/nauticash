// Métadonnées (titre, indexation) de la page : la page elle-même est un composant client.
export const metadata = {
  title: "Connexion",
  description:
    "Connectez-vous à Nauticash pour suivre votre portefeuille boursier.",
  alternates: { canonical: "/login" },
};

export default function Layout({ children }) {
  return children;
}
