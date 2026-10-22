/**
 * Root layout. Tokens are imported once; <PrismApp> supplies the canvas colour, the ambient
 * corner gradients and the shared keyframes.
 *
 * The font is loaded through next/font, which self-hosts it at build time — no runtime request
 * to a font CDN.
 */
import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { PrismApp } from "@ob/ui";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prism Builder",
  description: "Een gestuurd interview dat je door het bouwen van één leermodule praat.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={hanken.variable}>
      {/*
        `suppressHydrationWarning` staat hier om precies één reden: browserextensies zetten
        attributen op `<body>` vóórdat React hydrateert. ColorZilla zet er `cz-shortcut-listen`
        op, wachtwoordmanagers en vertaalextensies doen vergelijkbare dingen. React ziet dan een
        verschil tussen server en client dat niet uit deze code komt en nooit uit deze code kan
        komen — dit element heeft geen enkel eigen attribuut.

        Het dekt alleen de attributen van `<body>` zelf, niet die van de kinderen: een echte
        hydratiefout ergens in de app blijft dus gewoon zichtbaar.
      */}
      <body suppressHydrationWarning>
        <PrismApp>{children}</PrismApp>
      </body>
    </html>
  );
}
