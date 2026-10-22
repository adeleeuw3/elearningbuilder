/**
 * POST /api/media/haal  { url, soort }
 *
 * Haalt de bytes van een gekozen kandidaat op en geeft ze door aan de browser.
 *
 * **Waarom via de server.** De browser mag deze bestanden niet zelf ophalen: de CDN's van deze
 * bronnen staan geen cross-origin-verzoeken toe, en een `<img>` die wél laadt levert geen bytes op
 * die we kunnen keuren. De server haalt ze op achter `haalVeilig` — de SSRF-poort uit `CLAUDE.md`
 * §6 — en stuurt ze door.
 *
 * **Waarom niet meteen opslaan.** Verleidelijk, want de server heeft de bytes al. Maar de
 * EXIF-strip zit in de browser: `verwerkBestand` haalt een afbeelding door een canvas en schrijft
 * alleen de pixels terug. Hier opslaan zou die stap overslaan, en dan draagt een foto van een
 * stockbron alsnog zijn metadata mee het pakket in. Eén gekeurde route voor alle bestanden, of het
 * er nu een van je eigen schijf is of een van Pexels.
 */
import { NextResponse } from "next/server";
import { MAX_BYTES, type BestandSoort } from "../../../../lib/bestand";
import { haalVeilig, MEDIA_HOSTS } from "../../../../lib/veilige-url";
import type { ApiFout } from "../../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOORTEN: BestandSoort[] = ["afbeelding", "video", "audio"];

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fout("De aanvraag bevatte geen geldige JSON.", "ongeldig_json", 400);
  }

  const invoer = body as { url?: unknown; soort?: unknown };
  if (typeof invoer.url !== "string") {
    return fout("Er zat geen adres bij de aanvraag.", "ongeldige_invoer", 400);
  }
  const soort = invoer.soort as BestandSoort;
  if (!SOORTEN.includes(soort)) {
    return fout(`Onbekende soort: ${String(invoer.soort)}.`, "ongeldige_invoer", 400);
  }

  const uit = await haalVeilig(invoer.url, MEDIA_HOSTS, MAX_BYTES[soort]);
  if (!uit.ok) {
    return fout(uit.reden, "ongeldige_invoer", 400);
  }

  // De bytes gaan door zoals ze zijn; de keuring en het hercoderen gebeuren in de browser en
  // daarna nog een keer in `/api/upload`. Het content-type gaat mee als hint, niet als bewijs —
  // die kop komt van de andere kant en `controleerBestand` kijkt naar de bytes zelf.
  return new Response(uit.bytes as BodyInit, {
    headers: {
      "Content-Type": uit.mime || "application/octet-stream",
      "Content-Length": String(uit.bytes.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

function fout(bericht: string, code: ApiFout["code"], status: number) {
  const body: ApiFout = { fout: true, bericht, code };
  return NextResponse.json(body, { status });
}
