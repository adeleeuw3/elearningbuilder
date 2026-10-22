/**
 * Het storyboard: het canvas met de blokken, de inhoudsopgave ernaast, en de doellijnen ertussen.
 *
 * De verbindingslijn koppelt een rij blokken op het canvas aan zijn groep in de inhoudsopgave. Er
 * is er hooguit **één** tegelijk, bij hover of selectie. Permanente lijnen naar elke groep leken
 * logisch maar kruisen bij meer dan een paar pagina's het hele canvas; dan wijzen ze niets meer aan
 * en staan ze in de weg. Het verband tonen op het moment dat je ernaar vraagt doet hetzelfde werk
 * zonder die prijs.
 *
 * De lijnen worden **gemeten**, niet berekend: het canvas schuift, zoomt en pant, en de kaarten
 * veranderen van hoogte. Er is dus geen formule die de plek van een kaart op het scherm kent — die
 * moet uit `getBoundingClientRect()` komen, en dus opnieuw bij elke scroll, zoom, versleep en
 * resize. Alles achter één `rAF`, want scroll-events komen sneller dan frames.
 *
 * Kleur: Prism noemt bij Flow expliciet *verbinding*. Een doellijn is precies dat en niets meer,
 * dus Flow op lage dekking — en iets steviger voor de groep waarin het geselecteerde blok zit.
 */
"use client";

import * as React from "react";
import { TONE_HEX, cn } from "@ob/ui";
import { Whiteboard } from "./Whiteboard";
import { Inhoudsopgave, groepSleutel } from "./Inhoudsopgave";
import type { Knoop, KnoopSoort, Leerpad, Verbinding } from "../../lib/graph";
import type { Pagina, SectieGroep } from "../../lib/paginas";
import type { Streek } from "../../lib/annotaties";

export interface StoryboardProps {
  knopen: Knoop[];
  verbindingen: Verbinding[];
  breedte: number;
  hoogte: number;
  blokNummers: Record<string, number>;
  groepen: SectieGroep[];
  geselecteerd: string | null;
  geselecteerdeSchakel: string | null;
  onSelecteer: (id: string | null) => void;
  onSelecteerSchakel: (id: string | null) => void;
  onVerplaats: (knopen: Knoop[]) => void;
  onVerbind: (van: string, naar: string) => void;
  onVerbreek: (id: string) => void;
  selectie: string[];
  onSelectie: (ids: string[]) => void;
  onOpruimen: (hoogtes: Record<string, number>) => void;
  onVerwijderSelectie: () => void;
  leerpad: Leerpad;
  onPlaatsBlok: (soort: KnoopSoort) => void;
  onWijzigKnoop: (id: string, patch: Partial<Knoop>) => void;
  tekstVan: (knoop: Knoop) => string | null;
  onTekst: (knoop: Knoop, tekst: string) => void;
  onGenereer: (id: string) => void;
  bezigMet: string | null;
  onOpen: (knoop: Knoop) => void;
  streken: Streek[];
  onStreken: (streken: Streek[]) => void;
  onNieuweSectie: () => void;
  onDupliceerPagina: (pagina: Pagina) => void;
  /** Klik op een paginatitel: selecteer de hele keten. */
  onKiesPagina: (pagina: Pagina) => void;
  /** Breng deze knoop in beeld. De teller loopt op zodat twee keer hetzelfde blok ook werkt. */
  centreer: { id: string; teller: number } | null;
  /** De gemeten kaarthoogtes, zodat de layout rijen kan laten meegroeien. */
  onHoogtes: (hoogtes: Record<string, number>) => void;
  /** Onder de inhoudsopgave in dezelfde zijbalk: controlelijst en het paneel van het blok. */
  zijpaneel?: React.ReactNode;
}

interface Lijn {
  sleutel: string;
  d: string;
  actief: boolean;
}

export function Storyboard(props: StoryboardProps) {
  const { knopen, groepen, geselecteerd } = props;

  const omhulselRef = React.useRef<HTMLDivElement | null>(null);
  const canvasVakRef = React.useRef<HTMLDivElement | null>(null);
  const zijbalkRef = React.useRef<HTMLDivElement | null>(null);
  const kaarten = React.useRef(new Map<string, HTMLDivElement>());
  const ankers = React.useRef(new Map<string, HTMLElement>());
  const [lijn, setLijn] = React.useState<Lijn | null>(null);
  /** Waar de cursor overheen gaat: een knoop op het canvas of een groep in het paneel. */
  const [hoverKnoop, setHoverKnoop] = React.useState<string | null>(null);
  const [hoverPagina, setHoverPagina] = React.useState<string | null>(null);
  const gepland = React.useRef(0);

  const zetKaart = React.useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) kaarten.current.set(id, el);
    else kaarten.current.delete(id);
  }, []);

  const zetAnker = React.useCallback((sleutel: string, el: HTMLElement | null) => {
    if (el) ankers.current.set(sleutel, el);
    else ankers.current.delete(sleutel);
  }, []);

  /**
   * Welke groep het verband nu toont: waar de cursor is, anders waar de selectie staat.
   *
   * Hover wint van selectie: je wijst iets aan om het te zien, en dan moet dát antwoord komen en
   * niet het antwoord van vijf minuten geleden.
   */
  const paginas = React.useMemo(() => groepen.flatMap((g) => g.paginas), [groepen]);

  const actievePagina = React.useMemo(() => {
    const bij = (knoopId: string | null) =>
      knoopId
        ? (paginas.find((p) => p.onderdelen.some((k) => k.id === knoopId))?.kop.id ?? null)
        : null;
    return hoverPagina ?? bij(hoverKnoop) ?? bij(geselecteerd);
  }, [paginas, hoverPagina, hoverKnoop, geselecteerd]);

  /** De blokken van de pagina die vanuit het paneel wordt aangewezen, om ze te laten oplichten. */
  const gemarkeerd = React.useMemo(() => {
    if (!hoverPagina) return [];
    const p = paginas.find((x) => x.kop.id === hoverPagina);
    return p ? p.onderdelen.map((k) => k.id) : [];
  }, [paginas, hoverPagina]);

  const meet = React.useCallback(() => {
    const omhulsel = omhulselRef.current;
    const vak = canvasVakRef.current;
    const zijbalk = zijbalkRef.current;
    if (!omhulsel || !vak || !zijbalk) return;

    const basis = omhulsel.getBoundingClientRect();
    const vakRect = vak.getBoundingClientRect();
    const zijRect = zijbalk.getBoundingClientRect();

    /**
     * Staan canvas en zijbalk náást elkaar? Gemeten in plaats van uit een breakpoint afgeleid.
     * Een `matchMedia("(min-width: 1024px)")` moet handmatig gelijk blijven aan de `lg:`-klassen
     * hieronder, en dat loopt vroeg of laat uiteen. Onder elkaar zou een lijn dwars over de pagina
     * niets aanwijzen, dus dan tekenen we er geen.
     */
    const pagina = paginas.find((p) => p.kop.id === actievePagina);
    if (zijRect.left < vakRect.right - 1 || !pagina) {
      setLijn((vorig) => (vorig === null ? vorig : null));
      return;
    }

    const anker = ankers.current.get(pagina.kop.id);
    const blokken = pagina.onderdelen;
    if (!anker || blokken.length === 0) {
      setLijn(null);
      return;
    }

    // Verticaal midden van de kaarten van deze groep, geknipt op de rand van het canvasvak:
    // een kaart die weggescrold is mag de lijn niet buiten het canvas laten beginnen.
    const centra: number[] = [];
    for (const k of blokken) {
      const el = kaarten.current.get(k.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      centra.push(r.top + r.height / 2);
    }
    if (centra.length === 0) {
      setLijn(null);
      return;
    }
    const gemiddeld = centra.reduce((a, b) => a + b, 0) / centra.length;
    const y1 = Math.min(Math.max(gemiddeld, vakRect.top + 8), vakRect.bottom - 8) - basis.top;
    const x1 = vakRect.right - basis.left;

    // De zijbalk scrollt zelf; een kop die daar uit beeld is mag de lijn niet buiten de zijbalk
    // laten eindigen. Zelfde redenering als de knip op de canvasrand hierboven.
    const ar = anker.getBoundingClientRect();
    const x2 = ar.left - basis.left;
    const ankerY = ar.top + Math.min(ar.height / 2, 26);
    const y2 = Math.min(Math.max(ankerY, zijRect.top + 8), zijRect.bottom - 8) - basis.top;

    // Nooit meer bocht dan de halve afstand: het gat tussen canvas en zijbalk is maar de flex-gap
    // breed, en een vaste minimumbocht zet de twee controlepunten dan over elkaar heen — de lijn
    // maakt een knik terug in plaats van een vloeiende S.
    const bocht = Math.max(6, Math.min(36, (x2 - x1) * 0.5));
    setLijn({
      sleutel: pagina.kop.id,
      d: `M${x1} ${y1} C${x1 + bocht} ${y1} ${x2 - bocht} ${y2} ${x2} ${y2}`,
      actief: blokken.some((k) => k.id === geselecteerd),
    });
  }, [paginas, geselecteerd, actievePagina]);

  /**
   * Scroll-events komen sneller dan frames; één meting per frame is genoeg.
   *
   * Annuleren-en-opnieuw-plannen in plaats van een "staat er al een gepland"-vlag. Die vlag latcht:
   * in een tabblad dat niet tekent draait `requestAnimationFrame` niet, de vlag komt nooit meer op
   * false, en dan meet dit component nooit meer — ook niet als het tabblad terugkomt.
   */
  const meetStraks = React.useCallback(() => {
    cancelAnimationFrame(gepland.current);
    gepland.current = requestAnimationFrame(meet);
  }, [meet]);

  React.useLayoutEffect(() => {
    meet();
  }, [meet, knopen]);

  React.useEffect(() => {
    window.addEventListener("scroll", meetStraks, true);
    window.addEventListener("resize", meetStraks);
    const ro = new ResizeObserver(meetStraks);
    if (omhulselRef.current) ro.observe(omhulselRef.current);
    return () => {
      window.removeEventListener("scroll", meetStraks, true);
      window.removeEventListener("resize", meetStraks);
      ro.disconnect();
      cancelAnimationFrame(gepland.current);
    };
  }, [meetStraks]);

  return (
    <div ref={omhulselRef} className="relative flex flex-col gap-5 lg:flex-row lg:gap-8">
      <div ref={canvasVakRef} className="min-w-0 flex-1">
        <Whiteboard
          knopen={props.knopen}
          verbindingen={props.verbindingen}
          breedte={props.breedte}
          hoogte={props.hoogte}
          blokNummers={props.blokNummers}
          geselecteerd={props.geselecteerd}
          geselecteerdeSchakel={props.geselecteerdeSchakel}
          onSelecteer={props.onSelecteer}
          onSelecteerSchakel={props.onSelecteerSchakel}
          onVerplaats={props.onVerplaats}
          onVerbind={props.onVerbind}
          onVerbreek={props.onVerbreek}
          selectie={props.selectie}
          onSelectie={props.onSelectie}
          onOpruimen={props.onOpruimen}
          onVerwijderSelectie={props.onVerwijderSelectie}
          leerpad={props.leerpad}
          onPlaatsBlok={props.onPlaatsBlok}
          onWijzigKnoop={props.onWijzigKnoop}
          tekstVan={props.tekstVan}
          onTekst={props.onTekst}
          onGenereer={props.onGenereer}
          bezigMet={props.bezigMet}
          onOpen={props.onOpen}
          streken={props.streken}
          onStreken={props.onStreken}
          onKaartAnker={zetKaart}
          onHoverKnoop={setHoverKnoop}
          gemarkeerd={gemarkeerd}
          onHoogtes={props.onHoogtes}
          centreer={props.centreer}
          onVerandering={meetStraks}
        />
      </div>

      {/* De zijbalk blijft staan terwijl het canvas scrollt, en scrollt zelf als hij te lang wordt.
          `self-start` is nodig: in een flex-rij rekt een kolom standaard mee met de hoogste, en dan
          heeft `sticky` niets om binnen te blijven plakken. */}
      <div
        ref={zijbalkRef}
        className={cn(
          "flex w-full shrink-0 flex-col gap-4",
          "lg:sticky lg:top-4 lg:w-[330px] lg:self-start",
          "lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1",
        )}
      >
        <Inhoudsopgave
          groepen={props.groepen}
          geselecteerd={props.geselecteerd}
          onKiesBlok={(id) => {
            props.onSelecteerSchakel(null);
            props.onSelecteer(id);
          }}
          onKiesPagina={props.onKiesPagina}
          onHoverPagina={setHoverPagina}
          actievePagina={actievePagina}
          onNieuweSectie={props.onNieuweSectie}
          onDupliceerPagina={props.onDupliceerPagina}
          onAnker={zetAnker}
        />
        {props.zijpaneel}
      </div>

      {/* De doellijnen liggen over beide kolommen en vangen geen clicks. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible lg:block"
      >
        {lijn && (
          <path
            d={lijn.d}
            fill="none"
            strokeWidth={lijn.actief ? 2.25 : 1.75}
            strokeLinecap="round"
            stroke={TONE_HEX.flow.from}
            opacity={lijn.actief ? 0.85 : 0.55}
          />
        )}
      </svg>
    </div>
  );
}
