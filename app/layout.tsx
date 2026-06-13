import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AURA — AI Stylist & AR Try-On",
  description: "Client-side facial geometry, seasonal color analysis, live AR overlay.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
