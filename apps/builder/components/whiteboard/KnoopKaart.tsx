/**
 * De knoop als kaart: één blok dat één ding doet.
 *
 * Anatomie, gelijk voor elke soort:
 *   kop      het type-icoon, de titel, en het tandwiel voor de rest van de instellingen
 *   invoer   de opdracht — een prompt, of bij audio het narratiescript
 *   uitvoer  het resultaat, met de hand te bewerken
 *   poorten  het bolletje links (in) en rechts (uit), waarmee je hem aan de volgende knoopt
 *
 * Wat er in het midden staat hangt af van het type, want dat bepaalt wat de knoop dóét. Een
 * videoknoop heeft een beeldverhouding, een audioknoop een stem, een structuurknoop geen van beide.
 *
 * **Wat hier wel en niet gebeurt.** Tekst wordt echt geschreven; daar is een model voor. Beeld,
 * video en geluid komen van het apparaat van de auteur — kiezen, keuren, tonen — maar worden niet
 * gegenereerd, want dat kan deze stack niet. Een knop die belooft te renderen en dat niet doet is
 * erger dan geen knop.
 */
"use client";

import * as React from "react";
import { NodeCard, NodePort, cn } from "@ob/ui";
import {
  CATEGORIE_ICOON,
  CATEGORIE_LABEL,
  CATEGORIE_RAND,
  CATEGORIE_TAG,
  VRAAGVORM_LABEL,
  type Knoop,
} from "../../lib/graph";
import type { BestandSoort } from "../../lib/bestand";
import { Bestandskiezer } from "./Bestandskiezer";
import {
  BEELDVERHOUDINGEN,
  NIVEAU,
  RESOLUTIES,
  STEMMEN,
  XAPI_WERKWOORDEN,
  zoekvoorstel,
} from "../../lib/leerpad";

export interface KnoopKaartProps {
  knoop: Knoop;
  /** Plek in de stapel op zijn scherm; undefined = staat nergens in. */
  nummer: number | undefined;
  geselecteerd: boolean;
  /** Draait de tekstgeneratie voor deze knoop. */
  bezig: boolean;
  onHeaderPointerDown: React.PointerEventHandler<HTMLDivElement>;
  onKlik: () => void;
  onInstellingen: () => void;
  onWijzig: (patch: Partial<Knoop>) => void;
  /**
   * De tekst van dit blok, uit de bron waar hij hoort — `null` als deze knoop geen tekst draagt.
   * De kaart weet niet of dat de content of de knoop is, en kan dus ook niet de verkeerde kant
   * op wijzen.
   */
  tekst: string | null;
  onTekst: (tekst: string) => void;
  onGenereer: () => void;
  onUitgaandePoort: (ev: React.PointerEvent<HTMLSpanElement>) => void;
  /** Deze knoop is het startpunt van de lijn die nu getrokken wordt. */
  bronVanWire: boolean;
  /**
   * Er wordt een lijn getrokken en die mag hier landen.
   *
   * Een outline en geen glow: de kaart heeft zijn glow al voor zijn eigen state, en Prism staat er
   * maar één toe. Flow, want dat is de kleur van verbinden.
   */
  doelKandidaat: boolean;
}

/** De verticale plek van de poorten: het midden van de kop. */
const POORT_TOP = 21;

export function KnoopKaart({
  knoop,
  nummer,
  geselecteerd,
  bezig,
  onHeaderPointerDown,
  onKlik,
  onInstellingen,
  onWijzig,
  tekst,
  onTekst,
  onGenereer,
  onUitgaandePoort,
  bronVanWire,
  doelKandidaat,
}: KnoopKaartProps) {
  const niveau = NIVEAU[knoop.soort];
  const isInhoud = niveau === "inhoud";
  const isTekst = knoop.soort === "uitleg";
  /**
   * Draagt deze soort een tekst die de cursist leest? Dan hoort hij hier bewerkbaar te zijn.
   *
   * Een citaat hoort erbij maar krijgt géén promptveld en géén genereerknop: er valt niets te
   * schrijven, alleen over te nemen. Een carrousel draagt zijn tekst in de stappen, en die passen
   * niet op een kaart van 300px — die staan in het paneel.
   */
  const heeftTekstvak =
    knoop.soort === "uitleg" || knoop.soort === "citaat" || knoop.soort === "reflectie";
  /**
   * Mag dit blok geschreven worden?
   *
   * Een citaat niet: een door AI verzonnen uitspraak met een echte naam eronder is een verzinsel
   * dat als bron gepresenteerd wordt. Dat blok hoort uit een echte vindplaats te komen.
   */
  const kanSchrijven = knoop.soort === "uitleg" || knoop.soort === "reflectie";
  const heeftPrompt =
    isInhoud &&
    knoop.soort !== "assessment" &&
    knoop.soort !== "citaat" &&
    knoop.soort !== "carrousel";

  return (
    <div
      className={cn(
        "relative rounded-card",
        doelKandidaat && "outline outline-2 outline-offset-4 outline-flow-from",
      )}
    >
      {/* Poort in: waar de vorige knoop op uitkomt. */}
      <NodePort
        side="in"
        tone={doelKandidaat || geselecteerd ? "flow" : "rest"}
        style={{ top: POORT_TOP }}
      />

      <NodeCard
        style={{ width: "100%" }}
        title={
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em]",
              CATEGORIE_TAG[knoop.soort],
            )}
          >
            {CATEGORIE_LABEL[knoop.soort]}
          </span>
        }
        icon={CATEGORIE_ICOON[knoop.soort]}
        borderClass={CATEGORIE_RAND[knoop.soort]}
        state={knoop.klaar ? "rest" : "bloom"}
        selected={geselecteerd || bronVanWire}
        onHeaderPointerDown={onHeaderPointerDown}
        onClick={onKlik}
        status={
          <span className="flex items-center gap-1.5">
            <Nummer nummer={nummer} structuur={!isInhoud} />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInstellingen();
              }}
              aria-label={`Instellingen van "${knoop.titel}"`}
              title="Instellingen"
              className="grid h-5 w-5 shrink-0 place-items-center rounded-control text-[11px] text-ink-faint [transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px hover:shadow-glow-flow hover:bg-flow-wash hover:text-flow-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink"
            >
              ⚙
            </button>
          </span>
        }
        footer={
          isInhoud ? (
            <>
              <span className="flex items-center gap-1 tabular-nums" title="Geschatte tijd">
                <span aria-hidden="true">◕</span>
                {knoop.minuten} min
              </span>
              {kanSchrijven && (
                <button
                  type="button"
                  disabled={bezig}
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenereer();
                  }}
                  className="ml-auto flex items-center gap-1 rounded-control px-1.5 py-0.5 font-semibold text-flow-ink [transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px hover:shadow-glow-flow hover:bg-flow-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink disabled:opacity-45"
                >
                  {bezig ? "Bezig…" : "Genereer"}
                  <span aria-hidden="true">✦</span>
                </button>
              )}
            </>
          ) : (
            <span className="text-[11px] text-ink-faint">
              {CATEGORIE_LABEL[knoop.soort]} · groepeert andere knopen
            </span>
          )
        }
      >
        <p className="text-[13px] font-bold leading-snug text-ink">
          {knoop.titel || "Zonder titel"}
        </p>

        {/* --- het middenstuk: wat deze soort knoop doet --- */}

        {(knoop.soort === "afbeelding" ||
          knoop.soort === "video" ||
          knoop.soort === "audio") && (
          <Bestandsvak
            knoop={knoop}
            soort={knoop.soort === "afbeelding" ? "afbeelding" : knoop.soort}
            onWijzig={onWijzig}
          />
        )}

        {heeftPrompt && (
          <Vak
            label={knoop.soort === "audio" ? "Narratiescript" : "Prompt"}
            waarde={knoop.prompt ?? ""}
            placeholder={PLACEHOLDER[knoop.soort] ?? "Wat moet hier komen?"}
            donker
            onChange={(prompt) => onWijzig({ prompt })}
          />
        )}

        {knoop.soort === "video" && (
          <div className="grid grid-cols-2 gap-2">
            <Keuze
              label="Beeldverhouding"
              waarde={knoop.beeldverhouding ?? "16:9"}
              opties={[...BEELDVERHOUDINGEN]}
              onChange={(beeldverhouding) => onWijzig({ beeldverhouding })}
            />
            <Keuze
              label="Resolutie"
              waarde={knoop.resolutie ?? "720p"}
              opties={[...RESOLUTIES]}
              onChange={(resolutie) => onWijzig({ resolutie })}
            />
          </div>
        )}

        {knoop.soort === "audio" && (
          <Keuze
            label="Stem"
            waarde={knoop.stem ?? STEMMEN[0]}
            opties={[...STEMMEN]}
            onChange={(stem) => onWijzig({ stem })}
          />
        )}

        {heeftTekstvak && tekst !== null && (
          <Vak
            label={TEKSTVAK_LABEL[knoop.soort] ?? "Uitvoer (bewerkbaar)"}
            waarde={tekst}
            placeholder={TEKSTVAK_HINT[knoop.soort] ?? "Hier komt de tekst die de cursist leest…"}
            onChange={onTekst}
          />
        )}

        {knoop.soort === "citaat" && (
          <p className="text-[11px] leading-relaxed text-ink-soft">
            {knoop.bronvermelding?.trim() || "Nog geen bronvermelding"}
          </p>
        )}

        {knoop.soort === "carrousel" && (
          <p className="text-[11px] leading-relaxed text-ink-soft">
            {(knoop.items ?? []).length} stappen · bewerk ze in het paneel hiernaast
          </p>
        )}



        {knoop.soort === "toets" && (
          <p className="text-[11px] leading-relaxed text-ink-soft">
            {VRAAGVORM_LABEL[knoop.vraagvorm ?? "meerkeuze"]} ·{" "}
            {XAPI_WERKWOORDEN.find((w) => w.iri === knoop.xapiWerkwoord)?.naam ?? "niets gemeld"}
          </p>
        )}

        {knoop.soort === "assessment" && (
          <p className="text-[11px] leading-relaxed text-ink-soft">
            Slaagt vanaf {knoop.norm ?? 70}% ·{" "}
            {XAPI_WERKWOORDEN.find((w) => w.iri === knoop.xapiWerkwoord)?.naam ?? "niets gemeld"}
          </p>
        )}

        {knoop.soort === "reflectie" && (
          <p className="text-[11px] leading-relaxed text-ink-soft">
            Open antwoord · {knoop.aiBeoordeling ? "door AI beoordeeld" : "alleen vastgelegd"}
          </p>
        )}
      </NodeCard>

      {/* Poort uit: sleep hiervandaan naar de knoop die hierna komt. */}
      <NodePort
        side="out"
        tone={bronVanWire ? "flow" : geselecteerd ? "flow" : "rest"}
        style={{ top: POORT_TOP }}
        className="cursor-crosshair"
        onPointerDown={onUitgaandePoort}
      />
    </div>
  );
}

/** Hoe het tekstveld op de kaart heet, per soort. Wat er in staat verschilt écht per soort. */
const TEKSTVAK_LABEL: Partial<Record<Knoop["soort"], string>> = {
  uitleg: "Uitvoer (bewerkbaar)",
  citaat: "Citaat",
  // De vraag die de cursist te zien krijgt. Zonder dit veld was hij nergens te bewerken en viel de
  // export terug op de blokttitel — een vraag die niemand bedoeld heeft.
  reflectie: "Vraag",
};

const TEKSTVAK_HINT: Partial<Record<Knoop["soort"], string>> = {
  uitleg: "Hier komt de tekst die de cursist leest…",
  citaat: "De uitspraak zelf, zonder aanhalingstekens…",
  reflectie: "Wat vraag je de cursist?",
};

const PLACEHOLDER: Partial<Record<Knoop["soort"], string>> = {
  uitleg: "Bijv. leg uit wat valgevaar is, voor nieuwe medewerkers.",
  video: "Bijv. een korte animatie over het aanleggen van een harnas.",
  afbeelding: "Bijv. een foto van een correct opgesteld steiger.",
  audio: "Hallo en welkom! In deze module…",
  toets: "Bijv. een vraag over de minimale hoogte waarop valgevaar geldt.",
  reflectie: "Bijv. beschrijf een situatie waarin jij twijfelde over de veiligheid.",
};

/* ------------------------------------------------------------------- bouwstenen */

function Vak({
  label,
  waarde,
  placeholder,
  donker,
  onChange,
}: {
  label: string;
  waarde: string;
  placeholder: string;
  donker?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1" onPointerDown={(e) => e.stopPropagation()}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </span>
      <textarea
        value={waarde}
        rows={3}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full resize-none rounded-control border px-2 py-1.5 text-[11.5px] leading-relaxed",
          "focus:border-flow-from focus:outline-none",
          donker
            ? "border-transparent bg-ink text-white placeholder:text-white/45"
            : "border-stroke bg-card-sub text-ink placeholder:text-ink-faint",
        )}
      />
    </label>
  );
}

function Keuze({
  label,
  waarde,
  opties,
  onChange,
}: {
  label: string;
  waarde: string;
  opties: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1" onPointerDown={(e) => e.stopPropagation()}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </span>
      <select
        value={waarde}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-control border border-stroke bg-card px-1.5 py-1 text-[11.5px] text-ink focus:border-flow-from focus:outline-none"
      >
        {opties.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Het bestand van het apparaat van de auteur: kiezen, bekijken, weghalen.
 *
 * De melding onder het vak is geen kleine lettertjes maar het belangrijkste dat er staat: er is nog
 * geen opslag, dus dit bestand leeft in dit tabblad. Wie dat pas bij het exporteren ontdekt, is werk
 * kwijt.
 */
/**
 * Het bestand van een media-knoop.
 *
 * Een dunne wikkel om `Bestandskiezer`: die staat apart omdat het paneel hem ook gebruikt, voor de
 * stappen van een carrousel. Eén verwerkingsroute voor alle bestanden, en dus ook maar één plek
 * waar de magic-byte-controle en het hercoderen gebeuren.
 */
function Bestandsvak({
  knoop,
  soort,
  onWijzig,
}: {
  knoop: Knoop;
  soort: BestandSoort;
  onWijzig: (patch: Partial<Knoop>) => void;
}) {
  return (
    <Bestandskiezer
      bestand={knoop.bestand}
      soort={soort}
      onBestand={(bestand) => onWijzig({ bestand })}
      zoekhint={zoekvoorstel(knoop)}
    />
  );
}

/**
 * Het nummer van het blok in de stapel op zijn pagina.
 *
 * Geen tegenhanger voor "hoort nergens bij": elk inhoudsblok is onderdeel van precies één pagina,
 * ook als het aan niets hangt — dan is het de eerste van een pagina met één onderdeel. De LOS-markering
 * die hier stond meldde een probleem dat het gereedschap zelf veroorzaakte.
 */
function Nummer({ nummer, structuur }: { nummer: number | undefined; structuur: boolean }) {
  if (nummer === undefined || structuur) return null;
  return (
    <span
      title={`Onderdeel ${nummer} van deze pagina`}
      className="grid h-5 min-w-5 place-items-center rounded-full bg-card-sub px-1 text-[10.5px] font-bold tabular-nums text-ink-soft"
    >
      {nummer}
    </span>
  );
}
