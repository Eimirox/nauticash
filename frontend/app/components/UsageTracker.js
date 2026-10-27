"use client";
// Fréquentation interne (sans cookie ni outil tiers) : signale chaque écran consulté par un compte connecté.
// Seul le chemin de la page est envoyé ; un échec n'a aucun effet visible.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { API_BASE, getToken } from "@/lib/api";

export default function UsageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const token = getToken();
    if (!token || !pathname) return;
    fetch(`${API_BASE}/api/user/usage/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);
  return null;
}
