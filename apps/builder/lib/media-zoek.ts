/**
 * Beeld en video zoeken bij externe bronnen, en hun antwoorden op één vorm brengen.
 *
 * Puur en los van React en van `fetch`: de route doet het netwerk, dit bestand doet de vertaling.
 * Dat is met opzet, want dit is de laag die stil scheef gaat — een provider die zijn veldnaam
 * wijzigt levert geen foutmelding op maar een kandidaat zonder plaatje, en zoiets zie je pas als
 * een auteur er tegenaan loopt.
 *
 * **Waarom deze bronnen.** Pexels en Pixabay geven een licentie die downloaden én commercieel
 * hergebruiken toestaat; hun bestanden mogen dus in het exportpakket en werken daar offline.
 * YouTube is er alleen om te embedden: hun voorwaarden verbieden downloaden, dus een YouTube-keuze
 * wordt een externe video en géén bestand — de pagina waar hij op staat heeft dan internet nodig.
 *
 * **Waarom geen Google Afbeeldingen.** Er bestaat geen API die het recht geeft die resultaten te
 * downloaden en te herdistribueren. De beelden zijn van derden en deze pakketten gaan naar het LMS
 * van een klant; dat zou verspreiding van andermans werk zijn.
 */

export type Bron = "pexels" | "pixabay" | "youtube";

/** Wat je zoekt. `externe-video` is een embed en levert nooit een bestand op. */
export type Zoeksoort = "afbeelding" | "video" | "externe-video";

export interface Kandidaat {
  /** Uniek over bronnen heen: `<bron>:<id>`. Dubbele resultaten vallen hierop weg. */
  id: string;
  bron: Bron;
  soort: Zoeksoort;
  titel: string;
  /** Klein plaatje voor het keuzevenster. Altijd een afbeelding, ook bij een video. */
  voorbeeld: string;
  /**
   * Waar de bytes staan. Afwezig bij een externe video: die halen we niet op, en een veld dat er
   * wél staat maar niet gebruikt mag worden nodigt uit om het toch te gebruiken.
   */
  bestandUrl?: string;
  /** De pagina bij de bron. Voor de bronvermelding en om te kunnen nakijken wat je pakt. */
  paginaUrl: string;
  maker: string;
  makerUrl?: string;
  /** Onder welke voorwaarden dit gebruikt mag worden. Gaat mee de bronvermelding in. */
  licentie: string;
  breedte?: number;
  hoogte?: number;
  seconden?: number;
  /** Voorstel voor de alt-tekst. De auteur moet hem nalopen; zie de mediazoeker. */
  alt?: string;
  /** Alleen bij YouTube: waar de embed naar wijst. */
  videoId?: string;
}

/** Hoeveel kandidaten er per gevraagd item getoond worden. */
export const KEUZES = 5;

/* ------------------------------------------------------------------------ Pexels */

interface PexelsFoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt: string | null;
  src: Record<string, string>;
}

export function uitPexelsFotos(json: unknown): Kandidaat[] {
  const fotos = (json as { photos?: PexelsFoto[] })?.photos ?? [];
  return fotos.filter(Boolean).map((f) => ({
    id: `pexels:${f.id}`,
    bron: "pexels" as const,
    soort: "afbeelding" as const,
    titel: f.alt?.trim() || `Foto van ${f.photographer}`,
    voorbeeld: f.src?.medium ?? f.src?.small ?? f.src?.tiny ?? "",
    // `large` en niet `original`: origineel is bij Pexels regelmatig 5000px breed en tientallen
    // megabytes, en dat is voor een scherm in een LMS verspilling die de cursist moet downloaden.
    bestandUrl: f.src?.large2x ?? f.src?.large ?? f.src?.original,
    paginaUrl: f.url,
    maker: f.photographer,
    makerUrl: f.photographer_url,
    licentie: "Pexels-licentie — gratis te gebruiken, ook commercieel",
    breedte: f.width,
    hoogte: f.height,
    alt: f.alt?.trim() || undefined,
  }));
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image: string;
  duration: number;
  user?: { name?: string; url?: string };
  video_files?: { link: string; file_type: string; width: number | null; height: number | null; quality: string }[];
}

/**
 * Het bruikbaarste bestand uit de lijst: mp4, zo groot mogelijk maar niet breder dan 1920.
 *
 * Pexels levert dezelfde video in vijf maten, van 640px tot 4K. De grootste pakken zou een pakket
 * van honderden megabytes opleveren voor beeld dat op geen enkel scherm scherper is.
 */
export function besteVideobestand(
  bestanden: PexelsVideo["video_files"] = [],
  maxBreedte = 1920,
): string | undefined {
  const mp4 = bestanden.filter((b) => b?.link && b.file_type === "video/mp4");
  const passend = mp4.filter((b) => (b.width ?? 0) <= maxBreedte);
  const lijst = passend.length > 0 ? passend : mp4;
  return lijst.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.link;
}

export function uitPexelsVideos(json: unknown): Kandidaat[] {
  const videos = (json as { videos?: PexelsVideo[] })?.videos ?? [];
  return videos
    .filter(Boolean)
    .map((v) => {
      const bestandUrl = besteVideobestand(v.video_files);
      const maker = v.user?.name ?? "Pexels";
      return {
        id: `pexels:v${v.id}`,
        bron: "pexels" as const,
        soort: "video" as const,
        titel: `Video van ${maker}`,
        voorbeeld: v.image,
        ...(bestandUrl ? { bestandUrl } : {}),
        paginaUrl: v.url,
        maker,
        ...(v.user?.url ? { makerUrl: v.user.url } : {}),
        licentie: "Pexels-licentie — gratis te gebruiken, ook commercieel",
        breedte: v.width,
        hoogte: v.height,
        seconden: v.duration,
      };
    })
    // Een kandidaat zonder bestand kan niet gekozen worden; die tonen is een knop die niets doet.
    .filter((k) => !!k.bestandUrl);
}

/* ----------------------------------------------------------------------- Pixabay */

interface PixabayFoto {
  id: number;
  pageURL: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  tags: string;
  user: string;
  imageWidth?: number;
  imageHeight?: number;
}

/** Pixabay levert zijn omschrijving als komma-lijst met trefwoorden. Daar maken we een zin van. */
export function alsZin(tags: string): string {
  const woorden = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (woorden.length === 0) return "";
  const eerste = woorden[0]!;
  return eerste.charAt(0).toUpperCase() + eerste.slice(1) + (woorden.length > 1 ? `, ${woorden.slice(1).join(", ")}` : "");
}

export function uitPixabayFotos(json: unknown): Kandidaat[] {
  const hits = (json as { hits?: PixabayFoto[] })?.hits ?? [];
  return hits.filter(Boolean).map((h) => ({
    id: `pixabay:${h.id}`,
    bron: "pixabay" as const,
    soort: "afbeelding" as const,
    titel: alsZin(h.tags) || `Foto van ${h.user}`,
    voorbeeld: h.webformatURL ?? h.previewURL,
    bestandUrl: h.largeImageURL ?? h.webformatURL,
    paginaUrl: h.pageURL,
    maker: h.user,
    licentie: "Pixabay-licentie — gratis te gebruiken, ook commercieel",
    ...(h.imageWidth ? { breedte: h.imageWidth } : {}),
    ...(h.imageHeight ? { hoogte: h.imageHeight } : {}),
    alt: alsZin(h.tags) || undefined,
  }));
}

interface PixabayVideo {
  id: number;
  pageURL: string;
  duration: number;
  tags: string;
  user: string;
  videos?: Record<string, { url: string; width: number; height: number; thumbnail: string }>;
}

export function uitPixabayVideos(json: unknown): Kandidaat[] {
  const hits = (json as { hits?: PixabayVideo[] })?.hits ?? [];
  return hits
    .filter(Boolean)
    .map((h) => {
      // `medium` is bij Pixabay rond de 1280px: scherp genoeg voor een scherm, klein genoeg voor
      // een pakket dat iemand moet downloaden.
      const gekozen = h.videos?.medium ?? h.videos?.large ?? h.videos?.small;
      return {
        id: `pixabay:v${h.id}`,
        bron: "pixabay" as const,
        soort: "video" as const,
        titel: alsZin(h.tags) || `Video van ${h.user}`,
        voorbeeld: gekozen?.thumbnail ?? "",
        ...(gekozen?.url ? { bestandUrl: gekozen.url } : {}),
        paginaUrl: h.pageURL,
        maker: h.user,
        licentie: "Pixabay-licentie — gratis te gebruiken, ook commercieel",
        ...(gekozen?.width ? { breedte: gekozen.width } : {}),
        ...(gekozen?.height ? { hoogte: gekozen.height } : {}),
        seconden: h.duration,
      };
    })
    .filter((k) => !!k.bestandUrl);
}

/* ----------------------------------------------------------------------- YouTube */

interface YoutubeItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
}

export function uitYoutube(json: unknown): Kandidaat[] {
  const items = (json as { items?: YoutubeItem[] })?.items ?? [];
  return items
    .filter((i) => !!i?.id?.videoId)
    .map((i) => {
      const videoId = i.id!.videoId!;
      const s = i.snippet ?? {};
      return {
        id: `youtube:${videoId}`,
        bron: "youtube" as const,
        soort: "externe-video" as const,
        titel: s.title ?? "Video op YouTube",
        voorbeeld: s.thumbnails?.medium?.url ?? s.thumbnails?.default?.url ?? "",
        // Bewust geen `bestandUrl`: downloaden is in strijd met de voorwaarden van YouTube.
        paginaUrl: `https://www.youtube.com/watch?v=${videoId}`,
        maker: s.channelTitle ?? "YouTube",
        licentie: "YouTube — alleen insluiten, niet downloaden",
        videoId,
      };
    });
}

/* ------------------------------------------------------------------- samenvoegen */

/**
 * Zet de lijsten om de beurt bij elkaar en houdt er `aantal` over.
 *
 * Om de beurt en niet achter elkaar: bij simpel aaneenplakken komen de eerste vijf altijd van
 * dezelfde bron, en dan zie je de andere bron nooit terwijl je er wel op wacht.
 */
export function mengEnBeperk(lijsten: Kandidaat[][], aantal: number): Kandidaat[] {
  const uit: Kandidaat[] = [];
  const gezien = new Set<string>();
  const langste = Math.max(0, ...lijsten.map((l) => l.length));
  for (let i = 0; i < langste && uit.length < aantal; i += 1) {
    for (const lijst of lijsten) {
      if (uit.length >= aantal) break;
      const k = lijst[i];
      if (!k || gezien.has(k.id)) continue;
      gezien.add(k.id);
      uit.push(k);
    }
  }
  return uit;
}

/**
 * De zoekopdracht die naar de bronnen gaat.
 *
 * Kort houden: deze bronnen zoeken op trefwoorden, niet op zinnen. Een hele alinea erin gooien
 * levert nul resultaten op, en nul resultaten ziet er hetzelfde uit als een kapotte koppeling.
 */
export function zoekterm(ruw: string, maxWoorden = 6): string {
  return ruw
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWoorden)
    .join(" ")
    .trim();
}
