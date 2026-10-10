import { buildWebManifest } from "@/lib/webManifest";

// Servi à /manifest.webmanifest ; Next ajoute automatiquement <link rel="manifest"> dans <head>.
export default function manifest() {
  return buildWebManifest();
}
