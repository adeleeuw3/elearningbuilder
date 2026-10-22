/**
 * De invoer-zone, gerenderd volgens `invoer.type` uit het contract.
 *
 *   single_select   één keuze (chips) — kiezen verstuurt direct
 *   multi_select    meerdere keuzes + "Ga verder", disabled tot ≥1 keuze
 *   text            vrij tekstveld
 *   text_of_keuze   chips + "anders, namelijk…" tekstveld
 *
 * Geen HTML <form>: alles loopt via onClick/onChange (kwaliteitsvloer). Enter in een tekstveld
 * verstuurt wel — dat is wat mensen verwachten — via onKeyDown, niet via form submit.
 *
 * Chips volgen Prism: rust = card + stroke, geselecteerd = Flow-gradient + glow-flow.
 */
"use client";

import * as React from "react";
import { Button, cn } from "@ob/ui";
import type { Invoer } from "../../lib/types";

export interface InvoerZoneProps {
  invoer: Invoer;
  /** Uitgeschakeld tijdens een lopende aanroep. */
  bezig: boolean;
  /** Eén of meer waarden — de aanroeper weet uit `invoer.type` wat het betekent. */
  onAntwoord: (waarden: string[]) => void;
}

export function InvoerZone({ invoer, bezig, onAntwoord }: InvoerZoneProps) {
  switch (invoer.type) {
    case "single_select":
      return <SingleSelect opties={invoer.opties ?? []} bezig={bezig} onAntwoord={onAntwoord} />;
    case "multi_select":
      return <MultiSelect opties={invoer.opties ?? []} bezig={bezig} onAntwoord={onAntwoord} />;
    case "text":
      return <VrijeTekst bezig={bezig} onAntwoord={onAntwoord} />;
    case "text_of_keuze":
      return <TekstOfKeuze opties={invoer.opties ?? []} bezig={bezig} onAntwoord={onAntwoord} />;
  }
}

/* ------------------------------------------------------------------------ chip */

function Chip({
  label,
  geselecteerd,
  bezig,
  onClick,
}: {
  label: string;
  geselecteerd?: boolean;
  bezig: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={geselecteerd}
      disabled={bezig}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-2 text-left text-[13.5px] font-medium",
        // NIET box-shadow mee-transitionen. Tailwind's box-shadow-declaratie is byte-identiek
        // tussen shadow-klassen (allemaal dezelfde var()-keten), dus Chromium ziet geen wijziging,
        // start geen transitie én blijft op de oude waarde hangen: de chip kreeg dan de Flow-
        // gradient zonder de glow. Prism's motion.md wil hier toch alleen transform/opacity.
        "transition-[background-color,transform] duration-snappy ease-snappy",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
        "active:translate-y-px disabled:pointer-events-none disabled:opacity-55",
        geselecteerd
          ? "border-transparent bg-grad-flow font-semibold text-flow-on shadow-glow-flow"
          : "border-stroke bg-card text-ink shadow-elevation hover:bg-card-sub",
      )}
    >
      {label}
    </button>
  );
}

function ChipRij({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

/* --------------------------------------------------------------- single_select */

function SingleSelect({
  opties,
  bezig,
  onAntwoord,
}: {
  opties: string[];
  bezig: boolean;
  onAntwoord: (w: string[]) => void;
}) {
  return (
    <ChipRij>
      {opties.map((optie) => (
        <Chip key={optie} label={optie} bezig={bezig} onClick={() => onAntwoord([optie])} />
      ))}
    </ChipRij>
  );
}

/* ---------------------------------------------------------------- multi_select */

function MultiSelect({
  opties,
  bezig,
  onAntwoord,
}: {
  opties: string[];
  bezig: boolean;
  onAntwoord: (w: string[]) => void;
}) {
  const [gekozen, setGekozen] = React.useState<string[]>([]);

  const wissel = (optie: string) =>
    setGekozen((vorig) =>
      vorig.includes(optie) ? vorig.filter((o) => o !== optie) : [...vorig, optie],
    );

  return (
    <div className="flex flex-col gap-3">
      <ChipRij>
        {opties.map((optie) => (
          <Chip
            key={optie}
            label={optie}
            geselecteerd={gekozen.includes(optie)}
            bezig={bezig}
            onClick={() => wissel(optie)}
          />
        ))}
      </ChipRij>
      <div className="flex items-center gap-3">
        <Button
          role_="accent"
          size="sm"
          disabled={bezig || gekozen.length === 0}
          onClick={() => onAntwoord(gekozen)}
        >
          Ga verder
        </Button>
        <span className="text-[12px] text-ink-faint">
          {gekozen.length === 0
            ? "Kies er minstens één"
            : `${gekozen.length} gekozen`}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ text */

function VrijeTekst({
  bezig,
  onAntwoord,
  placeholder = "Typ je antwoord…",
  label = "Je antwoord",
}: {
  bezig: boolean;
  onAntwoord: (w: string[]) => void;
  placeholder?: string;
  label?: string;
}) {
  const [tekst, setTekst] = React.useState("");
  const leeg = tekst.trim().length === 0;

  const verstuur = () => {
    if (leeg || bezig) return;
    onAntwoord([tekst]);
    setTekst("");
  };

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
      <label className="flex-1">
        <span className="sr-only">{label}</span>
        <textarea
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          onKeyDown={(e) => {
            // Enter verstuurt, Shift+Enter maakt een nieuwe regel. Geen <form> nodig.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              verstuur();
            }
          }}
          disabled={bezig}
          rows={2}
          placeholder={placeholder}
          aria-label={label}
          className={cn(
            "w-full resize-none rounded-control border border-stroke bg-card px-3 py-2.5",
            "text-[14.5px] leading-relaxed text-ink",
            "focus:border-flow-from focus:shadow-glow-flow focus:outline-none",
            "disabled:opacity-55",
          )}
        />
      </label>
      <Button role_="accent" size="sm" disabled={bezig || leeg} onClick={verstuur}>
        Versturen
      </Button>
    </div>
  );
}

/* --------------------------------------------------------------- text_of_keuze */

function TekstOfKeuze({
  opties,
  bezig,
  onAntwoord,
}: {
  opties: string[];
  bezig: boolean;
  onAntwoord: (w: string[]) => void;
}) {
  const [eigenZichtbaar, setEigenZichtbaar] = React.useState(false);

  return (
    <div className="flex flex-col gap-3">
      <ChipRij>
        {opties.map((optie) => (
          <Chip key={optie} label={optie} bezig={bezig} onClick={() => onAntwoord([optie])} />
        ))}
        <Chip
          label="Anders, namelijk…"
          geselecteerd={eigenZichtbaar}
          bezig={bezig}
          onClick={() => setEigenZichtbaar((v) => !v)}
        />
      </ChipRij>
      {eigenZichtbaar && (
        <div className="motion-safe:animate-[prism-bloom-in_280ms_both]">
          <VrijeTekst
            bezig={bezig}
            onAntwoord={onAntwoord}
            placeholder="Vul je eigen antwoord in…"
            label="Eigen antwoord"
          />
        </div>
      )}
    </div>
  );
}
