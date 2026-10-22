/**
 * De graaf: blokken, schakels en wat daaraan mag hangen.
 *
 * Een pagina is hier **geen knooptype**. Een pagina is een maximale keten van onderling verbonden
 * inhoudsblokken, en die afleiding staat in `paginas.ts`. Dit bestand gaat over wat je met de graaf
 * mág doen; dat bestand over wat eruit volgt.
 *
 * Waarom die scheiding: zolang "pagina" een knoop was, moest de auteur eerst een container maken
 * voordat zijn blokken ergens bij hoorden, en alles wat nog niet in zo'n container liep werd als
 * LOS gemarkeerd. Het gereedschap klaagde dus over een structuur die het zelf eiste. Nu hoort elk
 * blok meteen bij precies één pagina — een blok zonder schakels is een pagina met één onderdeel.
 *
 * De invariant die de leesvolgorde bepaalbaar houdt:
 *
 *   een inhoudsblok heeft maximaal één inkomende en maximaal één uitgaande inhoudsschakel.
 *
 * Splitsen naar meerdere routes blijft voorbehouden aan de vertakking. Die hangt achter de staart
 * van een keten en wijst naar de kóp van andere ketens; zulke schakels tellen niet mee voor
 * lidmaatschap, want een route leggen mag nooit twee schermen samenvoegen.
 *
 * Puur en los van React: dit is precies het deel dat stil fout gaat zonder dat er iets faalt.
 */
import { VERBS } from "@ob/schema";
import {
  bouwLeerpad,
  CATEGORIE_LABEL,
  isInhoud,
  isLegeContent,
  KANT_MARGE,
  KOLOM_AFSTAND,
  RIJ_HOOGTE,
  NIVEAU,
  niveauVan,
  schatMinuten,
  type CarrouselItem,
  type Knoop,
  type KnoopSoort,
  type Leerpad,
  type Verbinding,
  type Voorwaarde,
} from "./graph";
import { paginamodel, paginasVan, type Pagina } from "./paginas";
import type { GeneratedContent } from "./types";

// Het niveau-begrip en `Leerpad` staan in `graph.ts` zodat de pagina-afleiding er los van hangt.
// Hier doorgegeven, zodat de bestaande importplekken niet allemaal om hoeven.
export { NIVEAU, niveauVan };
export type { Leerpad, Niveau } from "./graph";

/**
 * Mag deze schakel bestaan?
 *
 * De tabel is expliciet en niet "alles wat niet verboden is": een graaf waarin een sectie aan een
 * tekstblok hangt ziet er op het canvas prima uit en betekent niets. Dit is de plek waar dat
 * onmogelijk wordt gemaakt in plaats van achteraf gemeld.
 */
export function magVerbinden(van: Knoop, naar: Knoop): boolean {
  const a = niveauVan(van);
  const b = niveauVan(naar);
  // Inhoud stapelt op inhoud (dat vormt de pagina) of loopt op een vertakking uit.
  if (a === "inhoud") return b === "inhoud" || b === "vertakking";
  // Een AI-knoop wijst het blok aan dat hij schrijft. Verder hangt er niets aan hem.
  if (a === "gereedschap") return b === "inhoud";
  // Een vertakking wijst naar de kop van andere ketens.
  if (a === "vertakking") return b === "inhoud";
  // Een sectie groepeert op positie, niet met schakels: er gaat niets in en niets uit.
  return false;
}

/**
 * Waarom een schakel geweigerd wordt — voor een hint bij de cursor in plaats van stilte.
 *
 * Een geweigerde schakel stil laten gebeuren is het ergste van beide werelden: de auteur ziet
 * niets veranderen en weet niet of hij misklikte of dat het niet mag.
 */
export function verbindingsBezwaar(van: Knoop, naar: Knoop, leerpad?: Leerpad): string | null {
  if (van.id === naar.id) return "Een blok kan niet aan zichzelf hangen.";
  const a = niveauVan(van);
  const b = niveauVan(naar);

  if (!magVerbinden(van, naar)) {
    if (b === "gereedschap") return "Aan een AI-knoop hangt niets; hij wijst zelf een blok aan.";
    if (a === "sectie" || b === "sectie") {
      return "Een sectie groepeert op plek: sleep hem boven de pagina's die erbij horen.";
    }
    if (a === "vertakking" && b === "vertakking") {
      return "Een vertakking wijst naar blokken, niet naar een andere vertakking.";
    }
    return `Een ${CATEGORIE_LABEL[van.soort].toLowerCase()} kan niet aan een ${CATEGORIE_LABEL[naar.soort].toLowerCase()} hangen.`;
  }

  if (leerpad) {
    if (bereikbaar(leerpad.verbindingen, naar.id, van.id)) {
      return "Dat maakt een kring: dit blok komt al ná het andere.";
    }
    // De reden dat dit hier zit en niet als melding achteraf: met twee uitgaande schakels is de
    // stapelvolgorde op de pagina niet meer bepaald, en dan is er niets meer te melden — dan is de
    // pagina gewoon stuk.
    if (a === "inhoud" && b === "inhoud") {
      const alUit = leerpad.verbindingen.find(
        (x) => x.van === van.id && isInhoudsSchakel(leerpad, x),
      );
      if (alUit) {
        return `"${van.titel}" heeft al een blok eronder. Gebruik een vertakking om te splitsen.`;
      }
      const alIn = leerpad.verbindingen.find(
        (x) => x.naar === naar.id && isInhoudsSchakel(leerpad, x),
      );
      if (alIn) return `"${naar.titel}" staat al onder een ander blok.`;
    }
  }
  return null;
}

/** Telt deze schakel mee voor de keten? Alleen inhoud→inhoud doet dat. */
function isInhoudsSchakel(leerpad: Leerpad, v: Verbinding): boolean {
  const van = leerpad.knopen.find((k) => k.id === v.van);
  const naar = leerpad.knopen.find((k) => k.id === v.naar);
  return !!van && !!naar && isInhoud(van) && isInhoud(naar);
}

/* ------------------------------------------------------------------- het palet */

/**
 * Wat de auteur op het canvas mag zetten, gegroepeerd per niveau.
 *
 * `video`, `afbeelding` en `audio` dragen een echt bestand: van het apparaat van de auteur, of via
 * de mediazoeker uit een stockbron. Geluid staat niet in die zoeker — Pexels en Pixabay leveren
 * geen fragmenten, en een knop die altijd niets vindt is erger dan geen knop.
 */
export const PALET: { soort: KnoopSoort; hint: string }[] = [
  { soort: "uitleg", hint: "Een stuk uitleg" },
  { soort: "video", hint: "Video van je apparaat of uit een stockbron" },
  { soort: "afbeelding", hint: "Afbeelding van je apparaat of uit een stockbron" },
  { soort: "audio", hint: "Audio of voice-over van je apparaat" },
  { soort: "citaat", hint: "Korte tekst over een achtergrond, met bronvermelding" },
  { soort: "carrousel", hint: "Een reeks stappen die de cursist doorklikt" },
  { soort: "toets", hint: "Kennischeck met een vraagvorm en een xAPI-werkwoord" },
  { soort: "reflectie", hint: "Open antwoord, eventueel door AI beoordeeld" },
  { soort: "assessment", hint: "Scoort de checks ervoor, met een slagingsnorm" },
  { soort: "ai", hint: "Laat een blok schrijven of herschrijven" },
  { soort: "sectie", hint: "Groepeert de pagina's eronder in een langere cursus" },
  { soort: "vertakking", hint: "Splitst het pad op basis van een keuze of resultaat" },
];

/** De beeldverhoudingen en resoluties die een videoknoop kent. Gaan mee in de export-briefing. */
export const BEELDVERHOUDINGEN = ["16:9", "9:16", "1:1", "4:3"] as const;
export const RESOLUTIES = ["480p", "720p", "1080p"] as const;
/** Stemnamen voor een narratieknoop. Vrije tekst zou een typefout onopgemerkt laten. */
export const STEMMEN = ["Kore", "Puck", "Charon", "Fenrir", "Aoede"] as const;

/** Standaardduur van een zelf geplaatst blok, in minuten. De auteur past hem aan. */
export const EIGEN_MINUTEN = 2;

/**
 * De xAPI-werkwoorden, uit `@ob/schema`.
 *
 * Bewust niet overgetypt: `packages/xapi-runtime` bouwt de statements met dezelfde constante, en
 * twee lijsten die gelijk moeten blijven lopen uiteen. Zie CLAUDE.md — statements komen alleen uit
 * de runtime.
 */
export const XAPI_WERKWOORDEN: { iri: string; naam: string; uitleg: string }[] = [
  { iri: VERBS.answered, naam: "answered", uitleg: "De cursist gaf antwoord op de vraag." },
  { iri: VERBS.experienced, naam: "experienced", uitleg: "De cursist heeft het blok gezien." },
  { iri: VERBS.completed, naam: "completed", uitleg: "De cursist rondde het blok af." },
  { iri: VERBS.passed, naam: "passed", uitleg: "De cursist haalde de norm." },
  { iri: VERBS.failed, naam: "failed", uitleg: "De cursist haalde de norm niet." },
];

/** Wat een nieuwe kennischeck standaard meldt. Een vraag beantwoorden is `answered`. */
export const STANDAARD_WERKWOORD = VERBS.answered;

/* ---------------------------------------------------------------- knopen maken */

export function nieuwKnoopId(knopen: Knoop[]): string {
  const hoogste = knopen.reduce((max, k) => {
    const n = Number(/^b(\d+)$/.exec(k.id)?.[1]);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `b${hoogste + 1}`;
}

/**
 * Een nieuwe stabiele identiteit.
 *
 * `crypto.randomUUID` is beschikbaar in Node 19+ en in browsers op een beveiligde oorsprong
 * (localhost telt mee). Overal waar de uitkomst uitmaakt is hij injecteerbaar, zodat tests
 * herhaalbaar blijven.
 */
export function nieuwSeed(): string {
  return crypto.randomUUID();
}

export function nieuweKnoop(
  soort: KnoopSoort,
  x: number,
  y: number,
  id: string,
  seed: string = nieuwSeed(),
): Knoop {
  const basis: Knoop = {
    id,
    seed,
    soort,
    // Eén bron voor het woord: palet, pil op de kaart en standaardtitel zeggen hetzelfde.
    titel: `Nieuwe ${CATEGORIE_LABEL[soort].toLowerCase()}`,
    fragment: "",
    index: null,
    eigen: true,
    minuten: NIVEAU[soort] === "inhoud" ? EIGEN_MINUTEN : 0,
    // Een leeg blok is niet af. Dat is geen straf maar informatie: het statusbolletje op de kaart
    // en de controlelijst horen te laten zien dat hier nog werk ligt.
    klaar: false,
    x: Math.max(0, x),
    y: Math.max(0, y),
  };
  if (soort === "toets") {
    return { ...basis, xapiWerkwoord: STANDAARD_WERKWOORD, vraagvorm: "meerkeuze" };
  }
  if (soort === "reflectie") {
    return { ...basis, xapiWerkwoord: VERBS.answered, aiBeoordeling: false };
  }
  // 70% is de norm die de meeste organisaties hanteren; de auteur past hem aan.
  if (soort === "assessment") return { ...basis, xapiWerkwoord: VERBS.passed, norm: 70 };
  if (soort === "ai") return { ...basis, prompt: "" };
  if (soort === "video") {
    return { ...basis, prompt: "", beeldverhouding: "16:9", resolutie: "720p" };
  }
  if (soort === "audio") return { ...basis, prompt: "", stem: STEMMEN[0]! };
  if (soort === "afbeelding") return { ...basis, prompt: "" };
  // Een citaat draagt zijn tekst in `uitvoer`, net als elk ander zelf geplaatst inhoudsblok; de
  // bronvermelding staat ernaast omdat ze in de export een eigen veld is.
  if (soort === "citaat") return { ...basis, uitvoer: "", bronvermelding: "" };
  // Een carrousel begint met twee stappen. Eén stap is geen carrousel, en de auteur laten beginnen
  // met een lege lijst betekent dat het blok pas iets doet na twee handelingen die hij zelf moet
  // bedenken.
  if (soort === "carrousel") {
    return {
      ...basis,
      items: [
        { id: "i1", kop: "", tekst: "" },
        { id: "i2", kop: "", tekst: "" },
      ],
    };
  }
  if (NIVEAU[soort] === "inhoud") return { ...basis, prompt: "", uitvoer: "" };
  return basis;
}

export function voegKnoopToe(
  leerpad: Leerpad,
  soort: KnoopSoort,
  x: number,
  y: number,
  seed: string = nieuwSeed(),
): Leerpad {
  const knoop = nieuweKnoop(soort, x, y, nieuwKnoopId(leerpad.knopen), seed);
  return { ...leerpad, knopen: [...leerpad.knopen, knoop] };
}

/**
 * Zet een blok als **nieuwe pagina onderaan** neer.
 *
 * Waar op het canvas geklikt of losgelaten is doet er niet toe: een nieuw blok is een nieuwe
 * pagina, en pagina's staan van boven naar onder op volgorde. Onderaan is dus de enige plek die
 * niets verstoort van wat er al staat. Wil de auteur het blok bij een bestaande pagina, dan sleept
 * hij een schakel — en dan schuift de auto-layout het vanzelf die rij in.
 */
export function voegPaginaToe(
  leerpad: Leerpad,
  soort: KnoopSoort,
  onderkant: number,
  seed: string = nieuwSeed(),
): { leerpad: Leerpad; id: string } {
  const id = nieuwKnoopId(leerpad.knopen);
  const knoop = nieuweKnoop(soort, KANT_MARGE, onderkant, id, seed);
  return { leerpad: { ...leerpad, knopen: [...leerpad.knopen, knoop] }, id };
}

/**
 * Vult ontbrekende seeds aan.
 *
 * Nodig voor projecten die bewaard zijn vóórdat seeds bestonden, en als vangnet voor elke andere
 * route waarlangs een knoop zonder identiteit binnenkomt. Idempotent: een knoop die er al een
 * heeft houdt hem, want anders verschuift de identiteit bij elke keer openen — precies wat dit
 * hoort te voorkomen.
 */
export function voorzieVanSeeds(leerpad: Leerpad, maak: () => string = nieuwSeed): Leerpad {
  if (leerpad.knopen.every((k) => typeof k.seed === "string" && k.seed.length > 0)) return leerpad;
  return {
    ...leerpad,
    knopen: leerpad.knopen.map((k) =>
      typeof k.seed === "string" && k.seed.length > 0 ? k : { ...k, seed: maak() },
    ),
  };
}

/**
 * Verwijdert een knoop en **heelt de keten**: zat hij ertussen, dan wordt zijn voorganger aan zijn
 * opvolger geknoopt — mits die schakel is toegestaan. Zonder dat valt de pagina in twee stukken
 * uiteen bij het weghalen van één blok, en dat is nooit wat iemand bedoelt.
 */
export function verwijderKnoop(leerpad: Leerpad, id: string): Leerpad {
  const weg = leerpad.knopen.find((k) => k.id === id);
  const inkomend = leerpad.verbindingen.find((v) => v.naar === id);
  const uitgaand = leerpad.verbindingen.find((v) => v.van === id);
  let verbindingen = leerpad.verbindingen.filter((v) => v.van !== id && v.naar !== id);

  const van = leerpad.knopen.find((k) => k.id === inkomend?.van);
  const naar = leerpad.knopen.find((k) => k.id === uitgaand?.naar);
  if (van && naar && van.id !== naar.id && magVerbinden(van, naar)) {
    verbindingen = [
      ...verbindingen,
      { id: nieuwVerbindingId(verbindingen), van: van.id, naar: naar.id },
    ];
  }

  // Was dit de kop van een pagina, dan erft zijn opvolger de identiteit en de titel. Zonder dat
  // krijgt de pagina een andere IRI omdat er een blok is weggehaald, en dan valt de historie in de
  // LRS in tweeën zonder dat iemand daar iets over gezegd heeft.
  let knopen = leerpad.knopen.filter((k) => k.id !== id);
  if (weg && isInhoud(weg) && !van && naar && isInhoud(naar)) {
    knopen = knopen.map((k) => (k.id === naar.id ? metPaginaIdentiteit(k, weg) : k));
  }
  return { knopen, verbindingen };
}

/**
 * Geeft de pagina-identiteit van `bron` door aan `doel`.
 *
 * Alleen wat er wérkelijk is: draagt de bron geen eigen titel, dan krijgt het doel er ook geen —
 * anders zou een lege override een latere blokttitel gaan blokkeren.
 */
function metPaginaIdentiteit(doel: Knoop, bron: Knoop): Knoop {
  const eigen = (bron.paginaTitel ?? "").trim();
  return {
    ...doel,
    paginaSeed: bron.paginaSeed || bron.seed,
    ...(eigen ? { paginaTitel: eigen } : {}),
  };
}

/**
 * Draagt dit blok iets visueels? Dan is er een tekstalternatief nodig — en niet alleen bij het
 * exporteren.
 *
 * Geluid telt niet mee: daar helpt geen alt-tekst maar een transcript. Dat is dezelfde grens die
 * `publishBlockers()` in `@ob/schema` trekt; hier staat hij zodat de auteur het ziet terwijl hij
 * bouwt in plaats van bij het exporteren.
 */
export function ontbrekendeAlt(knoop: Knoop): string[] {
  const leeg = (t: string | undefined) => (t ?? "").trim().length === 0;
  const uit: string[] = [];
  const visueel = knoop.soort === "afbeelding" || knoop.soort === "video";
  if (visueel && knoop.bestand && leeg(knoop.bestand.alt)) uit.push(knoop.titel || "dit blok");
  (knoop.items ?? []).forEach((item, i) => {
    if (item.bestand && leeg(item.bestand.alt)) uit.push(item.kop.trim() || `stap ${i + 1}`);
  });
  return uit;
}

function altCompleet(knoop: Knoop): boolean {
  return ontbrekendeAlt(knoop).length === 0;
}

export function wijzigKnoop(leerpad: Leerpad, id: string, patch: Partial<Knoop>): Leerpad {
  return {
    ...leerpad,
    knopen: leerpad.knopen.map((k) => {
      if (k.id !== id) return k;
      const bij = { ...k, ...patch };
      // Voor een zelf geplaatst blok is "af" gewoon: heeft het een titel en een toelichting.
      // Structuurknopen dragen geen tekst en zijn af zodra ze een titel hebben.
      if (!bij.eigen) return bij;
      const heeftTitel = bij.titel.trim().length > 0;
      const inhoud = NIVEAU[bij.soort] === "inhoud";
      // Een inhoudsblok is af zodra het iets te zeggen heeft: een toelichting, een opdracht of een
      // uitvoer. Alleen op `fragment` kijken zou een blok dat een volle prompt heeft niet-af noemen.
      const heeftInhoud =
        bij.fragment.trim().length > 0 ||
        (bij.prompt ?? "").trim().length > 0 ||
        (bij.uitvoer ?? "").trim().length > 0 ||
        // Een carrousel draagt zijn inhoud in de stappen. Alleen naar de tekstvelden kijken zou
        // een volledig ingevulde carrousel niet-af noemen.
        (bij.items ?? []).some((i) => i.kop.trim().length > 0 || i.tekst.trim().length > 0);
      // Beeld zonder tekstalternatief is niet af. Zonder deze regel meldt de kaart "klaar" en
      // struikelt de export er later alsnog over — dan is de auteur al doorgelopen naar iets
      // anders en moet hij terugzoeken waar het aan lag.
      return { ...bij, klaar: heeftTitel && (!inhoud || heeftInhoud) && altCompleet(bij) };
    }),
  };
}

/**
 * Waarmee de mediazoeker opent voor dit blok.
 *
 * De prompt zegt het preciest, de toelichting daarna. De titel telt alleen mee als de auteur hem
 * zelf gekozen heeft: een verse knoop heet "Nieuwe afbeelding", en daarmee openen betekent dat het
 * venster meteen zoekt naar iets wat gegarandeerd niets oplevert — en een leeg resultaat ziet er
 * hetzelfde uit als een kapotte koppeling.
 */
export function zoekvoorstel(knoop: Knoop): string {
  const standaard = `Nieuwe ${CATEGORIE_LABEL[knoop.soort].toLowerCase()}`;
  const titel = knoop.titel.trim();
  return (
    (knoop.prompt ?? "").trim() ||
    knoop.fragment.trim() ||
    (titel && titel !== standaard ? titel : "")
  );
}

/* ------------------------------------------------------- carrousel-stappen */

/**
 * De stappen van een carrousel, als pure lijstbewerkingen.
 *
 * Los van React en los van de graaf: de aanroeper doet er `wijzigKnoop(..., { items })` mee. Zo is
 * de volgorde-logica te testen zonder een component te monteren, en dat is waar dit soort code stil
 * fout gaat — een item dat na verplaatsen twee keer in de lijst staat ziet er in de UI hetzelfde
 * uit tot je exporteert.
 */

/** Een id dat nog niet bezet is. Oplopend, dus voorspelbaar in tests en in de export. */
export function vrijItemId(items: CarrouselItem[]): string {
  const bezet = new Set(items.map((i) => i.id));
  let n = 1;
  while (bezet.has(`i${n}`)) n += 1;
  return `i${n}`;
}

export function metNieuwItem(items: CarrouselItem[]): CarrouselItem[] {
  return [...items, { id: vrijItemId(items), kop: "", tekst: "" }];
}

export function metGewijzigdItem(
  items: CarrouselItem[],
  itemId: string,
  patch: Partial<CarrouselItem>,
): CarrouselItem[] {
  return items.map((i) => (i.id === itemId ? { ...i, ...patch } : i));
}

/**
 * Een stap weghalen.
 *
 * De laatste twee blijven staan: onder de twee is het geen carrousel meer, en de export weigert
 * hem dan. Dat hier tegenhouden is vriendelijker dan het bij het exporteren pas melden.
 */
export function zonderItem(items: CarrouselItem[], itemId: string): CarrouselItem[] {
  if (items.length <= 2) return items;
  return items.filter((i) => i.id !== itemId);
}

/** Een stap één plek op of neer. Buiten de lijst gebeurt er niets. */
export function metVerplaatstItem(
  items: CarrouselItem[],
  itemId: string,
  richting: -1 | 1,
): CarrouselItem[] {
  const van = items.findIndex((i) => i.id === itemId);
  const naar = van + richting;
  if (van < 0 || naar < 0 || naar >= items.length) return items;
  const uit = [...items];
  const [item] = uit.splice(van, 1);
  uit.splice(naar, 0, item!);
  return uit;
}

/** Duur van een blok bijstellen. Blijft heel, zodat het totaal niet gaat liegen. */
export function zetMinuten(leerpad: Leerpad, id: string, minuten: number): Leerpad {
  return wijzigKnoop(leerpad, id, { minuten: Math.max(1, Math.min(240, Math.round(minuten))) });
}

/* -------------------------------------------------------------------- schakels */

export function nieuwVerbindingId(verbindingen: Verbinding[]): string {
  const hoogste = verbindingen.reduce((max, v) => {
    const n = Number(/^k(\d+)$/.exec(v.id)?.[1]);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `k${hoogste + 1}`;
}

/**
 * Kan je van `van` bij `naar` komen? Volgt **alle** uitgaande schakels, want met vertakkingen is
 * het pad geen ketting meer. Voor de luscontrole.
 */
export function bereikbaar(verbindingen: Verbinding[], van: string, naar: string): boolean {
  const uit = new Map<string, string[]>();
  for (const v of verbindingen) uit.set(v.van, [...(uit.get(v.van) ?? []), v.naar]);
  const bezocht = new Set<string>([van]);
  const stapel = [van];
  while (stapel.length > 0) {
    const hier = stapel.pop()!;
    for (const volgende of uit.get(hier) ?? []) {
      if (volgende === naar) return true;
      if (bezocht.has(volgende)) continue;
      bezocht.add(volgende);
      stapel.push(volgende);
    }
  }
  return false;
}

/**
 * Knoopt twee knopen aan elkaar.
 *
 * Een tweede uitgaande inhoudsschakel wordt **geweigerd** en niet stil vervangen: de auteur denkt
 * dan te splitsen, en een vervanging zou zijn vorige schakel weggooien zonder dat hij het ziet. De
 * UI vraagt daarom eerst `verbindingsBezwaar` en toont de reden bij de cursor.
 *
 * De vertakking is de uitzondering die mág splitsen — dat is zijn hele functie.
 */
export function verbindKnopen(leerpad: Leerpad, vanId: string, naarId: string): Leerpad {
  const van = leerpad.knopen.find((k) => k.id === vanId);
  const naar = leerpad.knopen.find((k) => k.id === naarId);
  if (!van || !naar) return leerpad;
  if (verbindingsBezwaar(van, naar, leerpad)) return leerpad;
  if (leerpad.verbindingen.some((v) => v.van === vanId && v.naar === naarId)) return leerpad;

  const soortVan = niveauVan(van);

  // Alleen de vertakking houdt meerdere uitgangen; bij de rest vervangt de nieuwe schakel de oude.
  // Voor inhoud kan dat geval hier niet meer voorkomen (het bezwaar hierboven ving het af), maar
  // een AI-knoop mag zijn doel wél verleggen.
  const overig = leerpad.verbindingen.filter(
    (v) => soortVan === "vertakking" || v.van !== vanId,
  );

  const nieuw: Verbinding = { id: nieuwVerbindingId(leerpad.verbindingen), van: vanId, naar: naarId };
  // Een tak uit een vertakking krijgt meteen een voorwaarde: eerst "geslaagd", dan "gezakt".
  if (soortVan === "vertakking") {
    const bestaand = leerpad.verbindingen.filter((v) => v.van === vanId).length;
    nieuw.voorwaarde =
      bestaand === 0
        ? { soort: "geslaagd" }
        : bestaand === 1
          ? { soort: "gezakt" }
          : { soort: "keuze", label: `Keuze ${bestaand + 1}` };
  }

  let knopen = leerpad.knopen;
  // Een blok vóór een kop zetten voegt dat blok bij die pagina; het maakt er geen nieuwe. Dus
  // reizen de identiteit en de overschreven titel mee naar de nieuwe kop. Zonder deze regel zou
  // een blok toevoegen de pagina hernoemen en haar IRI veranderen — twee dingen waar niemand om
  // vroeg. De keten van één blok is de enige die dit doet: worden twee gevulde pagina's
  // samengevoegd, dan wint de kop die vooropgaat.
  if (isInhoud(van) && isInhoud(naar) && !leerpad.verbindingen.some((v) => v.naar === vanId)) {
    const enkel = !leerpad.verbindingen.some(
      (v) => v.van === vanId && isInhoudsSchakel(leerpad, v),
    );
    if (enkel) {
      knopen = knopen.map((k) => (k.id === vanId ? metPaginaIdentiteit(k, naar) : k));
    }
  }
  return { knopen, verbindingen: [...overig, nieuw] };
}

export function verbreekVerbinding(leerpad: Leerpad, id: string): Leerpad {
  return { ...leerpad, verbindingen: leerpad.verbindingen.filter((v) => v.id !== id) };
}

/** Sleutel om twee voorwaarden te vergelijken: een keuze onderscheidt zich op zijn label. */
export function voorwaardeSleutel(v: Voorwaarde | undefined): string {
  if (!v) return "altijd";
  return v.soort === "keuze" ? `keuze:${v.label.trim().toLowerCase()}` : v.soort;
}

export function voorwaardeTekst(v: Voorwaarde | undefined): string {
  if (!v || v.soort === "altijd") return "altijd";
  if (v.soort === "geslaagd") return "geslaagd";
  if (v.soort === "gezakt") return "gezakt";
  return v.label.trim() || "keuze zonder naam";
}

export function zetVoorwaarde(leerpad: Leerpad, id: string, voorwaarde: Voorwaarde): Leerpad {
  return {
    ...leerpad,
    verbindingen: leerpad.verbindingen.map((v) => (v.id === id ? { ...v, voorwaarde } : v)),
  };
}

/* ------------------------------------------------------- afleiden uit de graaf */

function volgers(leerpad: Leerpad, id: string): Verbinding[] {
  return leerpad.verbindingen.filter((v) => v.van === id);
}

function knoopVan(leerpad: Leerpad, id: string): Knoop | undefined {
  return leerpad.knopen.find((k) => k.id === id);
}

/** Het blok dat een AI-knoop schrijft, of null als hij nog nergens op gericht is. */
export function aiDoel(leerpad: Leerpad, aiId: string): Knoop | null {
  const schakel = volgers(leerpad, aiId)[0];
  return schakel ? (knoopVan(leerpad, schakel.naar) ?? null) : null;
}

/**
 * De checks die bij dit assessment horen: de kennischecks en reflecties die er op dezelfde pagina
 * vóór staan, tot aan het vorige assessment.
 *
 * Afgeleid uit de keten en niet uit losse lidmaatschapsschakels: zo kan er geen assessment bestaan
 * dat checks claimt die op een heel ander scherm staan.
 */
export function assessmentChecks(leerpad: Leerpad, assessmentId: string): Knoop[] {
  const pagina = paginasVan(leerpad).find((p) =>
    p.onderdelen.some((k) => k.id === assessmentId),
  );
  if (!pagina) return [];
  const index = pagina.onderdelen.findIndex((k) => k.id === assessmentId);
  const checks: Knoop[] = [];
  for (let i = index - 1; i >= 0; i -= 1) {
    const k = pagina.onderdelen[i]!;
    if (k.soort === "assessment") break;
    if (k.soort === "toets" || k.soort === "reflectie") checks.unshift(k);
  }
  return checks;
}

/** De geschatte doorlooptijd van de hele cursus. */
export function totaleMinuten(leerpad: Leerpad): number {
  return paginasVan(leerpad).reduce(
    (som, p) => som + p.onderdelen.reduce((a, k) => a + k.minuten, 0),
    0,
  );
}

/* --------------------------------------------------------------- waar tekst staat */

/**
 * Waar de tekst van een knoop wérkelijk staat.
 *
 * Dit bestaat omdat er twee bronnen zijn, en dat is precies één te veel geweest: een blok uit de
 * generator draagt zijn tekst in `content` (en wordt daar bewerkt), een zelf geplaatst blok draagt
 * hem op de knoop. Toen de kaart een eigen uitvoerveld kreeg, ging die naar `knoop.uitvoer` kijken
 * — ook bij contentblokken. Gevolg: de kaart van een gevulde module stond leeg, en wie erin typte
 * veranderde niets aan wat de cursist leest.
 *
 * Eén functie die zegt waar de tekst hoort, en twee die hem daar lezen en schrijven. De kaart weet
 * het verschil niet meer, en dan kan hij ook niet meer de verkeerde kant op wijzen.
 */
export type Tekstbron =
  | { soort: "knoop" }
  | { soort: "intro" }
  | { soort: "samenvatting" }
  | { soort: "sectie"; index: number }
  /** Een gegenereerde open vraag: zijn tekst staat in `content.vragen[index].vraag`. */
  | { soort: "vraag"; index: number };

export function tekstbron(knoop: Knoop): Tekstbron | null {
  // Eerst `eigen`: een zelf geplaatst blok draagt zijn tekst altijd zelf, wat zijn soort ook is.
  if (knoop.eigen) return NIVEAU[knoop.soort] === "inhoud" ? { soort: "knoop" } : null;
  // `bron` is de expliciete markering voor de twee contentvelden die geen sectie zijn. Zonder die
  // markering zouden ze na het verdwijnen van de aparte knooptypes niet meer te onderscheiden zijn.
  if (knoop.bron === "intro") return { soort: "intro" };
  if (knoop.bron === "samenvatting") return { soort: "samenvatting" };
  if (knoop.soort === "uitleg" && knoop.index !== null) {
    return { soort: "sectie", index: knoop.index };
  }
  // Een gegenereerde reflectie is een open vraag uit `content.vragen`. Hij leest daar zijn tekst,
  // net als een sectie: zo blijft er één plek waar die tekst staat en werkt het bewerken in de
  // blokkenlijst gewoon. Zou hij hem op de knoop dragen, dan liepen de twee uiteen zodra iemand
  // er één van aanpast.
  if (knoop.soort === "reflectie" && knoop.index !== null) {
    return { soort: "vraag", index: knoop.index };
  }
  return null;
}

/** De tekst van een knoop, uit de bron waar hij hoort. `null` = deze knoop draagt geen tekst. */
export function leesTekst(knoop: Knoop, content: GeneratedContent): string | null {
  const bron = tekstbron(knoop);
  if (!bron) return null;
  if (bron.soort === "knoop") return knoop.uitvoer ?? "";
  if (bron.soort === "intro") return content.intro;
  if (bron.soort === "samenvatting") return content.samenvatting;
  if (bron.soort === "vraag") return content.vragen[bron.index]?.vraag ?? "";
  return content.secties[bron.index]?.tekst ?? "";
}

/**
 * De content mét de nieuwe tekst erin.
 *
 * `null` betekent: deze tekst hoort niet in de content maar op de knoop zelf — de aanroeper moet
 * dan `wijzigKnoop(..., { uitvoer })` doen. Bewust geen functie die beide kanten op schrijft: dan
 * zou hij twee soorten state moeten aanraken en is hij niet meer puur.
 */
export function contentMetTekst(
  knoop: Knoop,
  content: GeneratedContent,
  tekst: string,
): GeneratedContent | null {
  const bron = tekstbron(knoop);
  if (!bron || bron.soort === "knoop") return null;
  if (bron.soort === "intro") return { ...content, intro: tekst };
  if (bron.soort === "samenvatting") return { ...content, samenvatting: tekst };
  if (bron.soort === "vraag") {
    if (!content.vragen[bron.index]) return null;
    return {
      ...content,
      vragen: content.vragen.map((v, i) => (i === bron.index ? { ...v, vraag: tekst } : v)),
    };
  }
  const sectie = content.secties[bron.index];
  if (!sectie) return null;
  return {
    ...content,
    secties: content.secties.map((s, i) => (i === bron.index ? { ...s, tekst } : s)),
  };
}

/* ------------------------------------------------------------------ dupliceren */

/** Hoe ver onder de laatste keten de kopie komt te liggen. */
export const KOPIE_AFSTAND = 96;

/**
 * Kopieert een hele pagina — de keten met al haar onderdelen — en legt hem als nieuwe rij eronder.
 *
 * "Eronder" en niet "ernaast": de paginavolgorde volgt de verticale positie, dus onder betekent
 * hier letterlijk "hierna in de cursus". De kopie hangt aan niets: hij is een eigen pagina, en de
 * auteur bepaalt zelf of en waar hij hem inhaakt.
 */
export function dupliceerKeten(
  leerpad: Leerpad,
  knoopId: string,
  maakSeed: () => string = nieuwSeed,
): Leerpad {
  const pagina = paginasVan(leerpad).find((p) =>
    p.onderdelen.some((k) => k.id === knoopId),
  );
  if (!pagina) return leerpad;

  // De onderkant van álles, niet alleen van deze keten: de kopie moet onder de hele cursus komen,
  // anders duikt hij middenin de volgorde op.
  const onderkant = leerpad.knopen.reduce((max, k) => Math.max(max, k.y), 0);
  const rijY = onderkant + KOPIE_AFSTAND;

  let volgend = leerpad;
  const kaart = new Map<string, string>();
  pagina.onderdelen.forEach((bron, kolom) => {
    const id = nieuwKnoopId(volgend.knopen);
    kaart.set(bron.id, id);
    volgend = {
      ...volgend,
      knopen: [
        ...volgend.knopen,
        {
          ...bron,
          id,
          // Een kopie is een ánder blok, geen nieuwe versie van hetzelfde. De seed meekopiëren zou
          // de LRS twee blokken als één laten tellen.
          seed: maakSeed(),
          // En een andere pagina: de kopie erft de identiteit van het origineel niet.
          paginaSeed: undefined,
          index: null,
          // De kopie is auteurswerk, ook als het origineel uit de gegenereerde content kwam: hij
          // hoort niet meer bij te lopen met een sectie die hij niet ís.
          eigen: true,
          titel: `${bron.titel} (kopie)`,
          // Netjes als één rij neergelegd en niet als kopie van de oude plaatsing: het origineel
          // kan door de hele cursus verspreid liggen, en dan is de kopie geen leesbare pagina meer.
          x: KANT_MARGE + kolom * KOLOM_AFSTAND,
          y: rijY,
        },
      ],
    };
  });

  // Alleen de kop draagt de titel van de pagina, dus alleen daar heeft een overgenomen naam zin.
  const kopieKop = kaart.get(pagina.kop.id);
  if (kopieKop && pagina.eigenTitel) {
    volgend = wijzigKnoop(volgend, kopieKop, { paginaTitel: `${pagina.titel} (kopie)` });
  }

  for (let i = 0; i < pagina.onderdelen.length - 1; i += 1) {
    const van = kaart.get(pagina.onderdelen[i]!.id);
    const naar = kaart.get(pagina.onderdelen[i + 1]!.id);
    if (van && naar) volgend = verbindKnopen(volgend, van, naar);
  }
  return volgend;
}

/** Zet of wist de overschreven paginatitel. Werkt op de kop van de keten waar dit blok in zit. */
export function zetPaginaTitel(leerpad: Leerpad, knoopId: string, titel: string): Leerpad {
  const pagina = paginasVan(leerpad).find((p) =>
    p.onderdelen.some((k) => k.id === knoopId),
  );
  if (!pagina) return leerpad;
  const schoon = titel.trim();
  return {
    ...leerpad,
    knopen: leerpad.knopen.map((k) => {
      if (k.id !== pagina.kop.id) return k;
      // Leeg betekent "terug naar de titel van het eerste blok", niet "een lege naam".
      const { paginaTitel: _weg, ...rest } = k;
      return schoon ? { ...rest, paginaTitel: schoon } : rest;
    }),
  };
}

/* ------------------------------------------------------------------- controle */

/**
 * Wat er nog aan de graaf mankeert.
 *
 * Wat hier niet meer in staat is net zo belangrijk als wat er wel in staat. "Er is geen cursusknoop",
 * "pagina heeft geen inhoud" en "loopt geen pagina in" zijn verdwenen: die klaagden over een
 * structuur die het gereedschap zélf eiste. In het huidige model hoort elk blok bij een pagina en
 * bestaat een lege pagina niet, dus die drie kunnen niet meer voorkomen.
 */
export type ProbleemCode =
  | "cyclus"
  | "leeg-blok"
  | "vertakking-te-smal"
  | "dubbele-voorwaarde"
  | "ai-zonder-doel"
  | "kennischeck-zonder-werkwoord"
  | "beeld-zonder-alt";

export interface Probleem {
  code: ProbleemCode;
  bericht: string;
  /** `blokkeert` = er valt geen leesvolgorde uit te lezen. `let-op` = de auteur mag dit weten. */
  ernst: "blokkeert" | "let-op";
  knoopId?: string;
}

export function controleerLeerpad(leerpad: Leerpad): Probleem[] {
  const problemen: Probleem[] = [];

  // Een kring heeft geen begin, dus ook geen leesvolgorde. `verbindKnopen` laat er geen ontstaan;
  // dit vangt gemigreerde en met de hand bewerkte bestanden af.
  const { cyclisch } = paginamodel(leerpad);
  for (const k of cyclisch) {
    problemen.push({
      code: "cyclus",
      ernst: "blokkeert",
      knoopId: k.id,
      bericht: `"${k.titel}" zit in een kring van blokken die naar elkaar terugwijzen. Verbreek één schakel om de volgorde te herstellen.`,
    });
  }

  for (const k of leerpad.knopen) {
    // Eerst het concrete bezwaar, dan pas het algemene. "Nog niet af" naast "mist alt-tekst" laat
    // de auteur zoeken naar een tweede probleem dat er niet is.
    const zonderAlt = ontbrekendeAlt(k);
    if (zonderAlt.length > 0) {
      problemen.push({
        code: "beeld-zonder-alt",
        // Blokkeert echt: `publishBlockers()` weigert het pakket hierop, dus dit is geen advies.
        ernst: "blokkeert",
        knoopId: k.id,
        bericht:
          zonderAlt.length === 1 && zonderAlt[0] === (k.titel || "dit blok")
            ? `"${k.titel}" heeft beeld zonder alt-tekst. Zonder die beschrijving kan de module niet gepubliceerd worden.`
            : `In "${k.titel}" mist alt-tekst bij: ${zonderAlt.join(", ")}. Zonder die beschrijving kan de module niet gepubliceerd worden.`,
      });
    } else if (!k.klaar && !isOnaangeroerd(k)) {
      problemen.push({
        code: "leeg-blok",
        ernst: "let-op",
        knoopId: k.id,
        bericht: `"${k.titel}" is nog niet af.`,
      });
    }
    if (k.soort === "vertakking") {
      const uit = volgers(leerpad, k.id);
      if (uit.length < 2) {
        problemen.push({
          code: "vertakking-te-smal",
          ernst: "blokkeert",
          knoopId: k.id,
          bericht: `Vertakking "${k.titel}" heeft ${uit.length} uitgang(en). Een splitsing heeft er minstens twee.`,
        });
      }
      const gezien = new Set<string>();
      for (const v of uit) {
        const w = voorwaardeSleutel(v.voorwaarde);
        if (gezien.has(w)) {
          problemen.push({
            code: "dubbele-voorwaarde",
            ernst: "blokkeert",
            knoopId: k.id,
            bericht: `Vertakking "${k.titel}" heeft twee takken voor "${voorwaardeTekst(v.voorwaarde)}". Dan is niet bepaald welke gevolgd wordt.`,
          });
          break;
        }
        gezien.add(w);
      }
    }
    if (k.soort === "ai" && !aiDoel(leerpad, k.id)) {
      problemen.push({
        code: "ai-zonder-doel",
        ernst: "let-op",
        knoopId: k.id,
        bericht: `AI-knoop "${k.titel}" wijst nog geen blok aan om te schrijven.`,
      });
    }
    if (k.soort === "toets" && !k.xapiWerkwoord) {
      problemen.push({
        code: "kennischeck-zonder-werkwoord",
        ernst: "let-op",
        knoopId: k.id,
        bericht: `Kennischeck "${k.titel}" heeft geen xAPI-werkwoord, dus er wordt niets over gemeld.`,
      });
    }
  }

  const gezien = new Set<string>();
  return problemen.filter((p) => {
    const sleutel = `${p.code}|${p.knoopId ?? ""}`;
    if (gezien.has(sleutel)) return false;
    gezien.add(sleutel);
    return true;
  });
}

/**
 * Is dit blok nog precies zoals het uit het palet kwam?
 *
 * Zo'n blok meldt niets. Een verse module bestaat uit één leeg blok, en die begroeten met "is nog
 * niet af" is het gereedschap dat klaagt over zijn eigen beginsituatie. Zodra de auteur er een
 * titel of een woord in zet telt hij mee — dan is half af ook echt half af. Het statusbolletje op
 * de kaart blijft wél staan; dat beschrijft, het maant niet.
 */
function isOnaangeroerd(knoop: Knoop): boolean {
  if (!knoop.eigen) return false;
  const leeg = (t: string | undefined) => (t ?? "").trim().length === 0;
  return (
    knoop.titel === `Nieuwe ${CATEGORIE_LABEL[knoop.soort].toLowerCase()}` &&
    leeg(knoop.fragment) &&
    leeg(knoop.prompt) &&
    leeg(knoop.uitvoer) &&
    !knoop.bestand &&
    (knoop.items ?? []).every((i) => leeg(i.kop) && leeg(i.tekst))
  );
}

/* ---------------------------------------------------- bouwen uit de content */

/**
 * De eerste graaf uit de gegenereerde content: één keten, dus één pagina.
 *
 * Er komt geen container omheen. De keten *is* de pagina, dus wat de generator oplevert staat
 * meteen als pagina in het structuurpaneel — zonder waarschuwing en zonder dat de auteur eerst
 * iets moet aanklikken.
 *
 * Bewust één pagina en geen pagina per sectie: uit de content valt niet af te leiden waar een
 * schermovergang hoort. Dat is een keuze van de auteur, en die maakt hij door een schakel te
 * verbreken of een keten te verslepen.
 */
export function leerpadUitContent(
  content: GeneratedContent,
  maakSeed: () => string = nieuwSeed,
): Leerpad {
  // Een lege module begint met één leeg blok linksboven en verder niets. Geen voorgeschakelde
  // tweede knoop en geen alvast gelegde schakel: dat zou structuur suggereren die de auteur niet
  // heeft gemaakt, en hij moet hem dan eerst afbreken voordat hij kan beginnen.
  if (isLegeContent(content)) {
    return {
      knopen: [nieuweKnoop("uitleg", KANT_MARGE, KANT_MARGE, "b1", maakSeed())],
      verbindingen: [],
    };
  }
  const { knopen, verbindingen } = bouwLeerpad(content, maakSeed);
  return { knopen, verbindingen };
}

/**
 * Trekt de graaf bij na een contentwijziging.
 *
 * De regel: **de content bepaalt de tekst, de auteur bepaalt de structuur.** Titels, fragmenten,
 * duur en klaar-status van contentblokken lopen mee; posities, schakels, pagina's en zelf
 * geplaatste knopen blijven staan.
 *
 * Nieuwe contentblokken komen er los bij en worden niet stil in een pagina geschoven. Een blok
 * ertussen proppen verandert een scherm zonder dat iemand daarom vroeg; de controlelijst meldt het.
 */
export function synchroniseerMetContent(
  leerpad: Leerpad,
  content: GeneratedContent,
  maakSeed: () => string = nieuwSeed,
): Leerpad {
  // De verse knopen krijgen een seed, maar alleen die van écht nieuwe blokken wordt gebruikt:
  // een bestaand blok houdt hieronder zijn eigen seed via de spread.
  const fris = bouwLeerpad(content, maakSeed).knopen;
  const frisPerId = new Map(fris.map((k) => [k.id, k]));

  const bijgewerkt: Knoop[] = [];
  for (const k of leerpad.knopen) {
    if (k.eigen) {
      bijgewerkt.push(k);
      continue;
    }
    const nieuw = frisPerId.get(k.id);
    if (!nieuw) continue; // het blok erachter bestaat niet meer
    bijgewerkt.push({
      ...k,
      titel: nieuw.titel,
      fragment: nieuw.fragment,
      minuten: nieuw.minuten,
      klaar: nieuw.klaar,
      index: nieuw.index,
    });
  }

  // Nieuwe contentblokken komen als eigen pagina onder de bestaande. Ze worden niet stil in een
  // bestaande keten geschoven: dat verandert een scherm waar niemand om vroeg. De auto-layout zet
  // ze daarna netjes op het raster; hier telt alleen dat ze ónder alles uitkomen.
  const bekend = new Set(bijgewerkt.map((k) => k.id));
  const onderkant = bijgewerkt.reduce((max, k) => Math.max(max, k.y), 0) + RIJ_HOOGTE;
  let rij = 0;
  for (const k of fris) {
    if (bekend.has(k.id)) continue;
    bijgewerkt.push({ ...k, x: KANT_MARGE, y: onderkant + rij * RIJ_HOOGTE });
    rij += 1;
  }

  let tussen: Leerpad = { knopen: bijgewerkt, verbindingen: leerpad.verbindingen };
  for (const weg of leerpad.knopen.filter((k) => !k.eigen && !frisPerId.has(k.id))) {
    const inkomend = tussen.verbindingen.find((v) => v.naar === weg.id);
    const uitgaand = tussen.verbindingen.find((v) => v.van === weg.id);
    let verbindingen = tussen.verbindingen.filter((v) => v.van !== weg.id && v.naar !== weg.id);
    const van = tussen.knopen.find((k) => k.id === inkomend?.van);
    const naar = tussen.knopen.find((k) => k.id === uitgaand?.naar);
    if (van && naar && van.id !== naar.id && magVerbinden(van, naar)) {
      verbindingen = [
        ...verbindingen,
        { id: nieuwVerbindingId(verbindingen), van: van.id, naar: naar.id },
      ];
    }
    tussen = { ...tussen, verbindingen };
  }

  const ids = new Set(tussen.knopen.map((k) => k.id));
  return {
    ...tussen,
    verbindingen: tussen.verbindingen.filter((v) => ids.has(v.van) && ids.has(v.naar)),
  };
}

/** Voor het schatten van de duur van een tekstblok dat de auteur zelf typte. */
export function schatUitFragment(fragment: string): number {
  return schatMinuten(fragment);
}
