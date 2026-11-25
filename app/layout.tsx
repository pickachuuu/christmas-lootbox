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
  title: "Santa Shuffle",
  description: "A Christmas gift exchange.",
  icons: { icon: "/gift.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={publicPixel.variable}>{children}</body>
    </html>
  );
}
