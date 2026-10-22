/**
 * Pagina's, afgeleid uit de graaf.
 *
 * Een pagina is **geen knoop** maar een maximale keten van onderling verbonden inhoudsblokken.
 * Elk inhoudsblok hoort daarmee bij precies één pagina, ook als het nergens aan hangt — dan is het
 * een pagina met één onderdeel. Het begrip "los blok" bestaat niet: een blok dat de auteur neerzet
 * is meteen zichtbaar in de structuur, zonder dat hij eerst een container hoeft te maken.
 *
 * Drie regels bepalen alles wat hier gebeurt:
 *
 *   1. **Lidmaatschap volgt alleen inhoud→inhoud.** Een AI-schakel wijst een blok aan en een
 *      vertakking routeert tussen pagina's; geen van beide voegt blokken samen. Zou een van die
 *      twee wél meetellen, dan zouden twee pagina's samensmelten zodra de auteur een route legt.
 *   2. **De linkrichting is de leesvolgorde**, van kop naar staart. De kop is het blok zonder
 *      inkomende inhoudsschakel.
 *   3. **De verticale positie van de kop bepaalt de paginavolgorde.** Een keten verslepen herordent
 *      dus de cursus. De volgorde komt daarmee uit iets wat de auteur ziet, niet uit een schakel
 *      die hij moet onthouden.
 *
 * Puur en los van React: dit is precies het deel dat stil fout gaat. Een pagina die één blok mist
 * ziet er niet kapot uit — hij ziet er korter uit.
 */
import { isInhoud, type Knoop, type Leerpad } from "./graph";

export interface Pagina {
  /**
   * De stabiele identiteit voor xAPI. Komt van `paginaSeed` op de kop, en valt terug op de seed
   * van de kop zelf zolang die er nog geen draagt.
   */
  seed: string;
  /** Wat er in het paneel staat: de overschreven titel, anders die van het eerste blok. */
  titel: string;
  /** Is de titel overschreven? Het paneel toont dat, zodat "waarom heet dit zo" beantwoordbaar is. */
  eigenTitel: boolean;
  /** Het eerste blok. Hieraan hangen de identiteit, de titel en de plek in de volgorde. */
  kop: Knoop;
  /** De onderdelen in linkvolgorde, kop eerst. Nooit leeg. */
  onderdelen: Knoop[];
}

export interface Paginamodel {
  paginas: Pagina[];
  /**
   * Blokken die in een cyclus zitten en dus geen kop hebben.
   *
   * `verbindKnopen` laat een cyclus niet ontstaan, dus dit is een vangnet voor gemigreerde of met
   * de hand bewerkte data. Ze verdwijnen niet uit de weergave — een blok dat nergens meer opduikt
   * is erger dan een blok met een melding ernaast.
   */
  cyclisch: Knoop[];
}

/**
 * De volgorde-momentopname: de y van elke kop op het moment van de laatste drop.
 *
 * Bestaat omdat de volgorde bij het lóslaten herberekend moet worden en niet tijdens het slepen —
 * anders springt het paneel bij elke muisbeweging heen en weer en is niet meer te zien waar je iets
 * naartoe sleept. Een kop die er niet in staat (net geplaatst) valt terug op zijn echte y.
 */
export type Ordening = Record<string, number>;

/**
 * Leidt de pagina's af.
 *
 * @param orde momentopname van de kop-posities; leeg = gebruik de huidige posities.
 */
export function paginamodel(leerpad: Leerpad, orde: Ordening = {}): Paginamodel {
  const perId = new Map(leerpad.knopen.map((k) => [k.id, k]));
  const rang = new Map(leerpad.knopen.map((k, i) => [k.id, i]));
  const inhoud = leerpad.knopen.filter(isInhoud);
  const inhoudIds = new Set(inhoud.map((k) => k.id));

  /**
   * De keten als twee lookups. De UI blokkeert een tweede uitgaande schakel, maar de data kan uit
   * een migratie of een oud bestand komen: bij een dubbele wint de eerste. Dat is willekeurig maar
   * wél deterministisch, en dat is hier het enige dat telt — een volgorde die per render verschilt
   * is erger dan een volgorde die de auteur moet corrigeren.
   */
  const volgend = new Map<string, string>();
  const vorig = new Map<string, string>();
  for (const v of leerpad.verbindingen) {
    if (!inhoudIds.has(v.van) || !inhoudIds.has(v.naar)) continue;
    if (v.van === v.naar) continue;
    if (volgend.has(v.van) || vorig.has(v.naar)) continue;
    volgend.set(v.van, v.naar);
    vorig.set(v.naar, v.van);
  }

  const bezocht = new Set<string>();
  const keten = (startId: string): Knoop[] => {
    const uit: Knoop[] = [];
    let hier: string | undefined = startId;
    while (hier !== undefined && !bezocht.has(hier)) {
      bezocht.add(hier);
      const knoop = perId.get(hier);
      if (!knoop) break;
      uit.push(knoop);
      hier = volgend.get(hier);
    }
    return uit;
  };

  const paginas: Pagina[] = [];
  for (const kop of inhoud) {
    if (vorig.has(kop.id) || bezocht.has(kop.id)) continue;
    paginas.push(alsPagina(keten(kop.id)));
  }

  // Wat nu nog over is, is via geen enkele kop te bereiken: dat kan alleen een cyclus zijn. Elk
  // daarvan krijgt toch een pagina, met de eerste knoop in documentvolgorde als ingang.
  const cyclisch: Knoop[] = [];
  for (const knoop of inhoud) {
    if (bezocht.has(knoop.id)) continue;
    const ring = keten(knoop.id);
    cyclisch.push(...ring);
    paginas.push(alsPagina(ring));
  }

  const positie = (p: Pagina) => orde[p.kop.id] ?? p.kop.y;
  paginas.sort(
    (a, b) =>
      positie(a) - positie(b) ||
      a.kop.x - b.kop.x ||
      (rang.get(a.kop.id) ?? 0) - (rang.get(b.kop.id) ?? 0),
  );
  return { paginas, cyclisch };
}

/** Alleen de pagina's, voor de plekken die niets met cyclussen te maken hebben. */
export function paginasVan(leerpad: Leerpad, orde: Ordening = {}): Pagina[] {
  return paginamodel(leerpad, orde).paginas;
}

function alsPagina(onderdelen: Knoop[]): Pagina {
  const kop = onderdelen[0]!;
  const eigen = (kop.paginaTitel ?? "").trim();
  return {
    seed: kop.paginaSeed || kop.seed,
    titel: eigen || kop.titel,
    eigenTitel: eigen.length > 0,
    kop,
    onderdelen,
  };
}

/** De momentopname van de kopposities, om na een drop mee te sorteren. */
export function ordeningVan(paginas: Pagina[]): Ordening {
  const uit: Ordening = {};
  for (const p of paginas) uit[p.kop.id] = p.kop.y;
  return uit;
}

/** De pagina waar dit blok bij hoort, en op welke plek. `null` als het geen inhoudsblok is. */
export function plekVanBlok(
  paginas: Pagina[],
  knoopId: string,
): { pagina: Pagina; positie: number } | null {
  for (const pagina of paginas) {
    const i = pagina.onderdelen.findIndex((k) => k.id === knoopId);
    if (i >= 0) return { pagina, positie: i + 1 };
  }
  return null;
}

/* --------------------------------------------------------------------- secties */

export interface SectieGroep {
  /** `null` = pagina's die boven de eerste sectie staan en dus bij geen enkele horen. */
  sectie: Knoop | null;
  paginas: Pagina[];
}

/**
 * Groepeert de pagina's per sectie, op positie.
 *
 * Een sectieknoop claimt alles onder zich tot de volgende sectieknoop. Bewust zonder schakels: de
 * paginavolgorde is al positioneel, en een tweede mechanisme ernaast zou kunnen tegenspreken wat de
 * auteur ziet staan.
 *
 * Zijn er geen secties, dan komt er één groep zonder kop terug — geen verzonnen groep "zonder
 * sectie", want dat is een kop voor iets wat er niet is.
 */
export function paginasPerSectie(leerpad: Leerpad, paginas: Pagina[]): SectieGroep[] {
  const secties = leerpad.knopen
    .filter((k) => k.soort === "sectie")
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (secties.length === 0) return paginas.length > 0 ? [{ sectie: null, paginas }] : [];

  const groepen: SectieGroep[] = [{ sectie: null, paginas: [] }];
  for (const sectie of secties) groepen.push({ sectie, paginas: [] });

  for (const pagina of paginas) {
    // De laatste sectie die niet ónder deze pagina begint. Staat de pagina boven allemaal, dan
    // hoort hij bij geen enkele.
    let index = 0;
    for (let i = 0; i < secties.length; i += 1) {
      if (secties[i]!.y <= pagina.kop.y) index = i + 1;
    }
    groepen[index]!.paginas.push(pagina);
  }

  // De kop-loze groep alleen tonen als er iets in staat; lege secties blijven wél staan, want die
  // heeft de auteur zelf neergezet en een sectie die verdwijnt is verwarrender dan een lege.
  return groepen.filter((g, i) => i > 0 || g.paginas.length > 0);
}
