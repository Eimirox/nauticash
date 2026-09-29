import { SITE_URL, PUBLIC_PATHS } from "@/lib/site";

const PRIORITY = { "/": 1, "/register": 0.8, "/login": 0.5 };

export default function sitemap() {
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: PRIORITY[path] ?? 0.3,
  }));
}
