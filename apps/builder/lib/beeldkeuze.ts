/**
 * Beeld kiezen bij de stof: welke vraag stellen we, en waar landt het antwoord?
 *
 * Een gegenereerde module is tekst. De speler kan al beeld tonen — elke knoop mag een bestand
 * dragen en dat komt onder de tekst te staan — maar de generator vraagt er nooit om, dus komt het
 * er nooit in. Dit is de stap die dat gat dicht: na het bouwen loopt de app de secties langs en
 * vraagt per sectie welke afbeelding eronder moet.
 *
 * Puur en los van React, want dit is het deel dat stil fout gaat: een beeld dat bij de verkeerde
 * sectie belandt ziet er niet kapot uit — het ziet er alleen vreemd uit, en dat merk je pas in het
 * LMS.
 */
import type { Bestand } from "./bestand";
import type { Knoop, Leerpad } from "./graph";
import type { GeneratedContent } from "./types";
import { zoekterm } from "./media-zoek";

/**
 * Woorden die een stockzoekopdracht alleen maar ruis geven.
 *
 * Een sectiekop als "Wat doe je bij een brandalarm?" levert op "wat doe je bij een" niets zinnigs
 * op; op "brandalarm" wel. Lidwoorden, voorzetsels en vraagwoorden dragen geen beeld, dus gaan ze
 * eruit voordat de term naar de bron gaat.
 */
const RUIS = new Set([
  "de", "het", "een", "en", "of", "van", "voor", "bij", "op", "in", "met", "aan", "te", "tot",
  "je", "jij", "jou", "jouw", "u", "uw", "we", "wij", "ze", "zij", "men",
  "wat", "hoe", "waarom", "wanneer", "welke", "welk", "wie", "waar",
  "doe", "doen", "is", "zijn", "was", "waren", "wordt", "worden", "heeft", "hebben", "kan", "kun",
  "dat", "die", "dit", "deze", "als", "ook", "nog", "er", "om", "naar", "over", "uit", "door",
  "niet", "geen", "wel", "maar", "dan", "zo", "al",
]);

/** Hoeveel keuzes we per sectie ophalen. Vier past op één rij en is te overzien. */
export const BEELDKEUZES = 4;

/**
 * De zoekterm bij een sectie.
 *
 * De kop eerst: die zegt waar de sectie over gaat. Blijft er na het wegstrepen van ruiswoorden te
 * weinig over — "Wat doe je?" houdt niets over — dan valt hij terug op het onderwerp van de
 * module. Een lege term zou een zoekopdracht zijn die gegarandeerd niets vindt.
 *
 * De auteur kan de term in het venster overschrijven; dit is een vertrekpunt, geen oordeel.
 */
export function zoektermVoorSectie(onderwerp: string, kop: string, beeldterm?: string): string {
  // De term van het model eerst: die is Engels en beschrijft wat er te zíen moet zijn. De bronnen
  // indexeren op Engels, dus een Nederlandse kop levert ruis — "begin stoel basis houding" gaf
  // flamingo en winter, "office chair posture" gaf een bureaustoel.
  const vanModel = (beeldterm ?? "").trim();
  if (vanModel) return zoekterm(vanModel, 4);

  const woorden = kop
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !RUIS.has(w));

  if (woorden.length >= 1) return zoekterm(woorden.slice(0, 4).join(" "));
  return zoekterm(onderwerp, 4);
}

/** Eén stap in de beeldkeuze: bij welke sectie hoort hij, en wat vragen we? */
export interface Beeldstap {
  /** Index in `content.secties`. Hieraan hangt het beeld straks. */
  index: number;
  kop: string;
  /** De eerste regels van de sectie, zodat je ziet wat je illustreert. */
  fragment: string;
  /** Het vertrekpunt voor de zoekopdracht. */
  term: string;
}

/** De eerste zin of twee van een tekst, als voorbeschouwing naast de keuzes. */
function fragmentVan(tekst: string, maxTekens = 180): string {
  const plat = tekst.replace(/[*_#>]/g, "").replace(/\s+/g, " ").trim();
  if (plat.length <= maxTekens) return plat;
  const geknipt = plat.slice(0, maxTekens);
  const laatsteSpatie = geknipt.lastIndexOf(" ");
  return `${geknipt.slice(0, laatsteSpatie > 0 ? laatsteSpatie : maxTekens)}…`;
}

/**
 * Hoeveel secties er om beeld gevraagd worden, per antwoord uit het interview.
 *
 * **"Weinig" is niet "geen".** Dat verschil was er eerst niet: bij "weinig beeld" sloeg de app de
 * hele stap over, en dan krijgt een auteur die om een paar afbeeldingen vroeg er nul. Het niveau
 * bepaalt dus een aantal, niet of de stap draait. Wie écht geen beeld wil drukt op de eerste stap
 * op "Overslaan".
 *
 * Breuken van het aantal secties, met altijd minstens één: een module van drie secties hoort bij
 * "weinig" één beeld te krijgen, niet nul.
 */
const DEEL_PER_NIVEAU: Record<string, number> = {
  weinig: 1 / 3,
  gemiddeld: 2 / 3,
  beeldrijk: 1,
};

/** Hoeveel van `aantal` secties er gevraagd worden. Onbekend niveau = alles. */
export function hoeveelBeelden(aantal: number, beeldgebruik: string | null | undefined): number {
  if (aantal === 0) return 0;
  const deel = DEEL_PER_NIVEAU[beeldgebruik ?? ""] ?? 1;
  return Math.max(1, Math.round(aantal * deel));
}

/**
 * `k` posities, gelijkmatig verdeeld over `n` plekken.
 *
 * Gelijkmatig en niet "de eerste k", omdat een module met drie beelden bovenaan en verder niets er
 * onaf uitziet, terwijl begin-midden-eind leest als een bedoeling.
 */
function verdeeld(n: number, k: number): number[] {
  if (k >= n) return Array.from({ length: n }, (_, i) => i);
  if (k <= 1) return [0];
  return Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / (k - 1)));
}

/**
 * De stappen die de app langsloopt.
 *
 * Alleen secties, geen vragen en geen intro. Een afbeelding onder een meerkeuzevraag leidt af van
 * de vraag, en de intro staat al naast het menubeeld.
 *
 * Hoeveel secties er aan bod komen hangt af van wat de auteur in het interview koos; welke, van
 * een gelijkmatige verdeling over de module.
 */
export function beeldstappen(
  content: GeneratedContent,
  beeldgebruik?: string | null,
): Beeldstap[] {
  const bruikbaar = content.secties
    .map((sectie, index) => ({ sectie, index }))
    .filter(({ sectie }) => sectie.kop.trim().length > 0);

  const hoeveel = hoeveelBeelden(bruikbaar.length, beeldgebruik);
  return verdeeld(bruikbaar.length, hoeveel)
    .flatMap((plek) => {
      const gekozen = bruikbaar[plek];
      return gekozen ? [gekozen] : [];
    })
    .map(({ sectie, index }) => ({
      index,
      kop: sectie.kop,
      fragment: fragmentVan(sectie.tekst),
      term: zoektermVoorSectie(content.titel, sectie.kop, sectie.beeldterm),
    }));
}

/** Wat de auteur koos: per sectie-index het bestand, of niets. */
export type Beeldkeuzes = Record<number, Bestand>;

/**
 * De gekozen beelden op de juiste knopen zetten.
 *
 * De koppeling loopt over `index` — het veld waarmee een gegenereerde knoop naar zijn sectie
 * wijst — en níét over de volgorde in de keten. Die volgorde verandert zodra de auteur iets
 * versleept, en dan zou het beeld meeschuiven naar een sectie waar het niet over gaat.
 *
 * Alleen `uitleg`-knopen die uit de generator komen: een blok dat de auteur zelf neerzette draagt
 * zijn eigen bestand, en dat overschrijven zou werk weggooien.
 */
export function metBeelden(leerpad: Leerpad, beelden: Beeldkeuzes): Leerpad {
  if (Object.keys(beelden).length === 0) return leerpad;
  return {
    ...leerpad,
    knopen: leerpad.knopen.map((knoop: Knoop) => {
      if (knoop.soort !== "uitleg" || knoop.eigen || knoop.index === null) return knoop;
      const bestand = beelden[knoop.index];
      return bestand ? { ...knoop, bestand } : knoop;
    }),
  };
}
