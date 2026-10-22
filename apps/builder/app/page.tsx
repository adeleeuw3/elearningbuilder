/**
 * De volledige flow: interview → genereren → resultaat.
 *
 * Zo "stopt het programma om een vraag te stellen": elke beurt komt er gestructureerde JSON terug,
 * en bij status `vraag` of `bevestig` renderen we de invoer. Er gebeurt dan niets meer tot de
 * gebruiker antwoordt. Geen vrije tekst parsen, geen timers.
 *
 * Bij `genereer` gaat de volledige spec naar /api/generate en verschijnt de content als
 * bewerkbare blokken.
 */
"use client";

import * as React from "react";
import { Button, Card, ProgressRing } from "@ob/ui";
import { Shell } from "../components/Shell";
import { Foutmelding } from "../components/interview/Foutmelding";
import { InvoerZone } from "../components/interview/InvoerZone";
import { Thread } from "../components/interview/Thread";
import { Voortgangspips } from "../components/interview/Voortgangspips";
import { Resultaat } from "../components/resultaat/Resultaat";
import { Startscherm } from "../components/Startscherm";
import { Beheer } from "../components/Beheer";
import { Navigatie } from "../components/Navigatie";
import { Profiel } from "../components/Profiel";
import { genereerContent, vraagVolgendeBeurt } from "../lib/api-client";
import { legeContent, normaliseerContent } from "../lib/content";
import type { Leerpad } from "../lib/leerpad";
import {
  aanpasbareVelden,
  aantalGevuld,
  antwoordAlsTekst,
  pasAntwoordToe,
  pipStatussen,
  VELD_LABEL,
  wisVeld,
} from "../lib/spec";
import {
  CompleteModuleSpecSchema,
  LEGE_MODULE_SPEC,
  type ApiFout,
  type BevestigAntwoord,
  type CompleteModuleSpec,
  type GeneratedContent,
  type GesprekRegel,
  type ModuleSpec,
  type ModuleSpecVeld,
  type VraagAntwoord,
} from "../lib/types";

/** De vorm waar we nu op wachten. `null` = geen invoer nodig (bezig, of klaar). */
type OpenVraag = VraagAntwoord | BevestigAntwoord | null;

export default function InterviewPage() {
  const [moduleSpec, setModuleSpec] = React.useState<ModuleSpec>(LEGE_MODULE_SPEC);
  const [gesprek, setGesprek] = React.useState<GesprekRegel[]>([]);
  const [openVraag, setOpenVraag] = React.useState<OpenVraag>(null);
  const [bezig, setBezig] = React.useState(false);
  const [fout, setFout] = React.useState<{ bericht: string; code: ApiFout["code"] } | null>(null);
  const [fase, setFase] = React.useState<"interview" | "genereren" | "resultaat">("interview");
  const [kiesAanpassing, setKiesAanpassing] = React.useState(false);
  const [content, setContent] = React.useState<GeneratedContent | null>(null);
  /** Wat er uit de opslag kwam: het leerpad en het id waaronder het bewaard staat. */
  const [uitOpslag, setUitOpslag] = React.useState<{ leerpad?: Leerpad; id: string } | null>(null);
  /**
   * Welk scherm je ziet, naast de fase van het bouwen.
   *
   * Los van `fase` omdat beheer en profiel geen bouwfase zijn maar een zijstap: je komt er vandaan
   * terug in de module waar je mee bezig was. Zou dit één state zijn, dan zou "terug" betekenen
   * dat je opnieuw moet beginnen.
   */
  const [scherm, setScherm] = React.useState<"bouwen" | "beheer" | "profiel">("bouwen");
  const [volledigeSpec, setVolledigeSpec] = React.useState<CompleteModuleSpec | null>(null);

  /**
   * De laatste aanvraag, zodat "Opnieuw proberen" precies dat opnieuw doet. In een ref omdat de
   * knop hem buiten de render-cyclus aanroept en we geen verouderde state willen versturen.
   */
  const laatsteAanvraag = React.useRef<{ spec: ModuleSpec; gesprek: GesprekRegel[] } | null>(null);

  /**
   * De generatiestap. Staat vóór `doeBeurt` omdat die hem aanroept: zo is de binding er al
   * wanneer `doeBeurt` wordt gemaakt, en kan hij netjes in de dependencies mee.
   */
  const bouwModule = React.useCallback(async (spec: CompleteModuleSpec) => {
    setVolledigeSpec(spec);
    setFase("genereren");
    setFout(null);

    const res = await genereerContent(spec);
    if (!res.ok) {
      setFout({ bericht: res.bericht, code: res.code });
      return; // blijft in fase "genereren" met de foutmelding en een retry
    }
    // `correct` is een index en JSON Schema kan die grens niet afdwingen — hier rechttrekken.
    setContent(normaliseerContent(res.data));
    setFase("resultaat");
  }, []);

  const doeBeurt = React.useCallback(
    async (spec: ModuleSpec, historie: GesprekRegel[]) => {
      laatsteAanvraag.current = { spec, gesprek: historie };
      setBezig(true);
      setFout(null);
      setOpenVraag(null);

      const res = await vraagVolgendeBeurt(spec, historie);
      setBezig(false);

      if (!res.ok) {
        setFout({ bericht: res.bericht, code: res.code });
        return;
      }

      if (res.data.status === "genereer") {
        // Het model levert hier een volledige spec; die vertrouwen we boven onze eigen opbouw.
        setModuleSpec(res.data.moduleSpec);
        void bouwModule(res.data.moduleSpec);
        return;
      }

      setGesprek([...historie, { rol: "ai", bericht: res.data.bericht }]);
      setOpenVraag(res.data);
    },
    [bouwModule],
  );

  /**
   * Het startscherm ís de eerste beurt. Het onderwerp is altijd het eerste veld, dus daar hoeft
   * het model niet om gevraagd te worden: we schrijven het antwoord lokaal in de spec en laten het
   * model pas vanaf beurt twee meedenken. Dat scheelt de ~9-21s die de eerste aanroep kostte.
   *
   * De vraag die het startscherm stelt gaat wél mee in de historie, anders begint het gesprek voor
   * het model met een antwoord op niets.
   */
  const STARTVRAAG = "Waar moet je module over gaan?";

  function startInterview(onderwerp: string) {
    const nieuweSpec = pasAntwoordToe(LEGE_MODULE_SPEC, "onderwerp", [onderwerp], "text");
    const nieuwGesprek: GesprekRegel[] = [
      { rol: "ai", bericht: STARTVRAAG },
      { rol: "user", bericht: onderwerp },
    ];
    setModuleSpec(nieuweSpec);
    setGesprek(nieuwGesprek);
    void doeBeurt(nieuweSpec, nieuwGesprek);
  }

  /** Verwerkt een antwoord: in het gesprek, in de spec, en dan de volgende beurt. */
  function onAntwoord(waarden: string[]) {
    const vraag = openVraag;
    if (!vraag || bezig) return;

    const tekst = antwoordAlsTekst(waarden);
    const nieuwGesprek: GesprekRegel[] = [...gesprek, { rol: "user", bericht: tekst }];

    if (vraag.status === "bevestig") {
      // Optie 0 = doorgaan, al het andere = aanpassen. Op index i.p.v. tekst, zodat een
      // andere formulering door het model dit niet stilletjes breekt.
      const wilAanpassen = (vraag.invoer.opties ?? []).indexOf(tekst) !== 0;
      setGesprek(nieuwGesprek);
      setOpenVraag(null);
      if (wilAanpassen) {
        setKiesAanpassing(true);
      } else {
        void doeBeurt(moduleSpec, nieuwGesprek);
      }
      return;
    }

    const nieuweSpec = pasAntwoordToe(moduleSpec, vraag.veld, waarden, vraag.invoer.type);
    setModuleSpec(nieuweSpec);
    setGesprek(nieuwGesprek);
    void doeBeurt(nieuweSpec, nieuwGesprek);
  }

  /** De gebruiker koos welk veld opnieuw moet: leegmaken en het interview hervatten. */
  function onKiesAanpassing(veld: ModuleSpecVeld) {
    const nieuweSpec = wisVeld(moduleSpec, veld);
    const nieuwGesprek: GesprekRegel[] = [
      ...gesprek,
      { rol: "user", bericht: `Ik wil ${VELD_LABEL[veld].toLowerCase()} aanpassen.` },
    ];
    setModuleSpec(nieuweSpec);
    setGesprek(nieuwGesprek);
    setKiesAanpassing(false);
    void doeBeurt(nieuweSpec, nieuwGesprek);
  }

  function opnieuw() {
    // In de generatiefase betekent "opnieuw proberen" het bouwen herhalen, niet het interview.
    if (fase === "genereren" && volledigeSpec) {
      void bouwModule(volledigeSpec);
      return;
    }
    const vorig = laatsteAanvraag.current;
    if (vorig) void doeBeurt(vorig.spec, vorig.gesprek);
  }

  /**
   * Het interview overslaan en zelf bouwen.
   *
   * De module krijgt geen spec: die komt uit het interview en er is er geen. Dat is geen
   * tekortkoming maar informatie — `Resultaat` laat "Opnieuw" daarom weg in plaats van een
   * herschrijving te baseren op verzonnen uitgangspunten.
   *
   * Wat de auteur al typte gaat wel mee als titel. Dat zijn zijn eigen woorden.
   */
  /** Een bewaarde module openen: content en graaf terug, en het id vasthouden om op te bewaren. */
  function openBewaard(id: string, doc: unknown) {
    const d = doc as { content?: GeneratedContent; leerpad?: Leerpad; spec?: unknown };
    if (!d?.content) return;
    setContent(normaliseerContent(d.content));
    // Door het schema en niet rechtstreeks overnemen: dit komt van schijf en kan uit een oudere
    // versie komen waarin de ontwerpvelden nog niet bestonden. Mislukt het, dan geen spec — dat is
    // precies de toestand van vóór deze regel.
    const gelezen = CompleteModuleSpecSchema.safeParse(d.spec);
    setVolledigeSpec(gelezen.success ? gelezen.data : null);
    setUitOpslag({ id, ...(d.leerpad ? { leerpad: d.leerpad } : {}) });
    setFout(null);
    setFase("resultaat");
    setScherm("bouwen");
  }

  function bouwZelf(onderwerp?: string) {
    setContent(legeContent(onderwerp ?? moduleSpec.onderwerp));
    setVolledigeSpec(null);
    setUitOpslag(null);
    setFout(null);
    setOpenVraag(null);
    setKiesAanpassing(false);
    setFase("resultaat");
  }

  function beginOpnieuw() {
    setModuleSpec(LEGE_MODULE_SPEC);
    setGesprek([]);
    setOpenVraag(null);
    setFout(null);
    setKiesAanpassing(false);
    setContent(null);
    setVolledigeSpec(null);
    setUitOpslag(null);
    setFase("interview");
    setScherm("bouwen");
  }

  /**
   * De knoppen in de kop.
   *
   * `onbewaardWerk` is waar zodra er een module in beeld is: dit scherm weet niet of hij sinds de
   * laatste keer veranderd is, en dan is vragen beter dan stil weggooien. Liever één vraag te veel
   * dan één keer werk kwijt.
   */
  const navigatie = (
    <Navigatie
      hier={scherm}
      onbewaardWerk={!!content}
      onBeginscherm={beginOpnieuw}
      onBeheer={() => setScherm("beheer")}
      onProfiel={() => setScherm("profiel")}
    />
  );

  if (scherm === "beheer") {
    return (
      <Shell fase="resultaat" navigatie={navigatie}>
        <Beheer onOpen={openBewaard} />
      </Shell>
    );
  }

  if (scherm === "profiel") {
    return (
      <Shell fase="resultaat" navigatie={navigatie}>
        <Profiel />
      </Shell>
    );
  }

  const actiefVeld = openVraag?.status === "vraag" ? openVraag.veld : null;
  const pips = pipStatussen(moduleSpec, actiefVeld);

  if (fase === "genereren") {
    return (
      <Shell fase="genereren">
        <div className="flex flex-col gap-4">
          {fout ? (
            <Foutmelding
              bericht={fout.bericht}
              code={fout.code}
              onOpnieuw={opnieuw}
              onBeginOpnieuw={beginOpnieuw}
            />
          ) : (
            <Bouwen spec={volledigeSpec} />
          )}
        </div>
      </Shell>
    );
  }

  if (fase === "resultaat" && content) {
    return (
      <Shell fase="resultaat" breed navigatie={navigatie}>
        <Resultaat
          spec={volledigeSpec}
          content={content}
          onChange={setContent}
          onNieuweModule={beginOpnieuw}
          projectId={uitOpslag?.id ?? null}
          {...(uitOpslag?.leerpad ? { beginLeerpad: uitOpslag.leerpad } : {})}
        />
      </Shell>
    );
  }

  if (gesprek.length === 0) {
    return (
      <Startscherm onStart={startInterview} onZelfBouwen={bouwZelf} onOpen={openBewaard} />
    );
  }

  return (
    <Shell fase="interview" navigatie={navigatie}>
      <div className="flex flex-col gap-4">
        <Voortgangspips pips={pips} gevuld={aantalGevuld(moduleSpec)} />

        <Thread gesprek={gesprek} bezig={bezig} />

        {fout && (
          <Foutmelding
            bericht={fout.bericht}
            code={fout.code}
            onOpnieuw={opnieuw}
            onBeginOpnieuw={beginOpnieuw}
          />
        )}

        {kiesAanpassing && (
          <Card className="p-4">
            <span className="mb-2.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Wat wil je aanpassen?
            </span>
            <div className="flex flex-wrap gap-2">
              {aanpasbareVelden(moduleSpec).map(({ veld, label }) => (
                <button
                  key={veld}
                  type="button"
                  onClick={() => onKiesAanpassing(veld)}
                  className="rounded-full border border-stroke bg-card px-3.5 py-2 text-[13.5px] font-medium text-ink shadow-elevation transition-colors duration-snappy ease-snappy hover:bg-card-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink"
                >
                  {label}
                </button>
              ))}
            </div>
          </Card>
        )}

        {openVraag && !kiesAanpassing && (
          <InvoerZone invoer={openVraag.invoer} bezig={bezig} onAntwoord={onAntwoord} />
        )}

        {/* De uitweg uit het interview. Rustig vormgegeven: het is een alternatief, geen aanbod.
            Bewust NIET uitgeschakeld tijdens een lopende beurt — juist tijdens die ~9 seconden
            wachten wil iemand eruit. De knop doet geen aanroep, hij wisselt alleen van fase; een
            antwoord dat daarna binnenkomt schrijft naar state die niet meer getoond wordt. */}
        <div className="flex flex-wrap items-center gap-2 border-t border-stroke-soft pt-3">
          <span className="text-[12.5px] text-ink-faint">Liever zelf bouwen?</span>
          <Button size="sm" role_="subtle" onClick={() => bouwZelf()}>
            Naar het whiteboard, leeg beginnen →
          </Button>
        </div>
      </div>
    </Shell>
  );
}

/**
 * De wachtstand tijdens het bouwen: een draaiende ProgressRing in Flow.
 *
 * Bewust indeterminate — de API geeft geen voortgang terug en een verzonnen percentage zou de
 * lezer misleiden. De spec eronder laat zien wát er gebouwd wordt, zodat de wachttijd informatief
 * is in plaats van leeg.
 */
function Bouwen({ spec }: { spec: CompleteModuleSpec | null }) {
  return (
    <>
      <Card panel className="p-6">
        <div className="flex items-center gap-4">
          <ProgressRing indeterminate size={38} label="Je module wordt gebouwd" />
          <span>
            <b className="block text-[17px] font-semibold -tracking-[0.01em]">
              Je module wordt gebouwd…
            </b>
            <span className="text-[13.5px] text-ink-soft">
              {/* Gemeten op Opus 5: ~70s voor 3 secties en 6 vragen. Geen belofte doen die de
                  meting niet dekt — een te optimistische schatting voelt als een storing. */}
              Dit duurt ongeveer een minuut. Je kunt dit venster open laten staan.
            </span>
          </span>
        </div>
      </Card>

      {spec && (
        <Card className="p-5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Wat er gebouwd wordt
          </span>
          <h1 className="mt-2 text-[22px] font-bold -tracking-[0.01em]">{spec.onderwerp}</h1>
          <dl className="mt-3 flex flex-col gap-2 text-[13.5px]">
            <Regel label="Doelgroep" waarde={spec.doelgroep} />
            <Regel label="Leerdoelen" waarde={spec.leerdoelen.join(" · ")} />
            <Regel label="Vraagvormen" waarde={spec.vraagvormen.join(" · ")} />
            <Regel label="Toon" waarde={spec.toon} />
            <Regel label="Lengte" waarde={spec.lengte} />
            {/* De ontwerpkeuzes horen er ook te staan: ze zijn net gevraagd, en een overzicht dat
                drie van de zeven antwoorden weglaat leest als "dat is er niet mee gedaan". */}
            {spec.thema && <Regel label="Thema" waarde={THEMA_OMSCHRIJVING_KORT[spec.thema] ?? spec.thema} />}
            {spec.beeldgebruik && <Regel label="Beeldgebruik" waarde={spec.beeldgebruik} />}
            {spec.video && <Regel label="Video" waarde={spec.video} />}
            {spec.context && <Regel label="Context" waarde={spec.context} />}
          </dl>
        </Card>
      )}
    </>
  );
}

/** De korte naam uit de spec naar iets leesbaars; een onbekende waarde toont zichzelf. */
const THEMA_OMSCHRIJVING_KORT: Record<string, string> = {
  flow: "Koel blauw",
  bloom: "Roze-magenta",
  neutraal: "Inkt en grijs",
};

function Regel({ label, waarde }: { label: string; waarde?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-28 shrink-0 text-ink-faint">{label}</dt>
      <dd className="flex-1 text-ink">{waarde || "—"}</dd>
    </div>
  );
}
