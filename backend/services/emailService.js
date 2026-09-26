// backend/services/emailService.js
// Envoi d'emails transactionnels via l'API HTTP de Resend (https://resend.com).
// Aucune dépendance : utilise le fetch natif de Node (>= 18).
//
// Variables d'environnement :
//   RESEND_API_KEY  : clé API Resend (si absente, l'email est affiché dans la console — pratique en local)
//   EMAIL_FROM      : expéditeur, ex. "Nauticash <no-reply@mondomaine.fr>"
//                     (par défaut : onboarding@resend.dev, qui ne livre qu'à l'adresse du compte Resend)

const RESEND_URL = "https://api.resend.com/emails";

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Nauticash <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn("⚠️ RESEND_API_KEY absent — email non envoyé, contenu affiché ci-dessous :");
    console.log(`To: ${to}\nSubject: ${subject}\n\n${text || html}\n`);
    return { simulated: true };
  }

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${body}`);
  }

  return res.json();
}

async function sendPasswordResetEmail(to, resetUrl) {
  const subject = "Réinitialisation de votre mot de passe Nauticash";
  const text =
    `Bonjour,\n\n` +
    `Vous avez demandé la réinitialisation de votre mot de passe Nauticash.\n` +
    `Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe (valable 1 heure) :\n\n` +
    `${resetUrl}\n\n` +
    `Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.\n\n` +
    `L'équipe Nauticash`;

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0f172a">
    <h2 style="color:#059669">Nauticash</h2>
    <p>Bonjour,</p>
    <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
    <p style="margin:28px 0">
      <a href="${resetUrl}" style="background:#059669;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">
        Choisir un nouveau mot de passe
      </a>
    </p>
    <p style="font-size:13px;color:#475569">Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.</p>
  </div>`;

  return sendEmail({ to, subject, html, text });
}

module.exports = { sendEmail, sendPasswordResetEmail };
