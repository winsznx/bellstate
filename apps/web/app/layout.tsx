import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

// PRD §11.1 step 4 + design/tokens.md: Instrument Sans (primary) / IBM Plex Mono (technical
// values — IDs, timestamps), loaded via next/font per the PRD's own instruction.
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument-sans",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "Bellstate",
  description: "Real-market status for onchain stocks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${instrumentSans.variable} ${ibmPlexMono.variable} font-sans`}>{children}</body>
    </html>
  );
}
