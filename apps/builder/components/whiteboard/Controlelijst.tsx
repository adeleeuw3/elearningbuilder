/**
 * De meldingen: wat er nog aan de reeks mankeert.
 *
 * Staat bewust **buiten** de structuurweergave en standaard ingeklapt. Een structuurpaneel dat ook
 * meldingen doet gaat over de graaf in plaats van over de cursus, en dan moet de auteur twee dingen
 * tegelijk lezen: wat hij gebouwd heeft, en wat het gereedschap ervan vindt. Hier is het één ding
 * dat hij openklapt wanneer hij eraan toe is.
 *
 * `blokkeert` betekent: er valt geen leesvolgorde uit te lezen. Dat krijgt de Bloom-behandeling —
 * niet rood, want rood bestaat niet in de tokenlaag en dit is ook geen storing, er moet iets
 * gebeuren. `let-op` blijft neutraal, anders roept de lijst harder dan hij te melden heeft.
 */
"use client";

import * as React from "react";
import { cn } from "@ob/ui";
import type { Probleem } from "../../lib/leerpad";

export interface ControlelijstProps {
  problemen: Probleem[];
  onKiesKnoop: (id: string) => void;
}

export function Controlelijst({ problemen, onKiesKnoop }: ControlelijstProps) {
  const blokkerend = problemen.filter((p) => p.ernst === "blokkeert").length;
  // Een blokkerende melding klapt zichzelf open: die kost de auteur zijn export, en die wil je niet
  // achter een driehoekje verstoppen.
  const [open, setOpen] = React.useState(blokkerend > 0);

  if (problemen.length === 0) return null;

  return (
    <div className="rounded-card border border-stroke bg-card shadow-elevation">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-card px-3.5 py-2.5 text-left hover:bg-flow-wash hover:text-flow-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink"
      >
        <span
          aria-hidden="true"
          className={cn(
            "text-[10px] text-ink-faint transition-transform duration-snappy ease-snappy",
            open && "rotate-90",
          )}
        >
          ▶
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          Nog te doen · {problemen.length}
        </span>
        {blokkerend > 0 && (
          <span className="ml-auto rounded-full bg-bloom-wash px-2 py-0.5 text-[10.5px] font-semibold text-bloom-ink">
            {blokkerend} blokkeert
          </span>
        )}
      </button>

      {open && (
        <ul className="flex max-h-[200px] flex-col gap-1 overflow-y-auto px-2 pb-2">
          {problemen.map((p, i) => {
            const aanklikbaar = p.knoopId !== undefined;
            return (
              <li key={`${p.code}-${p.knoopId ?? i}`}>
                <button
                  type="button"
                  disabled={!aanklikbaar}
                  onClick={() => p.knoopId && onKiesKnoop(p.knoopId)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-control px-2 py-1.5 text-left text-[12.5px] leading-relaxed",
                    "[transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px hover:shadow-glow-flow",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
                    aanklikbaar ? "hover:bg-flow-wash hover:text-flow-ink" : "cursor-default",
                    p.ernst === "blokkeert" ? "text-bloom-ink" : "text-ink-soft",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      p.ernst === "blokkeert" ? "bg-grad-bloom" : "bg-ink-faint",
                    )}
                  />
                  <span className="flex-1">{p.bericht}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
