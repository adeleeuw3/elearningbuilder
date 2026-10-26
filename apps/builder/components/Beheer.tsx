/**
 * Beheer: wat er gebouwd is, en wat je ermee kunt.
 *
 * Het startscherm toont bewaarde modules ook, maar daar zijn ze een opstapje naar verder werken.
 * Hier zijn ze het onderwerp: hoe groot ze zijn, wanneer ze voor het laatst veranderden, en de
 * handelingen die je op een lijst wilt doen — openen, dupliceren, weggooien.
 *
 * **Verwijderen vraagt altijd.** Er is geen prullenbak op schijf: weg is weg. Een lijst waarin de
 * verwijderknop naast de openknop staat moet dat verschil dus zelf maken.
 */
"use client";

import * as React from "react";
import { Bevestiging, Button, Card, Chip, cn } from "@ob/ui";
import {
  bewaarProject,
  lijstProjecten,
  laadProject,
  verwijderProject,
  type ProjectRegel,
} from "../lib/api-client";
import { nieuwId } from "../lib/opslag";

export interface BeheerProps {
  /** Een module openen om verder te bouwen. */
  onOpen: (id: string, doc: unknown) => void;
}

export function Beheer({ onOpen }: BeheerProps) {
  const [regels, setRegels] = React.useState<ProjectRegel[] | null>(null);
  const [bezig, setBezig] = React.useState<string | null>(null);
  /** De module waarvan het verwijderen nog bevestigd moet worden. */
  const [teVerwijderen, setTeVerwijderen] = React.useState<ProjectRegel | null>(null);
  const [fout, setFout] = React.useState<string | null>(null);

  const laad = React.useCallback(async () => {
    setRegels(await lijstProjecten());
  }, []);

  React.useEffect(() => {
    void laad();
  }, [laad]);

  async function open(id: string) {
    setBezig(id);
    setFout(null);
    const uit = await laadProject(id);
    setBezig(null);
    if (!uit) {
      setFout("Deze module kon niet geopend worden.");
      return;
    }
    onOpen(id, uit.doc);
  }

  async function dupliceer(regel: ProjectRegel) {
    setBezig(regel.id);
    setFout(null);
    const gelezen = await laadProject(regel.id);
    if (!gelezen) {
      setBezig(null);
      setFout("Deze module kon niet gelezen worden, dus ook niet gekopieerd.");
      return;
    }
    // Een nieuw id, want het id ís de xAPI-identiteit van de module. Dezelfde identiteit hergebruiken
    // zou twee cursussen in de LRS op één hoop gooien.
    const nieuw = nieuwId();
    const uit = await bewaarProject(nieuw, `${regel.titel} (kopie)`, {
      ...(gelezen.doc as object),
      artifactId: nieuw,
    });
    setBezig(null);
    if (!uit.ok) {
      setFout(uit.bericht);
      return;
    }
    await laad();
  }

  async function verwijder(regel: ProjectRegel) {
    setBezig(regel.id);
    setFout(null);
    const ok = await verwijderProject(regel.id);
    setBezig(null);
    if (!ok) {
      setFout("Verwijderen lukte niet.");
      return;
    }
    await laad();
  }

  return (
    <div className="flex flex-col gap-4">
      {teVerwijderen && (
        <Bevestiging
          titel={`"${teVerwijderen.titel}" verwijderen?`}
          uitleg="Er is geen prullenbak: dit kan niet ongedaan gemaakt worden."
          bevestig="Verwijderen"
          ingrijpend
          onAnnuleer={() => setTeVerwijderen(null)}
          onBevestig={() => {
            const regel = teVerwijderen;
            setTeVerwijderen(null);
            void verwijder(regel);
          }}
        />
      )}
      <div>
        <h1 className="text-[30px] font-bold leading-[1.15] -tracking-[0.02em]">Beheer</h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          Alles wat op deze machine bewaard is.
          {regels && regels.length > 0 && ` ${regels.length} ${regels.length === 1 ? "module" : "modules"}.`}
        </p>
      </div>

      {fout && (
        <Card className="border-bloom-ink/30">
          <p className="text-[13px] text-ink">{fout}</p>
        </Card>
      )}

      {regels === null && <p className="text-[13px] text-ink-faint">Laden…</p>}

      {regels?.length === 0 && (
        <Card panel>
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            Er is nog niets bewaard. Bouw een module en druk op Bewaren; hij komt dan hier te staan.
          </p>
        </Card>
      )}

      {regels && regels.length > 0 && (
        <ul className="flex flex-col gap-2">
          {regels.map((regel) => (
            <li key={regel.id}>
              {/* Geen `interactive` op deze kaart: er staan drie knoppen in, en een klikbare rij
                  eromheen zou een klik op Verwijderen óók als openen laten tellen. De lift hoort
                  op wat je als geheel aanklikt — zoals een kandidaat in de mediazoeker. */}
              <Card className={cn("flex flex-wrap items-center gap-3", bezig === regel.id && "opacity-55")}>
                <div className="min-w-[200px] flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{regel.titel}</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-faint">
                    {omvang(regel)} · gewijzigd {wanneer(regel.gewijzigd)}
                  </p>
                </div>
                <Chip tone="rest" noDot className="shrink-0">
                  {regel.id.slice(0, 8)}
                </Chip>
                <div className="flex shrink-0 gap-1.5">
                  {/* De titel staat in de toegankelijke naam, niet alleen in het opschrift. Met
                      zes modules in de lijst staan er anders achttien knoppen die "Openen",
                      "Dupliceren" of "Verwijderen" heten en verder niets zeggen — en dan hoort een
                      schermlezer zes keer "Verwijderen" zonder te weten waarvan. Het whiteboard
                      doet dit al zo ("Pagina \"Inleiding\" dupliceren"); deze lijst deed het niet. */}
                  <Button
                    size="sm"
                    disabled={!!bezig}
                    aria-label={`"${regel.titel}" openen`}
                    onClick={() => void open(regel.id)}
                  >
                    Openen
                  </Button>
                  <Button
                    size="sm"
                    role_="subtle"
                    disabled={!!bezig}
                    aria-label={`"${regel.titel}" dupliceren`}
                    onClick={() => void dupliceer(regel)}
                  >
                    Dupliceren
                  </Button>
                  <Button
                    size="sm"
                    role_="subtle"
                    disabled={!!bezig}
                    aria-label={`"${regel.titel}" verwijderen`}
                    onClick={() => setTeVerwijderen(regel)}
                  >
                    Verwijderen
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Hoe groot de module is. Oudere bestanden dragen de telling niet; dan staat er niets. */
function omvang(regel: ProjectRegel): string {
  if (regel.paginas === undefined || regel.blokken === undefined) return "onbekende omvang";
  const p = `${regel.paginas} ${regel.paginas === 1 ? "pagina" : "pagina's"}`;
  const b = `${regel.blokken} ${regel.blokken === 1 ? "blok" : "blokken"}`;
  return `${p} · ${b}`;
}

/**
 * Hoe lang geleden, in woorden.
 *
 * Een los ISO-tijdstip zegt niets bij het scannen van een lijst; "gisteren" en "3 weken geleden"
 * wel. De exacte waarde blijft in de tooltip staan voor wie hem nodig heeft.
 */
function wanneer(iso: string): string {
  const toen = new Date(iso).getTime();
  if (Number.isNaN(toen)) return "op een onbekend moment";
  const minuten = Math.round((Date.now() - toen) / 60000);
  if (minuten < 1) return "zojuist";
  if (minuten < 60) return `${minuten} ${minuten === 1 ? "minuut" : "minuten"} geleden`;
  const uren = Math.round(minuten / 60);
  if (uren < 24) return `${uren} ${uren === 1 ? "uur" : "uur"} geleden`;
  const dagen = Math.round(uren / 24);
  if (dagen === 1) return "gisteren";
  if (dagen < 31) return `${dagen} dagen geleden`;
  const maanden = Math.round(dagen / 30);
  return `${maanden} ${maanden === 1 ? "maand" : "maanden"} geleden`;
}
