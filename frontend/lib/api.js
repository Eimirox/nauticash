// frontend/lib/api.js
// Appels au backend : ajoute le token, gère les erreurs et la session expirée.

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function getToken() {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

export function logout() {
  try {
    localStorage.removeItem("token");
  } catch {}
  window.location.href = "/login";
}

/**
 * apiFetch("/api/user/portfolio", { method: "POST", body: { ticker: "AAPL" } })
 * - Ajoute automatiquement "Authorization: Bearer <token>"
 * - Redirige vers /login si la session est expirée (401)
 * - Lève une ApiError avec le message du backend en cas d'erreur
 */
export async function apiFetch(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getToken();
    if (!token) {
      logout();
      throw new ApiError("Session expirée", 401);
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.", 0);
  }

  // Le backend renvoie toujours du JSON : une page HTML signifie qu'il est indisponible
  // ou pas à jour (route inconnue, déploiement en cours ou en échec).
  let data = null;
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  if (isJson) {
    try {
      data = await res.json();
    } catch {}
  } else if (res.status !== 204) {
    console.error(`Réponse non-JSON de ${API_BASE}${path} (HTTP ${res.status})`);
    throw new ApiError("Le serveur est momentanément indisponible. Réessayez dans quelques minutes.", res.status);
  }

  if (res.status === 401 && auth) {
    logout();
    throw new ApiError("Session expirée", 401);
  }

  if (!res.ok) {
    const message = data?.error || data?.details?.[0]?.msg || data?.message || `Erreur ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return data;
}

/**
 * Télécharge un fichier servi par le backend (export CSV / JSON) avec le token.
 * apiDownload("/api/user/export?format=csv", "nauticash-positions.csv")
 */
export async function apiDownload(path, filename) {
  const token = getToken();
  if (!token) {
    logout();
    throw new ApiError("Session expirée", 401);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.", 0);
  }
  if (res.status === 401) {
    logout();
    throw new ApiError("Session expirée", 401);
  }
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      message = (await res.json()).error || message;
    } catch {}
    throw new ApiError(message, res.status);
  }

  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
