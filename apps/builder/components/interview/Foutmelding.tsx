/**
 * Foutstaat in de juiste toon, mét "Opnieuw proberen".
 *
 * Bloom omdat een fout hier "nieuw / aandacht" is en niet "voltooid" — Glow zou de verkeerde
 * betekenis dragen. De tekst komt letterlijk uit de API, waar de boodschappen al zo geschreven
 * zijn dat ze zeggen wat er misging én wat je eraan doet.
 *
 * Bij `ongeldige_invoer` heeft opnieuw proberen geen zin (dezelfde aanvraag faalt weer), dus dan
 * verbergen we de knop in plaats van valse hoop te geven.
 */
import { Button } from "@ob/ui";
import type { ApiFout } from "../../lib/types";

export interface FoutmeldingProps {
  bericht: string;
  code: ApiFout["code"];
  onOpnieuw: () => void;
  /**
   * Uitweg als opnieuw proberen niet helpt. Zonder dit zou een niet-herstelbare fout een
   * doodlopende weg zijn: geen retry-knop én geen manier vooruit, alleen de pagina verversen.
   */
  onBeginOpnieuw?: () => void;
}

export function Foutmelding({ bericht, code, onOpnieuw, onBeginOpnieuw }: FoutmeldingProps) {
  const opnieuwHelpt = code !== "ongeldige_invoer";

  return (
    <div
      role="alert"
      className="rounded-card border border-transparent bg-bloom-wash p-3.5 shadow-glow-bloom motion-safe:animate-[prism-bloom-in_420ms_both]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-grad-bloom text-[15px] font-bold text-bloom-on"
        >
          !
        </span>
        <div className="flex-1">
          <p className="text-[13.5px] leading-relaxed text-bloom-on">{bericht}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {opnieuwHelpt && (
              <Button size="sm" onClick={onOpnieuw}>
                Opnieuw proberen
              </Button>
            )}
            {onBeginOpnieuw && (
              <Button size="sm" role_={opnieuwHelpt ? "subtle" : "neutral"} onClick={onBeginOpnieuw}>
                Begin opnieuw
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
