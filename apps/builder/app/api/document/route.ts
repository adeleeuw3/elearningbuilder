/**
 * POST /api/document  (multipart/form-data: `bestand`)
 *
 * Leest een aangeleverd Word-document, tekstbestand of Markdown en geeft de tekst terug met zijn
 * koppen, zodat een module erop gegrond kan worden.
 *
 * **Waarom hier en niet via /api/upload.** Die route is voor beeld, video en geluid, en weigert
 * juist documenten: `isTekstDocument` houdt SVG en XML tegen omdat die scripts kunnen bevatten en
 * straks op andermans LMS draaien. Dit is het omgekeerde geval — hier wíllen we tekst, en de
 * tekst verlaat deze server nooit als bestand. Hij gaat alleen als tekens naar het model.
 *
 * **De inhoud wordt niet bewaard.** Dit antwoord gaat terug naar de browser en reist van daar mee
 * naar het genereren. Het document zelf raakt de schijf niet: er is geen reden om het handboek
 * van een klant op deze machine te laten staan nadat de module gemaakt is.
 */
import { NextResponse } from "next/server";
import { leesDocument, MAX_DOCUMENT_BYTES } from "../../../lib/document";
import { toonbareNaam } from "../../../lib/opslag";
import type { ApiFout } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface Documentantwoord {
  naam: string;
  soort: "docx" | "tekst";
  /** De tekst met markdown-koppen, klaar om mee te geven aan het genereren. */
  tekst: string;
  /** Hoeveel alinea's eruit kwamen — voor de melding aan de auteur. */
  alineas: number;
  /** Is er afgekapt op de limiet? Dan hoort de auteur dat te weten. */
  afgekapt: boolean;
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fout("De aanvraag bevatte geen bruikbaar formulier.", "ongeldige_invoer", 400);
  }

  const veld = form.get("bestand");
  if (!(veld instanceof File)) {
    return fout("Er zat geen bestand bij de aanvraag.", "ongeldige_invoer", 400);
  }
  // Eerst de grootte, vóór we de hele inhoud in het geheugen trekken.
  if (veld.size > MAX_DOCUMENT_BYTES) {
    return fout(
      `Dit bestand is groter dan ${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB.`,
      "ongeldige_invoer",
      413,
    );
  }

  const bytes = new Uint8Array(await veld.arrayBuffer());
  const uit = await leesDocument(bytes, veld.name);
  if (!uit.ok) return fout(uit.reden, "ongeldige_invoer", 415);

  const antwoord: Documentantwoord = {
    naam: toonbareNaam(veld.name),
    soort: uit.inhoud.soort,
    tekst: uit.inhoud.tekst,
    alineas: uit.inhoud.alineas.length,
    afgekapt: uit.inhoud.afgekapt,
  };
  return NextResponse.json(antwoord);
}

function fout(bericht: string, code: ApiFout["code"], status: number) {
  const body: ApiFout = { fout: true, bericht, code };
  return NextResponse.json(body, { status });
}
