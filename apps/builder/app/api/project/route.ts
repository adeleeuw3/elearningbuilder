/**
 * GET  /api/project        de lijst met bewaarde modules
 * POST /api/project        { id?, titel, doc } — bewaart en geeft de regel terug
 *
 * `id` mag ontbreken: dan is het een nieuwe module en delen wij het id uit. Een client die zijn
 * eigen id verzint komt niet langs `isGeldigId`.
 */
import { NextResponse } from "next/server";
import { isGeldigId, nieuwId } from "../../../lib/opslag";
import { schijfOpslag } from "../../../lib/opslag-schijf";
import type { ApiFout } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ projecten: await schijfOpslag.lijstProjecten() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fout("De aanvraag bevatte geen geldige JSON.", "ongeldige_invoer", 400);
  }
  const invoer = body as { id?: unknown; titel?: unknown; doc?: unknown };
  if (invoer.doc === undefined) {
    return fout("Er zat geen document bij de aanvraag.", "ongeldige_invoer", 400);
  }
  if (invoer.id !== undefined && !isGeldigId(invoer.id)) {
    return fout("Ongeldig project-id.", "ongeldige_invoer", 400);
  }

  const id = isGeldigId(invoer.id) ? invoer.id : nieuwId();
  const titel = typeof invoer.titel === "string" ? invoer.titel : "";
  const regel = await schijfOpslag.bewaarProject(id, titel, invoer.doc);
  return NextResponse.json(regel);
}

function fout(bericht: string, code: ApiFout["code"], status: number) {
  const body: ApiFout = { fout: true, bericht, code };
  return NextResponse.json(body, { status });
}
