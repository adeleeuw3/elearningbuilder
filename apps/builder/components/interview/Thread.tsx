/**
 * De thread: AI-berichten als kaart met elevation en een "Prism"-label in Flow-ink,
 * gebruikersantwoorden rechts uitgelijnd als bubble in Flow-gradient.
 *
 * Nieuwe berichten komen binnen met de flow-spring, en de laatste regel scrollt in beeld —
 * beide alleen als de gebruiker geen reduced-motion heeft gevraagd.
 */
"use client";

import * as React from "react";
import { cn } from "@ob/ui";
import type { GesprekRegel } from "../../lib/types";

export interface ThreadProps {
  gesprek: GesprekRegel[];
  /** Toont de "Prism denkt na"-regel onderaan tijdens een aanroep. */
  bezig: boolean;
}

export function Thread({ gesprek, bezig }: ThreadProps) {
  const onderRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    onderRef.current?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "nearest",
    });
  }, [gesprek.length, bezig]);

  return (
    <div className="flex flex-col gap-3" role="log" aria-live="polite" aria-label="Gesprek">
      {gesprek.map((regel, i) => (
        <Bericht key={`${i}-${regel.rol}`} regel={regel} />
      ))}
      {bezig && <Denkt />}
      <div ref={onderRef} aria-hidden="true" />
    </div>
  );
}

function Bericht({ regel }: { regel: GesprekRegel }) {
  if (regel.rol === "user") {
    return (
      <div className="flex justify-end motion-safe:animate-[prism-bloom-in_280ms_both]">
        <p
          className={cn(
            "max-w-[85%] rounded-card bg-grad-flow px-3.5 py-2.5",
            "text-[14.5px] leading-relaxed text-flow-on shadow-glow-flow",
          )}
        >
          {regel.bericht}
        </p>
      </div>
    );
  }

  return (
    <div className="motion-safe:animate-[prism-bloom-in_280ms_both]">
      <div className="max-w-[92%] rounded-card border border-stroke bg-card p-3.5 shadow-elevation">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-flow-ink">
          Prism
        </span>
        <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">
          {regel.bericht}
        </p>
      </div>
    </div>
  );
}

/** Laadindicator in de thread zelf, zodat de wachttijd zichtbaar is waar het gesprek staat. */
function Denkt() {
  return (
    <div className="flex items-center gap-2.5 px-1" role="status">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-flow-from motion-safe:animate-[prism-breathe_1.4s_ease-in-out_infinite]"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      <span className="text-[12.5px] text-ink-faint">Prism denkt na…</span>
    </div>
  );
}
