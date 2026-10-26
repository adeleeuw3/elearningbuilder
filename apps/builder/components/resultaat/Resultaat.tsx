/**
 * Het resultaat: de gegenereerde module als bewerkbare blokken.
 *
 * Elk blok heeft "Bewerken" (inline velden) en "Opnieuw" (één blok opnieuw laten schrijven via
 * /api/regenerate). Het juiste antwoord van een vraag krijgt de Glow-behandeling — Glow betekent
 * "voltooid/juist", dus dat is de betekenis en niet decoratie.
 */
"use client";

import * as React from "react";
import { Button, Card, cn } from "@ob/ui";
import { Blok, Veld } from "./Blok";
import { Foutmelding } from "../interview/Foutmelding";
import { KnoopPaneel } from "../whiteboard/KnoopPaneel";
import { Variantenkiezer } from "../whiteboard/Variantenkiezer";
import { Storyboard } from "../whiteboard/Storyboard";
import { Controlelijst } from "../whiteboard/Controlelijst";
import type { Streek } from "../../lib/annotaties";
import {
  bewaarProject,
  exporteerPakket,
  regenereerSectie,
  regenereerVraag,
  schrijfTekst,
  type ExportProfiel,
} from "../../lib/api-client";
import { canvasBreedte, canvasHoogte, type Knoop, type KnoopSoort } from "../../lib/graph";
import { onderRijen, rijLayout, schuifInRij } from "../../lib/canvas";
import {
  aiDoel,
  assessmentChecks,
  contentMetTekst,
  controleerLeerpad,
  dupliceerKeten,
  leerpadUitContent,
  leesTekst,
  synchroniseerMetContent,
  totaleMinuten,
  voegPaginaToe,
  zetPaginaTitel,
  verbindKnopen,
  verbreekVerbinding,
  verwijderKnoop,
  voegKnoopToe,
  voorzieVanSeeds,
  wijzigKnoop,
  zetMinuten,
  type Leerpad,
} from "../../lib/leerpad";
import {
  paginasPerSectie,
  paginasVan,
  plekVanBlok,
  type Pagina,
} from "../../lib/paginas";
import { metBeelden, type Beeldkeuzes } from "../../lib/beeldkeuze";
import { migreerLeerpad } from "../../lib/migratie";
import { nieuwId } from "../../lib/opslag";
import {
  andereKoppen,
  andereVragen,
  vervangSectie,
  vervangVraag,
  verwijderOptie,
  voegOptieToe,
  wijzigOptie,
  zetCorrect,
} from "../../lib/content";
import type { ApiFout, CompleteModuleSpec, GeneratedContent, Vraag } from "../../lib/types";

export interface ResultaatProps {
  /**
   * `null` bij een module die de auteur zelf begon, buiten het interview om. Zonder spec is er
   * niets om een herschrijving op te baseren, dus vervalt "Opnieuw" — zie `Blok`.
   */
  spec: CompleteModuleSpec | null;
  content: GeneratedContent;
  onChange: (content: GeneratedContent) => void;
  onNieuweModule: () => void;
  /** Het leerpad zoals het uit de opslag kwam; leeg bij een nieuwe module. */
  beginLeerpad?: Leerpad;
  /** Het id waaronder deze module bewaard is; null zolang hij nieuw is. */
  projectId?: string | null;
  /** Beelden die de auteur na het bouwen bij de secties koos, per sectie-index. */
  beelden?: Beeldkeuzes;
}

export function Resultaat({
  spec,
  beelden,
  content,
  onChange,
  onNieuweModule,
  beginLeerpad,
  projectId,
}: ResultaatProps) {
  const [bewerkt, setBewerkt] = React.useState<Record<string, boolean>>({});
  const [bezig, setBezig] = React.useState<Record<string, boolean>>({});
  const [fout, setFout] = React.useState<{ bericht: string; code: ApiFout["code"] } | null>(null);
  const [weergave, setWeergave] = React.useState<"whiteboard" | "blokken">("whiteboard");

  /**
   * Het leerpad — blokken, schakels en secties — staat in eigen state, want het is **auteurswerk**
   * en geen afgeleide van de content. De reeks bepaalt de stapelvolgorde op de pagina, dus zou hij
   * bij elke contentwijziging opnieuw uit de content worden opgebouwd, dan gooide iedere druk op
   * "Opnieuw" het herdraden van de auteur weg.
   *
   * `synchroniseerMetContent` doet de bijwerkslag: de content bepaalt de tekst, de auteur bepaalt de
   * structuur.
   */
  /**
   * Een geladen leerpad gaat door `voorzieVanSeeds`: projecten van vóór de stabiele identiteiten
   * hebben er geen, en zonder deze stap zou elk blok bij elke keer openen een andere identiteit
   * krijgen — precies wat de seed hoort te voorkomen. De functie is idempotent, dus voor een recent
   * project verandert er niets.
   */
  const [leerpad, setLeerpad] = React.useState<Leerpad>(() =>
    // `migreerLeerpad` haalt de oude Pagina- en Cursusknopen eruit en ketent hun blokken aan
    // elkaar. Idempotent, dus een project dat al om is gaat er ongewijzigd doorheen.
    //
    // `metBeelden` zet de beelden erop die de auteur na het bouwen bij de secties koos. Alleen hier,
    // bij het aanmaken: een opgeslagen project draagt zijn beelden al, en ze er bij elke render
    // overheen zetten zou een vervangen beeld telkens terugdraaien.
    beginLeerpad
      ? voorzieVanSeeds(migreerLeerpad(beginLeerpad))
      : metBeelden(leerpadUitContent(content), beelden ?? {}),
  );
  /**
   * De identiteit van deze module — vanaf het moment dat ze bestaat, niet pas bij het eerste
   * bewaren.
   *
   * Dit id is tevens de `artifactId` waar alle xAPI-IRI's aan hangen. Wachten tot het opslaan
   * betekende dat exporteren pas kón na opslaan, en dat is een voorwaarde die niets met exporteren
   * te maken heeft. Nu is hij er meteen, en gebruiken bewaren én exporteren dezelfde: een pakket
   * dat je vóór het opslaan maakt heeft dezelfde IRI's als een pakket erna.
   */
  const [moduleId] = React.useState(() => projectId ?? nieuwId());
  /** Is deze module al een keer bewaard? Alleen voor wat het scherm erover zegt. */
  const [bewaardAls, setBewaardAls] = React.useState<string | null>(projectId ?? null);
  const [bewaarStand, setBewaarStand] = React.useState<"rust" | "bezig" | "klaar" | "mis">("rust");
  /** Wat de server zei toen bewaren niet lukte. Een gok helpt de auteur niet vooruit. */
  const [bewaarFout, setBewaarFout] = React.useState<string | null>(null);
  const [profiel, setProfiel] = React.useState<ExportProfiel>("xapi");
  const [exportStand, setExportStand] = React.useState<"rust" | "bezig" | "klaar">("rust");
  /** Waarom de export geweigerd werd. Auteurstaal, komt rechtstreeks van de route. */
  const [exportRedenen, setExportRedenen] = React.useState<string[]>([]);
  const [exportFout, setExportFout] = React.useState<string | null>(null);
  /**
   * De selectie als lijst, want je kunt er meerdere tegelijk vasthebben. Het láátste id is het
   * primaire: dat vult het paneel en licht op in de inhoudsopgave. Zo hoefden de bestaande
   * `geselecteerd`-props niet allemaal om.
   */
  const [selectie, setSelectie] = React.useState<string[]>([]);
  const geselecteerd = selectie.at(-1) ?? null;
  const setGeselecteerd = React.useCallback(
    (id: string | null) => setSelectie(id === null ? [] : [id]),
    [],
  );
  const [geselecteerdeSchakel, setGeselecteerdeSchakel] = React.useState<string | null>(null);

  /**
   * Tekeningen staan hier en niet in het whiteboard zelf: bij het wisselen naar de blokkenweergave
   * wordt dat component ontkoppeld, en dan zou het tekenwerk verdwijnen.
   */
  const [streken, setStreken] = React.useState<Streek[]>([]);
  /** Voor welke knoop draait de tekstgeneratie. */
  const [schrijft, setSchrijft] = React.useState<string | null>(null);
  /** Voor welke knoop het schrijfvenster openstaat. */
  const [schrijfVoor, setSchrijfVoor] = React.useState<string | null>(null);
  const [varianten, setVarianten] = React.useState<string[]>([]);
  const [schrijfFout, setSchrijfFout] = React.useState<string | null>(null);

  // De content is bijgewerkt (bewerkt veld, of een blok opnieuw geschreven): tekst overnemen,
  // structuur laten staan. Gebeurt bij elke contentwijziging; de functie is idempotent.
  React.useEffect(() => {
    setLeerpad((vorig) => synchroniseerMetContent(vorig, content));
  }, [content]);

  /** Welk blok het canvas in beeld moet brengen. De teller loopt op zodat twee keer hetzelfde werkt. */
  const [centreer, setCentreer] = React.useState<{ id: string; teller: number } | null>(null);
  /**
   * De gemeten kaarthoogtes, van het canvas.
   *
   * De layout heeft ze nodig: een rij is minstens de vaste rijhoogte, maar groeit mee met zijn
   * hoogste kaart. Zonder meting zou een tekstblok met prompt- én uitvoerveld over de rij eronder
   * lopen — en overlap is precies wat dit model onmogelijk moet maken.
   */
  const hoogtes = React.useRef<Record<string, number>>({});

  /**
   * De vorige plaatsing, om "Opruimen" ongedaan te kunnen maken.
   *
   * Opruimen is de enige handeling die posities dwingend herschrijft, en dus de enige die iets
   * wegneemt wat de auteur zelf heeft neergelegd. Zo'n handeling hoort terug te draaien te zijn,
   * anders durft niemand hem te gebruiken.
   */
  const vorigePlaatsing = React.useRef<Knoop[] | null>(null);

  /**
   * Elke structuurwijziging gaat hier doorheen.
   *
   * Bewust géén layout meer: het canvas is vrij, en posities worden alleen herschreven door
   * "Opruimen". Wat hier wél gebeurt, gebeurt bij het toevoegen en het aanhaken van een blok —
   * daar heeft het blok nog geen plek en moet er dus één gekozen worden.
   */
  const wijzig = React.useCallback((f: (l: Leerpad) => Leerpad) => setLeerpad(f), []);

  /** Legt de hele module in het raster. Onthoudt eerst waar alles stond. */
  const opruimen = React.useCallback(() => {
    setLeerpad((l) => {
      vorigePlaatsing.current = l.knopen;
      return { ...l, knopen: rijLayout(l, hoogtes.current) };
    });
  }, []);

  /** Zet de plaatsing terug zoals hij vóór het opruimen was. */
  const maakOngedaan = React.useCallback(() => {
    const terug = vorigePlaatsing.current;
    if (!terug) return false;
    vorigePlaatsing.current = null;
    setLeerpad((l) => ({ ...l, knopen: l.knopen.map((k) => terug.find((v) => v.id === k.id) ?? k) }));
    return true;
  }, []);

  React.useEffect(() => {
    const opToets = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      // Alleen als er iets terug te draaien is; anders laten we de browser zijn gang gaan, zodat
      // cmd+Z in een tekstveld gewoon de tekst herstelt.
      if (maakOngedaan()) e.preventDefault();
    };
    window.addEventListener("keydown", opToets);
    return () => window.removeEventListener("keydown", opToets);
  }, [maakOngedaan]);

  const paginas = React.useMemo(() => paginasVan(leerpad), [leerpad]);
  /** De nummers op de kaarten: de plek van een blok binnen zíjn pagina, niet over de cursus heen. */
  const blokNummers = React.useMemo(() => {
    const uit: Record<string, number> = {};
    for (const p of paginas) p.onderdelen.forEach((k, i) => (uit[k.id] = i + 1));
    return uit;
  }, [paginas]);
  const groepen = React.useMemo(
    () => paginasPerSectie(leerpad, paginas),
    [leerpad, paginas],
  );
  const problemen = React.useMemo(() => controleerLeerpad(leerpad), [leerpad]);
  const aantalPaginas = paginas.length;
  const aantalBlokken = paginas.reduce((som, p) => som + p.onderdelen.length, 0);

  /** Selecteren vanuit het rechterpaneel: aanwijzen én in beeld brengen. */
  const kiesBlok = React.useCallback((id: string) => {
    setGeselecteerdeSchakel(null);
    setSelectie([id]);
    setCentreer((c) => ({ id, teller: (c?.teller ?? 0) + 1 }));
  }, []);
  const afmetingen = React.useMemo(
    () => ({ breedte: canvasBreedte(leerpad.knopen), hoogte: canvasHoogte(leerpad.knopen) }),
    [leerpad.knopen],
  );
  const actieveKnoop = leerpad.knopen.find((k) => k.id === geselecteerd) ?? null;

  /** Op welke pagina staat het geselecteerde blok, en waar in de stapel? */
  const plekVanActieve = React.useMemo(() => {
    if (!actieveKnoop) return null;
    const plek = plekVanBlok(paginas, actieveKnoop.id);
    if (!plek) return null;
    return {
      pagina: plek.pagina.titel,
      positie: plek.positie,
      aantal: plek.pagina.onderdelen.length,
    };
  }, [paginas, actieveKnoop]);

  /**
   * Is het geselecteerde blok de kop van zijn pagina? Alleen dan is er een paginatitel te zetten:
   * daar hangt de identiteit aan, en een titelveld op elk blok zou suggereren dat elk blok een
   * pagina begint.
   */
  const paginaKopVanActieve = React.useMemo(() => {
    if (!actieveKnoop) return null;
    const pagina = paginas.find((p) => p.kop.id === actieveKnoop.id);
    if (!pagina) return null;
    return {
      titel: pagina.titel,
      eigenTitel: pagina.eigenTitel,
      blokTitel: pagina.kop.titel,
    };
  }, [paginas, actieveKnoop]);

  /**
   * De tekst van een knoop, uit de bron waar hij hoort — en hem daar ook weer wegschrijven.
   *
   * Dit is de plek waar de twee bronnen samenkomen, en de enige plek die van allebei weet. De kaart
   * krijgt alleen een string en een setter, en kan dus niet meer per ongeluk naar de knoop schrijven
   * terwijl de cursist uit de content leest.
   */
  const tekstVan = React.useCallback(
    (knoop: Knoop) => leesTekst(knoop, content),
    [content],
  );

  const zetTekst = React.useCallback(
    (knoop: Knoop, tekst: string) => {
      const nieuw = contentMetTekst(knoop, content, tekst);
      if (nieuw) onChange(nieuw);
      else setLeerpad((l) => wijzigKnoop(l, knoop.id, { uitvoer: tekst }));
    },
    [content, onChange],
  );

  /**
   * De knoop waar het schrijfvenster bij hoort — afgeleid, niet apart bewaard.
   *
   * Een kopie van de knoop in state zou na een wijziging de oude titel en de oude tekst blijven
   * tonen, en dan schrijf je op grond van iets wat er niet meer staat.
   */
  const schrijfKnoop = schrijfVoor
    ? (leerpad.knopen.find((k) => k.id === schrijfVoor) ?? null)
    : null;

  const wisselBewerk = (id: string) => setBewerkt((v) => ({ ...v, [id]: !v[id] }));

  async function opnieuwSectie(index: number) {
    const huidig = content.secties[index];
    if (!huidig || !spec) return;
    const id = `s${index}`;
    setBezig((b) => ({ ...b, [id]: true }));
    setFout(null);
    const res = await regenereerSectie(spec, huidig, andereKoppen(content, index));
    setBezig((b) => ({ ...b, [id]: false }));
    if (res.ok) onChange(vervangSectie(content, index, res.data));
    else setFout({ bericht: res.bericht, code: res.code });
  }

  async function opnieuwVraag(index: number) {
    const huidig = content.vragen[index];
    if (!huidig || !spec) return;
    const id = `v${index}`;
    setBezig((b) => ({ ...b, [id]: true }));
    setFout(null);
    const res = await regenereerVraag(spec, huidig, andereVragen(content, index));
    setBezig((b) => ({ ...b, [id]: false }));
    if (res.ok) onChange(vervangVraag(content, index, res.data));
    else setFout({ bericht: res.bericht, code: res.code });
  }

  const patchVraag = (index: number, v: Vraag) => onChange(vervangVraag(content, index, v));

  /**
   * Laat de tekst van één knoop schrijven.
   *
   * De uitvoer van de knoop ervóór gaat mee als context: dat is wat "de uitvoer van de ene knoop is
   * de invoer van de volgende" in de praktijk betekent. Zonder die context schrijft elk blok alsof
   * het het eerste is.
   */
  /**
   * Laat versies van dit blok schrijven, om uit te kiezen.
   *
   * De uitvoer van de knoop ervóór gaat mee als context: dat is wat "de uitvoer van de ene knoop is
   * de invoer van de volgende" in de praktijk betekent. Zonder die context schrijft elk blok alsof
   * het het eerste is.
   *
   * De opdracht komt uit het venster en niet van de knoop: je past hem daar meestal juist aan omdat
   * de vorige uitkomst niet beviel. Hij wordt wél teruggeschreven naar de knoop, anders is die
   * wijziging weg zodra het venster dicht gaat.
   */
  async function schrijfVarianten(id: string, opdracht: string, aantal: number) {
    const knoop = leerpad.knopen.find((k) => k.id === id);
    if (!knoop || !opdracht.trim()) return;
    setLeerpad((l) => wijzigKnoop(l, id, { prompt: opdracht }));

    const vorige = leerpad.verbindingen.find((v) => v.naar === id)?.van;
    const vorigeKnoop = leerpad.knopen.find((k) => k.id === vorige);
    // Ook de context uit de échte bron: anders levert een contentblok als voorganger niets op.
    const context = vorigeKnoop ? (leesTekst(vorigeKnoop, content) ?? "") : "";

    setSchrijft(id);
    setSchrijfFout(null);
    const res = await schrijfTekst({
      opdracht,
      titel: knoop.titel,
      huidig: leesTekst(knoop, content) ?? "",
      context,
      aantal,
    });
    setSchrijft(null);
    if (res.ok) setVarianten(res.data.varianten);
    else setSchrijfFout(res.bericht);
  }

  /**
   * Bewaart de module: de content én de graaf.
   *
   * Bewust één document. De graaf verwijst naar contentblokken op index, dus die twee los bewaren
   * levert vroeg of laat een graaf op die naar een sectie wijst die niet meer bestaat.
   */
  async function bewaar() {
    setBewaarStand("bezig");
    /**
     * Het project-id is tevens de `artifactId` van de module.
     *
     * Bewust geen tweede UUID ernaast: één module is één project, en twee identiteiten die gelijk
     * moeten blijven lopen vroeg of laat uiteen. De IRI's bij export hangen hieraan, dus hij mag
     * nooit veranderen — daarom wordt hij bij het eerste bewaren toegekend en daarna hergebruikt.
     */
    const uit = await bewaarProject(moduleId, content.titel, {
      content,
      leerpad,
      artifactId: moduleId,
      // De spec gaat mee, want zonder hem verliest een heropende module twee dingen stil: het
      // gekozen thema (de export valt dan terug op het standaardthema) en de mogelijkheid om een
      // blok opnieuw te laten schrijven — dat laatste meldde de app wel, het eerste niet.
      ...(spec ? { spec } : {}),
    });
    if (!uit.ok) {
      setBewaarFout(uit.bericht);
      setBewaarStand("mis");
      return;
    }
    setBewaarFout(null);
    setBewaardAls(uit.data.id);
    setBewaarStand("klaar");
  }

  /**
   * Haalt het exportpakket op en biedt het als download aan.
   *
   * Hoeft niet bewaard te zijn: de module draagt haar identiteit vanaf het begin, dus de IRI's in
   * het pakket kloppen ook als er nog niets op schijf staat. Wel gaan alle poorten gewoon door —
   * publicatieblokkades, manifest-controle en de secret-scan draaien onveranderd.
   */
  async function exporteer() {
    if (exportStand === "bezig") return;
    setExportStand("bezig");
    setExportFout(null);
    setExportRedenen([]);

    // Het thema komt uit het interview. `spec` is null bij een module die de auteur zelf begon;
    // dan valt de export terug op het standaardthema.
    const uit = await exporteerPakket(
      { id: moduleId, content, leerpad, thema: spec?.thema ?? null },
      profiel,
    );
    if (!uit.ok) {
      setExportStand("rust");
      setExportFout(uit.bericht);
      setExportRedenen(uit.redenen);
      return;
    }

    // Object-URL meteen weer vrijgeven: anders blijft de ZIP in het geheugen staan tot de pagina
    // ververst, en bij een paar exports achter elkaar is dat zo tientallen megabytes.
    const url = URL.createObjectURL(uit.blob);
    const anker = document.createElement("a");
    anker.href = url;
    anker.download = uit.bestandsnaam;
    anker.click();
    URL.revokeObjectURL(url);
    setExportStand("klaar");
  }

  /**
   * Een blok uit het palet plaatsen: als nieuwe pagina onderaan, en meteen geselecteerd.
   *
   * Waar er geklikt of losgelaten is doet niet ter zake — een nieuw blok is een nieuwe pagina, en
   * die hoort achteraan de cursus. Wil de auteur hem bij een bestaande pagina, dan sleept hij een
   * schakel; de auto-layout schuift hem dan vanzelf die rij in.
   */
  function plaatsBlok(soort: KnoopSoort) {
    setLeerpad((l) => {
      const { leerpad: na, id } = voegPaginaToe(l, soort, onderRijen(l, hoogtes.current));
      setSelectie([id]);
      setCentreer((c) => ({ id, teller: (c?.teller ?? 0) + 1 }));
      return na;
    });
  }

  /** Leesbare beschrijving van een schakel, voor het paneel eronder. */
  function schakelTekst(id: string): string {
    const v = leerpad.verbindingen.find((x) => x.id === id);
    if (!v) return "Schakel";
    const titel = (knoopId: string) =>
      leerpad.knopen.find((k) => k.id === knoopId)?.titel ?? knoopId;
    return `"${titel(v.naar)}" komt op de pagina direct onder "${titel(v.van)}".`;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        // Lange lopende tekst over 1900px leest niet; het canvas juist wel.
        weergave === "blokken" && "mx-auto w-full max-w-[760px]",
      )}
    >
      {/* titel + intro */}
      <Card panel className="p-5 motion-safe:animate-[prism-bloom-in_420ms_both]">
        {bewerkt["kop"] ? (
          <div className="flex flex-col gap-2.5">
            <Veld
              eenRegel
              label="Titel"
              waarde={content.titel}
              onChange={(titel) => onChange({ ...content, titel })}
            />
            <Veld
              label="Intro"
              waarde={content.intro}
              onChange={(intro) => onChange({ ...content, intro })}
            />
          </div>
        ) : (
          <>
            <h1 className="text-[30px] font-bold leading-tight -tracking-[0.02em]">
              {content.titel}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{content.intro}</p>
          </>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" role_="subtle" onClick={() => wisselBewerk("kop")}>
            {bewerkt["kop"] ? "Klaar" : "Bewerken"}
          </Button>
          <span className="text-[12px] text-ink-faint">
            {content.secties.length} secties · {content.vragen.length} vragen
          </span>
          <span className="ml-auto flex gap-1 rounded-control border border-stroke bg-card-sub p-1">
            {(
              [
                ["whiteboard", "Whiteboard"],
                ["blokken", "Blokken"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={weergave === id}
                onClick={() => setWeergave(id)}
                className={cn(
                  "rounded-control px-3 py-1.5 text-[12.5px] font-semibold",
                  "[transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px hover:shadow-glow-flow",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
                  weergave === id
                    ? "bg-card text-flow-ink shadow-elevation"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
      </Card>

      {fout && (
        <Foutmelding bericht={fout.bericht} code={fout.code} onOpnieuw={() => setFout(null)} />
      )}

      {!spec && weergave === "blokken" && (
        <p className="rounded-card border border-stroke bg-card p-3.5 text-[12.5px] leading-relaxed text-ink-soft shadow-elevation">
          Deze module heb je zelf begonnen, dus er is geen interview-spec om een herschrijving op te
          baseren. Daarom staat er geen &ldquo;Opnieuw&rdquo; bij de blokken — bewerken kan gewoon.
        </p>
      )}

      {weergave === "whiteboard" && (
        <>
          <Storyboard
            knopen={leerpad.knopen}
            verbindingen={leerpad.verbindingen}
            breedte={afmetingen.breedte}
            hoogte={afmetingen.hoogte}
            blokNummers={blokNummers}
            groepen={groepen}
            geselecteerd={geselecteerd}
            geselecteerdeSchakel={geselecteerdeSchakel}
            onSelecteer={setGeselecteerd}
            onSelecteerSchakel={setGeselecteerdeSchakel}
            // Groepsslepen blijft vrij bewegen; alleen structuurwijzigingen gaan door de layout.
            onVerplaats={(knopen) => setLeerpad((l) => ({ ...l, knopen }))}
            // Een blok dat aan een pagina wordt gehangen springt naar zijn kolompositie in die
            // rij; daarna is het weer vrij te verplaatsen.
            onVerbind={(van, naar) => wijzig((l) => schuifInRij(verbindKnopen(l, van, naar), naar))}
            selectie={selectie}
            onSelectie={setSelectie}
            leerpad={leerpad}
            // De gemeten hoogtes worden alleen bewaard; ze bepalen straks hoe hoog een rijbaan
            // wordt bij het opruimen en of een drop ergens past.
            onHoogtes={(gemeten) => {
              hoogtes.current = gemeten;
            }}
            onOpruimen={(gemeten) => {
              hoogtes.current = gemeten;
              opruimen();
            }}
            onVerwijderSelectie={() => {
              const ids = selectie;
              setSelectie([]);
              wijzig((l) => ids.reduce((acc, id) => verwijderKnoop(acc, id), l));
            }}
            onVerbreek={(id) => {
              wijzig((l) => verbreekVerbinding(l, id));
              setGeselecteerdeSchakel(null);
            }}
            onPlaatsBlok={(soort) => plaatsBlok(soort)}
            onWijzigKnoop={(id, patch) => setLeerpad((l) => wijzigKnoop(l, id, patch))}
            tekstVan={tekstVan}
            onTekst={zetTekst}
            onGenereer={(id) => {
              setSchrijfVoor(id);
              setVarianten([]);
              setSchrijfFout(null);
            }}
            bezigMet={schrijft}
            onOpen={(knoop) => {
              setGeselecteerd(knoop.id);
              setWeergave("blokken");
            }}
            streken={streken}
            onStreken={setStreken}
            centreer={centreer}
            onKiesPagina={(pagina: Pagina) => {
              setGeselecteerdeSchakel(null);
              setSelectie(pagina.onderdelen.map((k) => k.id));
              setCentreer((c) => ({ id: pagina.kop.id, teller: (c?.teller ?? 0) + 1 }));
            }}
            onNieuweSectie={() => plaatsBlok("sectie")}
            onDupliceerPagina={(pagina: Pagina) => wijzig((l) => dupliceerKeten(l, pagina.kop.id))}
            zijpaneel={
              <>
                <Controlelijst problemen={problemen} onKiesKnoop={kiesBlok} />

                <KnoopPaneel
                  knoop={actieveKnoop}
                  content={content}
                  plek={plekVanActieve}
                  paginaKop={paginaKopVanActieve}
                  onPaginaTitel={(titel) => {
                    if (geselecteerd) setLeerpad((l) => zetPaginaTitel(l, geselecteerd, titel));
                  }}
                  checks={
                    actieveKnoop?.soort === "assessment"
                      ? assessmentChecks(leerpad, actieveKnoop.id)
                      : []
                  }
                  aiDoel={
                    actieveKnoop?.soort === "ai" ? aiDoel(leerpad, actieveKnoop.id) : null
                  }
                  onBewerkInBlokken={() => setWeergave("blokken")}
                  onWijzig={(patch) => {
                    if (geselecteerd) setLeerpad((l) => wijzigKnoop(l, geselecteerd, patch));
                  }}
                  onZetMinuten={(minuten) => {
                    if (geselecteerd) setLeerpad((l) => zetMinuten(l, geselecteerd, minuten));
                  }}
                  onDupliceer={() => {
                    if (geselecteerd) wijzig((l) => dupliceerKeten(l, geselecteerd));
                  }}
                  onVerwijder={() => {
                    if (!geselecteerd) return;
                    wijzig((l) => verwijderKnoop(l, geselecteerd));
                    setGeselecteerd(null);
                  }}
                />

                {geselecteerdeSchakel && (
                  <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-stroke bg-card p-3.5 shadow-elevation">
                    <span className="text-[13px] text-ink-soft">{schakelTekst(geselecteerdeSchakel)}</span>
                    <Button
                      size="sm"
                      role_="subtle"
                      className="ml-auto"
                      onClick={() => {
                        wijzig((l) => verbreekVerbinding(l, geselecteerdeSchakel));
                        setGeselecteerdeSchakel(null);
                      }}
                    >
                      Schakel losmaken
                    </Button>
                  </div>
                )}
              </>
            }
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <Button size="sm" role_="subtle" onClick={() => wijzig(() => leerpadUitContent(content))}>
              Graaf opnieuw opbouwen
            </Button>
            <span className="text-[12px] text-ink-faint">
              {aantalPaginas} {aantalPaginas === 1 ? "pagina" : "pagina's"} · {aantalBlokken}{" "}
              {aantalBlokken === 1 ? "blok" : "blokken"} · ~{totaleMinuten(leerpad)} min · van boven
              naar onder
            </span>
          </div>
        </>
      )}

      {/* secties */}
      {weergave === "blokken" &&
        content.secties.map((sectie, i) => {
        const id = `s${i}`;
        return (
          <Blok
            key={id}
            soort="uitleg"
            tag={`Uitleg ${i + 1}`}
            bewerkt={!!bewerkt[id]}
            bezig={!!bezig[id]}
            onBewerkWissel={() => wisselBewerk(id)}
            onOpnieuw={spec ? () => void opnieuwSectie(i) : undefined}
          >
            {bewerkt[id] ? (
              <div className="flex flex-col gap-2.5">
                <Veld
                  eenRegel
                  label="Kop"
                  waarde={sectie.kop}
                  onChange={(kop) => onChange(vervangSectie(content, i, { ...sectie, kop }))}
                />
                <Veld
                  label="Tekst"
                  rows={5}
                  waarde={sectie.tekst}
                  onChange={(tekst) => onChange(vervangSectie(content, i, { ...sectie, tekst }))}
                />
              </div>
            ) : (
              <>
                <h2 className="text-[19px] font-semibold -tracking-[0.01em]">{sectie.kop}</h2>
                <p className="mt-1.5 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-soft">
                  {sectie.tekst}
                </p>
              </>
            )}
            </Blok>
          );
        })}

      {/* vragen */}
      {weergave === "blokken" &&
        content.vragen.map((vraag, i) => {
        const id = `v${i}`;
        const aanHetBewerken = !!bewerkt[id];
        return (
          <Blok
            key={id}
            soort="vraag"
            tag={`${vraag.vraagvorm} · vraag ${i + 1}`}
            bewerkt={aanHetBewerken}
            bezig={!!bezig[id]}
            onBewerkWissel={() => wisselBewerk(id)}
            onOpnieuw={spec ? () => void opnieuwVraag(i) : undefined}
          >
            {aanHetBewerken ? (
              <Veld
                label="Vraag"
                rows={2}
                waarde={vraag.vraag}
                onChange={(v) => patchVraag(i, { ...vraag, vraag: v })}
              />
            ) : (
              <p className="text-[15px] font-medium leading-relaxed text-ink">{vraag.vraag}</p>
            )}

            <ul className="mt-3 flex flex-col gap-1.5">
              {vraag.opties.map((optie, oi) => {
                const juist = oi === vraag.correct;
                return (
                  <li key={oi} className="flex items-start gap-2">
                    {aanHetBewerken ? (
                      <>
                        <button
                          type="button"
                          aria-pressed={juist}
                          aria-label={`Markeer optie ${oi + 1} als juist`}
                          onClick={() => patchVraag(i, zetCorrect(vraag, oi))}
                          className={cn(
                            // 24px is de ondergrens van WCAG 2.2 AA voor doelgrootte; op h-5 (20px)
                            // was dit de enige knop in de app die daar niet aan kwam.
                            "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-control border text-[11px]",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
                            juist
                              ? "border-transparent bg-grad-glow text-glow-on shadow-glow-glow"
                              : "border-stroke bg-card text-ink-faint",
                          )}
                        >
                          {juist ? "✓" : ""}
                        </button>
                        <span className="flex-1">
                          <Veld
                            eenRegel
                            label={`Optie ${oi + 1}`}
                            waarde={optie}
                            onChange={(t) => patchVraag(i, wijzigOptie(vraag, oi, t))}
                          />
                        </span>
                        <button
                          type="button"
                          onClick={() => patchVraag(i, verwijderOptie(vraag, oi))}
                          disabled={vraag.opties.length <= 2}
                          aria-label={`Verwijder optie ${oi + 1}`}
                          title={
                            vraag.opties.length <= 2
                              ? "Een vraag heeft minstens twee opties"
                              : "Verwijderen"
                          }
                          className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-control text-ink-faint hover:bg-flow-wash hover:text-flow-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink disabled:opacity-40"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span
                        className={cn(
                          "flex items-start gap-2 rounded-control px-2 py-1 text-[14px]",
                          juist ? "bg-glow-wash text-glow-ink shadow-glow-glow" : "text-ink-soft",
                        )}
                      >
                        <span aria-hidden="true" className="font-semibold">
                          {juist ? "✓" : "·"}
                        </span>
                        {optie}
                        {juist && <span className="sr-only">(juiste antwoord)</span>}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {aanHetBewerken && (
              <Button
                size="sm"
                role_="subtle"
                className="mt-2"
                onClick={() => patchVraag(i, voegOptieToe(vraag))}
              >
                + Optie toevoegen
              </Button>
            )}

            <div className="mt-3 rounded-control bg-card-sub p-3">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                Feedback
              </span>
              {aanHetBewerken ? (
                <Veld
                  label="Feedback"
                  rows={2}
                  waarde={vraag.feedback}
                  onChange={(f) => patchVraag(i, { ...vraag, feedback: f })}
                />
              ) : (
                <p className="text-[13.5px] leading-relaxed text-ink-soft">{vraag.feedback}</p>
              )}
            </div>
          </Blok>
        );
      })}

      {/* samenvatting */}
      {weergave === "blokken" && (
        <Card className="p-4 motion-safe:animate-[prism-bloom-in_420ms_both]">
        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          Samenvatting
        </span>
        {bewerkt["sam"] ? (
          <Veld
            label="Samenvatting"
            rows={4}
            waarde={content.samenvatting}
            onChange={(samenvatting) => onChange({ ...content, samenvatting })}
          />
        ) : (
          <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-soft">
            {content.samenvatting}
          </p>
        )}
          <Button size="sm" role_="subtle" className="mt-3" onClick={() => wisselBewerk("sam")}>
            {bewerkt["sam"] ? "Klaar" : "Bewerken"}
          </Button>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <Button role_="accent" onClick={() => void bewaar()} disabled={bewaarStand === "bezig"}>
          {bewaarStand === "bezig" ? "Bewaren…" : "Bewaren"}
        </Button>
        {bewaarStand === "klaar" && (
          <span className="text-[12px] text-glow-ink">Bewaard.</span>
        )}
        {bewaarStand === "mis" && bewaarFout && (
          <span className="text-[12px] text-bloom-ink">{bewaarFout}</span>
        )}
        <Button onClick={onNieuweModule}>Nieuwe module maken</Button>

        <span aria-hidden="true" className="mx-1 h-6 w-px bg-stroke" />

        {/*
          Geen <form>: dit is een knop met een keuze ernaast, geen formulierverzending.
          Het profiel bepaalt het manifest — cmi5 krijgt een cmi5.xml, xAPI een tincan.xml.
        */}
        <label className="flex items-center gap-1.5 text-[12px] text-ink-soft">
          Profiel
          <select
            value={profiel}
            onChange={(e) => setProfiel(e.target.value as ExportProfiel)}
            className="rounded-control border border-stroke bg-card px-2 py-[6px] text-[12.5px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink"
          >
            <option value="xapi">xAPI</option>
            <option value="cmi5">cmi5</option>
          </select>
        </label>

        <Button
          role_="reward"
          onClick={() => void exporteer()}
          disabled={exportStand === "bezig"}
          title="Bouwt het pakket en downloadt het als ZIP — bewaren hoeft niet"
        >
          {exportStand === "bezig" ? "Bouwen…" : "Exporteer pakket"}
        </Button>
        {exportStand === "klaar" && (
          <span className="text-[12px] text-glow-ink">Pakket gedownload.</span>
        )}
      </div>

      {/*
        Een weigering is geen crash maar een lijstje werk. Daarom staat hij hier voluit en niet in
        een toast: de auteur moet hem kunnen nalopen terwijl hij het oplost.
      */}
      {exportFout && (
        <Card className="border-bloom-ink/30">
          <p className="text-[13px] font-semibold text-ink">{exportFout}</p>
          {exportRedenen.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink-soft">
              {exportRedenen.map((reden) => (
                <li key={reden}>{reden}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {schrijfKnoop && (
        <Variantenkiezer
          blokTitel={schrijfKnoop.titel}
          opdracht={schrijfKnoop.prompt ?? ""}
          huidig={leesTekst(schrijfKnoop, content) ?? ""}
          bezig={schrijft === schrijfKnoop.id}
          varianten={varianten}
          fout={schrijfFout}
          onSchrijf={(opdracht, aantal) => void schrijfVarianten(schrijfKnoop.id, opdracht, aantal)}
          onKies={(tekst) => {
            zetTekst(schrijfKnoop, tekst);
            setSchrijfVoor(null);
            setVarianten([]);
          }}
          onSluit={() => {
            setSchrijfVoor(null);
            setVarianten([]);
          }}
        />
      )}
    </div>
  );
}
