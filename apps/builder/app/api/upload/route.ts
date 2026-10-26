/**
 * POST /api/upload  (multipart/form-data: `bestand`, `soort`)
 *
 * Slaat een afbeelding, video of geluidsfragment op en geeft een URL terug.
 *
 * **De keuring gebeurt hier opnieuw.** De browser keurt ook, maar dat is comfort: wie deze route
 * rechtstreeks aanroept komt daar niet langs. Dezelfde functie, op de bytes die wij ontvangen —
 * dat is de enige controle die telt.
 */
import { NextResponse } from "next/server";
import { controleerBestand, MAX_BYTES, type BestandSoort } from "../../../lib/bestand";
import { zonderMetadata } from "../../../lib/metadata";
import { bestandUrl, EXTENSIE, toonbareNaam } from "../../../lib/opslag";
import { schijfOpslag } from "../../../lib/opslag-schijf";
import { nieuwId } from "../../../lib/opslag";
import type { ApiFout } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOORTEN: BestandSoort[] = ["afbeelding", "video", "audio"];

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fout("De aanvraag bevatte geen bruikbaar formulier.", "ongeldige_invoer", 400);
  }

  const soort = String(form.get("soort") ?? "") as BestandSoort;
  if (!SOORTEN.includes(soort)) {
    return fout(`Onbekende soort: ${soort}.`, "ongeldige_invoer", 400);
  }

  const veld = form.get("bestand");
  if (!(veld instanceof File)) {
    return fout("Er zat geen bestand bij de aanvraag.", "ongeldige_invoer", 400);
  }
  // Eerst de grootte, vóór we de hele inhoud in het geheugen trekken.
  if (veld.size > MAX_BYTES[soort]) {
    return fout(`Dit bestand is groter dan het maximum voor ${soort}.`, "ongeldige_invoer", 413);
  }

  const bytes = new Uint8Array(await veld.arrayBuffer());
  const uitslag = controleerBestand(
    { naam: veld.name, type: veld.type, grootte: bytes.byteLength },
    bytes,
    soort,
  );
  if (!uitslag.ok || !uitslag.mime || !EXTENSIE[uitslag.mime]) {
    return fout(uitslag.reden ?? "Dit bestandstype wordt niet opgeslagen.", "ongeldige_invoer", 415);
  }

  /*
   * De metadata eruit vóór het opslaan.
   *
   * De browser hercodeert een afbeelding op een canvas en verliest daarbij alles wat geen pixel
   * is. Maar dat is de browser, en die is comfort — net als de typecontrole hierboven. Zonder deze
   * regel kwam een PNG met een `tEXt`-blok er aan de andere kant uit met precies dezelfde bytes,
   * en bij een telefoonfoto zit daar de GPS-locatie in. Die gaat zo het exportpakket in, naar het
   * LMS van een klant.
   *
   * Lukt het strippen niet — onbekend formaat, of een structuur die we niet kunnen volgen — dan
   * blijven de bytes zoals ze zijn. Een bestand halverwege doorsnijden is erger dan metadata laten
   * staan.
   */
  const schoon = zonderMetadata(bytes, uitslag.mime);

  const id = nieuwId();
  await schijfOpslag.bewaarBestand(id, uitslag.mime, schoon.bytes);

  return NextResponse.json({
    id,
    url: bestandUrl(id),
    mime: uitslag.mime,
    grootte: schoon.bytes.byteLength,
    naam: toonbareNaam(veld.name),
  });
}

function fout(bericht: string, code: ApiFout["code"], status: number) {
  const body: ApiFout = { fout: true, bericht, code };
  return NextResponse.json(body, { status });
}
