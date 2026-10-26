/**
 * Beeld kiezen bij de stof, in de vorm van het gesprek.
 *
 * Na het bouwen loopt dit de secties langs en vraagt per sectie: welke van deze vier zet je
 * hieronder? De keuzes komen uit dezelfde stockbronnen als de mediazoeker op het whiteboard, en
 * een gekozen beeld gaat door dezelfde deur als een bestand van je eigen schijf — magic-byte-
 * controle, hercoderen, EXIF strippen. Een tweede route zou betekenen dat die controle één van de
 * twee keer niet draait, en dat is precies de fout die niemand opmerkt.
 *
 * De stap mag altijd overgeslagen worden, per sectie en in zijn geheel. Een module zonder beeld is
 * een module; een auteur die vastzit omdat de bron niets vindt, is een auteur die afhaakt.
 */
"use client";

import * as React from "react";
import { Button, Card, cn } from "@ob/ui";
import { zoekMedia } from "../../lib/api-client";
import { neemKandidaatOver } from "../../lib/bestand-client";
import { bestandsnaam } from "../whiteboard/Mediazoeker";
import { BEELDKEUZES, type Beeldkeuzes, type Beeldstap } from "../../lib/beeldkeuze";
import type { Kandidaat } from "../../lib/media-zoek";
import type { Bestand } from "../../lib/bestand";

export interface BeeldkeuzeProps {
  stappen: Beeldstap[];
  /** Klaar: de gekozen beelden per sectie-index. Leeg mag. */
  onKlaar: (keuzes: Beeldkeuzes) => void;
}

export function Beeldkeuze({ stappen, onKlaar }: BeeldkeuzeProps) {
  const [stap, setStap] = React.useState(0);
  const [keuzes, setKeuzes] = React.useState<Beeldkeuzes>({});
  const [term, setTerm] = React.useState("");
  const [kandidaten, setKandidaten] = React.useState<Kandidaat[] | null>(null);
  const [bezig, setBezig] = React.useState(false);
  const [overnemen, setOvernemen] = React.useState<string | null>(null);
  const [fout, setFout] = React.useState<string | null>(null);

  const huidig = stappen[stap];

  const zoek = React.useCallback(async (vraag: string) => {
    if (!vraag.trim()) return;
    setBezig(true);
    setFout(null);
    setKandidaten(null);
    const res = await zoekMedia(vraag, ["afbeelding"], BEELDKEUZES);
    setBezig(false);
    if (!res.ok) {
      setFout(res.bericht);
      return;
    }
    setKandidaten(res.data.kandidaten.afbeelding ?? []);
  }, []);

  // Bij elke nieuwe sectie meteen zoeken met het voorstel: de auteur hoort keuzes te zien, niet
  // een leeg venster met een zoekveld.
  React.useEffect(() => {
    if (!huidig) return;
    setTerm(huidig.term);
    void zoek(huidig.term);
  }, [huidig, zoek]);

  function verder(bestand?: Bestand) {
    const bijgewerkt = bestand && huidig ? { ...keuzes, [huidig.index]: bestand } : keuzes;
    if (bestand) setKeuzes(bijgewerkt);
    if (stap + 1 >= stappen.length) {
      onKlaar(bijgewerkt);
      return;
    }
    setStap(stap + 1);
  }

  async function kies(k: Kandidaat) {
    if (overnemen || !k.bestandUrl) return;
    setOvernemen(k.id);
    setFout(null);
    const uit = await neemKandidaatOver(k.bestandUrl, "afbeelding", bestandsnaam(k));
    setOvernemen(null);
    if (!uit.ok) {
      setFout(uit.reden);
      return;
    }
    // De omschrijving van de bron als voorstel voor de alt-tekst. Zonder alt-tekst weigert de
    // export (WCAG AA), dus een voorstel is hier geen luxe. Hij blijft bewerkbaar in het paneel:
    // een beschrijving die niemand gelezen heeft is geen toegankelijkheid.
    verder({ ...uit.bestand, ...(k.alt ? { alt: k.alt } : {}) });
  }

  if (!huidig) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-[92%] rounded-card border border-stroke bg-card p-3.5 shadow-elevation">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-flow-ink">
          Prism
        </span>
        <p className="text-[14.5px] leading-relaxed text-ink">
          Welke afbeelding zet je onder <strong>{huidig.kop}</strong>?
        </p>
        {huidig.fragment && (
          <p className="mt-2 border-l-[3px] border-stroke pl-3 text-[13px] leading-relaxed text-ink-soft">
            {huidig.fragment}
          </p>
        )}
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Sectie {stap + 1} van {stappen.length}
          </span>
          <span className="text-[12px] text-ink-faint">
            {Object.keys(keuzes).length} gekozen
          </span>
        </div>

        {/* Geen <form>: een Enter in dit veld hoort te zoeken, niet de pagina te herladen. */}
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="sr-only">Zoekterm voor deze sectie</span>
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void zoek(term);
              }}
              placeholder="Waar moet het beeld over gaan?"
              className={cn(
                "w-full rounded-control border border-stroke bg-card px-3 py-2 text-[14px]",
                "text-ink placeholder:text-ink-faint",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-flow-ink",
              )}
            />
          </label>
          <Button size="sm" role_="subtle" onClick={() => void zoek(term)} disabled={bezig}>
            {bezig ? "Zoeken…" : "Zoeken"}
          </Button>
        </div>

        {fout && (
          <p className="rounded-control bg-bloom-wash px-3 py-2 text-[12.5px] leading-relaxed text-bloom-ink">
            {fout}
          </p>
        )}

        {bezig && <p className="py-6 text-center text-[13px] text-ink-faint">Beeld zoeken…</p>}

        {!bezig && kandidaten?.length === 0 && (
          <p className="py-6 text-center text-[13px] text-ink-faint">
            Niets gevonden voor “{term}”. Probeer een ander woord — deze bronnen zoeken op
            trefwoorden, niet op zinnen.
          </p>
        )}

        {!bezig && !!kandidaten?.length && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kandidaten.map((k) => (
              <li key={k.id}>
                <Tegel
                  kandidaat={k}
                  bezig={overnemen === k.id}
                  uit={!!overnemen && overnemen !== k.id}
                  onKies={() => void kies(k)}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-stroke-soft pt-3">
          <Button size="sm" role_="subtle" onClick={() => verder()} disabled={!!overnemen}>
            Geen beeld hier
          </Button>
          <Button
            size="sm"
            role_="subtle"
            onClick={() => onKlaar(keuzes)}
            disabled={!!overnemen}
          >
            Overslaan en naar de module
          </Button>
          <span className="ml-auto text-[11.5px] text-ink-faint">
            Je kunt later elk beeld nog vervangen op het whiteboard.
          </span>
        </div>
      </Card>
    </div>
  );
}

/** Eén kandidaat als klikbare tegel. */
function Tegel({
  kandidaat,
  bezig,
  uit,
  onKies,
}: {
  kandidaat: Kandidaat;
  bezig: boolean;
  uit: boolean;
  onKies: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onKies}
      disabled={uit || bezig}
      aria-label={`Kies: ${kandidaat.titel || "afbeelding"} van ${kandidaat.maker}`}
      title={`${kandidaat.titel} — ${kandidaat.maker}`}
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-card border border-stroke bg-card text-left",
        "transition-[transform,border-color,box-shadow] duration-flow ease-flow",
        uit ? "opacity-55" : "hover:-translate-y-px hover:border-flow-from hover:shadow-glow-flow",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
      )}
    >
      <span className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden bg-card-sub">
        {kandidaat.voorbeeld ? (
          // eslint-disable-next-line @next/next/no-img-element -- externe miniatuur, geen asset
          <img
            src={kandidaat.voorbeeld}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true" className="text-[20px] text-ink-faint">
            ▣
          </span>
        )}
        {bezig && (
          <span className="absolute inset-0 grid place-items-center bg-card/70 text-[12px] font-semibold text-flow-ink">
            Ophalen…
          </span>
        )}
      </span>
      <span className="block truncate px-2 py-1.5 text-[11.5px] text-ink-faint">
        {kandidaat.maker}
      </span>
    </button>
  );
}
