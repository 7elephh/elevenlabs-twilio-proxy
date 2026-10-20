import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";

import { SITE_URL } from "@/lib/env";

import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Le King Barber — L'art de soigner son style",
    template: "%s — Le King Barber",
  },
  description:
    "Le King Barber, salon de coiffure masculine et barbier. Coupes, dégradés et barbe. Nouveau salon, réservation en ligne en 30 secondes.",
  applicationName: "Le King Barber",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Le King Barber",
    title: "Le King Barber — L'art de soigner son style",
    description: "Coupes, dégradés et barbe. Réservation en ligne en 30 secondes.",
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#111214",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
