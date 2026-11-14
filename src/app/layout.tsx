import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "President Golf | Carte de score digitale",
  description: "Application digitale du President Golf de Yamoussoukro.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <head>
        <Script
          src="https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <SiteHeader />
        {children}
        <footer className="footer">
          <div className="container">President Golf de Yamoussoukro · Application en version de test</div>
        </footer>
      </body>
    </html>
  );
}
