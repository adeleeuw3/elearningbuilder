/**
 * Metadata uit een afbeelding halen, op de server, zonder beeldbibliotheek.
 *
 * **Waarom dit er moest komen.** `CLAUDE.md` §8 eist voor afbeeldingen: magic-byte-controle,
 * hercoderen en EXIF strippen. De eerste gebeurde al op de server; de andere twee alleen in de
 * browser, met een canvas. De uploadroute schrijft zelf verder op wat binnenkomt — en dat is de
 * controle die telt, want wie de route rechtstreeks aanroept komt niet langs de browser.
 *
 * Gemeten op een geüploade PNG met een `tEXt`-blok erin: hij kwam er aan de andere kant uit met
 * precies dezelfde bytes, inclusief dat blok. Bij een foto van een telefoon zit daar de
 * GPS-locatie in, en die gaat zo mee het exportpakket in, naar het LMS van een klant.
 *
 * **Wat dit wel en niet is.** Dit haalt de metadatablokken eruit; het hercodeert niet. Een echte
 * hercodering vraagt om een beeldbibliotheek (`sharp`) en die staat niet in de dependencies — dat
 * is een beslissing met gevolgen voor de build. Wat hier staat sluit het privacy-gat (locatie,
 * camera, auteur, tijdstip); het neutraliseert geen bestand dat tegelijk geldige afbeelding én
 * iets anders is. Zie de kop van `bestand.ts` voor wat er verder tegen dat laatste beschermt.
 *
 * Puur en zonder afhankelijkheden: dit is precies het soort code dat stil fout gaat. Een verkeerd
 * gelezen lengte levert geen foutmelding op maar een kapotte afbeelding, en dat zie je pas als een
 * cursist naar een leeg vlak kijkt.
 */

/**
 * De PNG-blokken die alleen beschrijving dragen en niets aan het beeld bijdragen.
 *
 * `iCCP` (kleurprofiel) en `pHYs` (fysieke afmeting) staan hier bewust **niet** bij: die zeggen
 * niets over wie of waar, maar wel hoe het beeld hoort te worden weergegeven. Ze weghalen zou de
 * kleuren of de afmeting veranderen, en dat is iets anders dan metadata strippen.
 */
const PNG_WEG = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

/** De JPEG-segmenten met metadata: APP1 (EXIF/XMP), APP2, APP13 (IPTC) en commentaar. */
const JPEG_WEG = new Set([0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xec, 0xed, 0xee, 0xfe]);

/** De WebP-blokken met metadata. */
const WEBP_WEG = new Set(["EXIF", "XMP "]);

function leesTekst(b: Uint8Array, van: number, lengte: number): string {
  let uit = "";
  for (let i = van; i < van + lengte && i < b.length; i += 1) uit += String.fromCharCode(b[i]!);
  return uit;
}

function leesUint32(b: Uint8Array, van: number): number {
  return ((b[van]! << 24) | (b[van + 1]! << 16) | (b[van + 2]! << 8) | b[van + 3]!) >>> 0;
}

/**
 * PNG: een reeks blokken van `lengte | type | data | crc`.
 *
 * De CRC blijft staan zoals hij is — we rekenen niets opnieuw uit, want we veranderen geen enkel
 * blok dat we houden; we laten er alleen een paar weg.
 */
function stripPng(b: Uint8Array): Uint8Array | null {
  const uit: number[] = [137, 80, 78, 71, 13, 10, 26, 10];
  let i = 8;
  let gezien = false;

  while (i + 8 <= b.length) {
    const lengte = leesUint32(b, i);
    const type = leesTekst(b, i + 4, 4);
    const eind = i + 12 + lengte;
    // Een lengte die buiten het bestand wijst betekent dat we de structuur verkeerd lezen. Dan
    // liever niets aanraken dan een half bestand opleveren.
    if (eind > b.length) return null;

    if (!PNG_WEG.has(type)) {
      for (let j = i; j < eind; j += 1) uit.push(b[j]!);
    }
    if (type === "IEND") {
      gezien = true;
      break;
    }
    i = eind;
  }

  return gezien ? Uint8Array.from(uit) : null;
}

/**
 * JPEG: markers van `0xFF <code>`, de meeste gevolgd door een lengte van twee bytes.
 *
 * Vanaf `SOS` (start of scan) komt de beeldstroom, die geen markerstructuur meer heeft; daar
 * stoppen we met kijken en nemen we de rest over zoals hij is.
 */
function stripJpeg(b: Uint8Array): Uint8Array | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  const uit: number[] = [0xff, 0xd8];
  let i = 2;

  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return null;
    const code = b[i + 1]!;

    // Start of scan: vanaf hier is het beeldgegevens tot het eind.
    if (code === 0xda) {
      for (let j = i; j < b.length; j += 1) uit.push(b[j]!);
      return Uint8Array.from(uit);
    }

    const lengte = (b[i + 2]! << 8) | b[i + 3]!;
    const eind = i + 2 + lengte;
    if (lengte < 2 || eind > b.length) return null;

    if (!JPEG_WEG.has(code)) {
      for (let j = i; j < eind; j += 1) uit.push(b[j]!);
    }
    i = eind;
  }

  return null;
}

/** WebP: een RIFF-container met blokken van `naam | lengte | data`, even uitgelijnd. */
function stripWebp(b: Uint8Array): Uint8Array | null {
  if (leesTekst(b, 0, 4) !== "RIFF" || leesTekst(b, 8, 4) !== "WEBP") return null;
  const blokken: number[] = [];
  let i = 12;

  while (i + 8 <= b.length) {
    const naam = leesTekst(b, i, 4);
    // RIFF is little-endian, anders dan PNG.
    const lengte = (b[i + 4]! | (b[i + 5]! << 8) | (b[i + 6]! << 16) | (b[i + 7]! << 24)) >>> 0;
    const data = i + 8;
    const eind = data + lengte + (lengte % 2); // blokken zijn op een even grens uitgelijnd
    if (eind > b.length) return null;

    if (!WEBP_WEG.has(naam)) {
      for (let j = i; j < eind; j += 1) blokken.push(b[j]!);
    }
    i = eind;
  }

  const grootte = 4 + blokken.length;
  return Uint8Array.from([
    ...[82, 73, 70, 70], // "RIFF"
    grootte & 255,
    (grootte >>> 8) & 255,
    (grootte >>> 16) & 255,
    (grootte >>> 24) & 255,
    ...[87, 69, 66, 80], // "WEBP"
    ...blokken,
  ]);
}

/**
 * De afbeelding zonder zijn metadata.
 *
 * Geeft de **originele bytes** terug als het formaat onbekend is of de structuur niet te volgen —
 * een bestand half doorsnijden is erger dan metadata laten staan, en de aanroeper weet aan
 * `gestript` of het gelukt is.
 */
export function zonderMetadata(bytes: Uint8Array, mime: string): {
  bytes: Uint8Array;
  gestript: boolean;
} {
  const uit =
    mime === "image/png"
      ? stripPng(bytes)
      : mime === "image/jpeg"
        ? stripJpeg(bytes)
        : mime === "image/webp"
          ? stripWebp(bytes)
          : null;

  if (!uit || uit.length === 0) return { bytes, gestript: false };
  return { bytes: uit, gestript: true };
}

/** Zit er nog metadata in? Alleen voor tests en diagnose. */
export function draagtMetadata(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/png") {
    for (const type of PNG_WEG) {
      for (let i = 8; i + 8 <= bytes.length; i += 1) {
        if (leesTekst(bytes, i, 4) === type) return true;
      }
    }
    return false;
  }
  if (mime === "image/jpeg") {
    let i = 2;
    while (i + 3 < bytes.length) {
      if (bytes[i] !== 0xff) return false;
      const code = bytes[i + 1]!;
      if (code === 0xda) return false;
      if (JPEG_WEG.has(code)) return true;
      i += 2 + ((bytes[i + 2]! << 8) | bytes[i + 3]!);
    }
    return false;
  }
  if (mime === "image/webp") {
    let i = 12;
    while (i + 8 <= bytes.length) {
      const naam = leesTekst(bytes, i, 4);
      if (WEBP_WEG.has(naam)) return true;
      const lengte = (bytes[i + 4]! | (bytes[i + 5]! << 8) | (bytes[i + 6]! << 16) | (bytes[i + 7]! << 24)) >>> 0;
      i = i + 8 + lengte + (lengte % 2);
    }
    return false;
  }
  return false;
}
