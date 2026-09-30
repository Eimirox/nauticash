import ComingSoonPage from "../components/ComingSoonPage";

export const metadata = {
  title: "Objectifs",
  robots: { index: false, follow: false },
};

export default function Objectifs() {
  return (
    <ComingSoonPage
      title="Objectifs"
      intro="Fixez un cap : un patrimoine à atteindre ou une rente de dividendes, et suivez la route pour y arriver."
      upcoming={[
        "Objectif de patrimoine (par exemple 1 M€) ou de rente de dividendes",
        "Projection avec vos versements mensuels et un rendement estimé",
        "Date d'arrivée estimée et versement mensuel nécessaire",
      ]}
    />
  );
}
