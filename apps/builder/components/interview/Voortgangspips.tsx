/**
 * Voortgangspips — één pip per verplicht veld.
 *
 * Prism-toewijzing volgt de betekenis: leeg = neutraal (rust), actief = Flow-wash (hier ben je
 * nu), gevuld = Glow-wash mét glow (dit is klaar). Dat is de Glow-betekenis "voltooid", niet
 * decoratie.
 *
 * Dit is bewust niet `PipsPager` uit @ob/ui: die modelleert "welke pagina van N", met precies
 * één actieve dot. Hier hebben pips drie toestanden en kan er meer dan één gevuld zijn.
 */
import { cn } from "@ob/ui";
import type { PipStatus } from "../../lib/spec";

export interface VoortgangspipsProps {
  pips: { veld: string; label: string; status: PipStatus }[];
  /** Aantal gevulde verplichte velden — voor de leesbare samenvatting. */
  gevuld: number;
}

const PIP_STIJL: Record<PipStatus, string> = {
  leeg: "bg-card-sub text-ink-faint",
  actief: "bg-flow-wash text-flow-ink shadow-glow-flow",
  gevuld: "bg-glow-wash text-glow-ink shadow-glow-glow",
};

export function Voortgangspips({ pips, gevuld }: VoortgangspipsProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={`Voortgang: ${gevuld} van ${pips.length} velden bekend`}
    >
      {pips.map((pip) => (
        <span
          key={pip.veld}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            // box-shadow bewust niet mee-transitionen — zie de toelichting in InvoerZone.tsx:
            // de var()-keten van Tailwind blijft anders op de oude waarde hangen.
            "transition-[background-color,color] duration-flow ease-flow",
            PIP_STIJL[pip.status],
          )}
        >
          {pip.label}
        </span>
      ))}
      <span className="ml-auto text-[11px] font-medium tracking-[0.06em] text-ink-faint">
        {gevuld} / {pips.length}
      </span>
    </div>
  );
}
