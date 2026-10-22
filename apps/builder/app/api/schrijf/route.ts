/**
 * POST /api/schrijf
 *
 * Body: { opdracht, titel, huidig, context, aantal }
 * Geeft terug: { varianten } — één of meer versies van de inhoud van één knoop op het canvas.
 *
 * Meer dan één versie in één aanroep en niet `aantal` keer dezelfde aanroep: het model ziet de
 * andere versies dan terwijl het schrijft en kan er écht naast gaan staan. Los gevraagd komen er
 * `aantal` keer bijna dezelfde tekst uit, en dan valt er niets te kiezen.
 *
 * Bestaat naast /api/regenerate omdat een knoop op het canvas geen moduleSpec heeft: hij heeft een
 * eigen opdracht, en de uitvoer van de knoop ervóór als context. Dat is wat "de uitvoer van de ene
 * knoop is de invoer van de volgende" in de praktijk betekent.
 */
import { NextResponse } from "next/server";
import { ClaudeFout, callGestructureerd } from "../../../lib/claude";
import { SchrijfRequestSchema, SchrijfAntwoordSchema, type ApiFout } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `Je schrijft de inhoud van één blok in een e-learningmodule.

Regels:
- Schrijf alleen de tekst van dit blok. Geen kop, geen opsomming van wat je gaat doen, geen
  afsluitende vraag aan de lezer.
- Houd het kort: twee tot vijf zinnen, tenzij de opdracht om meer vraagt.
- Sluit aan op de tekst van het vorige blok als die meegegeven is, maar herhaal hem niet.
- Nederlands, tenzij de opdracht een andere taal vraagt.

Wordt er om meer dan één versie gevraagd, dan verschillen die versies echt: een andere invalshoek,
een ander aangrijpingspunt, een andere opbouw. Niet dezelfde tekst met andere woorden — daar valt
niets tussen te kiezen. Lever er precies zoveel als gevraagd.`;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fout("De aanvraag bevatte geen geldige JSON.", "ongeldige_invoer", 400);
  }

  const invoer = SchrijfRequestSchema.safeParse(body);
  if (!invoer.success) {
    return fout(
      `De aanvraag is onvolledig: ${invoer.error.issues[0]?.path.join(".") ?? "onbekend veld"}.`,
      "ongeldige_invoer",
      400,
    );
  }

  const { opdracht, titel, huidig, context, aantal } = invoer.data;
  const regels = [
    `Titel van het blok: ${titel || "(geen)"}`,
    "",
    `Opdracht: ${opdracht}`,
    "",
    aantal === 1
      ? "Schrijf één versie."
      : `Schrijf ${aantal} versies die duidelijk van elkaar verschillen.`,
  ];
  if (context.trim()) regels.push("", "Tekst van het vorige blok:", context.trim());
  if (huidig.trim()) regels.push("", "Wat er nu staat (herschrijf dit):", huidig.trim());

  try {
    const antwoord = await callGestructureerd({
      system: SYSTEM,
      messages: [{ role: "user", content: regels.join("\n") }],
      schema: SchrijfAntwoordSchema,
      effort: "medium",
      // Meer versies is meer tekst. Ruim genomen, want afkappen midden in een variant levert een
      // keuze op die er alleen maar slechter uitziet dan hij is.
      maxTokens: 1500 + 1500 * aantal,
    });
    // Het aantal wordt hier bewaakt en niet in het schema: structured outputs accepteert geen
    // `maxItems`. Meer dan gevraagd wordt afgekapt — wat er staat is bruikbaar. Niets terug is wél
    // een fout, want dan heeft het venster niets om te tonen.
    const varianten = antwoord.varianten.map((v) => v.trim()).filter(Boolean).slice(0, aantal);
    if (varianten.length === 0) {
      return fout("Het model leverde geen tekst op. Probeer het opnieuw.", "onbekend", 502);
    }
    return NextResponse.json({ varianten });
  } catch (e) {
    const f = e instanceof ClaudeFout ? e : null;
    return fout(
      f?.message ?? "Er ging iets onverwacht mis. Probeer het opnieuw.",
      f?.code ?? "onbekend",
      f?.code === "geen_api_key" ? 500 : 502,
    );
  }
}

function fout(bericht: string, code: ApiFout["code"], status: number) {
  const body: ApiFout = { fout: true, bericht, code };
  return NextResponse.json(body, { status });
}
