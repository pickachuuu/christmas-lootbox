import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";
import "./avatar-fields.css";

const publicPixel = localFont({
  src: "./public-pixel.ttf",
  variable: "--font-pixel",
  fallback: ["Courier New", "monospace"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || "christmas-lootbox.vercel.app"}`),
  title: "Manito Manita",
  description: "A Christmas gift exchange.",
  icons: { icon: "/gift.png" },
  openGraph: { type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={publicPixel.variable}>{children}</body>
    </html>
  );
}
