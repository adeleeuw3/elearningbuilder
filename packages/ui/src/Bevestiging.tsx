/**
 * Bevestiging — "weet je het zeker?" als Prism-dialoog in plaats van `window.confirm`.
 *
 * De native dialoog was een echte bug, niet alleen een stijlkwestie: hij wordt in ingesloten
 * contexten onderdrukt, en Chrome biedt na een paar keer "voorkom dat deze pagina nog dialogen
 * maakt" aan. Staat die vink eenmaal aan, dan geeft `confirm()` stilletjes `false` terug en doet de
 * knop niets meer. Een navigatie die afhangt van een browserdialoog kan dus zonder enige melding
 * stuk zijn — en dat was precies het symptoom.
 *
 * Daarnaast is het het enige in de app zonder ontwerp: een grijze systeembalk midden in een canvas
 * dat verder volledig in Prism staat.
 *
 * De bevestigende knop krijgt de focus bij openen, Escape annuleert, en een klik naast het venster
 * annuleert ook. Annuleren is altijd de veilige kant: wie per ongeluk opent verliest niets.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { cn } from "./lib/cn";
import { springClasses } from "./lib/tone";

export interface BevestigingProps {
  /** Waar het over gaat. Kort, en noem het ding bij naam. */
  titel: string;
  /** Wat er gebeurt als je doorgaat. Mag leeg als de titel genoeg zegt. */
  uitleg?: string;
  /** Het woord op de knop die doorgaat — een werkwoord, niet "OK". */
  bevestig: string;
  /**
   * Gaat er iets verloren? Dan krijgt de knop de Glow-behandeling in plaats van Flow.
   *
   * Niet rood: Prism kent geen rood, en een kleur verzinnen voor dit ene geval zou de regel breken
   * die het hele systeem draagt. Glow is in Prism de kleur die aandacht vraagt zonder te schreeuwen.
   */
  ingrijpend?: boolean;
  onBevestig: () => void;
  onAnnuleer: () => void;
}

export function Bevestiging({
  titel,
  uitleg,
  bevestig,
  ingrijpend,
  onBevestig,
  onAnnuleer,
}: BevestigingProps) {
  const jaRef = React.useRef<HTMLButtonElement | null>(null);
  const [gemonteerd, setGemonteerd] = React.useState(false);

  React.useEffect(() => {
    setGemonteerd(true);
  }, []);

  React.useEffect(() => {
    jaRef.current?.focus();
    const opToets = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAnnuleer();
    };
    window.addEventListener("keydown", opToets);
    return () => window.removeEventListener("keydown", opToets);
  }, [onAnnuleer, gemonteerd]);

  if (!gemonteerd) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-ink/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onAnnuleer();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bevestiging-titel"
        {...(uitleg ? { "aria-describedby": "bevestiging-uitleg" } : {})}
        className={cn(
          "w-full max-w-[420px] rounded-large border border-stroke bg-card p-5 shadow-elevation",
          "animate-[prism-bloom-in_var(--spring-bloom)]",
          springClasses("bloom"),
        )}
      >
        <h2 id="bevestiging-titel" className="text-[20px] font-semibold -tracking-[0.01em] text-ink">
          {titel}
        </h2>
        {uitleg && (
          <p id="bevestiging-uitleg" className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
            {uitleg}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" role_="subtle" onClick={onAnnuleer}>
            Annuleren
          </Button>
          <Button
            ref={jaRef}
            size="sm"
            role_={ingrijpend ? "reward" : "accent"}
            onClick={onBevestig}
          >
            {bevestig}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
