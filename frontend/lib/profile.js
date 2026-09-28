// frontend/lib/profile.js
// Préférences du profil (GET /api/user/profile), chargées une fois par page et partagées
// entre l'en-tête, les pages et le formulaire « Mon profil ».

"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api";

export const DEFAULT_PROFILE = {
  displayName: "",
  avatarColor: "emerald",
  baseCurrency: "EUR",
  theme: "system",
  discreetMode: false,
  homePage: "/portfolio",
};

let shared = null; // promesse partagée { email, profile }
let current = null; // dernière valeur connue
const listeners = new Set();

/** Mode discret : classe « discreet » sur <html> (voir globals.css), mémorisée sur l'appareil */
export function applyDiscreet(on) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("discreet", Boolean(on));
  try {
    localStorage.setItem("discreet", on ? "1" : "0");
  } catch {}
}

function publish(data) {
  current = data;
  applyDiscreet(data.profile.discreetMode);
  listeners.forEach((fn) => fn(data));
}

export function fetchProfile({ force = false } = {}) {
  if (!shared || force) {
    shared = apiFetch("/api/user/profile")
      .then((d) => {
        const data = { email: d?.email || "", profile: { ...DEFAULT_PROFILE, ...(d?.profile || {}) } };
        publish(data);
        return data;
      })
      .catch((err) => {
        shared = null;
        throw err;
      });
  }
  return shared;
}

/** À appeler après un PATCH réussi pour mettre à jour l'en-tête et les pages sans recharger */
export function setCachedProfile(data) {
  const next = { email: data?.email ?? current?.email ?? "", profile: { ...DEFAULT_PROFILE, ...(data?.profile || {}) } };
  shared = Promise.resolve(next);
  publish(next);
}

/** Réinitialise le cache (déconnexion) */
export function clearProfileCache() {
  shared = null;
  current = null;
}

/** { email, profile, loading } — profile vaut les valeurs par défaut tant que rien n'est chargé */
export function useProfile() {
  const [state, setState] = useState(() => ({
    email: current?.email || "",
    profile: current?.profile || DEFAULT_PROFILE,
    loading: !current,
  }));

  useEffect(() => {
    let alive = true;
    const onChange = (d) => alive && setState({ email: d.email, profile: d.profile, loading: false });
    listeners.add(onChange);
    if (typeof window !== "undefined" && localStorage.getItem("token")) {
      fetchProfile().catch(() => alive && setState((s) => ({ ...s, loading: false })));
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
    return () => {
      alive = false;
      listeners.delete(onChange);
    };
  }, []);

  return state;
}

/** Devise de référence choisie dans le profil (EUR par défaut) */
export function useBaseCurrency() {
  return useProfile().profile.baseCurrency || "EUR";
}

/**
 * [discret, basculer] — masque les montants (« •••• ») sur toutes les pages.
 * Le changement est immédiat puis enregistré dans le profil ; annulé si l'enregistrement échoue.
 */
export function useDiscreet() {
  const { email, profile } = useProfile();
  const on = Boolean(profile.discreetMode);

  const toggle = async () => {
    const before = { email, profile };
    const next = !on;
    setCachedProfile({ email, profile: { ...profile, discreetMode: next } });
    try {
      const saved = await apiFetch("/api/user/profile", { method: "PATCH", body: { discreetMode: next } });
      setCachedProfile(saved);
    } catch {
      setCachedProfile(before);
    }
  };

  return [on, toggle];
}
