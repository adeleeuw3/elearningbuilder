/**
 * Zoeken op het canvas.
 *
 * Waarom dit er is: een canvas dat groter is dan het venster verliest dingen. Een knoop die op
 * y=1008 staat in een venster van 1000 hoog bestaat wel maar is er niet — en er was geen manier om
 * hem terug te vinden behalve rondscrollen.
 *
 * De lijst verschijnt pas bij een term en verdwijnt na een keuze. Toetsenbord: pijltjes door de
 * treffers, Enter om erheen te springen, Escape om te sluiten.
 */
"use client";

import * as React from "react";
import { cn } from "@ob/ui";
import { CATEGORIE_ICOON, CATEGORIE_LABEL, type Knoop } from "../../lib/graph";
import { zoekKnopen, type Treffer } from "../../lib/canvas";

export interface ZoekvakProps {
  knopen: Knoop[];
  onKies: (knoop: Knoop) => void;
}

const WAAR_LABEL: Record<Treffer["waar"], string> = {
  titel: "titel",
  tekst: "tekst",
  opdracht: "opdracht",
};

export function Zoekvak({ knopen, onKies }: ZoekvakProps) {
  const [term, setTerm] = React.useState("");
  const [actief, setActief] = React.useState(0);
  const treffers = React.useMemo(() => zoekKnopen(knopen, term), [knopen, term]);
  const open = term.trim().length > 0;

  const kies = (t: Treffer | undefined) => {
    if (!t) return;
    onKies(t.knoop);
    setTerm("");
    setActief(0);
  };

  return (
    <div className="relative w-full sm:w-[260px]">
      <label className="flex items-center gap-2 rounded-full border border-stroke bg-card px-3 py-1.5 shadow-elevation focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-flow-ink">
        <span aria-hidden="true" className="text-[13px] text-ink-faint">
          ⌕
        </span>
        <span className="sr-only">Zoek een knoop</span>
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setActief(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActief((i) => Math.min(i + 1, treffers.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActief((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              kies(treffers[actief]);
            } else if (e.key === "Escape") {
              setTerm("");
            }
            // Niet doorlaten naar het canvas: daar zijn V/H/M/C/E sneltoetsen, en die horen niet
            // te vuren terwijl iemand een woord typt.
            e.stopPropagation();
          }}
          placeholder="Zoek een knoop…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        {open && (
          <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">
            {treffers.length}
          </span>
        )}
      </label>

      {open && (
        <ul className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-card border border-stroke bg-card shadow-elevation">
          {treffers.length === 0 && (
            <li className="px-3 py-2 text-[12.5px] text-ink-faint">Niets gevonden.</li>
          )}
          {treffers.map((t, i) => (
            <li key={t.knoop.id}>
              <button
                type="button"
                onMouseEnter={() => setActief(i)}
                onClick={() => kies(t)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px]",
                  i === actief ? "bg-flow-wash text-flow-ink" : "text-ink hover:bg-card-sub",
                )}
              >
                <span aria-hidden="true" className="shrink-0 text-ink-faint">
                  {CATEGORIE_ICOON[t.knoop.soort]}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.knoop.titel || "Zonder titel"}</span>
                <span className="shrink-0 text-[10.5px] text-ink-faint">
                  {CATEGORIE_LABEL[t.knoop.soort]} · {WAAR_LABEL[t.waar]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
