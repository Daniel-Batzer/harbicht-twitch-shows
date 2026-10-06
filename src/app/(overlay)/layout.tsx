import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./overlay-globals.scss";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Overlay · Harbicht Twitch Shows",
};

// Separate root layout for the OBS browser source: transparent page and no
// dashboard styles (Decision 005).
export default function OverlayRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
