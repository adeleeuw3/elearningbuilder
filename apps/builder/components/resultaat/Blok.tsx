/**
 * Het omhulsel om elk contentblok: kop, tag, en de knoppen "Bewerken" en "Opnieuw".
 *
 * Prism-toewijzing: een uitleg-sectie is gewone content, dus een kaart met elevation (rust). Een
 * vraag is nieuw/AI-gegenereerd materiaal, dus Bloom-rand met een Bloom-ink tag. Content verschijnt
 * met de bloom-spring — "nieuw" is precies wat Bloom betekent.
 */
"use client";

import * as React from "react";
import { Button, ProgressRing, cn } from "@ob/ui";

export interface BlokProps {
  /** "uitleg" = kaart met elevation · "vraag" = Bloom-rand + tag */
  soort: "uitleg" | "vraag";
  tag: string;
  bewerkt: boolean;
  bezig: boolean;
  onBewerkWissel: () => void;
  /**
   * Ontbreekt bij een module die niet uit het interview komt: dan is er geen spec om een
   * herschrijving op te baseren. Liever geen knop dan een knop die iets anders doet dan hij belooft.
   */
  onOpnieuw?: () => void;
  children: React.ReactNode;
}

export function Blok({
  soort,
  tag,
  bewerkt,
  bezig,
  onBewerkWissel,
  onOpnieuw,
  children,
}: BlokProps) {
  const isVraag = soort === "vraag";

  return (
    <div
      className={cn(
        "rounded-card bg-card p-4 motion-safe:animate-[prism-bloom-in_420ms_both]",
        isVraag ? "border border-transparent shadow-glow-bloom" : "border border-stroke shadow-elevation",
        bezig && "opacity-60",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
            isVraag ? "bg-bloom-wash text-bloom-ink" : "bg-card-sub text-ink-faint",
          )}
        >
          {tag}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {bezig && <ProgressRing indeterminate size={20} label="Blok wordt opnieuw geschreven" />}
          <Button size="sm" role_="subtle" onClick={onBewerkWissel} disabled={bezig}>
            {bewerkt ? "Klaar" : "Bewerken"}
          </Button>
          {onOpnieuw && (
            <Button size="sm" onClick={onOpnieuw} disabled={bezig}>
              Opnieuw
            </Button>
          )}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Tekstveld dat meegroeit — voor bewerkbare kop/tekst/feedback. */
export function Veld({
  waarde,
  onChange,
  label,
  rows = 3,
  eenRegel,
}: {
  waarde: string;
  onChange: (v: string) => void;
  label: string;
  rows?: number;
  eenRegel?: boolean;
}) {
  const gedeeld =
    "w-full rounded-control border border-stroke bg-card px-3 py-2 text-[14.5px] leading-relaxed text-ink focus:border-flow-from focus:shadow-glow-flow focus:outline-none";

  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      {eenRegel ? (
        <input
          value={waarde}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className={gedeeld}
        />
      ) : (
        <textarea
          value={waarde}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          aria-label={label}
          className={cn(gedeeld, "resize-y")}
        />
      )}
    </label>
  );
}
