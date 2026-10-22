/**
 * Opslag: waar een project en zijn bestanden blijven staan.
 *
 * Dit bestand is de **pure** helft — namen, paden en identiteiten. Geen fs, geen React, zodat het
 * deel dat stil fout gaat te testen is.
 *
 * ## Waarom de naam van de auteur nooit het pad bepaalt
 *
 * Een bestandsnaam van een client is invoer van een vreemde. `../../.env`, een naam van 4 kB, een
 * NUL-byte, een naam die op Windows `CON` heet — het zijn allemaal geldige strings en allemaal
 * manieren om buiten de map te komen of het schrijven te laten ontsporen. Daarom is de naam op
 * schijf **volledig door ons bepaald**: een gegenereerd id plus de extensie die hoort bij het type
 * dat wij uit de bytes hebben vastgesteld. De naam van de auteur gaat mee als los veld, puur om te
 * tonen. Zo is padtraversal niet afgevangen maar onmogelijk.
 *
 * ## Waarom de server opnieuw keurt
 *
 * `lib/bestand.ts` keurt in de browser. Dat is comfort: de auteur krijgt meteen te horen dat zijn
 * SVG niet mag. Het is géén beveiliging — wie de pagina omzeilt en rechtstreeks POST komt daar niet
 * langs. De uploadroute doet daarom exact dezelfde controle op de bytes die hij ontvangt.
 *
 * ## Wat hier niet in zit
 *
 * Tenancy. `CLAUDE.md` §1 eist dat alle tenant-data via `withTenant` loopt; deze bouw-app kent geen
 * tenants, geen sessie en geen database. De opslag is daarom bewust achter één smalle interface
 * gezet: de schijf-implementatie is voor lokaal werken, en de R2/Postgres-implementatie is de plek
 * waar `withTenant` en de per-tenant prefix landen. Eén implementatie vervangen is dan een
 * afgebakende wissel in plaats van een operatie door de hele app.
 */

import type { BestandSoort } from "./bestand";

/** De extensie die bij een geverifieerd type hoort. Niets erbuiten wordt opgeslagen. */
export const EXTENSIE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

/** Van mime naar de soort knoop waar het bij hoort. */
export const MIME_SOORT: Record<string, BestandSoort> = {
  "image/png": "afbeelding",
  "image/jpeg": "afbeelding",
  "image/webp": "afbeelding",
  "video/mp4": "video",
  "video/webm": "video",
  "audio/mpeg": "audio",
  "audio/ogg": "audio",
  "audio/wav": "audio",
};

/** Ids die wij uitdelen: 32 hex-tekens. Alles wat hier niet aan voldoet raakt geen pad aan. */
export const ID_PATROON = /^[0-9a-f]{32}$/;

export function isGeldigId(id: unknown): id is string {
  return typeof id === "string" && ID_PATROON.test(id);
}

/**
 * De naam op schijf.
 *
 * Werpt bij een onbekend type of een ongeldig id in plaats van iets te verzinnen: een pad dat op
 * een gok is samengesteld is precies wat we hier niet willen.
 */
export function schijfnaam(id: string, mime: string): string {
  if (!isGeldigId(id)) throw new Error(`Ongeldig id: ${String(id)}`);
  const ext = EXTENSIE[mime];
  if (!ext) throw new Error(`Onbekend type voor opslag: ${mime}`);
  return `${id}.${ext}`;
}

/** Het type dat bij een opgeslagen naam hoort. `null` als de naam niet van ons kan zijn. */
export function mimeVanSchijfnaam(naam: string): string | null {
  const m = /^([0-9a-f]{32})\.([a-z0-9]+)$/.exec(naam);
  if (!m) return null;
  const gevonden = Object.entries(EXTENSIE).find(([, ext]) => ext === m[2]);
  return gevonden ? gevonden[0] : null;
}

/**
 * De naam van de auteur, alleen om te tonen.
 *
 * Wordt nergens voor een pad gebruikt, maar belandt wel in JSON en straks op een scherm. Padtekens
 * en stuurtekens eruit, en begrensd — een naam van 4 kB is geen naam.
 */
export function toonbareNaam(naam: string): string {
  const schoon = Array.from(naam)
    // Stuurtekens eruit: die horen niet in een naam en breken elke weergave die hem doorgeeft.
    .filter((c) => {
      const code = c.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join("")
    // Beide scheidingstekens: op Windows is `..\` net zo goed een uitweg als `../`.
    .replace(/[\\/]/g, "-")
    .trim();
  return schoon.length > 120 ? `${schoon.slice(0, 119)}…` : schoon || "naamloos";
}

/* -------------------------------------------------------------------- projecten */

/** Wat er van een project bewaard wordt. Bewust plat: dit gaat als JSON de opslag in. */
export interface ProjectRegel {
  id: string;
  titel: string;
  /** ISO-tijdstip; wordt bij het opslaan gezet, niet door de client aangeleverd. */
  gewijzigd: string;
  /**
   * Hoe groot de module is, voor het beheeroverzicht.
   *
   * Afgeleid bij het opsommen en niet meebewaard: dan kan het niet uit de pas lopen met het
   * document. Het kost niets, want `lijstProjecten` laadt elk project toch al om de regel te
   * kunnen lezen.
   */
  paginas?: number;
  blokken?: number;
}

/**
 * De opslag, als interface.
 *
 * Alles wat de app nodig heeft staat hier; de schijf-implementatie en straks de R2/Postgres-versie
 * vullen hetzelfde in. De app kent geen van beide.
 */
export interface Opslag {
  bewaarProject(id: string, titel: string, doc: unknown): Promise<ProjectRegel>;
  laadProject(id: string): Promise<{ regel: ProjectRegel; doc: unknown } | null>;
  lijstProjecten(): Promise<ProjectRegel[]>;
  verwijderProject(id: string): Promise<boolean>;

  /** Slaat al geverifieerde bytes op. De aanroeper heeft het type al vastgesteld. */
  bewaarBestand(id: string, mime: string, bytes: Uint8Array): Promise<void>;
  leesBestand(id: string): Promise<{ mime: string; bytes: Uint8Array } | null>;

  /**
   * Eén klein document dat niet bij een project hoort — nu alleen het profiel.
   *
   * Op schijf en niet in `localStorage`: wie de app in een andere browser opent hoort zijn eigen
   * naam en voorkeuren terug te zien. De naam is een vaste constante van de aanroeper, nooit iets
   * wat de client aanlevert; anders is het een pad dat de client kiest.
   */
  leesInstelling(naam: InstellingNaam): Promise<unknown | null>;
  bewaarInstelling(naam: InstellingNaam, doc: unknown): Promise<void>;
}

/** De documenten die los van een project bewaard worden. Een gesloten lijst, zie `Opslag`. */
export type InstellingNaam = "profiel";

/**
 * Het project-id als echte UUID.
 *
 * Op schijf zijn id's 32 hex-tekens zónder streepjes — dat is een veilige bestandsnaam en het
 * patroon waar `isGeldigId` op toetst. Het observatiedocument eist een UUID mét streepjes
 * (`SeedId`), dus zonder deze omzetting weigert de export elk project. De omzetting is verliesvrij
 * en deterministisch: het id kwam uit `crypto.randomUUID()`, alleen de streepjes waren eruit.
 */
export function alsUuid(id: string): string {
  if (!isGeldigId(id)) throw new Error(`Ongeldig id: ${String(id)}`);
  return [
    id.slice(0, 8),
    id.slice(8, 12),
    id.slice(12, 16),
    id.slice(16, 20),
    id.slice(20),
  ].join("-");
}

/**
 * Een nieuw id: 16 bytes hex, hetzelfde formaat dat `isGeldigId` afdwingt.
 *
 * Staat in de pure helft omdat de client hem ook nodig heeft: een module krijgt haar identiteit
 * zodra ze bestaat, niet pas bij het eerste bewaren. Dat id is tevens de `artifactId` waar alle
 * xAPI-IRI's aan hangen, en dus mag exporteren er niet op hoeven wachten.
 */
export function nieuwId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** De URL waarmee de app een opgeslagen bestand ophaalt. */
export function bestandUrl(id: string): string {
  if (!isGeldigId(id)) throw new Error(`Ongeldig id: ${String(id)}`);
  return `/api/bestand/${id}`;
}

/** Haalt het id terug uit zo'n URL. `null` als het er geen van ons is. */
export function idUitUrl(url: string): string | null {
  const m = /^\/api\/bestand\/([0-9a-f]{32})$/.exec(url);
  return m ? m[1]! : null;
}
