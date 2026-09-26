import LegalPage from "../components/LegalPage";

export const metadata = { title: "Politique de confidentialité" };

// ⚠️ À compléter : les éléments entre [crochets] (responsable, contact, hébergeurs).
export default function Confidentialite() {
  return (
    <LegalPage title="Politique de confidentialité" updated="26 septembre 2026">
      <h2>1. Responsable du traitement</h2>
      <p>
        [Nom et prénom de l'éditeur] – contact : [adresse email de contact].
      </p>

      <h2>2. Données collectées</h2>
      <ul>
        <li><strong>Compte :</strong> adresse email et mot de passe (stocké uniquement sous forme chiffrée, jamais en clair).</li>
        <li><strong>Portefeuille :</strong> tickers, quantités, prix de revient unitaire, montant et devise du cash, historique de valeur que vous saisissez.</li>
        <li><strong>Technique :</strong> adresse IP, conservée temporairement en mémoire pour limiter les tentatives de connexion abusives.</li>
      </ul>
      <p>Aucune donnée bancaire, aucun identifiant de courtier et aucune pièce d'identité ne sont demandés.</p>

      <h2>3. Finalités et bases légales</h2>
      <ul>
        <li>Fournir le service de suivi de portefeuille (exécution du contrat).</li>
        <li>Sécuriser le compte : authentification, réinitialisation du mot de passe, protection contre les abus (intérêt légitime).</li>
      </ul>
      <p>Vos données ne sont ni vendues, ni louées, ni utilisées à des fins publicitaires.</p>

      <h2>4. Destinataires et sous-traitants</h2>
      <ul>
        <li><strong>Hébergement du site :</strong> [ex. Vercel]</li>
        <li><strong>Hébergement de l'API :</strong> [hébergeur du serveur]</li>
        <li><strong>Base de données :</strong> MongoDB Atlas [région du cluster]</li>
        <li><strong>Envoi d'emails</strong> (réinitialisation du mot de passe) : Resend – reçoit uniquement votre adresse email.</li>
      </ul>
      <p>
        Les fournisseurs de données de marché reçoivent uniquement les tickers à actualiser, jamais votre identité.
        Certains prestataires étant situés hors de l'Union européenne, les transferts sont encadrés par les clauses
        contractuelles types de la Commission européenne ou le Data Privacy Framework.
      </p>

      <h2>5. Durée de conservation</h2>
      <ul>
        <li>Données du compte et du portefeuille : tant que le compte existe, puis suppression sur demande.</li>
        <li>Lien de réinitialisation du mot de passe : 1 heure.</li>
        <li>Adresses IP pour la limitation des tentatives : 1 heure au maximum, en mémoire uniquement.</li>
      </ul>

      <h2>6. Cookies et stockage local</h2>
      <p>
        Nauticash n'utilise ni cookie publicitaire ni outil de mesure d'audience. Le navigateur stocke localement votre jeton
        de connexion et votre choix de langue, strictement nécessaires au fonctionnement du site.
      </p>

      <h2>7. Vos droits</h2>
      <p>
        Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos
        données. Pour les exercer, écrivez à [adresse email de contact]. Vous pouvez également introduire une réclamation auprès
        de la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>).
      </p>

      <h2>8. Sécurité</h2>
      <p>
        Les mots de passe sont hachés (bcrypt), les échanges sont chiffrés (HTTPS) et l'accès aux données est limité à votre
        compte via un jeton d'authentification.
      </p>
    </LegalPage>
  );
}
