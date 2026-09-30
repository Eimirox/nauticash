// Adresse publique du site, utilisée pour le SEO (sitemap, robots, balises Open Graph).
// Priorité : NEXT_PUBLIC_SITE_URL, puis le domaine de production fourni par Vercel, puis le local.
function resolveSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = "Nauticash";
export const SITE_DESCRIPTION =
  "Suivez votre portefeuille d'actions, d'ETF et de cryptos : performance, dividendes et répartition géographique.";

// Pages publiques indexables (les pages du compte sont exclues).
export const PUBLIC_PATHS = ["/", "/register", "/login", "/cgu", "/confidentialite"];

// Pages privées ou sans intérêt pour les moteurs de recherche.
export const PRIVATE_PATHS = [
  "/portfolio",
  "/tableau-de-bord",
  "/analyses",
  "/objectifs",
  "/strategie",
  "/analytics",
  "/profil",
  "/compte",
  "/forgot-password",
  "/reset-password",
];

// Bêta privée (Basic Auth active) : on demande aux robots de ne rien indexer.
export function isPrivateBeta() {
  return Boolean(process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASSWORD);
}
