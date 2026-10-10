// Manifeste d'application web (PWA simple, sans mode hors ligne ni service worker) :
// rend Nauticash « installable » sur l'écran d'accueil d'un mobile.
// Servi par app/manifest.js à l'adresse /manifest.webmanifest.
import { SITE_NAME, SITE_DESCRIPTION } from "./site.js";

// Couleurs reprises de docs/DESIGN.md (--bg clair « écume » et sombre « abysse »).
const BG_LIGHT = "#F7F8F6";
const BG_DARK = "#0B1B2B";

export const MANIFEST_ICONS = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  // Fond plein et logo dans la zone sûre : Android peut la découper en cercle ou en carré arrondi.
  { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export function buildWebManifest() {
  return {
    id: "/",
    name: `${SITE_NAME} – Suivi de portefeuille boursier`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: "fr",
    dir: "ltr",
    // L'application installée ouvre directement le tableau de bord (redirection vers la connexion si besoin).
    start_url: "/tableau-de-bord",
    scope: "/",
    display: "standalone",
    background_color: BG_LIGHT,
    theme_color: BG_DARK,
    categories: ["finance"],
    icons: MANIFEST_ICONS,
  };
}
