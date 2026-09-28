import { SITE_URL, PRIVATE_PATHS, isPrivateBeta } from "@/lib/site";

// Lu à chaque requête : suit l'activation/désactivation de la bêta privée sans rebuild.
export const dynamic = "force-dynamic";

export default function robots() {
  if (isPrivateBeta()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
