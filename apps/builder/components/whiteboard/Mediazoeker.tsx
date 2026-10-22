/**
 * Het keuzevenster: zoek beeld of video bij een externe bron en kies er één.
 *
 * Vijf kandidaten per keer, niet meer. Een raster van dertig miniaturen ziet er rijker uit maar
 * maakt kiezen langzamer, en de auteur is hier om verder te kunnen — niet om te browsen. Wie niets
 * geschikts ziet zoekt met andere woorden opnieuw; dat is sneller dan doorscrollen.
 *
 * **De keuze wordt een gewoon bestand.** Bij het aanklikken gaan de bytes via de proxy naar de
 * browser en daarna door dezelfde keuring en EXIF-strip als een bestand van je eigen schijf. Wat
 * hier uit komt is dus niet "een plaatje van Pexels" maar precies hetzelfde soort `Bestand` als
 * altijd — export, alt-tekst en verpakking merken er niets van.
 *
 * **Een YouTube-keuze is iets anders.** Die levert geen bestand op: hun voorwaarden verbieden
 * downloaden. Zo'n keuze komt terug als een externe video, en het venster zegt erbij dat de pagina
 * waar hij op staat internet nodig heeft.
 */
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button, Chip, IconButton, cn, springClasses } from "@ob/ui";
import type { Bestand, BestandSoort } from "../../lib/bestand";
import { neemKandidaatOver } from "../../lib/bestand-client";
import { KEUZES, type Bron, type Kandidaat, type Zoeksoort } from "../../lib/media-zoek";

/** Wat er uit het venster komt: een binnengehaald bestand, of een verwijzing naar YouTube. */
export type Mediakeuze =
  | { soort: "bestand"; bestand: Bestand; kandidaat: Kandidaat }
  | { soort: "externe-video"; kandidaat: Kandidaat };

export interface MediazoekerProps {
  /** Waar naar gezocht wordt. Bepaalt ook wat een keuze oplevert. */
  soort: Zoeksoort;
  /** De zoekopdracht waarmee het venster opent — meestal afgeleid uit de tekst van het blok. */
  beginterm?: string;
  onKies: (keuze: Mediakeuze) => void;
  onSluit: () => void;
}

interface Antwoord {
  term: string;
  kandidaten: Record<string, Kandidaat[]>;
  bronnen: Bron[];
  ontbrekend: Bron[];
}

const BRONNAAM: Record<Bron, string> = {
  pexels: "Pexels",
  pixabay: "Pixabay",
  youtube: "YouTube",
};

const SOORTNAAM: Record<Zoeksoort, string> = {
  afbeelding: "Afbeelding",
  video: "Video",
  "externe-video": "Video op YouTube",
};

export function Mediazoeker({ soort, beginterm = "", onKies, onSluit }: MediazoekerProps) {
  const [term, setTerm] = React.useState(beginterm);
  const [bezig, setBezig] = React.useState(false);
  const [antwoord, setAntwoord] = React.useState<Antwoord | null>(null);
  const [fout, setFout] = React.useState<string | null>(null);
  /** Welke kandidaat op dit moment binnengehaald wordt. */
  const [overnemen, setOvernemen] = React.useState<string | null>(null);

  const veldRef = React.useRef<HTMLInputElement | null>(null);
  const raamRef = React.useRef<HTMLDivElement | null>(null);

  // Escape sluit, en de cursor staat meteen in het zoekveld: dit venster opent om te typen.
  React.useEffect(() => {
    veldRef.current?.focus();
    const opToets = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSluit();
    };
    window.addEventListener("keydown", opToets);
    return () => window.removeEventListener("keydown", opToets);
  }, [onSluit]);

  const zoek = React.useCallback(async () => {
    if (!term.trim() || bezig) return;
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/media/zoek", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ term, soorten: [soort], aantal: KEUZES }),
      });
      const body = (await res.json().catch(() => null)) as (Antwoord & { bericht?: string }) | null;
      if (!res.ok || !body) {
        setFout(body?.bericht ?? "Zoeken lukte niet.");
        setAntwoord(null);
        return;
      }
      setAntwoord(body);
    } catch {
      setFout("De server is niet bereikbaar.");
      setAntwoord(null);
    } finally {
      setBezig(false);
    }
  }, [term, soort, bezig]);

  // Openen met een voorstel betekent: meteen laten zien wat dat oplevert.
  React.useEffect(() => {
    if (beginterm.trim()) void zoek();
    // Alleen bij het openen; daarna bepaalt de auteur wanneer er gezocht wordt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function kies(k: Kandidaat) {
    if (overnemen) return;
    if (k.soort === "externe-video") {
      onKies({ soort: "externe-video", kandidaat: k });
      return;
    }
    if (!k.bestandUrl) return;
    setOvernemen(k.id);
    setFout(null);
    const bestandsoort: BestandSoort = k.soort === "video" ? "video" : "afbeelding";
    const uit = await neemKandidaatOver(k.bestandUrl, bestandsoort, bestandsnaam(k));
    setOvernemen(null);
    if (!uit.ok) {
      setFout(uit.reden);
      return;
    }
    // De omschrijving van de bron als voorstel voor de alt-tekst. Hij staat er alvast, maar het
    // veld blijft zichtbaar en de auteur moet hem nalopen: een beschrijving die niemand gelezen
    // heeft is geen toegankelijkheid.
    onKies({
      soort: "bestand",
      bestand: { ...uit.bestand, ...(k.alt ? { alt: k.alt } : {}) },
      kandidaat: k,
    });
  }

  const lijst = antwoord?.kandidaten[soort] ?? [];

  /**
   * In een portal naar `document.body`, niet gewoon waar hij staat.
   *
   * Het whiteboard pant en zoomt met een `transform`, en een element met een transform wordt het
   * referentiekader voor alles wat erin `fixed` staat. Zonder portal komt dit venster dus binnen
   * het canvas te hangen: het schaalt mee met de zoom en werd op 100% 274px breed in plaats van
   * 880. Dat is geen stijlkwestie — de bestandskiezer staat óók in het paneel, dus hetzelfde
   * venster zou op twee plekken twee verschillende maten hebben.
   */
  const [gemonteerd, setGemonteerd] = React.useState(false);
  React.useEffect(() => setGemonteerd(true), []);
  if (!gemonteerd) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSluit();
      }}
    >
      <div
        ref={raamRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mediazoeker-kop"
        className={cn(
          "flex max-h-[86vh] w-full max-w-[880px] flex-col overflow-hidden",
          "rounded-large border border-stroke bg-card shadow-elevation",
          springClasses("flow"),
        )}
      >
        {/* ---- kop ---- */}
        <div className="flex items-center gap-3 border-b border-stroke-soft px-5 py-4">
          <h2 id="mediazoeker-kop" className="text-[19px] font-semibold -tracking-[0.01em]">
            {SOORTNAAM[soort]} zoeken
          </h2>
          <Chip tone="rest" noDot className="ml-auto">
            {KEUZES} keuzes
          </Chip>
          <IconButton label="Sluiten" size="sm" stil onClick={onSluit}>
            ×
          </IconButton>
        </div>

        {/* ---- zoeken ---- */}
        <div className="flex items-center gap-2 px-5 py-3">
          <input
            ref={veldRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              // Geen <form>: een submit herlaadt de pagina en dan is het canvas weg.
              if (e.key === "Enter") void zoek();
            }}
            placeholder="Waar moet het over gaan? Bijv. serverruimte, phishing"
            className="w-full rounded-control border border-stroke bg-card px-3 py-2 text-[14px] text-ink placeholder:text-ink-faint focus:border-flow-from focus:shadow-glow-flow focus:outline-none"
          />
          <Button size="sm" onClick={() => void zoek()} disabled={bezig || !term.trim()}>
            {bezig ? "Zoeken…" : "Zoeken"}
          </Button>
        </div>

        {/* De videokiezer mengt drie bronnen, en twee ervan leveren iets wezenlijk anders dan de
            derde. Deze melding hoort er dus ook te staan als er maar één YouTube-tegel tussen de
            stockvideo's zit. */}
        {(soort === "externe-video" || lijst.some((k) => k.bron === "youtube")) && (
          <p className="mx-5 mb-3 rounded-control bg-bloom-wash px-3 py-2 text-[12px] leading-relaxed text-bloom-ink">
            Een YouTube-video wordt <strong>ingesloten</strong>, niet meegeleverd — downloaden mag
            niet van YouTube. De pagina waar hij op staat heeft dus internet nodig, en werkt niet in
            een LMS dat YouTube blokkeert.
          </p>
        )}

        {/* ---- uitkomst ---- */}
        <div className="min-h-[220px] flex-1 overflow-y-auto px-5 pb-4">
          {fout && (
            <p className="rounded-control bg-bloom-wash px-3 py-2 text-[12.5px] leading-relaxed text-bloom-ink">
              {fout}
            </p>
          )}

          {!fout && !antwoord && !bezig && (
            <p className="pt-10 text-center text-[13px] text-ink-faint">
              Typ waar dit blok over gaat en druk op Zoeken.
            </p>
          )}

          {antwoord && lijst.length === 0 && !bezig && (
            <p className="pt-10 text-center text-[13px] text-ink-faint">
              Niets gevonden voor “{antwoord.term}”. Probeer andere woorden — deze bronnen zoeken op
              trefwoorden, niet op zinnen.
            </p>
          )}

          {lijst.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {lijst.map((k) => (
                <li key={k.id}>
                  <Keuze
                    kandidaat={k}
                    bezig={overnemen === k.id}
                    uit={!!overnemen && overnemen !== k.id}
                    onKies={() => void kies(k)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---- voet: waar dit vandaan komt ---- */}
        {antwoord && (
          <div className="border-t border-stroke-soft px-5 py-3 text-[11.5px] leading-relaxed text-ink-faint">
            {antwoord.bronnen.length > 0 && (
              <span>Gezocht bij {opsomming(antwoord.bronnen.map((b) => BRONNAAM[b]))}. </span>
            )}
            {antwoord.ontbrekend.length > 0 && (
              <span>
                Niet meegezocht bij {opsomming(antwoord.ontbrekend.map((b) => BRONNAAM[b]))}: daar
                is nog geen API-sleutel voor ingesteld.
              </span>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * "Pexels, Pixabay en YouTube" in plaats van "Pexels en Pixabay en YouTube".
 *
 * Met twee bronnen viel dit niet op; met drie wel.
 */
function opsomming(namen: string[]): string {
  if (namen.length <= 1) return namen[0] ?? "";
  return `${namen.slice(0, -1).join(", ")} en ${namen[namen.length - 1]}`;
}

/** Eén kandidaat als klikbare tegel. */
function Keuze({
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
      disabled={uit}
      title={`${kandidaat.titel} — ${kandidaat.maker}`}
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-card border border-stroke bg-card text-left",
        springClasses("flow"),
        "transition-[transform,border-color,box-shadow]",
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
        {kandidaat.bron === "youtube" && (
          <span className="absolute left-1 top-1 rounded-control bg-bloom-ink px-1.5 py-0.5 text-[10px] font-semibold text-card">
            alleen online
          </span>
        )}
        {kandidaat.seconden !== undefined && (
          <span className="absolute bottom-1 right-1 rounded-control bg-ink/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-card">
            {duur(kandidaat.seconden)}
          </span>
        )}
        {bezig && (
          <span className="absolute inset-0 grid place-items-center bg-card/80 text-[12px] font-semibold text-flow-ink">
            Ophalen…
          </span>
        )}
      </span>
      <span className="flex flex-col gap-0.5 px-2 py-1.5">
        <span className="line-clamp-2 text-[11.5px] font-semibold leading-snug text-ink">
          {kandidaat.titel}
        </span>
        <span className="truncate text-[10.5px] text-ink-faint">
          {BRONNAAM[kandidaat.bron]} · {kandidaat.maker}
        </span>
      </span>
    </button>
  );
}

function duur(seconden: number): string {
  const m = Math.floor(seconden / 60);
  const s = Math.round(seconden % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Een bestandsnaam die iets zegt.
 *
 * De bron levert er geen; zonder dit zou elk binnengehaald bestand "download" heten en zou de
 * auteur in een lijst van tien niet meer weten welke welke is.
 */
export function bestandsnaam(k: Kandidaat): string {
  const kern = (k.titel || k.maker || "media")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const ext = k.soort === "video" ? "mp4" : "jpg";
  return `${kern || "media"}-${k.bron}.${ext}`;
}
