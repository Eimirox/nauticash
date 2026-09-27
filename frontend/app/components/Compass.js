// Boussole Nauticash (élément signature, voir docs/DESIGN.md)
export default function Compass({ className = "", spin = false }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none">
      <circle cx="32" cy="32" r="29" stroke="currentColor" strokeOpacity=".25" strokeWidth="2" />
      <circle cx="32" cy="32" r="21" stroke="currentColor" strokeOpacity=".15" strokeWidth="1.5" strokeDasharray="2 4" />
      {["N", "E", "S", "O"].map((l, i) => {
        const pos = [[32, 11], [53, 33.5], [32, 56], [11, 33.5]][i];
        return (
          <text key={l} x={pos[0]} y={pos[1]} textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" fillOpacity=".55">
            {l}
          </text>
        );
      })}
      <g className={spin ? "origin-center animate-[spin_6s_linear_infinite]" : ""} style={{ transformOrigin: "32px 32px" }}>
        <path d="M32 14 L37 32 L32 36 L27 32 Z" fill="rgb(var(--accent))" />
        <path d="M32 50 L27 32 L32 28 L37 32 Z" fill="rgb(var(--accent-2))" fillOpacity=".7" />
      </g>
      <circle cx="32" cy="32" r="2.5" fill="rgb(var(--text))" />
    </svg>
  );
}
