/**
 * De gegenereerde module als leerpad op een canvas: van knoop naar knoop.
 *
 * Prism omschrijft zichzelf als een node-based e-learning app waarin leren van knoop naar knoop
 * over een canvas stroomt (DESIGN_SYSTEM.md). Dit is die weergave: de blokkenlijst laat zien
 * *wat* er staat, het whiteboard laat de *structuur* zien.
 *
 * Puur en los van React, want de layout- en verbindingslogica is het deel dat stil fout gaat:
 * een knoop die naar zichzelf verwijst, of een pad dat een blok overslaat.
 */
import { VERBS } from "@ob/schema";
import type { Bestand } from "./bestand";
import type { GeneratedContent, Vraag } from "./types";

/**
 * De soorten blokken op het canvas.
 *
 * `uitleg` en `toets` komen uit de gegenereerde content. `video`, `afbeelding` en `audio` zet de
 * auteur zelf op het canvas: dit product genereert die vormen nog niet, maar de pagina moet ze wél
 * kunnen bevatten.
 *
 * Er is geen `intro` of `samenvatting` meer. Dat waren aparte soorten voor "de eerste" en "de
 * laatste", terwijl welke pagina eerst komt nu uitsluitend uit de canvaspositie volgt. Een soort
 * die een plek claimt die hij niet kan afdwingen is een belofte die het gereedschap niet waarmaakt.
 */
export type KnoopSoort =
  // inhoud — wat de cursist ziet
  | "uitleg"
  | "toets"
  | "video"
  | "afbeelding"
  | "audio"
  | "citaat"
  | "carrousel"
  // interactie
  | "reflectie"
  | "assessment"
  // gereedschap — hoort niet bij wat de cursist ziet
  | "ai"
  // structuur
  | "sectie"
  | "vertakking";

/**
 * Een stap van een carrousel.
 *
 * Een eigen vorm en geen losse knopen: de spec zegt dat de component pas af is als álle items
 * bekeken zijn, en dat is een uitspraak over één ding. Vijf knopen op het canvas zouden vijf
 * pagina's worden en die belofte niet kunnen waarmaken.
 */
export interface CarrouselItem {
  /** Stabiel binnen dit blok; de export gebruikt hem als item-id. */
  id: string;
  kop: string;
  tekst: string;
  /** Het uitgelichte citaat onder de tekst. Optioneel. */
  citaat?: string;
  /** Het beeld naast de tekst. */
  bestand?: Bestand;
}

export interface Knoop {
  /**
   * Het id binnen dít document. Positioneel en vluchtig: `b1` van vandaag hoeft morgen niet
   * hetzelfde blok te zijn.
   */
  id: string;
  /**
   * De **stabiele** identiteit, een UUID, die over versies heen meegaat.
   *
   * Hier hangt de xAPI-identiteit aan: `iri.component(base, artifactId, seed)`. Zou de IRI van `id`
   * afhangen, dan wijst de historie in de LRS na een herbouw naar een ander blok — en dat merk je
   * pas als iemand een rapportage over een half jaar opvraagt. Wordt één keer toegekend en daarna
   * nooit meer gewijzigd; een kopie krijgt een nieuwe.
   */
  seed: string;
  soort: KnoopSoort;
  /** Korte titel op de knoop. */
  titel: string;
  /** Eén regel voorbeeldtekst, zodat de knoop iets zegt zonder open te klikken. */
  fragment: string;
  /** Index in `secties` of `vragen`; null voor de intro, de samenvatting en eigen knopen. */
  index: number | null;
  /**
   * Welk contentveld dit blok toont, als dat niet `secties[index]` is.
   *
   * De gegenereerde content heeft `intro` en `samenvatting` als losse velden naast `secties`. Toen
   * dat nog aparte knooptypes waren, was de soort de aanwijzing; nu zijn het gewone uitleg-blokken
   * en zou `soort === "uitleg" && index === null` niet meer te onderscheiden zijn — de kaart zou
   * dan naar het verkeerde veld schrijven. Vandaar deze expliciete markering: hij overleeft
   * hernoemen en er valt niets uit af te leiden wat er niet in staat.
   */
  bron?: "intro" | "samenvatting";
  /**
   * Het xAPI-werkwoord van een kennischeck. Komt uit `VERBS` in `@ob/schema` — niet uit een
   * overgetypte lijst, want dan lopen de authoring-kant en de runtime uit elkaar.
   */
  xapiWerkwoord?: string;
  /**
   * De invoer van de knoop: de instructie die zegt wat er gemaakt moet worden. Bij een audio-knoop
   * is dit het narratiescript.
   */
  prompt?: string;
  /**
   * De uitvoer: het resultaat, met de hand te bewerken.
   *
   * Bewust een eigen veld en niet `fragment`: `fragment` is de samenvattingsregel op de kaart, en
   * die overschrijven met een gegenereerde lap tekst maakt het canvas onleesbaar.
   */
  uitvoer?: string;
  /** Video: beeldverhouding en resolutie. Gaan mee in de export-briefing. */
  beeldverhouding?: string;
  resolutie?: string;
  /** Audio: welke stem het script inspreekt. */
  stem?: string;
  /**
   * Citaat: van wie het is.
   *
   * Niet `bron` — dat veld betekent al iets anders (welk contentveld dit blok toont) en twee
   * betekenissen op één naam is precies hoe een veld stil het verkeerde gaat doen.
   */
  bronvermelding?: string;
  /** Carrousel: de stappen, in de volgorde waarin de cursist ze krijgt. */
  items?: CarrouselItem[];
  /**
   * Het bestand dat de auteur van zijn apparaat koos.
   *
   * De `url` is een object-URL: die leeft in dít tabblad. Er is nog geen opslag, dus een bestand
   * overleeft geen herlaadbeurt en gaat niet mee in een export. Dat staat ook op de kaart, want
   * een auteur die dat pas bij het exporteren ontdekt is een auteur die werk kwijt is.
   */
  bestand?: Bestand;
  /** De vraagvorm van een kennischeck. */
  vraagvorm?: Vraagvorm;
  /** Laat een reflectie-antwoord door AI beoordelen. */
  aiBeoordeling?: boolean;
  /** Slagingsnorm van een assessment, in procenten. */
  norm?: number;
  /**
   * Heeft de auteur deze knoop zelf op het canvas gezet? Dan zit er geen content achter en zijn
   * `titel` en `fragment` hier de enige bron — ze worden dus niet overschreven bij een
   * contentwijziging (zie `synchroniseerMetContent`).
   */
  eigen: boolean;
  /**
   * De stabiele identiteit van de **pagina** waar dit blok de kop van is.
   *
   * Alleen betekenisvol op de kop van een keten; op elk ander blok slaapt hij. Bestaat omdat een
   * pagina geen knoop meer is en dus geen eigen seed heeft, terwijl de export er wel een IRI aan
   * hangt (`pages[].id`). Zou de pagina de seed van haar eerste blok lenen, dan kreeg ze een
   * andere identiteit zodra iemand er een blok vóór zet — en dat merk je pas als een rapportage
   * een half jaar later in tweeën valt.
   *
   * Afwezig betekent: gebruik de eigen `seed`. Zo hoeft een vers blok niets te dragen en krijgt
   * het toch een stabiele pagina-identiteit.
   */
  paginaSeed?: string;
  /**
   * De overschreven paginatitel. Ook alleen betekenisvol op de kop.
   *
   * Reist met `paginaSeed` mee als er een blok vóór de kop komt, zodat een titel die de auteur
   * zelf koos niet verdwijnt door een bewerking die er niets mee te maken heeft.
   */
  paginaTitel?: string;
  /** Geschatte doorlooptijd in minuten — zie `schatMinuten`. */
  minuten: number;
  /**
   * Is dit blok af? Geen decoratieve vinkje maar een echte controle: ontbrekende tekst,
   * te weinig antwoordopties of een `correct` buiten bereik maken een blok niet-af.
   */
  klaar: boolean;
  x: number;
  y: number;
}

/** Leestempo voor de tijdschatting. Gemiddelde stillezer zit rond de 200 woorden per minuut. */
export const WOORDEN_PER_MINUUT = 200;
/** Een meerkeuzevraag lezen, wegen en beantwoorden — schatting, geen meting. */
export const SECONDEN_PER_VRAAG = 45;

/**
 * Schat de doorlooptijd van een tekst in hele minuten, minimaal 1.
 *
 * Bewust een schatting uit het aantal woorden en niet een verzonnen getal: de kaart toont een
 * kloksymbool, en dan moet dat cijfer op iets berusten. Minimaal 1 omdat "0 min" niets zegt.
 */
export function schatMinuten(tekst: string, extraSeconden = 0): number {
  const woorden = tekst.trim().split(/\s+/).filter(Boolean).length;
  const seconden = (woorden / WOORDEN_PER_MINUUT) * 60 + extraSeconden;
  return Math.max(1, Math.round(seconden / 60));
}

/**
 * Een schakel in de reeks: dit blok komt op de pagina direct onder dat blok.
 *
 * De reeks is één doorlopend pad, geen boom. Daarom mag elk blok maximaal één uitgaande en één
 * inkomende schakel hebben — zie `verbindKnopen`, die dat afdwingt. Zou een blok twee uitgaande
 * schakels hebben, dan is de stapelvolgorde op de pagina niet meer bepaald, en dat is precies wat
 * dit model moet garanderen.
 */
/**
 * Wanneer een tak gevolgd wordt. Alleen betekenisvol op een schakel uit een vertakkingsknoop.
 *
 * De drie vallen samen met de betekenis van de Prism-paren: doorstromen is Flow, gehaald is Glow,
 * en een gezakt-tak is een zijspoor en dus Bloom.
 */
export type Voorwaarde =
  | { soort: "altijd" }
  | { soort: "geslaagd" }
  | { soort: "gezakt" }
  /** Scenario: de cursist koos deze optie. */
  | { soort: "keuze"; label: string };

/** De vraagvormen van een kennischeck — dezelfde die Storyline kent. */
export type Vraagvorm =
  | "meerkeuze"
  | "juist-onjuist"
  | "invullen"
  | "matchen"
  | "slepen"
  | "hotspot";

/**
 * De vraagvorm die het model opschreef, naar de vorm die dit product kent.
 *
 * Het model schrijft vrije tekst — "Meerkeuzevragen", "Juist/onjuist", "Waar of niet waar" — en
 * die hoort bij precies één van de vormen hieronder te landen. Terugvallen op meerkeuze is de
 * veilige kant op: dat is de vorm die de speler hoe dan ook kan tonen.
 *
 * **Alleen de twee vormen die het hele pad aankunnen.** Matchen, slepen, invullen en hotspot staan
 * wel in `Vraagvorm` — een auteur kan ze met de hand kiezen — maar de generator levert ze niet,
 * want de inhoud die eruit komt is altijd "kies er één van N". Zou dit hier wél `slepen`
 * teruggeven, dan meldt de LRS `sequencing` over gegevens die een keuze zijn, en dat is een
 * rapportage die liegt.
 */
export function normaliseerVraagvorm(ruw: string | undefined): Vraagvorm {
  const t = (ruw ?? "").toLowerCase();
  if (/juist|onjuist|waar|true|false/.test(t)) return "juist-onjuist";
  return "meerkeuze";
}

export const VRAAGVORM_LABEL: Record<Vraagvorm, string> = {
  meerkeuze: "Meerkeuze",
  "juist-onjuist": "Juist/onjuist",
  invullen: "Invullen",
  matchen: "Matchen",
  slepen: "Slepen en plaatsen",
  hotspot: "Hotspot",
};

export interface Verbinding {
  id: string;
  van: string;
  naar: string;
  /** Alleen gezet op een schakel uit een vertakking; elders betekenisloos en dus afwezig. */
  voorwaarde?: Voorwaarde;
}

export interface Leerpad {
  knopen: Knoop[];
  verbindingen: Verbinding[];
}

/**
 * Wat voor soort ding een knoop is.
 *
 * `inhoud` is wat de cursist ziet en het enige niveau dat een keten vormt. `gereedschap` (de
 * AI-knoop) wijst een blok aan maar staat er zelf niet tussen. `vertakking` routeert tussen
 * pagina's, en `sectie` groepeert ze — die twee horen bij geen enkele keten.
 *
 * Staat hier en niet bij het leerpad omdat de pagina-afleiding er los van moet kunnen hangen.
 */
export type Niveau = "inhoud" | "gereedschap" | "sectie" | "vertakking";

export const NIVEAU: Record<KnoopSoort, Niveau> = {
  uitleg: "inhoud",
  video: "inhoud",
  afbeelding: "inhoud",
  audio: "inhoud",
  toets: "inhoud",
  citaat: "inhoud",
  carrousel: "inhoud",
  reflectie: "inhoud",
  assessment: "inhoud",
  ai: "gereedschap",
  sectie: "sectie",
  vertakking: "vertakking",
};

export function niveauVan(knoop: Knoop): Niveau {
  return NIVEAU[knoop.soort];
}

/** Is dit een blok dat op het scherm van de cursist komt? */
export function isInhoud(knoop: Knoop): boolean {
  return NIVEAU[knoop.soort] === "inhoud";
}

/** Afmetingen — hier gedeeld met het canvas zodat layout en render niet uit elkaar lopen. */
/**
 * Breder dan de 216px van een kale kaart: er staat nu een prompt- én een uitvoerveld in, en een
 * tekstvak van 216px breed is niet te gebruiken.
 */
export const KNOOP_BREEDTE = 300;
/** Horizontale steek binnen een rij: kaartbreedte plus de tussenruimte. */
export const KOLOM_AFSTAND = 340;
export const KANT_MARGE = 32;

/**
 * De vaste rijhoogte, en de lucht die er onder de hoogste kaart bij komt.
 *
 * "Vast" is hier een **ondergrens**, geen absolute maat. Kaarthoogtes worden gemeten en lopen ver
 * uiteen — een tekstblok met een prompt- én een uitvoerveld meet ruim 320px, een kale kaart 130.
 * Een echt vaste steek zou een hoge kaart over de rij eronder laten lopen, en overlap is precies
 * wat dit model onmogelijk moet maken. Vandaar: elke rij is minstens `RIJ_HOOGTE` hoog en groeit
 * mee met zijn hoogste kaart.
 */
export const RIJ_HOOGTE = 300;
export const RIJ_TUSSEN = 40;

function eersteRegel(tekst: string, max = 90): string {
  const schoon = tekst.replace(/\s+/g, " ").trim();
  return schoon.length > max ? `${schoon.slice(0, max - 1)}…` : schoon;
}

/**
 * Is een vraag bruikbaar? Structured outputs garandeert de vórm, niet de inhoud: een vraag met
 * één optie, een leeg antwoord of een `correct` buiten bereik komt er ongehinderd door. Dat is
 * precies wat het statusbolletje op de kaart moet verraden.
 */
export function vraagIsKlaar(vraag: Vraag): boolean {
  // Een open vraag heeft geen opties en geen goed antwoord; eisen dat hij ze heeft maakt hem
  // per definitie onaf, en dan blokkeert hij de export van de hele module.
  if (vraag.vorm === "open") {
    return vraag.vraag.trim().length > 0 && vraag.feedback.trim().length > 0;
  }
  const gevuldeOpties = vraag.opties.filter((o) => o.trim().length > 0);
  return (
    vraag.vraag.trim().length > 0 &&
    gevuldeOpties.length >= 2 &&
    vraag.correct >= 0 &&
    vraag.correct < vraag.opties.length &&
    (vraag.opties[vraag.correct]?.trim().length ?? 0) > 0 &&
    vraag.feedback.trim().length > 0
  );
}

/**
 * Prism-paar per categorie. Vijf onderscheidbare behandelingen uit de drie paren plus neutraal —
 * geen verzonnen groen of rood, want die bestaan niet in de tokenlaag (zie CLAUDE.md).
 *
 * De categorie zit in de RAND; de state (selectie, niet-af) in de glow. Zo blijft "max één glow
 * per element" overeind: een rand is geen glow.
 */
export const CATEGORIE_RAND: Record<KnoopSoort, string> = {
  uitleg: "border-stroke",
  video: "border-stroke",
  afbeelding: "border-stroke",
  audio: "border-stroke",
  citaat: "border-stroke",
  carrousel: "border-stroke",
  toets: "border-bloom-from",
  ai: "border-bloom-from border-dashed",
  vertakking: "border-bloom-from",
  reflectie: "border-bloom-from",
  assessment: "border-bloom-from",
  sectie: "border-flow-from border-dashed",
};

export const CATEGORIE_TAG: Record<KnoopSoort, string> = {
  uitleg: "bg-card-sub text-ink-soft",
  video: "bg-card-sub text-ink-soft",
  afbeelding: "bg-card-sub text-ink-soft",
  audio: "bg-card-sub text-ink-soft",
  citaat: "bg-card-sub text-ink-soft",
  carrousel: "bg-card-sub text-ink-soft",
  toets: "bg-bloom-wash text-bloom-ink",
  ai: "bg-bloom-wash text-bloom-ink",
  vertakking: "bg-bloom-wash text-bloom-ink",
  reflectie: "bg-bloom-wash text-bloom-ink",
  assessment: "bg-bloom-wash text-bloom-ink",
  sectie: "bg-flow-wash text-flow-ink",
};

export const CATEGORIE_LABEL: Record<KnoopSoort, string> = {
  uitleg: "Uitleg",
  video: "Video",
  afbeelding: "Afbeelding",
  audio: "Audio",
  citaat: "Citaat",
  carrousel: "Carrousel",
  toets: "Vraag",
  ai: "AI",
  vertakking: "Vertakking",
  reflectie: "Reflectie",
  assessment: "Assessment",
  sectie: "Sectie",
};

export const CATEGORIE_ICOON: Record<KnoopSoort, string> = {
  uitleg: "▤",
  video: "▷",
  afbeelding: "▣",
  audio: "◉",
  citaat: "❝",
  carrousel: "⧉",
  toets: "?",
  ai: "✦",
  vertakking: "⋔",
  reflectie: "✎",
  assessment: "◆",
  sectie: "▤▤",
};

/** Totale geschatte doorlooptijd van het hele pad. */
export function totaleMinuten(knopen: Knoop[]): number {
  return knopen.reduce((som, k) => som + k.minuten, 0);
}

/** Draagt deze content nog niets? Alleen een titel telt niet als inhoud. */
export function isLegeContent(content: GeneratedContent): boolean {
  return (
    content.intro.trim().length === 0 &&
    content.samenvatting.trim().length === 0 &&
    content.secties.length === 0 &&
    content.vragen.length === 0
  );
}

/**
 * Bouwt het leerpad uit de gegenereerde content: één keten, dus één pagina.
 *
 * De volgorde volgt de leerweg: de intro, dan de uitleg-secties, dan de toetsvragen, dan de
 * samenvatting. Vragen hangen in het datamodel niet aan een specifieke sectie (`secties` en
 * `vragen` zijn losse lijsten), dus we suggereren die koppeling ook niet — dat zou een structuur
 * tonen die er niet is.
 *
 * De blokken komen op één y-baan naast elkaar te staan. Dat is meteen de eindvorm: een pagina ís
 * een rij. De auto-layout normaliseert daarna toch, dus hier iets anders neerzetten zou alleen
 * verwarrend zijn.
 */
export function bouwLeerpad(
  content: GeneratedContent,
  /**
   * Levert de stabiele identiteit voor een knoop. Injecteerbaar zodat deze functie puur en
   * herhaalbaar blijft: `bouwLeerpad` wordt bij elke synchronisatie opnieuw aangeroepen, en zou
   * hij zelf UUID's verzinnen dan kreeg elk blok bij elke toetsaanslag een nieuwe identiteit.
   */
  maakSeed: (id: string) => string = () => "",
): {
  knopen: Knoop[];
  verbindingen: Verbinding[];
  breedte: number;
  hoogte: number;
} {
  // Lege content levert géén knopen op. Wie een leeg whiteboard begint krijgt één blok van
  // `leerpadUitContent`; zou deze functie er alsnog een intro en een samenvatting bijzetten, dan
  // schuift `synchroniseerMetContent` ze er meteen weer in en staat de auteur toch met drie blokken.
  if (isLegeContent(content)) {
    return { knopen: [], verbindingen: [], breedte: KANT_MARGE, hoogte: KANT_MARGE };
  }

  // Drie rijen, drie pagina's: inleiding, inhoud, toets. Elke rij is een eigen keten, en omdat
  // lidmaatschap alleen uit inhoud→inhoud-schakels volgt (zie `paginas.ts`) levert dat precies
  // drie pagina's op. Hiervóór liep er één ketting door alles heen; dan is er per definitie maar
  // één maximale keten, en kreeg de cursist een menu met één item en een pagina van elf blokken.
  const rijen: Knoop[][] = [[], [], []];
  const INLEIDING = 0;
  const INHOUD = 1;
  const TOETS = 2;

  /** Zet het volgende blok rechts van het vorige, op de baan van zijn eigen pagina. */
  const plaatsIn = (rij: number, knoop: Omit<Knoop, "x" | "y" | "seed">) => {
    const baan = rijen[rij]!;
    baan.push({
      ...knoop,
      seed: maakSeed(knoop.id),
      x: KANT_MARGE + baan.length * KOLOM_AFSTAND,
      y: KANT_MARGE + rij * RIJ_HOOGTE,
    });
  };

  const plaats = (knoop: Omit<Knoop, "x" | "y" | "seed">) => plaatsIn(INHOUD, knoop);

  plaatsIn(INLEIDING, {
    id: "intro",
    soort: "uitleg",
    // De intro is een gewoon uitleg-blok dat toevallig het contentveld `intro` toont.
    bron: "intro",
    titel: content.titel,
    fragment: eersteRegel(content.intro),
    index: null,
    eigen: false,
    minuten: schatMinuten(content.intro),
    klaar: content.intro.trim().length > 0 && content.titel.trim().length > 0,
  });

  content.secties.forEach((sectie, i) => {
    plaats({
      id: `s${i}`,
      soort: "uitleg",
      titel: sectie.kop,
      fragment: eersteRegel(sectie.tekst),
      index: i,
      eigen: false,
      minuten: schatMinuten(sectie.tekst),
      klaar: sectie.kop.trim().length > 0 && sectie.tekst.trim().length > 0,
    });
  });

  // De samenvatting sluit de stof af en staat daarom nog op de inhoudspagina: eerst samenvatten,
  // dan toetsen. Hij komt vóór de vragen in de code omdat zijn plek op de rij zijn leesvolgorde is.
  plaats({
    id: "samenvatting",
    soort: "uitleg",
    bron: "samenvatting",
    titel: "Samenvatting",
    fragment: eersteRegel(content.samenvatting),
    index: null,
    eigen: false,
    minuten: schatMinuten(content.samenvatting),
    klaar: content.samenvatting.trim().length > 0,
  });

  content.vragen.forEach((vraag, i) => {
    // Een open vraag is geen kennischeck maar een reflectie: geen opties, geen goed antwoord, geen
    // oordeel. Hem als `toets` neerzetten maakte hem per definitie onaf en blokkeerde de export van
    // de hele module — met de melding "heeft nog geen vraag met antwoorden", terwijl het ontbreken
    // van antwoorden precies de bedoeling was.
    const open = vraag.vorm === "open";
    plaatsIn(TOETS, {
      id: `v${i}`,
      soort: open ? "reflectie" : "toets",
      titel: open ? `Reflectie ${i + 1}` : `Vraag ${i + 1}`,
      fragment: eersteRegel(vraag.vraag),
      index: i,
      eigen: false,
      minuten: schatMinuten(vraag.vraag + " " + vraag.opties.join(" "), SECONDEN_PER_VRAAG),
      klaar: vraagIsKlaar(vraag),
      // Dezelfde standaardwaarden als een blok dat de auteur zelf neerzet (`nieuweKnoop`).
      // Zonder werkwoord valt de export terug op `experienced`: de LRS krijgt dan te horen dat de
      // cursist de vraag gezíén heeft, niet dat hij hem beantwoordde — en de controlelijst
      // klaagde erover bij élke gegenereerde module, over blokken die de auteur niet had gemaakt.
      xapiWerkwoord: VERBS.answered,
      // Een vraagvorm hoort bij een kennischeck; een reflectie heeft er geen. Hem toch zetten zou
      // een interactietype beloven dat er niet is.
      ...(open
        ? { aiBeoordeling: false }
        : { vraagvorm: normaliseerVraagvorm(vraag.vraagvorm) }),
    });
  });

  // De naam die in het menu komt te staan. Hij hangt aan de kop van de keten, want daar leest
  // `paginas.ts` hem af. Zonder deze namen zou de toetspagina "Vraag 1" gaan heten — de titel van
  // zijn eerste blok — en dat zegt in een menu niets.
  const NAMEN = ["Inleiding", "Inhoud", "Toets"];
  rijen.forEach((baan, i) => {
    const kop = baan[0];
    if (kop) kop.paginaTitel = NAMEN[i];
  });

  const knopen = rijen.flat();
  return {
    knopen,
    // Per rij een eigen ketting. Het voorvoegsel houdt de schakel-id's uniek: drie ketens die
    // allemaal bij `k0` beginnen leveren drie schakels met dezelfde id op, en dan verwijdert het
    // wissen van één schakel er stilletjes drie.
    verbindingen: rijen.flatMap((baan, i) => verbindKetting(baan, `r${i}`)),
    breedte: canvasBreedte(knopen),
    hoogte: canvasHoogte(knopen),
  };
}

/**
 * Verbindt de knopen in leesvolgorde tot één pad.
 *
 * Dit is het *startpunt* van de reeks, niet de eindvorm. Zodra de auteur gaat herdraden of blokken
 * bijzet is deze ketting geschiedenis — zie `synchroniseerMetContent`, die de reeks van de auteur
 * met rust laat.
 */
export function verbindKetting(knopen: Knoop[], voorvoegsel = "k"): Verbinding[] {
  const verbindingen: Verbinding[] = [];
  for (let i = 0; i < knopen.length - 1; i += 1) {
    const van = knopen[i];
    const naar = knopen[i + 1];
    if (!van || !naar) continue;
    // Nooit een knoop aan zichzelf hangen — dat zou een oneindige lus tekenen.
    if (van.id === naar.id) continue;
    verbindingen.push({ id: `${voorvoegsel}${i}`, van: van.id, naar: naar.id });
  }
  return verbindingen;
}

export function canvasBreedte(knopen: Knoop[]): number {
  const rechts = knopen.reduce((max, k) => Math.max(max, k.x + KNOOP_BREEDTE), 0);
  return rechts + KANT_MARGE;
}

export function canvasHoogte(knopen: Knoop[], knoopHoogte = 132): number {
  const onder = knopen.reduce((max, k) => Math.max(max, k.y + knoopHoogte), 0);
  return onder + KANT_MARGE;
}

/** Verplaatst één knoop en houdt hem binnen het canvas. */
export function verplaatsKnoop(
  knopen: Knoop[],
  id: string,
  x: number,
  y: number,
  grens: { breedte: number; hoogte: number },
  knoopHoogte = 132,
): Knoop[] {
  const maxX = Math.max(0, grens.breedte - KNOOP_BREEDTE);
  const maxY = Math.max(0, grens.hoogte - knoopHoogte);
  return knopen.map((k) =>
    k.id === id
      ? { ...k, x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) }
      : k,
  );
}

/** Zet alle knopen terug op de automatische layout. */
export function herstelLayout(content: GeneratedContent): Knoop[] {
  return bouwLeerpad(content).knopen;
}
