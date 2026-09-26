import Link from "next/link";
import LegalPage from "../components/LegalPage";

export const metadata = { title: "Conditions d'utilisation et mentions légales" };

// ⚠️ À compléter : les éléments entre [crochets] (éditeur, contact, hébergeurs).
export default function CGU() {
  return (
    <LegalPage title="Conditions d'utilisation et mentions légales" updated="26 septembre 2026">
      <h2>1. Mentions légales</h2>
      <ul>
        <li><strong>Éditeur du site :</strong> [Nom et prénom de l'éditeur], [adresse postale ou « adresse communiquée sur demande » si particulier non professionnel]</li>
        <li><strong>Contact :</strong> [adresse email de contact]</li>
        <li><strong>Directeur de la publication :</strong> [Nom et prénom]</li>
        <li><strong>Hébergement du site :</strong> [ex. Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis]</li>
        <li><strong>Hébergement de l'API et des données :</strong> [ex. hébergeur du serveur] et [MongoDB Atlas – région du cluster]</li>
      </ul>

      <h2>2. Objet</h2>
      <p>
        Nauticash est un outil de suivi de portefeuille qui permet d'enregistrer ses positions (actions, ETF, cryptomonnaies),
        son cash, et de consulter des indicateurs de performance, de dividendes et de répartition. Les présentes conditions
        encadrent l'utilisation du service. En créant un compte, vous les acceptez.
      </p>

      <h2>3. Absence de conseil en investissement</h2>
      <p>
        Nauticash est un outil de suivi à visée informative. Aucune information affichée ne constitue un conseil en investissement,
        une recommandation d'achat ou de vente, ni une offre de service financier. Vous restez seul responsable de vos décisions
        d'investissement.
      </p>

      <h2>4. Données de marché</h2>
      <p>
        Les cours, dividendes et informations sur les sociétés proviennent de fournisseurs tiers (par exemple Financial Modeling Prep
        et Alpha Vantage). Ils sont actualisés périodiquement et peuvent être retardés, incomplets ou erronés. Nauticash ne garantit
        pas leur exactitude et ne saurait être tenu responsable d'une décision prise sur leur base.
      </p>

      <h2>5. Compte utilisateur</h2>
      <ul>
        <li>Vous devez fournir une adresse email valide et choisir un mot de passe robuste.</li>
        <li>Vous êtes responsable de la confidentialité de vos identifiants et de l'activité de votre compte.</li>
        <li>En cas d'oubli, le mot de passe peut être réinitialisé via la page « Mot de passe oublié ».</li>
        <li>Vous pouvez demander la suppression de votre compte à tout moment à l'adresse de contact ci-dessus.</li>
      </ul>

      <h2>6. Utilisation acceptable</h2>
      <p>
        Il est interdit de perturber le fonctionnement du service, d'en automatiser l'usage de manière abusive, de tenter d'accéder
        aux données d'autres utilisateurs ou de contourner les limitations techniques. Tout manquement peut entraîner la suspension
        du compte.
      </p>

      <h2>7. Disponibilité</h2>
      <p>
        Le service est fourni « en l'état », en version bêta. Il peut être interrompu, modifié ou arrêté à tout moment, notamment
        pour maintenance. Nous vous recommandons de conserver vos propres relevés auprès de votre courtier.
      </p>

      <h2>8. Propriété intellectuelle</h2>
      <p>
        Le nom Nauticash, le logo, le design et le code du site sont protégés. Les données que vous saisissez restent les vôtres.
      </p>

      <h2>9. Données personnelles</h2>
      <p>
        Le traitement de vos données est décrit dans la <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>10. Modification des conditions et droit applicable</h2>
      <p>
        Ces conditions peuvent évoluer ; la date de mise à jour figure en haut de la page. Elles sont soumises au droit français.
      </p>
    </LegalPage>
  );
}
