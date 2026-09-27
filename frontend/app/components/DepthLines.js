// Motif discret de lignes de niveau (bathymétrie) pour les fonds de page vides
export default function DepthLines({ className = "" }) {
  const paths = Array.from({ length: 9 }, (_, i) => {
    const y = 40 + i * 55;
    const a = 18 + (i % 3) * 8;
    return `M-20 ${y} C 180 ${y - a}, 320 ${y + a}, 520 ${y} S 860 ${y - a}, 1060 ${y + a / 2}`;
  });
  return (
    <svg viewBox="0 0 1040 560" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="1.2" strokeOpacity={0.05 + (i % 3) * 0.015} />
      ))}
    </svg>
  );
}
