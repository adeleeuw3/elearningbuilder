/**
 * De brug: de graaf van het canvas naar het observatiedocument.
 *
 * Puur en los van React en van het bestandssysteem, want dit is de plek waar identiteit ontstaat.
 * Een fout hier is stil: een verkeerde IRI ziet er precies zo uit als een goede, en je merkt het
 * pas als iemand maanden later een rapportage opvraagt en de historie op het verkeerde blok blijkt
 * te staan.
 *
 * Drie dingen die hier expliciet zijn geregeld:
 *
 * 1. **Identiteit komt uit de seed, nooit uit het documentinterne id.** `b1` is positioneel; de
 *    seed gaat over versies heen mee. Zie `lib/leerpad.ts`.
 * 2. **Tekst wordt geëscaped, niet doorgegeven.** Wat de auteur typt is platte tekst. Die als HTML
 *    doorlaten zou een injectiepad openen in het geëxporteerde pakket, waar geen sanitizer meer
 *    draait. CLAUDE.md §4 eist sanitizen bij opslaan én renderen; escapen bij de bron is hier de
 *    strengere en simpelere variant.
 * 3. **Geen `iriBase` verzinnen.** De IRI-namespace is identiteit. Raden zou statements publiceren
 *    onder een namespace die niet van jou is, en dat is in een LRS niet meer terug te draaien.
 */
import { ObservationDoc, iri } from "@ob/schema";
import {
  VRAAGVORM_LABEL,
  totaleMinuten,
  type Knoop,
  type KnoopSoort,
  type Vraagvorm,
} from "./graph";
import { leesTekst } from "./leerpad";
import type { Bestand } from "./bestand";
import { paginasVan } from "./paginas";
import type { Leerpad } from "./graph";
import { EXTENSIE, idUitUrl } from "./opslag";
import type { GeneratedContent, Vraag } from "./types";

/** De taal van wat deze builder maakt. Eén plek, zodat er geen tweede ontstaat. */
export const TAAL = "nl-NL";

const tekstKaart = (t: string) => ({ [TAAL]: t });

/**
 * Van vraagvorm naar het xAPI-interactietype.
 *
 * Waar geen exacte tegenhanger bestaat wordt de dichtstbijzijnde gekozen die het schema kent.
 * Een type dat iets anders belooft dan de vraag doet is erger dan een ruwer type.
 */
export const VRAAGVORM_INTERACTIE: Record<Vraagvorm, string> = {
  meerkeuze: "choice",
  "juist-onjuist": "true-false",
  invullen: "fill-in",
  matchen: "matching",
  slepen: "sequencing",
  hotspot: "hotspot-identify",
};

/** De vormen die een blok in het pakket kan aannemen; het schema kent dezelfde zes. */
export type ComponentSoort = "text" | "media" | "quote" | "question" | "open" | "carousel";

/**
 * Van knoopsoort naar componentsoort.
 *
 * Een expliciete tabel en geen slimmigheid: welke vorm een blok krijgt is niet iets om uit toevallig
 * gevulde velden af te leiden. Wat hier niet in staat wordt tekst — de veiligste uitkomst, want die
 * toont wat er staat in plaats van een interactie te beloven die er niet is.
 *
 * De `assessment`-knoop (de eindtoets) valt daar bewust onder: er is nog geen assessment-component
 * in de speler, en hem als `question` exporteren zou een vraag beloven die nergens vandaan komt.
 */
export const COMPONENT_SOORT: Partial<Record<KnoopSoort, ComponentSoort>> = {
  uitleg: "text",
  afbeelding: "media",
  video: "media",
  audio: "media",
  citaat: "quote",
  carrousel: "carousel",
  toets: "question",
  reflectie: "open",
};

/**
 * Hoe elke componentsoort op de pagina staat.
 *
 * Eén tabel, zodat er geen plek is waar per blok iets anders besloten wordt. Een citaat is een
 * adempauze — volle breedte, halve schermhoogte en nadruk, zodat het niet als zoveelste alinea
 * voorbijkomt. Beeld loopt van rand tot rand; tekst blijft in de leeskolom.
 */
const NADRUK_PER_SOORT: Record<
  ComponentSoort,
  { nadruk: "rustig" | "normaal" | "accent"; fullBleed: boolean; minHeight: number }
> = {
  text: { nadruk: "normaal", fullBleed: false, minHeight: 0 },
  media: { nadruk: "normaal", fullBleed: true, minHeight: 0 },
  quote: { nadruk: "accent", fullBleed: true, minHeight: 0.5 },
  question: { nadruk: "normaal", fullBleed: false, minHeight: 0 },
  open: { nadruk: "rustig", fullBleed: false, minHeight: 0 },
  carousel: { nadruk: "normaal", fullBleed: false, minHeight: 0 },
};

/** HTML-escape. De uitvoer gaat een pakket in waar geen sanitizer meer draait. */
export function escapeHtml(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * De opmaak binnen één regel: vet en cursief.
 *
 * **Escapen gebeurt eerst, omzetten daarna.** Die volgorde is de hele beveiliging van deze functie:
 * na `escapeHtml` bestaat er geen `<` meer in de tekst, dus elke tag die hierna in de uitvoer staat
 * is er één die wij zelf hebben gezet. Draai je het om, dan is dit een injectiepunt — en de tekst
 * komt van een taalmodel, dus de vraag is niet óf er ooit iets tagachtigs in staat.
 *
 * Alleen `**vet**`, `*cursief*` en `_cursief_`. Geen koppen, geen links, geen afbeeldingen: wat het
 * model aan structuur wil aanbrengen hoort in een eigen blok te staan en niet in een alinea
 * verstopt te zitten.
 */
function inlineOpmaak(veiligeTekst: string): string {
  return veiligeTekst
    .replace(/\*\*(?=\S)([^*]+?)(?<=\S)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<![*\w])\*(?=\S)([^*\n]+?)(?<=\S)\*(?!\*)/g, "<em>$1</em>")
    .replace(/(?<![_\w])_(?=\S)([^_\n]+?)(?<=\S)_(?![_\w])/g, "<em>$1</em>");
}

const GENUMMERD = /^\s*\d+[.)]\s+/;
const BOLLETJE = /^\s*[-*+]\s+/;

/** Wat voor regel is dit: een genummerd item, een bolletje, of gewone tekst? */
function soortRegel(regel: string): "ol" | "ul" | "p" {
  if (GENUMMERD.test(regel)) return "ol";
  if (BOLLETJE.test(regel)) return "ul";
  return "p";
}

/**
 * Eén tekstblok naar HTML: afwisselend alinea's en lijsten.
 *
 * Het blok wordt in reeksen van hetzelfde soort regel geknipt. Dat moet, want de vorm die het
 * model het vaakst schrijft is een inleidende zin met bolletjes eronder:
 *
 *     Bij oplopende spanning:
 *     - Verlaag de prikkels.
 *     - Bied nabijheid.
 *
 * Een regel die eist dat *elke* regel een opsommingsteken draagt — de eerste versie hiervan —
 * laat zo'n blok volledig als alinea staan. In één echte module gold dat voor 18 van de 23
 * lijstregels: ze kwamen er wel leesbaar uit, maar zonder inspringing en zonder bolletje.
 */
function blokNaarHtml(blok: string): string {
  const regels = blok.split("\n").filter((r) => r.trim().length > 0);
  const stukken: string[] = [];

  let i = 0;
  while (i < regels.length) {
    const soort = soortRegel(regels[i]!);
    const reeks: string[] = [];
    while (i < regels.length && soortRegel(regels[i]!) === soort) reeks.push(regels[i++]!);

    if (soort === "p") {
      stukken.push(`<p>${reeks.map((r) => inlineOpmaak(escapeHtml(r))).join("<br>")}</p>`);
      continue;
    }
    const patroon = soort === "ol" ? GENUMMERD : BOLLETJE;
    const items = reeks.map((r) => `<li>${inlineOpmaak(escapeHtml(r.replace(patroon, "")))}</li>`);
    stukken.push(`<${soort}>${items.join("")}</${soort}>`);
  }

  return stukken.join("");
}

/**
 * Platte tekst naar HTML. Lege regels scheiden de blokken.
 *
 * Het model schrijft Markdown — daar is het op getraind, en vragen om het te laten is een regel in
 * een prompt die het soms vergeet. Tot nu toe werd die opmaak alleen ge-escaped, waardoor de
 * cursist letterlijk `**Cliënt**` op zijn scherm kreeg en een genummerde lijst als één doorlopende
 * alinea. Dit zet een kleine, vaste deelverzameling om in echte tags.
 */
export function alsHtml(tekst: string): string {
  return tekst
    .split(/\n{2,}/)
    .map((deel) => deel.trim())
    .filter((deel) => deel.length > 0)
    .map(blokNaarHtml)
    .join("");
}

export interface ExportInvoer {
  leerpad: Leerpad;
  content: GeneratedContent;
  /** Stabiel per module; komt uit het project. */
  artifactId: string;
  /** De IRI-namespace. Verplicht — zie de kop van dit bestand. */
  iriBase: string;
  version?: number;
}

export type ExportUitslag =
  | { ok: true; doc: ObservationDoc; activityId: string }
  | { ok: false; redenen: string[] };

/**
 * Bouwt het observatiedocument uit de graaf.
 *
 * Weigert liever dan half te leveren: een document met een lege pagina of een kennischeck zonder
 * antwoorden valideert wel maar is niets waard.
 */
export function naarObservatieDocument(invoer: ExportInvoer): ExportUitslag {
  const { leerpad, content, artifactId, iriBase } = invoer;
  const redenen: string[] = [];

  // De pagina's in de volgorde waarin de cursist ze krijgt: die volgt de verticale positie van
  // het eerste blok van elke keten. Een AI-knoop staat niet in een keten, dus die komt hier al niet
  // in voor — gereedschap van de auteur hoort niet op het scherm van de cursist.
  const paginas = paginasVan(leerpad);
  if (paginas.length === 0) {
    redenen.push("Er staat nog geen blok op het canvas, dus er valt niets te exporteren.");
  }

  const pages = paginas.map((pagina) => ({
    kind: "stack" as const,
    id: pagina.seed,
    title: tekstKaart(pagina.titel || "Naamloze pagina"),
    blocks: pagina.onderdelen.map((knoop, i) => blokVan(knoop, content, i, redenen)),
  }));

  // De doorlooptijd die het menuscherm toont. Alleen wat de cursist echt doorloopt telt mee: de
  // knopen die in een pagina staan. Gereedschap van de auteur staat niet in `paginas` en zou de
  // schatting anders optrekken met tijd die niemand besteedt.
  const minuten = paginas.reduce((som, p) => som + totaleMinuten(p.onderdelen), 0);

  const ruw = {
    schemaVersion: "1.0" as const,
    artifactId,
    version: invoer.version ?? 1,
    iriBase,
    metadata: {
      title: tekstKaart(content.titel || "Naamloze module"),
      ...(content.intro.trim() ? { description: tekstKaart(content.intro) } : {}),
      language: TAAL,
      ...(minuten > 0 ? { estimatedMinutes: minuten } : {}),
      tags: [],
    },
    pages,
    rubrics: [],
  };

  // Eerst wat er aan de graaf mankeert: dat leest een auteur, schemafouten zijn ruis daarnaast.
  if (redenen.length > 0) return { ok: false, redenen };

  const uitslag = ObservationDoc.safeParse(ruw);
  if (!uitslag.success) {
    return {
      ok: false,
      redenen: uitslag.error.issues
        .slice(0, 10)
        .map((issue) => `${issue.path.join(".") || "document"}: ${issue.message}`),
    };
  }

  return {
    ok: true,
    doc: uitslag.data,
    activityId: iri.parent(iriBase, artifactId),
  };
}

function blokVan(
  knoop: Knoop,
  content: GeneratedContent,
  volgorde: number,
  redenen: string[],
): Record<string, unknown> {
  const naam = knoop.titel || `Blok ${volgorde + 1}`;
  const soort = COMPONENT_SOORT[knoop.soort] ?? "text";
  const tekst = leesTekst(knoop, content) ?? "";

  const blok: Record<string, unknown> = {
    kind: soort,
    // De seed, niet het documentinterne id: dát is wat over versies heen meegaat.
    id: knoop.seed,
    name: naam,
    label: tekstKaart(naam),
    // Bij een open vraag staat de tekst in de prompt. Hem hier óók zetten zou de vraag twee keer
    // op het scherm zetten, en de auteur heeft hem één keer geschreven.
    content:
      soort === "open"
        ? { html: "", media: [] }
        : { html: alsHtml(tekst), media: mediaVan(knoop) },
    order: volgorde,
    xapi: {
      activityType: "http://adlnet.gov/expapi/activities/interaction",
      verbOnInteract:
        knoop.xapiWerkwoord || "http://adlnet.gov/expapi/verbs/experienced",
    },
  };

  /*
   * De vormgeving van het pakket komt uit het thema, niet uit de keuzes van de auteur. Wat hier
   * gezet wordt is daarom intentie: hoeveel nadruk vraagt dit blok, en hoe staat het op de pagina.
   * Welke kleur daarbij hoort bepaalt `lib/thema.ts` — zo zien twee modules over twee onderwerpen,
   * uit twee prompts, er hetzelfde uit.
   */
  blok.presentation = { ...NADRUK_PER_SOORT[soort], nadruk: NADRUK_PER_SOORT[soort].nadruk };

  const alt = knoop.bestand?.alt?.trim();
  if (alt) blok.altText = tekstKaart(alt);

  if (soort === "question") {
    const vraag = knoop.index !== null ? content.vragen[knoop.index] : undefined;
    const assessment = assessmentVan(knoop, vraag);
    if (assessment) blok.assessment = assessment;
    else redenen.push(`Kennischeck "${naam}" heeft nog geen vraag met antwoorden.`);
  }

  /*
   * Een reflectie is een open vraag, en een open vraag heeft een assessment nodig — daar hangt de
   * prompt in, en daar kijkt de speler naar om het invoerveld te tonen.
   *
   * Zonder dit exporteerde een reflectieblok als een lege sectie: de tekst werd hierboven bewust
   * uit `content.html` gelaten (hij hoort in de prompt), maar er werd nooit een prompt gebouwd.
   * Resultaat was een kopje zonder vraag en zonder tekstvak. Niets faalde — er stond alleen niets.
   *
   * `long-fill-in` en geen goed antwoord: `publishBlockers` weet dat zo'n vraag niet beoordeeld
   * wordt en eist er geen `correctResponsesPattern` bij.
   */
  if (soort === "open") {
    const prompt = tekst.trim();
    if (!prompt) redenen.push(`Reflectie "${naam}" heeft nog geen vraag.`);
    else blok.assessment = { interactionType: "long-fill-in", prompt: tekstKaart(prompt) };
  }

  if (soort === "quote") {
    if (!tekst.trim()) redenen.push(`Citaat "${naam}" heeft nog geen tekst.`);
    const bron = knoop.bronvermelding?.trim();
    if (bron) blok.attribution = tekstKaart(bron);
  }

  if (soort === "carousel") {
    const items = (knoop.items ?? []).filter(
      (i) => i.kop.trim().length > 0 || i.tekst.trim().length > 0,
    );
    // Eén stap is geen carrousel: er valt niets door te klikken, en de component zou meteen af
    // zijn. Dat weigeren is eerlijker dan hem als tekstblok laten doorgaan.
    if (items.length < 2) {
      redenen.push(`Carrousel "${naam}" heeft ${items.length} ingevulde stap(pen); dat zijn er minstens twee.`);
    }
    blok.items = items.map((item, i) => ({
      id: item.id || `i${i + 1}`,
      heading: tekstKaart(item.kop.trim() || `Stap ${i + 1}`),
      content: { html: alsHtml(item.tekst), media: bestandAlsMedia(item.bestand) },
      ...(item.citaat?.trim() ? { highlight: tekstKaart(item.citaat.trim()) } : {}),
      ...(item.bestand?.alt?.trim() ? { altText: tekstKaart(item.bestand.alt.trim()) } : {}),
    }));
    // De carrousel draagt zijn tekst in de stappen; die er ook boven zetten toont hem twee keer.
    blok.content = { html: "", media: [] };
  }

  if (soort === "open") {
    const vraagtekst = tekst.trim() || knoop.titel.trim();
    if (!vraagtekst) redenen.push(`Open vraag "${naam}" heeft nog geen vraagtekst.`);
    blok.assessment = {
      interactionType: "long-fill-in",
      prompt: tekstKaart(vraagtekst),
      // Geen `correctResponsesPattern` en geen punten: dit antwoord wordt vastgelegd, niet
      // beoordeeld. Een patroon verzinnen waar niets tegenaan gemeten wordt zou de rapportage in
      // de LRS een oordeel laten tonen dat nooit geveld is.
      score: { min: 0, max: 0, correct: 0 },
    };
  }

  return blok;
}

/**
 * Hoe het bestand in het pakket komt te heten.
 *
 * Met extensie, want een statische server leidt daar het content-type uit af en een `<video>`
 * zonder content-type speelt op sommige apparaten niet af. Het staat in het document en niet in de
 * exporter, zodat er één plek is die de naam bepaalt.
 */
function bestandsnaam(assetId: string, mime: string | undefined): string {
  return `${assetId}.${(mime && EXTENSIE[mime]) ?? "bin"}`;
}

/** Het bestand van een media-knoop, als verwijzing naar de opslag. */
function mediaVan(knoop: Knoop): Mediaverwijzing[] {
  const url = knoop.bestand?.url;
  if (!url) return [];
  const assetId = idUitUrl(url);
  if (!assetId) return [];
  const kind =
    knoop.soort === "afbeelding" ? "image" : knoop.soort === "video" ? "video" : "audio";
  return [{ assetId, kind, filename: bestandsnaam(assetId, knoop.bestand?.mime) }];
}

interface Mediaverwijzing {
  assetId: string;
  kind: "image" | "audio" | "video";
  filename: string;
}

/**
 * Het beeld van een carrousel-stap.
 *
 * Altijd `image`: een stap toont een visueel element naast de tekst, en een videospeler die zichzelf
 * na drie seconden laat wegklikken is dat niet.
 */
function bestandAlsMedia(bestand: Bestand | undefined): Mediaverwijzing[] {
  const assetId = bestand?.url ? idUitUrl(bestand.url) : null;
  if (!assetId) return [];
  return [{ assetId, kind: "image", filename: bestandsnaam(assetId, bestand?.mime) }];
}

/**
 * De vraag als xAPI-interactie.
 *
 * `correctResponsesPattern` verwijst naar de id van de juiste keuze. Zonder dat patroon kan een LRS
 * niet zien of het antwoord goed was, en `publishBlockers()` blokkeert er terecht op.
 */
function assessmentVan(
  knoop: Knoop,
  vraag: Vraag | undefined,
): Record<string, unknown> | null {
  if (!vraag) return null;
  if (vraag.opties.filter((o) => o.trim().length > 0).length < 2) return null;
  if (!vraag.opties[vraag.correct]) return null;

  const vorm = knoop.vraagvorm ?? "meerkeuze";
  return {
    interactionType: VRAAGVORM_INTERACTIE[vorm] ?? "other",
    prompt: tekstKaart(vraag.vraag),
    choices: vraag.opties.map((tekst, i) => ({ id: `c${i}`, text: tekstKaart(tekst) })),
    correctResponsesPattern: [`c${vraag.correct}`],
    ...(vraag.feedback.trim()
      ? {
          feedback: {
            correct: tekstKaart(vraag.feedback),
            incorrect: tekstKaart(vraag.feedback),
          },
        }
      : {}),
  };
}

/** Alleen om te tonen: welke vraagvormen er in de module zitten. */
export function gebruikteVraagvormen(leerpad: Leerpad): string[] {
  const vormen = new Set<string>();
  for (const k of leerpad.knopen) {
    if (k.soort === "toets") vormen.add(VRAAGVORM_LABEL[k.vraagvorm ?? "meerkeuze"]);
  }
  return [...vormen];
}

/**
 * Keurt de IRI-namespace vóór er iets gebouwd wordt.
 *
 * De secret-scan (`assertNoSecrets`) weigert alles wat op een LRS-endpoint lijkt, en die
 * `activityId` staat straks letterlijk in het manifest. Een namespace met een `/xapi`- of
 * `/statements`-segment is dus wél geldig als IRI maar onbruikbaar als exportnamespace: het
 * pakket zou pas ná het bouwen sneuvelen, met een melding over geheimen die hier niets verklaart.
 *
 * De uitweg is bewust niet "zet de scanner voor deze waarde uit". Deze basis komt uit de omgeving
 * en kan per installatie iets anders zijn — een instelbare URL door de poort laten is precies wat
 * die poort moet tegenhouden. Dus liever een namespace kiezen die niet als endpoint te lezen is.
 */
export function keurIriBasis(basis: string): string | null {
  let url: URL;
  try {
    url = new URL(basis);
  } catch {
    return `OB_IRI_BASE is geen geldige URL: ${basis}`;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "OB_IRI_BASE moet een http(s)-URL zijn.";
  }
  // Alleen het pad telt: een hostnaam als `xapi.example.com` is prima, een pad `/xapi/...` niet.
  const botsing = /\/(xapi|xAPI|statements)\b/.exec(url.pathname);
  if (botsing) {
    return (
      `OB_IRI_BASE bevat het padsegment "${botsing[1]}". Die namespace komt in het manifest ` +
      "terecht en is daar niet te onderscheiden van een LRS-endpoint, dus de secret-scan zou " +
      "elk pakket weigeren. Kies een pad zonder /xapi of /statements, bijvoorbeeld " +
      `${url.origin}/leerobjecten.`
    );
  }
  return null;
}
