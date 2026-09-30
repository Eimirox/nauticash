import ComingSoonPage from "../components/ComingSoonPage";

export const metadata = {
  title: "Stratégie",
  robots: { index: false, follow: false },
};

export default function Strategie() {
  return (
    <ComingSoonPage
      title="Stratégie"
      intro="Définissez la répartition que vous visez et comparez-la à votre portefeuille actuel."
      upcoming={[
        "Répartition cible par type d'actif, zone et secteur",
        "Écarts entre votre portefeuille et votre cible",
        "Pistes de rééquilibrage (sans recommandation d'achat d'un titre précis)",
      ]}
    />
  );
}
