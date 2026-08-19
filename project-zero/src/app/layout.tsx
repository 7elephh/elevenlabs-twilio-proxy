import type { Metadata, Viewport } from "next";

import { BottomNav, TopNav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROJECT ZERO — Football Development System",
  description:
    "Minimum input, maximum insight: measure football progression against a fixed baseline.",
  applicationName: "PROJECT ZERO",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PROJECT ZERO",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 antialiased">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-24 pt-5 md:max-w-4xl md:pb-10">
          <header className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-bold tracking-[0.22em] text-chalk-100">
                PROJECT ZERO
              </p>
              <p className="text-[10px] uppercase tracking-[0.28em] text-chalk-600">
                Football Development System
              </p>
            </div>
            <TopNav />
          </header>
          <main className="flex-1">{children}</main>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
