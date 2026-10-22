/**
 * Root layout. Imports the Prism tokens exactly once and wraps everything in <PrismApp>,
 * which supplies the canvas colour, the ambient corner gradients, the font stack and the
 * shared keyframes.
 *
 * The shell (header + NavigationView) is a client component because the rail tracks the
 * active route; the layout itself stays a server component.
 */
import type { Metadata } from "next";
import "./globals.css";
import { PrismApp } from "@ob/ui";
import { Shell } from "../components/Shell";

export const metadata: Metadata = {
  title: "Observation Builder",
  description:
    "Author realistic, explorable learning artifacts and export xAPI / cmi5 packages that run offline.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PrismApp>
          <Shell>{children}</Shell>
        </PrismApp>
      </body>
    </html>
  );
}
