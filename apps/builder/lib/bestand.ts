/**
 * Bestanden van het apparaat van de auteur: afbeelding, video, audio.
 *
 * `CLAUDE.md` §8 stelt hier eisen aan, en die zijn er niet voor niets:
 *
 *   magic-byte-controle · hercoderen · EXIF strippen · SVG weigeren
 *
 * **Waarom niet op `file.type` vertrouwen.** Die waarde komt van het besturingssysteem en is
 * afgeleid van de extensie. Noem een bestand `foto.png` en de browser meldt `image/png`, wat er ook
 * in zit. De enige bron die niet liegt zijn de eerste bytes zelf. Daarom kijkt `herkenSoort` daar,
 * en weigert `controleerBestand` alles waarvan de bytes niet overeenkomen met wat er beweerd wordt.
 *
 * **Waarom GIF eruit ligt.** De regel zegt hercoderen, en dat kan niet zonder een animatie tot één
 * stilstaand beeld te reduceren. Stil vernietigen wat de auteur koos is erger dan weigeren; voor
 * beweging is er de videoknoop. Een uitzondering maken voor "alleen stilstaande GIF" zou betekenen
 * dat we GIF-frames gaan parsen om te weten of het mag — dat is een parser die niemand wil hebben.
 *
 * **Waarom SVG eruit ligt.** Een SVG is een document, niet een plaatje: het kan `<script>`,
 * `<foreignObject>` en externe verwijzingen bevatten. In een exportpakket dat op andermans LMS
 * draait is dat een gat. Er is geen veilige variant die de moeite waard is, dus: weigeren.
 *
 * Puur en los van React: dit is de laag waar een fout niet luidruchtig faalt maar stil doorglipt.
 */

export type BestandSoort = "afbeelding" | "video" | "audio";

/** Wat er van een gekozen bestand op de knoop belandt. */
export interface Bestand {
  naam: string;
  /** Het type zoals wij het hebben vastgesteld uit de bytes, niet zoals het werd aangeboden. */
  mime: string;
  grootte: number;
  /**
   * Een object-URL naar de blob in dít browsertabblad.
   *
   * Bewust geen data-URL: een video van 40 MB als base64 in React-state is ~53 MB tekst die bij
   * elke render meegaat en in elke serialisatie belandt.
   */
  url: string;
  /** Is dit bestand hercodeerd (en dus van zijn metadata ontdaan)? Alleen afbeeldingen. */
  hercodeerd: boolean;
  /**
   * Het tekstalternatief. Verplicht om te publiceren zodra er iets visueels staat — WCAG AA, en
   * `publishBlockers()` in `@ob/schema` blokkeert erop. Zonder dit veld kan een module met een
   * afbeelding per definitie nooit gepubliceerd worden.
   */
  alt?: string;
}

/**
 * Grenzen per soort. Ruim genoeg voor echt lesmateriaal, streng genoeg om een misklik te vangen
 * voordat het tabblad omvalt.
 */
export const MAX_BYTES: Record<BestandSoort, number> = {
  afbeelding: 10 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

/** Wat we accepteren, met de mime die wij eraan geven. */
interface Vingerafdruk {
  mime: string;
  soort: BestandSoort;
  /** Klopt de kop van het bestand? */
  past: (b: Uint8Array) => boolean;
}

const begintMet = (b: Uint8Array, bytes: number[], vanaf = 0): boolean =>
  bytes.every((v, i) => b[vanaf + i] === v);

/** ASCII-tekens op een vaste plek, zoals "ftyp" of "WEBP". */
const tekstOp = (b: Uint8Array, positie: number, tekst: string): boolean =>
  begintMet(b, [...tekst].map((c) => c.charCodeAt(0)), positie);

export const VINGERAFDRUKKEN: Vingerafdruk[] = [
  {
    mime: "image/png",
    soort: "afbeelding",
    past: (b) => begintMet(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  { mime: "image/jpeg", soort: "afbeelding", past: (b) => begintMet(b, [0xff, 0xd8, 0xff]) },
  {
    mime: "image/webp",
    soort: "afbeelding",
    past: (b) => tekstOp(b, 0, "RIFF") && tekstOp(b, 8, "WEBP"),
  },
  // MP4 en verwanten: de eerste vier bytes zijn de lengte van de box, dan pas "ftyp".
  { mime: "video/mp4", soort: "video", past: (b) => tekstOp(b, 4, "ftyp") },
  { mime: "video/webm", soort: "video", past: (b) => begintMet(b, [0x1a, 0x45, 0xdf, 0xa3]) },
  {
    mime: "audio/wav",
    soort: "audio",
    past: (b) => tekstOp(b, 0, "RIFF") && tekstOp(b, 8, "WAVE"),
  },
  { mime: "audio/ogg", soort: "audio", past: (b) => tekstOp(b, 0, "OggS") },
  {
    mime: "audio/mpeg",
    soort: "audio",
    past: (b) =>
      tekstOp(b, 0, "ID3") ||
      // Een kaal MP3-frame: 11 bits sync, dus 0xFF en de bovenste drie bits van de volgende byte.
      (b[0] === 0xff && (b[1] ?? 0) >= 0xe0),
  },
];

/**
 * Wat is dit werkelijk, volgens de bytes?
 *
 * `null` betekent: niet iets dat we accepteren. Dat is geen "onbekend maar misschien goed" — het is
 * een weigering.
 */
export function herkenSoort(bytes: Uint8Array): Vingerafdruk | null {
  // WebM staat vóór MP4 in de lijst zou hier niet helpen: de checks sluiten elkaar uit op positie.
  return VINGERAFDRUKKEN.find((v) => v.past(bytes)) ?? null;
}

/** Een GIF, herkend om hem te kunnen weigeren met een uitleg in plaats van "onbekend type". */
export function isGif(bytes: Uint8Array): boolean {
  return tekstOp(bytes, 0, "GIF8");
}

/** Ziet dit eruit als een SVG of ander XML/HTML-document? Dan gaat het eruit. */
export function isTekstDocument(bytes: Uint8Array): boolean {
  const kop = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, 256))
    .trimStart()
    .toLowerCase();
  return kop.startsWith("<?xml") || kop.startsWith("<svg") || kop.startsWith("<!doctype");
}

export interface Uitslag {
  ok: boolean;
  /** Bij ok: de mime die wij hebben vastgesteld. */
  mime?: string;
  /** Bij afkeuring: waarom, in taal die de auteur iets zegt. */
  reden?: string;
}

/**
 * Keurt een gekozen bestand.
 *
 * `verwacht` is de soort knoop waar het op gesleept werd. Een MP3 op een afbeeldingsknoop is geen
 * fout van de gebruiker om af te straffen met "ongeldig bestand" — het is een verkeerde plek, en dat
 * hoort de melding te zeggen.
 */
export function controleerBestand(
  bestand: { naam: string; type: string; grootte: number },
  bytes: Uint8Array,
  verwacht: BestandSoort,
): Uitslag {
  if (bestand.grootte === 0) {
    return { ok: false, reden: "Dit bestand is leeg." };
  }
  if (bestand.grootte > MAX_BYTES[verwacht]) {
    return {
      ok: false,
      reden: `Te groot: ${mb(bestand.grootte)} MB. Het maximum voor ${verwacht} is ${mb(MAX_BYTES[verwacht])} MB.`,
    };
  }
  if (isTekstDocument(bytes)) {
    return {
      ok: false,
      reden:
        "SVG en andere documenten worden niet geaccepteerd: die kunnen scripts bevatten en draaien straks op andermans LMS.",
    };
  }

  if (isGif(bytes)) {
    return {
      ok: false,
      reden:
        "GIF wordt niet geaccepteerd: hercoderen zou de animatie tot één beeld platslaan. Gebruik PNG, of een videoknoop.",
    };
  }

  const gevonden = herkenSoort(bytes);
  if (!gevonden) {
    return {
      ok: false,
      reden: `De inhoud van "${bestand.naam}" is geen bestandstype dat we ondersteunen.`,
    };
  }
  if (gevonden.soort !== verwacht) {
    return {
      ok: false,
      reden: `Dit is ${gevonden.mime}, en dat hoort op een ${gevonden.soort}-knoop — niet op een ${verwacht}-knoop.`,
    };
  }
  // De aangeboden mime mag afwijken (het OS kijkt naar de extensie), maar niet compleet iets anders
  // beweren: dat is het geval waarin iemand een bestand van naam heeft veranderd.
  const beweerd = bestand.type.trim().toLowerCase();
  if (beweerd && beweerd.split("/")[0] !== mimeGroep(gevonden.soort)) {
    return {
      ok: false,
      reden: `"${bestand.naam}" wordt aangeboden als ${beweerd} maar is in werkelijkheid ${gevonden.mime}.`,
    };
  }
  return { ok: true, mime: gevonden.mime };
}

/** De mime-hoofdgroep die bij een soort hoort. `afbeelding` heet in mime-land `image`. */
export function mimeGroep(soort: BestandSoort): string {
  return soort === "afbeelding" ? "image" : soort;
}

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/** Wat het `accept`-attribuut van de bestandskiezer moet zeggen, per soort. */
export function accepteert(soort: BestandSoort): string {
  return VINGERAFDRUKKEN.filter((v) => v.soort === soort)
    .map((v) => v.mime)
    .join(",");
}

export function leesbareGrootte(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${mb(bytes)} MB`;
}
