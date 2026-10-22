/**
 * Detailpaneel naast het canvas: wat zit er in de geselecteerde knoop, en waar staat hij.
 *
 * Twee regimes:
 *   · **contentblokken** (uit de gegenereerde module) worden in de blokkenweergave bewerkt. Hier
 *     lees je ze alleen. Twee plekken die hetzelfde veld wijzigen zou de auteur laten twijfelen
 *     welke de waarheid is.
 *   · **zelf geplaatste knopen** hebben geen content erachter, dus is dit paneel hun enige bron.
 *
 * De eigenschappen die eronder verschijnen horen bij de soort: een vraagvorm en een xAPI-werkwoord
 * bij een kennischeck, een slagingsnorm bij een assessment, een opdracht bij een AI-knoop. Wat er
 * niet bij hoort staat er ook niet — een veld dat nergens op slaat is erger dan geen veld.
 */
"use client";

import * as React from "react";
import { Button, cn } from "@ob/ui";
import {
  CATEGORIE_LABEL,
  VRAAGVORM_LABEL,
  type CarrouselItem,
  type Knoop,
  type Vraagvorm,
} from "../../lib/graph";
import {
  metGewijzigdItem,
  metNieuwItem,
  metVerplaatstItem,
  NIVEAU,
  XAPI_WERKWOORDEN,
  zonderItem,
} from "../../lib/leerpad";
import type { GeneratedContent } from "../../lib/types";
import { Bestandskiezer } from "./Bestandskiezer";

export interface KnoopPaneelProps {
  knoop: Knoop | null;
  content: GeneratedContent;
  /** Op welke pagina dit blok staat en waar in de stapel; null als het geen inhoudsblok is. */
  plek: { pagina: string; positie: number; aantal: number } | null;
  /**
   * De pagina waar dit blok de kop van is, of null als het niet de kop is.
   *
   * Alleen de kop draagt de paginatitel: daar hangt de identiteit aan, en een titelveld op elk
   * blok zou suggereren dat elk blok een pagina begint.
   */
  paginaKop: { titel: string; eigenTitel: boolean; blokTitel: string } | null;
  onPaginaTitel: (titel: string) => void;
  /** De checks die bij een assessment horen — afgeleid uit de keten, niet apart bijgehouden. */
  checks: Knoop[];
  /** Het blok dat een AI-knoop schrijft. */
  aiDoel: Knoop | null;
  onBewerkInBlokken: () => void;
  onWijzig: (patch: Partial<Knoop>) => void;
  onZetMinuten: (minuten: number) => void;
  onDupliceer: () => void;
  onVerwijder: () => void;
}

export function KnoopPaneel({
  knoop,
  content,
  plek,
  paginaKop,
  onPaginaTitel,
  checks,
  aiDoel,
  onBewerkInBlokken,
  onWijzig,
  onZetMinuten,
  onDupliceer,
  onVerwijder,
}: KnoopPaneelProps) {
  if (!knoop) {
    return (
      <div className="rounded-card border border-stroke bg-card p-5 shadow-elevation">
        <p className="text-center text-[13px] text-ink-faint">
          Klik een blok aan om het te bewerken. Sleep aan de kop om te verplaatsen, of gebruik het
          verbind-gereedschap om blokken onder elkaar op dezelfde pagina te zetten.
        </p>
      </div>
    );
  }

  const isInhoud = NIVEAU[knoop.soort] === "inhoud";

  return (
    <div
      className={cn(
        "rounded-card border bg-card p-5",
        knoop.klaar ? "border-stroke shadow-elevation" : "border-transparent shadow-glow-bloom",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          {CATEGORIE_LABEL[knoop.soort]}
        </span>
        <span className="ml-auto text-right text-[11.5px] tabular-nums text-ink-faint">
          {plek ? `${plek.pagina} · onderdeel ${plek.positie} van ${plek.aantal}` : ""}
        </span>
      </div>

      {knoop.eigen ? (
        <div className="mt-3 flex flex-col gap-3">
          <Veld label="Titel" waarde={knoop.titel} onChange={(titel) => onWijzig({ titel })} eenRegel />
          {isInhoud && (
            <>
              <Veld
                label="Toelichting"
                waarde={knoop.fragment}
                onChange={(fragment) => onWijzig({ fragment })}
                rows={3}
                hint={
                  knoop.soort === "video" || knoop.soort === "afbeelding" || knoop.soort === "audio"
                    ? "Waar dit fragment over gaat. Wordt ook gebruikt als voorstel bij het zoeken."
                    : undefined
                }
              />
              <label className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                  Duur
                </span>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={knoop.minuten}
                  onChange={(e) => onZetMinuten(Number(e.target.value))}
                  className="w-16 rounded-control border border-stroke bg-card px-2 py-1 text-[13.5px] tabular-nums text-ink focus:border-flow-from focus:outline-none"
                />
                <span className="text-[13px] text-ink-soft">minuten</span>
              </label>
            </>
          )}
        </div>
      ) : (
        <>
          <h2 className="mt-1.5 text-[19px] font-semibold -tracking-[0.01em]">{knoop.titel}</h2>
          <div className="mt-3">{inhoud(knoop, content)}</div>
          <Button size="sm" className="mt-4" onClick={onBewerkInBlokken}>
            Bewerken in blokkenweergave
          </Button>
        </>
      )}

      {/* ---- eigenschappen die bij deze soort horen ---- */}

      {knoop.soort === "toets" && (
        <div className="mt-4 flex flex-col gap-3 border-t border-stroke-soft pt-4">
          <Keuze
            label="Vraagvorm"
            waarde={knoop.vraagvorm ?? "meerkeuze"}
            opties={Object.entries(VRAAGVORM_LABEL).map(([w, l]) => ({ waarde: w, label: l }))}
            onChange={(v) => onWijzig({ vraagvorm: v as Vraagvorm })}
          />
          <Werkwoord knoop={knoop} onWijzig={onWijzig} />
        </div>
      )}

      {knoop.soort === "reflectie" && (
        <div className="mt-4 flex flex-col gap-3 border-t border-stroke-soft pt-4">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={knoop.aiBeoordeling ?? false}
              onChange={(e) => onWijzig({ aiBeoordeling: e.target.checked })}
              className="mt-0.5 h-5 w-5 shrink-0 accent-flow-ink"
            />
            <span className="text-[13px] leading-relaxed text-ink-soft">
              Laat het antwoord door AI beoordelen. Zonder dit wordt het alleen vastgelegd.
            </span>
          </label>
          <Werkwoord knoop={knoop} onWijzig={onWijzig} />
        </div>
      )}

      {knoop.soort === "assessment" && (
        <div className="mt-4 flex flex-col gap-3 border-t border-stroke-soft pt-4">
          <label className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Slagingsnorm
            </span>
            <input
              type="number"
              min={1}
              max={100}
              value={knoop.norm ?? 70}
              onChange={(e) =>
                onWijzig({ norm: Math.max(1, Math.min(100, Number(e.target.value))) })
              }
              className="w-16 rounded-control border border-stroke bg-card px-2 py-1 text-[13.5px] tabular-nums text-ink focus:border-flow-from focus:outline-none"
            />
            <span className="text-[13px] text-ink-soft">%</span>
          </label>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Telt deze checks mee
            </span>
            {checks.length === 0 ? (
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-faint">
                Nog geen checks. Alles wat vóór dit assessment in dezelfde keten staat telt mee, tot
                aan een vorig assessment.
              </p>
            ) : (
              <ul className="mt-1 flex flex-col gap-0.5">
                {checks.map((c) => (
                  <li key={c.id} className="text-[12.5px] text-ink-soft">
                    · {c.titel}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Werkwoord knoop={knoop} onWijzig={onWijzig} />
        </div>
      )}

      {knoop.soort === "citaat" && (
        <div className="mt-4 flex flex-col gap-3 border-t border-stroke-soft pt-4">
          <Veld
            label="Bronvermelding"
            eenRegel
            waarde={knoop.bronvermelding ?? ""}
            onChange={(bronvermelding) => onWijzig({ bronvermelding })}
            hint="Van wie het citaat is. Laat je dit leeg, dan staat er geen bron onder."
          />
        </div>
      )}

      {knoop.soort === "carrousel" && <Stappen knoop={knoop} onWijzig={onWijzig} />}

      {knoop.soort === "ai" && (
        <div className="mt-4 flex flex-col gap-3 border-t border-stroke-soft pt-4">
          <Veld
            label="Opdracht"
            rows={3}
            waarde={knoop.prompt ?? ""}
            onChange={(prompt) => onWijzig({ prompt })}
            hint={
              aiDoel
                ? `Deze knoop hoort bij "${aiDoel.titel}".`
                : "Verbind deze knoop met het blok dat geschreven moet worden."
            }
          />
          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            De opdracht wordt bewaard, maar er wordt nog niets uitgevoerd: de schrijfroute is nog
            niet gebouwd.
          </p>
        </div>
      )}

      {paginaKop && (
        <div className="mt-4 border-t border-stroke-soft pt-3">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Deze pagina
          </span>
          <label className="mt-1.5 block">
            <span className="sr-only">Paginatitel</span>
            <input
              type="text"
              value={paginaKop.eigenTitel ? paginaKop.titel : ""}
              placeholder={paginaKop.blokTitel}
              onChange={(e) => onPaginaTitel(e.target.value)}
              className="w-full rounded-control border border-stroke bg-card-sub px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink"
            />
          </label>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">
            {paginaKop.eigenTitel
              ? "Eigen titel. Leegmaken zet hem terug op de titel van het eerste blok."
              : "Standaard de titel van het eerste blok. Vul iets in om hem vast te zetten."}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {isInhoud && (
          <Button size="sm" onClick={onDupliceer}>
            Pagina dupliceren
          </Button>
        )}
        <Button size="sm" role_="subtle" onClick={onVerwijder}>
          Verwijderen
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- eigenschappen */

/**
 * De stappen van een carrousel.
 *
 * Hier en niet op de kaart: een lijst met een kop, een tekst en een citaat per stap past niet op
 * een blok van 300px breed, en een kaart die opzwelt tot een formulier maakt het canvas onleesbaar.
 * De kaart laat zien hóéveel stappen er zijn; hier staat wat erin staat.
 */
function Stappen({ knoop, onWijzig }: { knoop: Knoop; onWijzig: (p: Partial<Knoop>) => void }) {
  const items = knoop.items ?? [];
  const zet = (nieuw: CarrouselItem[]) => onWijzig({ items: nieuw });

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-stroke-soft pt-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          Stappen
        </span>
        <span className="ml-auto text-[11.5px] tabular-nums text-ink-faint">{items.length}</span>
      </div>

      {items.map((item, i) => (
        <div key={item.id} className="rounded-control border border-stroke bg-card-sub p-3">
          <div className="mb-2 flex items-center gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Stap {i + 1}
            </span>
            <div className="ml-auto flex gap-1">
              <Stapknop
                label={`Stap ${i + 1} omhoog`}
                teken="↑"
                uit={i === 0}
                onClick={() => zet(metVerplaatstItem(items, item.id, -1))}
              />
              <Stapknop
                label={`Stap ${i + 1} omlaag`}
                teken="↓"
                uit={i === items.length - 1}
                onClick={() => zet(metVerplaatstItem(items, item.id, 1))}
              />
              <Stapknop
                label={`Stap ${i + 1} verwijderen`}
                teken="×"
                uit={items.length <= 2}
                onClick={() => zet(zonderItem(items, item.id))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Veld
              label="Kop"
              eenRegel
              waarde={item.kop}
              onChange={(kop) => zet(metGewijzigdItem(items, item.id, { kop }))}
            />
            <Veld
              label="Tekst"
              rows={3}
              waarde={item.tekst}
              onChange={(tekst) => zet(metGewijzigdItem(items, item.id, { tekst }))}
            />
            <Veld
              label="Uitgelicht citaat"
              eenRegel
              waarde={item.citaat ?? ""}
              onChange={(citaat) => zet(metGewijzigdItem(items, item.id, { citaat }))}
            />
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                Beeld
              </span>
              <Bestandskiezer
                compact
                soort="afbeelding"
                bestand={item.bestand}
                zoekhint={item.kop.trim() || item.tekst.trim() || knoop.titel}
                onBestand={(bestand) => zet(metGewijzigdItem(items, item.id, { bestand }))}
              />
            </div>
          </div>
        </div>
      ))}

      <Button size="sm" onClick={() => zet(metNieuwItem(items))}>
        Stap toevoegen
      </Button>
      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        Een carrousel is pas afgerond als de cursist alle stappen bekeken heeft. Onder de twee
        stappen valt er niets door te klikken, dus die kunnen niet weg.
      </p>
    </div>
  );
}

function Stapknop({
  label,
  teken,
  uit,
  onClick,
}: {
  label: string;
  teken: string;
  uit: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={uit}
      onClick={onClick}
      className={cn(
        "h-6 w-6 rounded-control border border-stroke bg-card text-[13px] leading-none text-ink-soft",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
        uit ? "opacity-40" : "hover:border-flow-from hover:text-flow-ink",
      )}
    >
      {teken}
    </button>
  );
}

/** Het xAPI-werkwoord: wat er over dit blok naar de LRS gaat. */
function Werkwoord({ knoop, onWijzig }: { knoop: Knoop; onWijzig: (p: Partial<Knoop>) => void }) {
  const huidig = XAPI_WERKWOORDEN.find((w) => w.iri === knoop.xapiWerkwoord);
  return (
    <div className="flex flex-col gap-1.5">
      <Keuze
        label="xAPI-werkwoord"
        waarde={knoop.xapiWerkwoord ?? ""}
        opties={[
          { waarde: "", label: "Niets melden" },
          ...XAPI_WERKWOORDEN.map((w) => ({ waarde: w.iri, label: w.naam })),
        ]}
        onChange={(v) => onWijzig({ xapiWerkwoord: v })}
      />
      <span className="text-[11.5px] leading-relaxed text-ink-faint">
        {huidig ? huidig.uitleg : "Er gaat geen statement over dit blok naar de LRS."}
      </span>
    </div>
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
  opties: { waarde: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </span>
      <select
        value={waarde}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-control border border-stroke bg-card px-2.5 py-2 text-[13.5px] text-ink focus:border-flow-from focus:outline-none"
      >
        {opties.map((o) => (
          <option key={o.waarde} value={o.waarde}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Veld({
  label,
  waarde,
  onChange,
  rows = 2,
  eenRegel,
  hint,
}: {
  label: string;
  waarde: string;
  onChange: (v: string) => void;
  rows?: number;
  eenRegel?: boolean;
  hint?: string;
}) {
  const gedeeld = cn(
    "w-full rounded-control border border-stroke bg-card px-3 py-2",
    "text-[14px] leading-relaxed text-ink",
    "focus:border-flow-from focus:shadow-glow-flow focus:outline-none",
  );
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </span>
      {eenRegel ? (
        <input value={waarde} onChange={(e) => onChange(e.target.value)} className={gedeeld} />
      ) : (
        <textarea
          value={waarde}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          className={cn(gedeeld, "resize-none")}
        />
      )}
      {hint && <span className="text-[11.5px] leading-relaxed text-ink-faint">{hint}</span>}
    </label>
  );
}

/* --------------------------------------------------------------------- inhoud */

function inhoud(knoop: Knoop, content: GeneratedContent) {
  // `bron` is de markering voor de twee contentvelden die geen sectie zijn; zie `tekstbron`.
  if (knoop.bron === "intro") return <Alinea>{content.intro}</Alinea>;
  if (knoop.bron === "samenvatting") return <Alinea>{content.samenvatting}</Alinea>;

  if (knoop.soort === "uitleg" && knoop.index !== null) {
    const sectie = content.secties[knoop.index];
    return sectie ? <Alinea>{sectie.tekst}</Alinea> : <Ontbreekt />;
  }
  if (knoop.soort === "toets" && knoop.index !== null) {
    const vraag = content.vragen[knoop.index];
    if (!vraag) return <Ontbreekt />;
    return (
      <>
        <p className="text-[14.5px] font-medium leading-relaxed text-ink">{vraag.vraag}</p>
        <ul className="mt-2.5 flex flex-col gap-1">
          {vraag.opties.map((optie, i) => {
            const juist = i === vraag.correct;
            return (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-2 rounded-control px-2 py-1 text-[13.5px]",
                  juist ? "bg-glow-wash text-glow-ink shadow-glow-glow" : "text-ink-soft",
                )}
              >
                <span aria-hidden="true" className="font-semibold">
                  {juist ? "✓" : "·"}
                </span>
                {optie}
                {juist && <span className="sr-only">(juiste antwoord)</span>}
              </li>
            );
          })}
        </ul>
      </>
    );
  }
  return <Ontbreekt />;
}

function Alinea({ children }: { children: React.ReactNode }) {
  return (
    <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-soft">{children}</p>
  );
}

/** Kan alleen als content en knopen uit de pas lopen — dan liever dit dan een leeg paneel. */
function Ontbreekt() {
  return (
    <p className="text-[13px] text-ink-faint">Het blok hierachter bestaat niet meer in de content.</p>
  );
}
