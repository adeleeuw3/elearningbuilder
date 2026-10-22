/**
 * Een bestand kiezen, bekijken en beschrijven.
 *
 * Eén component voor de kaart op het canvas én voor de stappen van een carrousel in het paneel.
 * Bewust niet twee keer geschreven: hierachter zit `verwerkBestand` met de magic-byte-controle, het
 * hercoderen en het strippen van EXIF (`CLAUDE.md` §8). Een tweede kopie van die aanroep is een
 * tweede plek waar een controle vergeten kan worden, en dat merk je pas als er iets doorheen komt.
 *
 * **Alt-tekst hoort hier en niet ergens anders.** Ze is verplicht om te publiceren zodra er iets
 * visueels staat, en `publishBlockers()` blokkeert erop. Het veld staat daarom pal onder het beeld
 * waar het over gaat: alt-tekst in een ander paneel invullen betekent dat je moet onthouden waar
 * het plaatje ook alweer over ging.
 */
"use client";

import * as React from "react";
import { cn } from "@ob/ui";
import { accepteert, leesbareGrootte, type Bestand, type BestandSoort } from "../../lib/bestand";
import { geefVrij, verwerkBestand } from "../../lib/bestand-client";
import { Mediazoeker } from "./Mediazoeker";

/** Draagt deze soort iets visueels? Dan is er een tekstalternatief nodig. */
export function vraagtAlt(soort: BestandSoort): boolean {
  // Geluid niet: daar helpt geen alt-tekst maar een transcript, en dat is een ander veld.
  return soort === "afbeelding" || soort === "video";
}

export interface BestandskiezerProps {
  bestand: Bestand | undefined;
  soort: BestandSoort;
  onBestand: (bestand: Bestand | undefined) => void;
  /** Kleiner, voor in een paneel naast andere velden. */
  compact?: boolean;
  /**
   * Waar dit blok over gaat, als voorstel voor de zoekopdracht.
   *
   * Leeg mag: dan opent de zoeker met een leeg veld. Wat hier níét gebeurt is zelf een term
   * verzinnen uit de bestandsnaam of de knooptitel — die zeggen zelden waar het beeld over moet
   * gaan, en een verkeerd voorstel is vervelender dan geen voorstel.
   */
  zoekhint?: string;
}

export function Bestandskiezer({
  bestand,
  soort,
  onBestand,
  compact,
  zoekhint,
}: BestandskiezerProps) {
  const invoerRef = React.useRef<HTMLInputElement | null>(null);
  const [fout, setFout] = React.useState<string | null>(null);
  const [bezig, setBezig] = React.useState(false);
  const [zoeken, setZoeken] = React.useState(false);

  async function kies(file: File | undefined) {
    if (!file) return;
    setFout(null);
    setBezig(true);
    const res = await verwerkBestand(file, soort);
    setBezig(false);
    if (!res.ok) {
      setFout(res.reden);
      return;
    }
    // De vorige blob vrijgeven, anders blijft die tot het tabblad dicht gaat in het geheugen staan.
    geefVrij(bestand);
    // De alt-tekst hoort bij het oude beeld, niet bij het nieuwe. Meenemen zou een beschrijving
    // aan een plaatje hangen dat er niet meer is — erger dan geen beschrijving, want het ziet
    // eruit alsof het klaar is.
    onBestand(res.bestand);
  }

  return (
    <div className="flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
      <div
        className={cn(
          "grid place-items-center overflow-hidden rounded-control bg-card-sub",
          compact ? "min-h-[56px]" : "min-h-[86px]",
        )}
      >
        {bestand && soort === "afbeelding" && (
          // eslint-disable-next-line @next/next/no-img-element -- een blob-URL, geen remote bron
          <img
            src={bestand.url}
            alt=""
            className={cn("w-full object-contain", compact ? "max-h-[96px]" : "max-h-[150px]")}
          />
        )}
        {bestand && soort === "video" && (
          <video src={bestand.url} controls className="max-h-[150px] w-full" />
        )}
        {bestand && soort === "audio" && (
          <audio src={bestand.url} controls className="w-full px-2" />
        )}
        {!bestand && (
          <span className="text-[22px] text-ink-faint" aria-hidden="true">
            {soort === "video" ? "▷" : soort === "audio" ? "◉" : "▣"}
          </span>
        )}
      </div>

      <input
        ref={invoerRef}
        type="file"
        accept={accepteert(soort)}
        className="sr-only"
        onChange={(e) => {
          void kies(e.target.files?.[0]);
          // Legen, anders vuurt hetzelfde bestand opnieuw kiezen geen change-event.
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={bezig}
          onClick={(e) => {
            e.stopPropagation();
            invoerRef.current?.click();
          }}
          className="rounded-control border border-stroke bg-card px-2 py-1 text-[11px] font-semibold text-ink [transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px hover:shadow-glow-flow hover:bg-flow-wash hover:text-flow-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink disabled:opacity-55"
        >
          {bezig ? "Bezig…" : bestand ? "Vervangen" : "Bestand kiezen"}
        </button>
        {/* Audio zoeken we niet: Pexels en Pixabay leveren geen geluidsfragmenten. Een knop die
            altijd niets vindt is erger dan geen knop. */}
        {soort !== "audio" && (
          <button
            type="button"
            disabled={bezig}
            onClick={(e) => {
              e.stopPropagation();
              setZoeken(true);
            }}
            className="rounded-control border border-stroke bg-card px-2 py-1 text-[11px] font-semibold text-flow-ink [transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px hover:shadow-glow-flow hover:bg-flow-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink disabled:opacity-55"
          >
            Zoeken
          </button>
        )}
        {bestand && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              geefVrij(bestand);
              onBestand(undefined);
            }}
            className="rounded-control px-1.5 py-1 text-[11px] text-ink-faint hover:bg-flow-wash hover:text-flow-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink"
          >
            Weghalen
          </button>
        )}
      </div>

      {bestand && vraagtAlt(soort) && (
        <AltVeld
          waarde={bestand.alt ?? ""}
          soort={soort}
          onChange={(alt) => onBestand({ ...bestand, alt })}
        />
      )}

      {bestand && (
        <p className="truncate text-[10.5px] text-ink-faint" title={bestand.naam}>
          {bestand.naam} · {leesbareGrootte(bestand.grootte)} · {bestand.mime}
          {bestand.hercodeerd && " · hercodeerd, metadata verwijderd"}
        </p>
      )}

      {fout && <p className="text-[10.5px] leading-relaxed text-bloom-ink">{fout}</p>}

      {bestand && !compact && (
        <p className="text-[10.5px] leading-relaxed text-ink-faint">
          Opgeslagen op de server. Bewaar de module om de verwijzing te behouden.
        </p>
      )}

      {zoeken && (
        <Mediazoeker
          soort={soort === "video" ? "video" : "afbeelding"}
          beginterm={zoekhint ?? ""}
          onSluit={() => setZoeken(false)}
          onKies={(keuze) => {
            if (keuze.soort !== "bestand") return;
            geefVrij(bestand);
            onBestand(keuze.bestand);
            setZoeken(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Het tekstalternatief.
 *
 * Zolang het leeg is staat er in de kleur van een probleem bij waaróm het nodig is, niet alleen
 * dát het nodig is. "Verplicht" leert een auteur niets; "een schermlezer leest deze zin voor in
 * plaats van het beeld" wel — en dat is het verschil tussen een ingevuld veld en een goed veld.
 */
export function AltVeld({
  waarde,
  soort,
  onChange,
}: {
  waarde: string;
  soort: BestandSoort;
  onChange: (v: string) => void;
}) {
  const leeg = waarde.trim().length === 0;
  const wat = soort === "video" ? "de video" : "de afbeelding";
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        Alt-tekst
      </span>
      <input
        value={waarde}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Beschrijf wat er op ${wat} te zien is…`}
        className={cn(
          "w-full rounded-control border bg-card px-2 py-1 text-[11.5px] text-ink",
          "placeholder:text-ink-faint focus:outline-none",
          leeg ? "border-bloom-from focus:border-bloom-from" : "border-stroke focus:border-flow-from",
        )}
      />
      <span
        className={cn(
          "text-[10.5px] leading-relaxed",
          leeg ? "text-bloom-ink" : "text-ink-faint",
        )}
      >
        {leeg
          ? `Nodig om te publiceren. Een schermlezer leest deze zin voor in plaats van ${wat}.`
          : "Beschrijf wat iemand mist die het beeld niet ziet — niet wat er al in de tekst staat."}
      </span>
    </label>
  );
}
