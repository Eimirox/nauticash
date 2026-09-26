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

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}

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
