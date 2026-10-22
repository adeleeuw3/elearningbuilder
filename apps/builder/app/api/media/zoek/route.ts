/**
 * POST /api/media/zoek  { term, soorten, aantal }
 *
 * Zoekt beeld en video bij externe bronnen en geeft per soort een handvol kandidaten terug.
 *
 * **De sleutels blijven hier.** Ze komen uit environment variables en gaan nooit de client in —
 * een sleutel in de browserbundel is een sleutel die iedereen heeft, en bij deze bronnen betekent
 * dat iemand anders jouw quotum opmaakt. Daarom loopt het zoeken via de server en niet
 * rechtstreeks vanuit het keuzevenster.
 *
 * **Een ontbrekende sleutel is geen fout.** Wie alleen Pexels heeft ingesteld hoort gewoon
 * Pexels-resultaten te zien. Welke bronnen meededen staat in het antwoord, zodat het venster kan
 * zeggen waar de resultaten vandaan komen — en kan zeggen dát er een bron ontbreekt in plaats van
 * stil minder te tonen.
 */
import { NextResponse } from "next/server";
import {
  KEUZES,
  mengEnBeperk,
  uitPexelsFotos,
  uitPexelsVideos,
  uitPixabayFotos,
  uitPixabayVideos,
  uitYoutube,
  zoekterm,
  type Bron,
  type Kandidaat,
  type Zoeksoort,
} from "../../../../lib/media-zoek";
import { API_HOSTS, keurUrl } from "../../../../lib/veilige-url";
import type { ApiFout } from "../../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOORTEN: Zoeksoort[] = ["afbeelding", "video", "externe-video"];
/** Een zoekopdracht mag even duren, maar niet de hele aanvraag ophouden. */
const TIJDLIMIET_MS = 8000;

export interface Zoekantwoord {
  term: string;
  /** Per gevraagde soort de kandidaten, hoogstens `KEUZES` stuks. */
  kandidaten: Record<string, Kandidaat[]>;
  /** Welke bronnen meededen. */
  bronnen: Bron[];
  /** Bronnen die niet meededen omdat hun sleutel ontbreekt. */
  ontbrekend: Bron[];
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fout("De aanvraag bevatte geen geldige JSON.", "ongeldig_json", 400);
  }

  const invoer = body as { term?: unknown; soorten?: unknown; aantal?: unknown };
  const term = zoekterm(typeof invoer.term === "string" ? invoer.term : "");
  if (!term) {
    return fout("Geef een zoekopdracht mee.", "ongeldige_invoer", 400);
  }

  const gevraagd = Array.isArray(invoer.soorten)
    ? (invoer.soorten.filter((s): s is Zoeksoort => SOORTEN.includes(s as Zoeksoort)))
    : (["afbeelding"] as Zoeksoort[]);
  if (gevraagd.length === 0) {
    return fout("Geef minstens één soort mee om te zoeken.", "ongeldige_invoer", 400);
  }
  const aantal = Math.max(1, Math.min(KEUZES, Number(invoer.aantal) || KEUZES));

  const pexels = process.env.PEXELS_API_KEY;
  const pixabay = process.env.PIXABAY_API_KEY;
  const youtube = process.env.YOUTUBE_API_KEY;

  // Welke bronnen bij déze zoekopdracht horen — niet welke sleutels er toevallig staan. Het
  // venster schrijft deze lijst onder de resultaten, en "gezocht bij YouTube" onder een rij foto's
  // is een mededeling die niet waar is.
  const stockSoort = gevraagd.includes("afbeelding") || gevraagd.includes("video");
  const youtubeSoort = gevraagd.includes("video") || gevraagd.includes("externe-video");

  const bronnen: Bron[] = [];
  const ontbrekend: Bron[] = [];
  if (stockSoort) {
    if (pexels) bronnen.push("pexels");
    else ontbrekend.push("pexels");
    if (pixabay) bronnen.push("pixabay");
    else ontbrekend.push("pixabay");
  }
  if (youtubeSoort) {
    if (youtube) bronnen.push("youtube");
    else ontbrekend.push("youtube");
  }

  if (bronnen.length === 0) {
    return fout(
      "Er is geen enkele mediabron ingesteld. Zet PEXELS_API_KEY of PIXABAY_API_KEY in .env.local — zie .env.example.",
      "geen_api_key",
      503,
    );
  }

  const kandidaten: Record<string, Kandidaat[]> = {};

  for (const soort of gevraagd) {
    const lijsten: Kandidaat[][] = [];

    if (soort === "afbeelding") {
      if (pexels) lijsten.push(await zoekPexels("v1/search", term, pexels, uitPexelsFotos));
      if (pixabay) lijsten.push(await zoekPixabay("", term, pixabay, uitPixabayFotos));
    } else if (soort === "video") {
      // Alle drie de bronnen in één lijst. Ze leveren niet hetzelfde: Pexels en Pixabay geven een
      // bestand dat mee de ZIP in gaat en offline speelt, YouTube geeft een insluiting die een
      // internetverbinding nodig heeft. Dat verschil verdwijnt hier níét — `bron` draagt het mee en
      // de kiezer zet er een waarschuwing bij. Ze apart houden zou betekenen dat je twee keer moet
      // zoeken om te zien wat er is.
      if (pexels) lijsten.push(await zoekPexels("v1/videos/search", term, pexels, uitPexelsVideos));
      if (pixabay) lijsten.push(await zoekPixabay("videos/", term, pixabay, uitPixabayVideos));
      if (youtube) lijsten.push(await zoekYoutube(term, youtube));
    } else if (youtube) {
      lijsten.push(await zoekYoutube(term, youtube));
    }

    kandidaten[soort] = mengEnBeperk(lijsten, aantal);
  }

  const antwoord: Zoekantwoord = { term, kandidaten, bronnen, ontbrekend };
  return NextResponse.json(antwoord);
}

/* --------------------------------------------------------------------- de bronnen */

/**
 * Eén provider bevragen.
 *
 * Een bron die stukgaat mag de andere niet meeslepen: dan zou een storing bij Pixabay betekenen
 * dat je ook geen Pexels-resultaten krijgt, terwijl die er gewoon zijn. Vandaar dat elke fout hier
 * een lege lijst wordt en niet een uitzondering.
 */
/**
 * Haalt JSON op bij een toegestane bron, of `null`.
 *
 * **Waarom hier gelogd wordt.** Een afgekeurde sleutel en een zoekterm zonder treffers gaven
 * allebei een lege lijst terug, en dat is precies hetzelfde beeld voor wie het gebruikt: geen
 * resultaten, geen melding, niets om op te zoeken. De status gaat daarom naar het serverlog.
 *
 * Alleen de bron en de status, nooit de URL: die draagt de sleutel in zijn querystring. Bij Pexels
 * zit hij in een header en zou hij via `headers` meelekken — vandaar dat hier niets anders van het
 * verzoek wordt geschreven dan de naam die de aanroeper meegeeft.
 */
async function haalJson(
  bron: string,
  url: string,
  headers: Record<string, string> = {},
): Promise<unknown> {
  // Ook de eigen API-adressen door de poort: dan staat er één plek waar bepaald wordt met wie
  // deze server praat, en kan er geen adres binnensluipen via een omgevingsvariabele.
  const gekeurd = keurUrl(url, API_HOSTS);
  if (!gekeurd.ok) {
    console.warn(`[media] ${bron}: adres afgekeurd — ${gekeurd.reden}`);
    return null;
  }
  try {
    const res = await fetch(gekeurd.url, {
      headers,
      signal: AbortSignal.timeout(TIJDLIMIET_MS),
    });
    if (!res.ok) {
      const uitleg =
        res.status === 401 || res.status === 403
          ? " — sleutel geweigerd"
          : res.status === 429
            ? " — limiet bereikt"
            : "";
      console.warn(`[media] ${bron}: HTTP ${res.status}${uitleg}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`[media] ${bron}: ${e instanceof Error ? e.message : "verzoek mislukt"}`);
    return null;
  }
}

async function zoekPexels(
  pad: string,
  term: string,
  sleutel: string,
  vertaal: (json: unknown) => Kandidaat[],
): Promise<Kandidaat[]> {
  const url = `https://api.pexels.com/${pad}?query=${encodeURIComponent(term)}&per_page=${KEUZES}`;
  return vertaal(await haalJson("pexels", url, { Authorization: sleutel }));
}

async function zoekPixabay(
  pad: string,
  term: string,
  sleutel: string,
  vertaal: (json: unknown) => Kandidaat[],
): Promise<Kandidaat[]> {
  // `safesearch` staat aan: dit materiaal komt in lesmateriaal terecht.
  const url =
    `https://pixabay.com/api/${pad}?key=${encodeURIComponent(sleutel)}` +
    `&q=${encodeURIComponent(term)}&per_page=${Math.max(3, KEUZES)}&safesearch=true`;
  return vertaal(await haalJson("pixabay", url));
}

async function zoekYoutube(term: string, sleutel: string): Promise<Kandidaat[]> {
  // `videoEmbeddable=true` is niet optioneel: zonder dat filter komen er video's terug die de
  // eigenaar níét laat insluiten, en die tonen als keuze levert een zwart vlak in de cursus op.
  const url =
    "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video" +
    `&videoEmbeddable=true&safeSearch=strict&maxResults=${KEUZES}` +
    `&q=${encodeURIComponent(term)}&key=${encodeURIComponent(sleutel)}`;
  return uitYoutube(await haalJson("youtube", url));
}

function fout(bericht: string, code: ApiFout["code"], status: number) {
  const body: ApiFout = { fout: true, bericht, code };
  return NextResponse.json(body, { status });
}
