"use client";

// Dernier recours si la mise en page principale elle-même plante (styles minimaux intégrés)
export default function GlobalError({ reset }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0B1B2B", color: "#E8EEF2" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <p style={{ color: "#34D399", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontSize: 13 }}>Nauticash</p>
            <h1 style={{ fontSize: 28, margin: "8px 0 12px" }}>Le site rencontre un problème</h1>
            <p style={{ color: "#9FB0BF", marginBottom: 24 }}>Rechargez la page ou réessayez dans quelques minutes.</p>
            <button onClick={() => reset()} style={{ minHeight: 44, padding: "0 20px", borderRadius: 12, border: 0, fontWeight: 600, background: "#34D399", color: "#0B1B2B", cursor: "pointer" }}>
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
