/**
 * Laat een blok schrijven — in zoveel versies als je wilt — en kies er één.
 *
 * Dezelfde handeling als de mediazoeker en daarom dezelfde vorm: je zegt wat je wilt, je krijgt een
 * paar uitkomsten naast elkaar, je kiest. Het verschil is dat een tekstvariant gelezen moet worden
 * en een miniatuur bekeken, dus staan ze onder elkaar en niet in een raster.
 *
 * **Wat er nu staat doet mee als kandidaat.** Zonder die kolom is "houden wat ik had" een knop die
 * je moet durven kiezen zonder te kunnen vergelijken. De oude tekst overschrijven zonder hem naast
 * het alternatief te hebben gezien is precies hoe je werk kwijtraakt waar je tevreden over was.
 *
 * **De prompt staat hier, niet alleen op de kaart.** Je verandert de opdracht meestal juist omdat
 * de vorige uitkomst niet beviel; dan moet je niet eerst het venster hoeven sluiten.
 */
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button, Chip, IconButton, cn, springClasses } from "@ob/ui";
import { VARIANTEN_MAX } from "../../lib/types";

export interface VariantenkiezerProps {
  /** De titel van het blok, voor in de kop van het venster. */
  blokTitel: string;
  /** De opdracht zoals hij nu op de knoop staat. */
  opdracht: string;
  /** Wat er nu in het blok staat; leeg bij een blok dat nog niets heeft. */
  huidig: string;
  /** Draait er een schrijfopdracht? */
  bezig: boolean;
  /** De versies die terugkwamen, of een lege lijst. */
  varianten: string[];
  fout: string | null;
  /** Schrijf `aantal` versies met deze opdracht. */
  onSchrijf: (opdracht: string, aantal: number) => void;
  /** Deze versie wordt de inhoud van het blok. */
  onKies: (tekst: string) => void;
  onSluit: () => void;
}

export function Variantenkiezer({
  blokTitel,
  opdracht,
  huidig,
  bezig,
  varianten,
  fout,
  onSchrijf,
  onKies,
  onSluit,
}: VariantenkiezerProps) {
  const [tekstOpdracht, setTekstOpdracht] = React.useState(opdracht);
  const [aantal, setAantal] = React.useState(3);
  const veldRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    veldRef.current?.focus();
    const opToets = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !bezig) onSluit();
    };
    window.addEventListener("keydown", opToets);
    return () => window.removeEventListener("keydown", opToets);
  }, [onSluit, bezig]);

  // Zie de mediazoeker: het canvas pant met een `transform`, en dan is `fixed` niet het scherm maar
  // dat canvas. Zonder portal zou dit venster meeschalen met de zoom.
  const [gemonteerd, setGemonteerd] = React.useState(false);
  React.useEffect(() => setGemonteerd(true), []);
  if (!gemonteerd) return null;

  const kanSchrijven = tekstOpdracht.trim().length > 0 && !bezig;

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !bezig) onSluit();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="varianten-kop"
        className={cn(
          "flex max-h-[88vh] w-full max-w-[860px] flex-col overflow-hidden",
          "rounded-large border border-stroke bg-card shadow-elevation",
          springClasses("flow"),
        )}
      >
        <div className="flex items-center gap-3 border-b border-stroke-soft px-5 py-4">
          <h2 id="varianten-kop" className="truncate text-[19px] font-semibold -tracking-[0.01em]">
            Schrijven: {blokTitel || "dit blok"}
          </h2>
          <Chip tone="bloom" className="ml-auto shrink-0">
            AI
          </Chip>
          <IconButton label="Sluiten" size="sm" stil disabled={bezig} onClick={onSluit}>
            ×
          </IconButton>
        </div>

        {/* ---- de opdracht ---- */}
        <div className="flex flex-col gap-2 px-5 py-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Opdracht
            </span>
            <textarea
              ref={veldRef}
              rows={3}
              value={tekstOpdracht}
              onChange={(e) => setTekstOpdracht(e.target.value)}
              placeholder="Wat moet er in dit blok komen?"
              className="w-full resize-none rounded-control border border-stroke bg-card px-3 py-2 text-[14px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-flow-from focus:shadow-glow-flow focus:outline-none"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Versies
            </span>
            <div className="flex gap-1" role="group" aria-label="Aantal versies">
              {Array.from({ length: VARIANTEN_MAX }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={aantal === n}
                  onClick={() => setAantal(n)}
                  className={cn(
                    "h-7 w-7 rounded-control border text-[12.5px] font-semibold tabular-nums",
                    "transition-[transform,background-color,color,border-color] active:translate-y-px",
                    springClasses("snappy"),
                    aantal === n
                      ? "border-flow-from bg-flow-wash text-flow-ink"
                      : "border-stroke bg-card text-ink-soft hover:bg-card-sub",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              role_="accent"
              className="ml-auto"
              disabled={!kanSchrijven}
              onClick={() => onSchrijf(tekstOpdracht, aantal)}
            >
              {bezig ? "Schrijven…" : varianten.length > 0 ? "Opnieuw" : "Schrijven"}
            </Button>
          </div>
        </div>

        {fout && (
          <p className="mx-5 mb-3 rounded-control bg-bloom-wash px-3 py-2 text-[12.5px] leading-relaxed text-bloom-ink">
            {fout}
          </p>
        )}

        {/* ---- de uitkomsten ---- */}
        <div className="min-h-[160px] flex-1 overflow-y-auto px-5 pb-4">
          {varianten.length === 0 && !bezig && !fout && (
            <p className="pt-10 text-center text-[13px] text-ink-faint">
              {huidig.trim()
                ? "Kies hoeveel versies je wilt en druk op Schrijven. Wat er nu staat blijft staan tot je iets kiest."
                : "Kies hoeveel versies je wilt en druk op Schrijven."}
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {huidig.trim() && varianten.length > 0 && (
              <li>
                <Optie
                  label="Wat er nu staat"
                  tekst={huidig}
                  knop="Houden"
                  onKies={() => onKies(huidig)}
                />
              </li>
            )}
            {varianten.map((v, i) => (
              <li key={i}>
                <Optie
                  label={`Versie ${i + 1}`}
                  tekst={v}
                  knop="Deze nemen"
                  nieuw
                  onKies={() => onKies(v)}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Optie({
  label,
  tekst,
  knop,
  nieuw,
  onKies,
}: {
  label: string;
  tekst: string;
  knop: string;
  nieuw?: boolean;
  onKies: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-card border bg-card p-3",
        // Bloom markeert wat nieuw is — dat is precies de betekenis die Prism eraan geeft. De
        // bestaande tekst blijft neutraal: die is niet nieuw en hoeft geen aandacht te trekken.
        nieuw ? "border-bloom-from" : "border-stroke",
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          {label}
        </span>
        <span className="text-[11px] tabular-nums text-ink-faint">{woorden(tekst)} woorden</span>
        <Button size="sm" className="ml-auto" onClick={onKies}>
          {knop}
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{tekst}</p>
    </div>
  );
}

function woorden(tekst: string): number {
  return tekst.split(/\s+/).filter(Boolean).length;
}
