import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "./components/ui/Toast";
import { themeInitScript } from "./components/ui/ThemeToggle";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  // Base des URL absolues (Open Graph, canonical) ; image et icônes : fichiers opengraph-image.png, icon.png, apple-icon.png d'app/
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nauticash – Suivi de portefeuille boursier",
    template: "%s | Nauticash",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE_NAME,
    title: "Nauticash – Suivi de portefeuille boursier",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Nauticash – Suivi de portefeuille boursier",
    description: SITE_DESCRIPTION,
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F8F6" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1B2B" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a href="#contenu" className="skip-link">
          Aller au contenu
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
