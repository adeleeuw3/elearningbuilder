/**
 * Het palet: waar de auteur blokken vandaan haalt.
 *
 * Twee manieren om hetzelfde te doen, met opzet:
 *   · slepen naar een plek op het canvas — dat is wat de vraag was;
 *   · klikken, waarna het blok midden in beeld verschijnt.
 *
 * Die tweede is geen luxe. WCAG 2.2 vraagt bij 2.5.7 (Dragging Movements) om een alternatief voor
 * elke handeling die je alleen met slepen kunt doen. Met alleen slepen zou het palet onbruikbaar
 * zijn met een toetsenbord, en dan kan de helft van het product niet gebouwd worden.
 */
"use client";

import * as React from "react";
import { cn } from "@ob/ui";
import { CATEGORIE_ICOON, CATEGORIE_LABEL, type KnoopSoort } from "../../lib/graph";
import { PALET } from "../../lib/leerpad";

export interface BlokpaletProps {
  /** Klik: het blok mag zelf een plek kiezen. */
  onPlaats: (soort: KnoopSoort) => void;
  /** Sleep: begint een sleep die het whiteboard afmaakt op de losgelaten plek. */
  onSleepStart: (soort: KnoopSoort, ev: React.PointerEvent<HTMLButtonElement>) => void;
  /** De soort die nu gesleept wordt, zodat de knop laat zien dat hij bezig is. */
  sleept: KnoopSoort | null;
}

export function Blokpalet({ onPlaats, onSleepStart, sleept }: BlokpaletProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        Blokken
      </span>
      <div className="flex flex-wrap gap-2">
        {PALET.map((p) => (
          <button
            key={p.soort}
            type="button"
            title={`${p.hint} — slepen naar het canvas of klikken om te plaatsen`}
            onPointerDown={(ev) => onSleepStart(p.soort, ev)}
            onClick={() => onPlaats(p.soort)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-medium",
              "transition-[background-color,transform] duration-snappy ease-snappy",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
              "active:translate-y-px",
              sleept === p.soort
                ? "border-transparent bg-grad-flow text-flow-on shadow-glow-flow"
                : "border-stroke bg-card text-ink shadow-elevation hover:bg-card-sub",
            )}
          >
            <span aria-hidden="true" className="text-[14px] leading-none">
              {CATEGORIE_ICOON[p.soort]}
            </span>
            {CATEGORIE_LABEL[p.soort]}
          </button>
        ))}
      </div>
    </div>
  );
}
