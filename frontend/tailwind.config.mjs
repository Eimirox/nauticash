/** @type {import('tailwindcss').Config} */
// Couleurs de marque exposées en variables CSS (app/globals.css, voir docs/DESIGN.md)
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        bg: token("bg"),
        surface: { DEFAULT: token("surface"), 2: token("surface-2") },
        line: token("border"),
        ink: { DEFAULT: token("text"), muted: token("text-muted") },
        accent: { DEFAULT: token("accent"), 2: token("accent-2") },
        "on-accent": token("on-accent"),
        gain: token("gain"),
        loss: token("loss"),
        warn: token("warn"),
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(11 27 43 / 0.04), 0 4px 16px -4px rgb(11 27 43 / 0.08)",
      },
    },
  },
  plugins: [],
};
