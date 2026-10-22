/**
 * GET  /api/profiel  → het bewaarde profiel (leeg als er nog niets is)
 * PUT  /api/profiel  → bewaart het profiel
 *
 * Op schijf en niet in de browser, zodat je naam en voorkeuren meegaan als je de app ergens anders
 * opent. Er zit geen inlog omheen: deze app heeft er geen, en net doen alsof zou betekenen dat de
 * volgende die hierop bouwt denkt dat er autorisatie is waar die er niet is.
 */
import { NextResponse } from "next/server";
import { LEEG_PROFIEL, ProfielSchema, leesProfiel } from "../../../lib/profiel";
import { schijfOpslag } from "../../../lib/opslag-schijf";
import type { ApiFout } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ruw = await schijfOpslag.leesInstelling("profiel");
  return NextResponse.json(ruw === null ? LEEG_PROFIEL : leesProfiel(ruw));
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fout("De aanvraag bevatte geen geldige JSON.", "ongeldig_json", 400);
  }

  const uit = ProfielSchema.safeParse(body);
  if (!uit.success) {
    return fout(
      `Dit profiel klopt niet: ${uit.error.issues[0]?.path.join(".") ?? "onbekend veld"}.`,
      "ongeldige_invoer",
      400,
    );
  }

  await schijfOpslag.bewaarInstelling("profiel", uit.data);
  return NextResponse.json(uit.data);
}

function fout(bericht: string, code: ApiFout["code"], status: number) {
  const body: ApiFout = { fout: true, bericht, code };
  return NextResponse.json(body, { status });
}
