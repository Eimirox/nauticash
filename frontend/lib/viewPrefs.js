// frontend/lib/viewPrefs.js
// Hook usePersistedPreference : un tri ou un filtre choisi est mémorisé dans le compte de l'utilisateur
// (PATCH /api/user/profile, champ viewPrefs) et retrouvé d'une visite à l'autre et d'un appareil à l'autre.
//
//   const [sort, setSort, { reset, customized }] = usePersistedPreference(VIEW_PREF_CODECS.dividendSort);
//
// - Au chargement : copie locale de l'appareil (affichage rapide, secours si l'API est indisponible),
//   puis valeur du compte dès que le profil est chargé (le compte fait foi).
// - À chaque changement : état immédiat, copie locale, puis enregistrement groupé (600 ms) ;
//   un échec d'enregistrement n'interrompt jamais l'écran.
// - Les préférences ne contiennent que des choix d'affichage (tri, filtre, années), rien de sensible.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, getToken } from "./api";
import { useProfile, setCachedProfile } from "./profile";
import { sameValue, isCustomized } from "./viewPrefCodecs";

export { VIEW_PREF_CODECS } from "./viewPrefCodecs";

export const LOCAL_PREFIX = "nauticash:vp:";
const SAVE_DELAY_MS = 600;

const timers = new Map(); // nom de préférence → minuteur d'enregistrement en attente
const inflight = new Set(); // noms de préférences en cours d'enregistrement

function readLocal(name) {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + name);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeLocal(name, stored) {
  try {
    if (stored === null) localStorage.removeItem(LOCAL_PREFIX + name);
    else localStorage.setItem(LOCAL_PREFIX + name, JSON.stringify(stored));
  } catch {}
}

/** Efface les copies locales (à la déconnexion : l'appareil peut servir à un autre compte) */
export function clearLocalViewPrefs() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(LOCAL_PREFIX)) localStorage.removeItem(key);
    }
  } catch {}
}

function scheduleSave(name, stored) {
  if (!getToken()) return; // pas connecté : rien à enregistrer côté compte
  clearTimeout(timers.get(name));
  timers.set(
    name,
    setTimeout(async () => {
      timers.delete(name);
      inflight.add(name);
      try {
        const saved = await apiFetch("/api/user/profile", { method: "PATCH", body: { viewPrefs: { [name]: stored } } });
        setCachedProfile(saved);
      } catch {
        // Hors ligne ou erreur serveur : la copie locale garde le choix, on réessaiera au prochain changement
      } finally {
        inflight.delete(name);
      }
    }, SAVE_DELAY_MS)
  );
}

/**
 * @param codec un élément de VIEW_PREF_CODECS
 * @returns [valeur, setValeur, { reset, customized, ready }]
 *   setValeur accepte une valeur ou une fonction (comme useState) ;
 *   ready passe à true quand la valeur du compte est connue (pour attendre avant d'appliquer un tri par défaut).
 */
export function usePersistedPreference(codec) {
  const { name, defaultValue, serialize, deserialize } = codec;
  const { profile, loading } = useProfile();
  const [value, setValueState] = useState(defaultValue);
  const [ready, setReady] = useState(false);
  const valueRef = useRef(defaultValue);

  const apply = useCallback((next) => {
    valueRef.current = next;
    setValueState(next);
  }, []);

  // 1) copie locale de l'appareil, tout de suite après l'affichage
  useEffect(() => {
    const local = readLocal(name);
    if (local !== undefined) apply(deserialize(local));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // 2) valeur du compte une fois le profil chargé (le compte fait foi, sauf enregistrement en cours)
  const accountValue = profile?.viewPrefs?.[name];
  const accountKey = JSON.stringify(accountValue ?? null);
  useEffect(() => {
    if (loading) return;
    setReady(true);
    if (timers.has(name) || inflight.has(name)) return;
    // On compare les formes enregistrées : un état vide local (ex. aucune année cochée) n'est pas écrasé
    // par l'absence de préférence côté compte, qui en est justement la forme enregistrée
    if (!sameValue(serialize(valueRef.current), accountValue ?? null)) apply(deserialize(accountValue));
    writeLocal(name, serialize(valueRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, accountKey, name]);

  const setValue = useCallback(
    (next) => {
      const resolved = typeof next === "function" ? next(valueRef.current) : next;
      apply(resolved);
      const stored = serialize(resolved);
      writeLocal(name, stored);
      scheduleSave(name, stored);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, apply]
  );

  const reset = useCallback(() => setValue(defaultValue), [setValue, defaultValue]);

  return [value, setValue, { reset, customized: isCustomized(codec, value), ready }];
}
