/**
 * Shell — the page frame shared by all three phases.
 *
 * A centred column, max ~720px, mobile-first. The header carries the logo mark (a
 * flow→bloom→glow gradient), the product name, and the phase label on the right.
 */
import { cn } from "@ob/ui";
import { Merkteken, Woordmerk } from "./Merkteken";

export type Fase = "interview" | "genereren" | "beeld" | "resultaat";

const FASE_LABEL: Record<Fase, string> = {
  interview: "Interview",
  genereren: "Bouwen…",
  beeld: "Beeld kiezen",
  resultaat: "Klaar",
};

/** The phase label borrows the tone that matches its meaning. */
const FASE_TONE: Record<Fase, string> = {
  interview: "bg-flow-wash text-flow-ink",
  genereren: "bg-bloom-wash text-bloom-ink",
  // Beeld kiezen is nog bezig, net als bouwen: Flow, niet Glow — dat laatste betekent voltooid.
  beeld: "bg-flow-wash text-flow-ink",
  resultaat: "bg-glow-wash text-glow-ink",
};

export function Shell({
  fase,
  breed,
  navigatie,
  children,
}: {
  fase: Fase;
  /**
   * De knoppen rechts in de kop: beginscherm, beheer, profiel.
   *
   * Als prop en niet hier ingebakken, want de Shell weet niet waar je naartoe kunt — dat weet de
   * pagina. Weglaten mag: op het bouwscherm hoort hij er wél, in een los foutscherm niet.
   */
  navigatie?: React.ReactNode;
  /**
   * Schermbreed in plaats van een leeskolom. Voor het storyboard: een canvas van 720px op een
   * scherm van 1900 is een postzegel. De blokkenweergave klemt zichzelf weer smal — een regel
   * lopende tekst over de volle breedte leest niet.
   */
  breed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-screen w-full flex-col px-4 pb-16 pt-5 sm:px-6",
        breed ? "max-w-none" : "max-w-[720px]",
      )}
    >
      <header className="mb-5 flex items-center gap-3">
        <Merkteken />
        <span className="mr-auto">
          <Woordmerk />
        </span>
        {navigatie}
        <span
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            FASE_TONE[fase],
          )}
        >
          {FASE_LABEL[fase]}
        </span>
      </header>
      {children}
    </div>
  );
}
