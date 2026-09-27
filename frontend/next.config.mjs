/** @type {import('next').NextConfig} */

// Origine du backend (appels API) : autorisée explicitement dans la politique de sécurité du contenu
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000").origin;
  } catch {
    return "";
  }
})();

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy : n'autorise que le site lui-même, le backend et l'API de taux de change.
// 'unsafe-inline' reste nécessaire pour les scripts d'initialisation de Next.js et du thème.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} https://api.exchangerate-api.com${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Interdit l'affichage du site dans une iframe (protection contre le clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Empêche le navigateur de deviner le type des fichiers
  { key: "X-Content-Type-Options", value: "nosniff" },
  // N'envoie que le domaine (pas l'adresse complète) aux sites externes
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Désactive les fonctionnalités sensibles du navigateur, inutiles ici
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  // Force le HTTPS pendant 2 ans (ignoré en HTTP local)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
