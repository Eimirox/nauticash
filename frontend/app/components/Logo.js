// Logo Nauticash (petite image carrée à taille fixe, déjà en WebP) : une balise <img> simple
// suffit, l'optimisation de next/image n'apporte rien ici et imposerait une configuration
// des images locales avec paramètre de version (?v=).
export default function Logo({ size = 32, alt = "", className = "" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo_nauticash.webp?v=3" alt={alt} width={size} height={size} className={className} />
  );
}
