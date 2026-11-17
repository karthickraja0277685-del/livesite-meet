import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";

const onest = Onest({
  subsets: ["latin"],
  variable: "--font-onest",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "LiveSite Meet — Present Your Website. Let Everyone Explore It.",
  description:
    "Upload your site, start a meeting, and give every attendee their own independent live session."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${onest.variable} dark`}>
      <body className="min-h-screen antialiased selection:bg-cyan-500/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}