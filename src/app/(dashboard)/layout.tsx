import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.scss";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Harbicht Twitch Shows",
  description: "Interactive Twitch stream game shows",
};

// Root layout for streamer-facing pages. The OBS overlay uses its own root
// layout in (overlay) so it can render on a transparent page.
export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
