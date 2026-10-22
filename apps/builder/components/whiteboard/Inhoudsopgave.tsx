/**
 * De cursusstructuur: pagina's onder elkaar, per pagina de onderdelen in linkvolgorde.
 *
 * Dit paneel is een **read-model**. Het toont de uitkomst en niets anders: geen validatie, geen
 * uitleg over hoe het tot stand komt, geen groep voor iets wat er niet is. Wat hier staat is wat de
 * cursist krijgt, in de volgorde waarin hij het krijgt.
 *
 * Waarom die strengheid: een structuurweergave die óók meldingen doet gaat over de graaf in plaats
 * van over de cursus, en dan moet de auteur twee dingen tegelijk lezen — wat hij gebouwd heeft en
 * wat het gereedschap ervan vindt. De meldingen staan daarom apart, ingeklapt, buiten deze lijst.
 *
 * Klikken op een onderdeel selecteert en centreert dat blok op het canvas; klikken op een
 * paginatitel selecteert de hele keten. Elke pagina meldt zijn positie via `onAnker`, zodat het
 * canvas er een doellijn naartoe kan trekken.
 *
 * **Eén kaart per pagina.** Hiervoor zaten alle pagina's van een sectiegroep in één kaart, en dan
 * is de grens tussen twee pagina's niets: je ziet een lijst met namen en moet zelf uitvogelen waar
 * de ene ophoudt en de andere begint. Nu is elke pagina een eigen vlak, met het wóórd pagina erbij
 * en het aantal onderdelen uitgeschreven — een kaal getal achter een titel kan alles betekenen.
 *
 * **De keten is zichtbaar.** De onderdelen hangen aan een verticale lijn in Flow, de kleur die in
 * Prism verbinding betekent, met een bolletje per blok. Het eerste bolletje is gevuld: dat is de
 * kop van de keten, en daar leent de pagina haar naam van als de auteur er zelf geen koos. Dat ís
 * het model — en nu hoeft het niet meer uitgelegd te worden, want je ziet het.
 */
"use client";

import { Button, IconButton, cn } from "@ob/ui";
import { CATEGORIE_ICOON } from "../../lib/graph";
import type { Pagina, SectieGroep } from "../../lib/paginas";

export interface InhoudsopgaveProps {
  groepen: SectieGroep[];
  /** Het blok dat nu geselecteerd is, om het in de lijst op te laten lichten. */
  geselecteerd: string | null;
  /** Klik op een onderdeel: selecteer dat blok en breng het in beeld. */
  onKiesBlok: (knoopId: string) => void;
  /** Klik op een paginatitel: selecteer de hele keten. */
  onKiesPagina: (pagina: Pagina) => void;
  onNieuweSectie: () => void;
  onDupliceerPagina: (pagina: Pagina) => void;
  /** Over welke pagina de cursor gaat, zodat het canvas de bijbehorende rij kan oplichten. */
  onHoverPagina?: (kopId: string | null) => void;
  /** De pagina die nu het verband met het canvas toont. */
  actievePagina?: string | null;
  /**
   * Meldt waar elke pagina in het paneel staat, zodat het canvas er één lijn naartoe kan trekken.
   *
   * Per pagina en niet per sectiegroep: zonder secties is er maar één groep, en dan zou de lijn
   * altijd naar dezelfde doos wijzen — dat is geen verband maar decoratie.
   */
  onAnker: (kopId: string, el: HTMLElement | null) => void;
}

/** De sleutel waarmee canvas en paneel naar dezelfde groep verwijzen. */
export function groepSleutel(groep: SectieGroep, index: number): string {
  return `${groep.sectie?.id ?? "geen"}#${index}`;
}

export function Inhoudsopgave({
  groepen,
  geselecteerd,
  onKiesBlok,
  onKiesPagina,
  onNieuweSectie,
  onDupliceerPagina,
  onHoverPagina,
  actievePagina,
  onAnker,
}: InhoudsopgaveProps) {
  const leeg = groepen.every((g) => g.paginas.length === 0);
  /**
   * Pagina's zijn doorlopend genummerd over de secties heen.
   *
   * De cursist loopt ze in één volgorde door; een nummer dat per sectie opnieuw bij 1 begint zou
   * suggereren dat er twee keer een eerste pagina is.
   */
  let nummer = 0;

  return (
    <aside aria-label="Cursusstructuur" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="mr-auto text-[17px] font-semibold -tracking-[0.01em]">Cursusstructuur</h2>
        <Button size="sm" role_="subtle" onClick={onNieuweSectie} aria-label="Sectie toevoegen">
          <span aria-hidden="true" className="text-[15px] leading-none">
            +
          </span>
        </Button>
      </div>

      {leeg && (
        <p className="rounded-card border border-stroke bg-card p-4 text-[13px] text-ink-faint shadow-elevation">
          Nog niets op het canvas. Zet een blok neer; dat is meteen je eerste pagina.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {groepen.map((groep, gi) => (
          <div key={groepSleutel(groep, gi)} className="flex flex-col gap-2">
            {groep.sectie && (
              <button
                type="button"
                onClick={() => onKiesBlok(groep.sectie!.id)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-control px-1 py-0.5 text-left",
                  "text-[14.5px] font-semibold -tracking-[0.01em] text-ink",
                  "[transition:background-color_var(--spring-flow),color_var(--spring-flow)]",
                  "hover:bg-flow-wash hover:text-flow-ink",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
                )}
              >
                <span aria-hidden="true" className="text-ink-faint">
                  {CATEGORIE_ICOON.sectie}
                </span>
                {groep.sectie.titel}
              </button>
            )}

            <ol className="flex flex-col gap-2">
              {groep.paginas.map((pagina) => {
                nummer += 1;
                return (
                  <Paginakaart
                    key={pagina.kop.id}
                    pagina={pagina}
                    nummer={nummer}
                    geselecteerd={geselecteerd}
                    aangewezen={actievePagina === pagina.kop.id}
                    onAnker={onAnker}
                    onKiesBlok={onKiesBlok}
                    onKiesPagina={onKiesPagina}
                    onDupliceerPagina={onDupliceerPagina}
                    {...(onHoverPagina ? { onHoverPagina } : {})}
                  />
                );
              })}

              {groep.paginas.length === 0 && groep.sectie && (
                <li className="px-2 py-1 text-[12px] text-ink-faint">
                  Nog geen pagina&rsquo;s in deze sectie. Sleep een keten hieronder.
                </li>
              )}
            </ol>
          </div>
        ))}
      </div>
    </aside>
  );
}

/**
 * Eén pagina als eigen vlak.
 *
 * De kop zegt wát het is ("Pagina 3") vóór hij zegt hoe het heet. De naam alleen is namelijk niet
 * te onderscheiden van een blok — zeker niet wanneer de pagina haar naam van haar eerste blok
 * leent, want dan staat dezelfde tekst twee keer onder elkaar. Met het woord ervoor leest die
 * herhaling als hiërarchie in plaats van als fout, en de regel eronder zegt waaróm hij er twee
 * keer staat.
 */
function Paginakaart({
  pagina,
  nummer,
  geselecteerd,
  aangewezen,
  onAnker,
  onHoverPagina,
  onKiesBlok,
  onKiesPagina,
  onDupliceerPagina,
}: {
  pagina: Pagina;
  nummer: number;
  geselecteerd: string | null;
  aangewezen: boolean;
  onAnker: (kopId: string, el: HTMLElement | null) => void;
  onHoverPagina?: (kopId: string | null) => void;
  onKiesBlok: (knoopId: string) => void;
  onKiesPagina: (pagina: Pagina) => void;
  onDupliceerPagina: (pagina: Pagina) => void;
}) {
  const bevatSelectie = pagina.onderdelen.some((k) => k.id === geselecteerd);
  const aantal = pagina.onderdelen.length;

  return (
    <li
      ref={(el) => onAnker(pagina.kop.id, el)}
      onPointerEnter={() => onHoverPagina?.(pagina.kop.id)}
      onPointerLeave={() => onHoverPagina?.(null)}
      className={cn(
        "rounded-card border bg-card p-3 shadow-elevation",
        "[transition:background-color_var(--spring-flow),border-color_var(--spring-flow),box-shadow_var(--spring-flow)]",
        aangewezen || bevatSelectie
          ? "border-flow-from shadow-glow-flow"
          : "border-stroke hover:border-flow-from",
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={() => onKiesPagina(pagina)}
          title={
            pagina.eigenTitel
              ? "Eigen paginatitel · klik om de hele pagina te selecteren"
              : `Deze pagina heet naar haar eerste blok "${pagina.kop.titel}" · klik om de hele pagina te selecteren`
          }
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-0.5 rounded-control px-1.5 py-1 text-left",
            "[transition:transform_var(--spring-snappy),background-color_var(--spring-flow),color_var(--spring-flow)]",
            "active:translate-y-px hover:bg-flow-wash",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
          )}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Pagina {nummer}
          </span>
          <span
            className={cn(
              "min-w-0 truncate text-[14px] font-semibold -tracking-[0.01em]",
              bevatSelectie ? "text-flow-ink" : "text-ink",
            )}
          >
            {pagina.titel}
          </span>
          <span className="text-[11px] leading-snug text-ink-faint">
            {aantal} {aantal === 1 ? "onderdeel" : "onderdelen"}
            {!pagina.eigenTitel && aantal > 0 ? " · heet naar het eerste blok" : ""}
          </span>
        </button>
        <IconButton
          label={`Pagina "${pagina.titel}" dupliceren`}
          size="sm"
          stil
          onClick={() => onDupliceerPagina(pagina)}
        >
          ⧉
        </IconButton>
      </div>

      {/*
        De keten. De lijn staat in Flow omdat dat in Prism verbinding betekent, en het eerste
        bolletje is gevuld: dat is de kop waar de pagina haar naam vandaan haalt.
      */}
      <ul className="ml-2 mt-1.5 flex flex-col border-l-2 border-flow-from/40 pl-3">
        {pagina.onderdelen.map((blok, i) => (
          <li key={blok.id} className="relative">
            <span
              aria-hidden="true"
              className={cn(
                "absolute -left-[17px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border-2 border-flow-from",
                i === 0 ? "bg-flow-from" : "bg-card",
              )}
            />
            <button
              type="button"
              onClick={() => onKiesBlok(blok.id)}
              aria-current={geselecteerd === blok.id}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-control px-1.5 py-1 text-left text-[12px]",
                "[transition:transform_var(--spring-snappy),background-color_var(--spring-flow),color_var(--spring-flow)]",
                "active:translate-y-px",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
                geselecteerd === blok.id
                  ? "bg-flow-wash font-semibold text-flow-ink"
                  : "text-ink-soft hover:bg-flow-wash hover:text-flow-ink",
              )}
            >
              <span aria-hidden="true" className="shrink-0 text-ink-faint">
                {CATEGORIE_ICOON[blok.soort]}
              </span>
              <span className="min-w-0 flex-1 truncate">{blok.titel}</span>
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}
